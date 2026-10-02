'use client'

// One inspection report, on its own page.
//
// Its own component rather than the generic RecordView because two kinds of row
// land here and only one of them is in a static list: the generated reports
// come from the PM library, and the ones raised in the portal come from the
// store. A record page that reads only the static list shows "nothing here with
// that reference" for the inspection the user just completed, which is the
// worst possible moment to say it.
//
// The other reason is the sheet. A created inspection carries the technician's
// answer to every line, and a label/value list cannot show that — the filled
// checklist *is* the record.

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import PageHeading from '../components/PageHeading'
import { ProductStyles, RecordCard, DetailColumns, DetailColumn, KV, EmptyState, Icons } from '../components/product'
import { Section, StatusBadge, ActionButton, PALETTE } from '../lib/kit'
import { useInspectionStore } from '../lib/store'
import { INSPECTION_REPORTS, shapeInspection, inspectionSheet } from '../lib/inspections'
import InspectionConduct from './InspectionConduct'
import { fmtDate, toneOf } from '../lib/data'

const { SUB, MUTE, INK, LINE, ACCENT } = PALETTE

const resultTone = (r) => ({
  Passed: 'green', 'Passed with observations': 'amber', Failed: 'red', 'In progress': 'blue',
}[r] || 'grey')

const scoreColour = (n) => (n >= 80 ? '#059669' : n >= 60 ? '#d97706' : '#dc2626')

const ANSWER = {
  pass: { label: 'Pass', bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d' },
  fail: { label: 'Fail', bg: '#fef2f2', border: '#fecaca', color: '#b91c1c' },
  na: { label: 'Not applicable', bg: '#f8fafc', border: '#e2e8f0', color: '#64748b' },
}

export default function InspectionView() {
  const { id } = useParams()
  const router = useRouter()
  const { created, ready, create } = useInspectionStore()
  const [conducting, setConducting] = useState(false)

  const reportId = decodeURIComponent(String(id))
  const back = () => router.push('/portal/datacenter/inspection-reports')

  const report = useMemo(() => {
    const mine = created.find((r) => r.reportId === reportId)
    if (mine) return shapeInspection(mine)
    return INSPECTION_REPORTS.find((r) => r.reportId === reportId) || null
  }, [created, reportId])

  if (!report) {
    return (
      <div>
        <PageHeading back={{ label: 'Inspection Reports', onClick: back }} title="Inspection" />
        <EmptyState
          icon={Icons.clipboard}
          title={ready ? 'Nothing here with that reference.' : 'Looking for that inspection…'}
          body={ready ? `${reportId} is not in the inspection register.` : 'Reading the records raised in this portal.'}
        />
        {ready && <div style={{ marginTop: 14 }}><ActionButton onClick={back}>Back to the register</ActionButton></div>}
      </div>
    )
  }

  // A created inspection carries the technician's own answers. A generated one
  // has none, so the sheet is reconstructed from its task and result — the same
  // record, filled — and flagged illustrative below so it is never read as a
  // line somebody signed.
  const items = (report._items && report._items.length) ? report._items : inspectionSheet(report)
  const illustrative = !(report._items && report._items.length)
  const gradedCount = items.length
  const failedCount = items.filter((it) => it.response === 'fail').length
  const passedCount = items.filter((it) => it.response === 'pass').length
  const readings = items.filter((it) => it.value)

  // Conducting files a fresh completed inspection for this asset — the same
  // sheet, this time with the technician's own answers — and opens it.
  const handleConduct = async (record) => {
    const newId = `INS-${Date.now().toString(36).slice(-5).toUpperCase()}`
    const saved = await create({ reportId: newId, ...record })
    setConducting(false)
    router.push(`/portal/datacenter/inspection-reports/${encodeURIComponent((saved && saved.reportId) || newId)}`)
  }

  if (conducting) {
    return <InspectionConduct report={report} onBack={() => setConducting(false)} onSubmit={handleConduct} />
  }

  return (
    <div>
      <ProductStyles />

      <PageHeading
        back={{ label: 'Inspection Reports', onClick: back }}
        title={`${report.reportId} — ${report._asset}`}
        subtitle={`${report.task} · inspected ${fmtDate(report.date)}${report.inspector ? ` by ${report.inspector}` : ''}`}
        right={(
          <>
            <ActionButton onClick={() => setConducting(true)}>Conduct inspection</ActionButton>
            <ActionButton variant="ghost" onClick={() => window.print()}>Print</ActionButton>
          </>
        )}
      />

      <div style={styles.summary}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          <StatusBadge tone={resultTone(report.result)}>{report.result}</StatusBadge>
          <StatusBadge tone={toneOf(report.criticality)}>{report.criticality}</StatusBadge>
          {report._created && <StatusBadge tone="blue">Raised in this portal</StatusBadge>}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: scoreColour(report.score), letterSpacing: '-0.02em', lineHeight: 1 }}>
            {report.score}%
          </div>
          <div style={{ fontSize: 11, color: MUTE, marginTop: 4 }}>
            {gradedCount ? `${passedCount} of ${gradedCount} lines passed${failedCount ? ` · ${failedCount} failed` : ''}` : `${report.score} / 100`}
          </div>
        </div>
      </div>

      <Section title="Record">
        <DetailColumns>
          <DetailColumn icon={Icons.box} title="Asset">
            <KV label="Reference" value={report.assetId} />
            <KV label="Class" value={report.assetClass} />
            <KV label="Site" value={report._site} />
            <KV label="Location" value={report._location} />
          </DetailColumn>

          <DetailColumn icon={Icons.clipboard} title="What was done">
            <KV label="Task" value={report.task} />
            <KV label="PM reference" value={report.taskId} />
            <KV label="Standard" value={report.standard || '—'} />
            <KV label="Frequency" value={report.frequency} />
          </DetailColumn>

          <DetailColumn icon={Icons.user} title="Who and when">
            <KV label="Inspected" value={fmtDate(report.date)} />
            <KV label="Inspector" value={report.inspector || '—'} />
            <KV label="Team" value={report.team || '—'} />
            <KV label="Result" value={report.result} tone={report._failed ? '#dc2626' : undefined} />
          </DetailColumn>
        </DetailColumns>
      </Section>

      <Section title="Findings">
        <p style={{ margin: 0, fontSize: 13, color: report.findings ? '#334155' : MUTE, lineHeight: 1.65 }}>
          {report.findings || 'No findings recorded — the inspection passed clean.'}
        </p>
      </Section>

      {readings.length > 0 && (
        <Section title="Readings taken">
          <div style={styles.readGrid}>
            {readings.map((it) => (
              <div key={it.itemId} style={{ ...styles.readCard, borderColor: it.response === 'fail' ? '#fecaca' : LINE, background: it.response === 'fail' ? '#fef2f2' : '#fff' }}>
                <div style={styles.readLabel}>{it.text}</div>
                <div style={{ ...styles.readValue, color: it.response === 'fail' ? '#b91c1c' : INK }}>{it.value}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title={`The sheet — ${items.length} line${items.length === 1 ? '' : 's'}`}
        right={illustrative ? <span style={{ fontSize: 10.5, color: MUTE }}>reconstructed from the task &amp; result · illustrative</span> : <span style={{ fontSize: 10.5, color: MUTE }}>as signed</span>}>
        {items.length > 0 && (
          <div style={{ display: 'grid', gap: 8 }}>
            {items.map((item, i) => {
              const a = ANSWER[item.response]
              return (
                <div key={item.itemId} style={{ ...styles.line, borderColor: a?.border || LINE, background: a?.bg || '#fff' }}>
                  <span style={styles.num}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.lineText}>
                      {item.text}
                      {item.critical && <span style={styles.criticalDot} title="On a class the client rates Critical" />}
                    </div>
                    <div style={styles.lineMeta}>{item.assetClass || item.section || item.responseType}</div>
                    {item.value && <div style={styles.lineValue}>Measured: <strong>{item.value}</strong></div>}
                    {item.note && <div style={styles.lineNote}>{item.note}</div>}
                  </div>
                  <span style={{ ...styles.verdict, color: a?.color || MUTE, borderColor: a?.border || LINE }}>
                    {a?.label || 'Unanswered'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Section>

    </div>
  )
}

const styles = {
  summary: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 16, flexWrap: 'wrap', marginBottom: 18,
    background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: '14px 16px',
  },
  line: {
    display: 'flex', alignItems: 'flex-start', gap: 11,
    padding: '11px 13px', borderRadius: 10, border: '1px solid',
  },
  num: {
    width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: '#eef2ff', color: ACCENT,
    fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  lineText: { fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.45 },
  lineMeta: { fontSize: 11, color: MUTE, marginTop: 3 },
  lineValue: { fontSize: 12, color: SUB, marginTop: 5 },
  lineNote: { fontSize: 12, color: '#334155', marginTop: 5, lineHeight: 1.55 },
  criticalDot: { display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#dc2626', marginLeft: 7, verticalAlign: 'middle' },
  verdict: {
    fontSize: 10.5, fontWeight: 700, background: '#fff', border: '1px solid',
    borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap', flexShrink: 0,
  },
  readGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 },
  readCard: { border: '1px solid', borderRadius: 10, padding: '11px 13px', background: '#fff' },
  readLabel: { fontSize: 12, color: SUB, lineHeight: 1.4 },
  readValue: { fontSize: 14.5, fontWeight: 800, color: INK, marginTop: 5, fontVariantNumeric: 'tabular-nums' },
}
