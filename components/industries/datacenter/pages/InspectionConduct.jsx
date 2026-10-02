'use client'

// Conduct an inspection — the step-through a technician works after pressing
// Start / Conduct, mirroring the product's own conduct flow rather than a record
// page. Each line of the class-appropriate sheet is answered Pass / Fail / N-A,
// readings are captured against their limit, and the result and score are graded
// live from the answers. Submitting files a completed inspection through the
// store and opens it — a real record with the technician's own answers behind
// it, not a reconstruction.

import { useMemo, useState } from 'react'
import { Card, ActionButton, StatusBadge, PALETTE } from '../lib/kit'
import { inspectionTemplate } from '../lib/inspections'

const { INK, SUB, MUTE, LINE, ACCENT, GREEN, AMBER, RED } = PALETTE

const CHOICES = [
  { key: 'pass', label: 'Pass', on: { bg: '#f0fdf4', bd: '#86efac', fg: '#15803d' } },
  { key: 'fail', label: 'Fail', on: { bg: '#fef2f2', bd: '#fca5a5', fg: '#b91c1c' } },
  { key: 'na', label: 'N/A', on: { bg: '#f1f5f9', bd: '#cbd5e1', fg: '#475569' } },
]

export default function InspectionConduct({ report, onBack, onSubmit }) {
  const lines = useMemo(() => inspectionTemplate(report.assetClass), [report.assetClass])
  const [ans, setAns] = useState({})          // itemId -> { response, value, note }
  const [inspector, setInspector] = useState(report.inspector || '')
  const [saving, setSaving] = useState(false)

  const set = (id, patch) => setAns((p) => ({ ...p, [id]: { ...(p[id] || {}), ...patch } }))

  const answered = lines.filter((l) => ans[l.itemId]?.response).length
  const graded = lines.filter((l) => { const r = ans[l.itemId]?.response; return r === 'pass' || r === 'fail' })
  const failed = graded.filter((l) => ans[l.itemId]?.response === 'fail')
  const noted = lines.filter((l) => (ans[l.itemId]?.note || '').trim())
  const score = graded.length ? Math.round(((graded.length - failed.length) / graded.length) * 100) : 0
  const result = failed.length ? 'Failed' : noted.length ? 'Passed with observations' : 'Passed'
  const allAnswered = answered === lines.length

  const submit = async () => {
    setSaving(true)
    try {
      const items = lines.map((l) => {
        const a = ans[l.itemId] || {}
        return {
          itemId: l.itemId, text: l.text, responseType: l.responseType, critical: l.critical,
          response: a.response || 'na',
          value: l.isReading && a.value ? `${a.value}${l.unit ? ` ${l.unit}` : ''} (limit ${l.limit})` : null,
          note: (a.note || '').trim() || null,
        }
      })
      const finding = failed.length
        ? `${failed.length} line${failed.length === 1 ? '' : 's'} failed on ${report._asset}; corrective work order to be raised.`
        : noted.length ? `${noted.length} observation${noted.length === 1 ? '' : 's'} recorded; within tolerance this cycle.` : null
      await onSubmit({
        assetId: report.assetId,
        checklistId: report.taskId && report.taskId !== '—' ? report.taskId : null,
        task: report.task,
        items,
        status: 'Completed',
        inspector: inspector.trim() || 'Site Engineering',
        team: report.team || 'Site Engineering',
        date: new Date().toISOString().slice(0, 10),
        findings: finding,
      })
    } finally { setSaving(false) }
  }

  return (
    <div>
      <button onClick={onBack} style={styles.crumb}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
        Back to inspection
      </button>

      <div style={styles.grid}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card>
            <div style={{ fontSize: 15, fontWeight: 800, color: INK }}>Conduct inspection</div>
            <div style={{ fontSize: 12.5, color: SUB, marginTop: 3, overflowWrap: 'anywhere' }}>{report._asset}</div>
            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              <Row k="Task" v={report.task} />
              <Row k="Standard" v={report.standard || '—'} />
              <Row k="Site" v={report._site || '—'} />
              <Row k="Location" v={report._location || '—'} />
            </div>
          </Card>

          <Card>
            <div style={styles.h}>Live result</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <StatusBadge tone={result === 'Failed' ? 'red' : result === 'Passed with observations' ? 'amber' : 'green'}>{result}</StatusBadge>
              <div style={{ fontSize: 26, fontWeight: 800, color: score >= 80 ? '#059669' : score >= 60 ? '#d97706' : '#dc2626', lineHeight: 1 }}>{score}%</div>
            </div>
            <div style={styles.progressTrack}><div style={{ ...styles.progressFill, width: `${lines.length ? (answered / lines.length) * 100 : 0}%` }} /></div>
            <div style={{ fontSize: 11.5, color: MUTE }}>{answered} of {lines.length} answered · {graded.length - failed.length} passed · {failed.length} failed</div>
            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>Inspector</label>
              <input value={inspector} onChange={(e) => setInspector(e.target.value)} placeholder="Your name" style={styles.input} />
            </div>
          </Card>

          <ActionButton variant="success" disabled={saving || answered === 0} full onClick={submit}>
            {saving ? 'Filing…' : allAnswered ? 'Submit inspection' : `Submit (${lines.length - answered} unanswered → N/A)`}
          </ActionButton>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lines.map((l, i) => {
            const a = ans[l.itemId] || {}
            return (
              <Card key={l.itemId} style={{ borderColor: a.response === 'fail' ? '#fecaca' : a.response ? '#d1fae5' : LINE }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={styles.num}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.4 }}>
                      {l.text}{l.critical && <span style={styles.dot} title="Critical class" />}
                    </div>
                    <div style={{ fontSize: 11, color: MUTE, marginTop: 2 }}>{l.responseType}{l.limit ? ` · limit ${l.limit}` : ''}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {CHOICES.map((ch) => {
                      const on = a.response === ch.key
                      return (
                        <button key={ch.key} onClick={() => set(l.itemId, { response: ch.key })}
                          style={{ ...styles.choice, ...(on ? { background: ch.on.bg, borderColor: ch.on.bd, color: ch.on.fg } : null) }}>
                          {ch.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {l.isReading && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input value={a.value || ''} onChange={(e) => set(l.itemId, { value: e.target.value.replace(/[^\d.]/g, '') })} placeholder="reading" style={{ ...styles.input, width: 96 }} />
                      <span style={{ fontSize: 12, color: MUTE }}>{l.unit}</span>
                    </div>
                  )}
                  <input value={a.note || ''} onChange={(e) => set(l.itemId, { note: e.target.value })} placeholder="Note (optional)" style={{ ...styles.input, flex: 1, minWidth: 140 }} />
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Row({ k, v }) {
  return (
    <div style={{ display: 'flex', gap: 10, fontSize: 12.5 }}>
      <span style={{ color: MUTE, flex: '0 0 78px' }}>{k}</span>
      <span style={{ color: INK, fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere' }}>{v}</span>
    </div>
  )
}

const styles = {
  crumb: { display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12, padding: '5px 10px 5px 7px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 8, color: '#15227a', cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: 'minmax(240px,1fr) minmax(360px,2fr)', gap: 14, alignItems: 'start' },
  h: { fontSize: 13, fontWeight: 800, color: '#15227a', marginBottom: 10 },
  num: { width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: '#eef2ff', color: ACCENT, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  dot: { display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#dc2626', marginLeft: 7, verticalAlign: 'middle' },
  choice: { padding: '5px 10px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 8, color: SUB, cursor: 'pointer' },
  progressTrack: { height: 7, borderRadius: 999, background: '#eef2f7', margin: '10px 0 6px', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, background: GREEN, transition: 'width .25s ease' },
  input: { boxSizing: 'border-box', padding: '8px 10px', fontSize: 12.5, fontFamily: 'inherit', color: INK, background: '#fff', borderRadius: 8, outline: 'none', borderStyle: 'solid', borderWidth: 1, borderColor: LINE },
}
