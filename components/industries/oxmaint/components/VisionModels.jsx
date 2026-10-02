'use client'

// The models running on the estate.
//
// A vision deployment is not one model with a version number — it is a handful
// of narrow ones, each trained on its own problem, each with its own accuracy
// and its own cost per frame. Showing that is the difference between "we have AI
// vision" and "here is what it catches, how well, and what it costs to run".
//
// The two columns that matter most are the ones a demo usually leaves out.
// Recall is what the model MISSES, and it is lower than precision on every model
// here because that is how these are tuned in a plant: an alert nobody trusts is
// worse than a quiet one. And status says which models are actually raising
// alerts — a model in shadow is scoring and being reviewed, not acting.
//
// Coverage is counted from the camera estate rather than written down, so a
// model cannot claim cameras that are not watching anything it detects.

import { useState } from 'react'
import { Card, Section, StatusBadge, DataTable, PALETTE } from '../lib/kit'
import { MODELS, STATUS_TONE, viewsFor, auditModels, modelSummary } from '../lib/visionModels'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN, AMBER } = PALETTE

export default function VisionModels({ cameras = [] }) {
  const [open, setOpen] = useState(null)
  const summary = modelSummary(cameras)
  const audit = auditModels()
  const drift = audit.claimedButNeverRaised.length + audit.raisedByNoModel.length

  const rows = MODELS.map((m) => ({
    ...m,
    _views: viewsFor(m),
    _cameras: summary.camerasFor(m),
  }))

  return (
    <Section
      title="Vision models"
      right={(
        <span style={{ fontSize: 11.5, color: MUTE }}>
          {summary.production} in production · {summary.shadow} shadow · {summary.retraining} retraining
        </span>
      )}
    >
      <Card style={{ marginBottom: 12, padding: '11px 14px', background: '#f8fafc' }}>
        <p style={{ margin: 0, fontSize: 12, color: SUB, lineHeight: 1.6 }}>
          Each model is defined by the detections it owns, and its camera count is taken from the
          estate above rather than stated — a model cannot claim coverage the cameras do not give it.
          <b style={{ color: INK }}> Precision, recall and latency below are illustrative figures for
          models of this shape, not measurements from a validation run.</b> This build has no
          validation set, and a number invented here would be the most convincing thing on the page.
        </p>
      </Card>

      {/* A quiet disagreement between the model list and the detection
          catalogue is the failure this section is most likely to develop, so it
          is reported rather than left for somebody to notice. */}
      {drift > 0 && (
        <Card style={{ marginBottom: 12, padding: '11px 14px', background: '#fffbeb', borderColor: '#fde68a' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#92400e', lineHeight: 1.6 }}>
            <b>The model list and the detection catalogue disagree.</b>
            {audit.claimedButNeverRaised.length > 0 && (
              <> Claimed but never raised: {audit.claimedButNeverRaised.join(', ')}.</>
            )}
            {audit.raisedByNoModel.length > 0 && (
              <> Raised with no model behind it: {audit.raisedByNoModel.join(', ')}.</>
            )}
          </p>
        </Card>
      )}

      <div style={styles.figures}>
        <Figure k="Models deployed" v={summary.total} note={`${summary.detections} distinct detections`} />
        <Figure k="Raising alerts" v={summary.production} note="the rest are shadow or retraining" tone={GREEN} />
        <Figure k="Mean precision" v={`${summary.meanPrecision.toFixed(1)}%`} note="production models" />
        <Figure k="Worst-case frame cost" v={`${summary.worstCaseMs} ms`} note="every production model on one frame" tone={AMBER} />
      </div>

      <DataTable
        rows={rows}
        pageSize={10}
        onRowClick={(m) => setOpen(open?.id === m.id ? null : m)}
        empty="No models configured."
        columns={[
          {
            key: 'name',
            label: 'Model',
            render: (m) => (
              <span>
                <span style={{ display: 'block', fontWeight: 700, color: ACCENT }}>{m.name}</span>
                <span style={{ display: 'block', fontSize: 11, color: MUTE }}>{m.family} · v{m.version}</span>
              </span>
            ),
          },
          {
            key: 'detects',
            label: 'Detects',
            sortValue: (m) => m.detects.length,
            render: (m) => (
              <span style={{ fontSize: 12, color: SUB, lineHeight: 1.5 }}>{m.detects.join(' · ')}</span>
            ),
          },
          {
            key: '_cameras',
            label: 'Cameras',
            align: 'right',
            render: (m) => (
              <span>
                <span style={{ display: 'block', fontWeight: 700 }}>{m._cameras}</span>
                <span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>
                  {m._views.length} view{m._views.length === 1 ? '' : 's'}
                </span>
              </span>
            ),
          },
          {
            key: 'precision',
            label: 'Precision',
            align: 'right',
            render: (m) => <Metric value={m.precision} />,
          },
          {
            key: 'recall',
            label: 'Recall',
            align: 'right',
            render: (m) => <Metric value={m.recall} />,
          },
          {
            key: 'latencyMs',
            label: 'Latency',
            align: 'right',
            render: (m) => <span style={{ fontSize: 12, color: SUB, whiteSpace: 'nowrap' }}>{m.latencyMs} ms</span>,
          },
          { key: 'backbone', label: 'Backbone', render: (m) => <span style={{ fontSize: 11.5, color: SUB }}>{m.backbone}</span> },
          {
            key: 'status',
            label: 'Status',
            render: (m) => <StatusBadge tone={STATUS_TONE[m.status] || 'grey'}>{m.status}</StatusBadge>,
          },
        ]}
      />

      {open && (
        <Card style={{ marginTop: 12, padding: '14px 16px', borderColor: '#c7d2fe' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: INK }}>{open.name}</div>
              <div style={{ fontSize: 11.5, color: MUTE, marginTop: 2 }}>
                {open.family} · v{open.version} · {open.backbone}
              </div>
            </div>
            <StatusBadge tone={STATUS_TONE[open.status] || 'grey'}>{open.status}</StatusBadge>
          </div>

          <p style={{ margin: '0 0 12px', fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>{open.note}</p>

          <div style={styles.detailGrid}>
            <Figure k="Input" v={open.input} />
            <Figure k="Training set" v={open.frames} />
            <Figure k="Last trained" v={open.trained} />
            <Figure k="Latency" v={`${open.latencyMs} ms/frame`} />
            <Figure k="Precision" v={`${open.precision}%`} note="of alerts, correct" />
            <Figure k="Recall" v={`${open.recall}%`} note="of real events, caught" />
          </div>

          <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${LINE}` }}>
            <div style={styles.k}>Runs on</div>
            <div style={{ fontSize: 12.5, color: INK, marginTop: 4 }}>
              {open._views?.length
                ? `${viewsFor(open).join(' · ')} — ${summary.camerasFor(open)} camera${summary.camerasFor(open) === 1 ? '' : 's'}`
                : 'No camera on this estate watches anything this model detects.'}
            </div>
          </div>
        </Card>
      )}
    </Section>
  )
}

// Recall below 90 is worth seeing, because it is the number that says what gets
// missed — and it is the one a reader skims past when it is styled like the rest.
function Metric({ value }) {
  const weak = value < 90
  return (
    <span style={{ fontSize: 12.5, fontWeight: 700, color: weak ? '#b45309' : INK, whiteSpace: 'nowrap' }}>
      {value}%
    </span>
  )
}

function Figure({ k, v, note, tone }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={styles.k}>{k}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: tone || INK, marginTop: 3 }}>{v}</div>
      {note && <div style={{ fontSize: 10.5, color: MUTE, marginTop: 2 }}>{note}</div>}
    </div>
  )
}

const styles = {
  figures: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))',
    gap: 12, padding: '12px 14px', borderRadius: 10, background: '#f8fafc',
    marginBottom: 12,
  },
  detailGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12,
  },
  k: {
    fontSize: 10, fontWeight: 800, color: MUTE,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
}
