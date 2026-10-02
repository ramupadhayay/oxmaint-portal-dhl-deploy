'use client'

// The Alert & Anomaly Register, and the workflow behind each row.
//
// SOW 7.2 defines one chain — alert raised, engineering review, condition
// validated, action determined, work order executed, outcome recorded, feedback
// into analytics — and it is the thing this PoC exists to demonstrate. The
// register is the list; the drawer is the chain, assembled from the three sheets
// that hold it.
//
// The drawer also shows what the *existing* systems recorded around the same
// moment, which is SOW 6.1 and the least obvious value in the data: the EPMS
// logged a ground-fault pre-alarm three minutes before ALT-0003, and the OEM
// platform flagged its own thermal anomaly on ALT-0002. Read one sheet at a time
// that correlation is invisible; put the rows on one timeline and it is the
// point.
//
// False positives are kept in the register and labelled, not filtered out. The
// SOW's Alert Accuracy and False Positive Rate KPIs are computed from them, and
// a register that only shows the hits cannot support either number.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toolbar, DataTable, StatusBadge, PALETTE } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { useSite } from '../lib/siteStore'
import { ALERT_ROWS, fmtDateTime, toneOf } from '../lib/data'

const { SUB, MUTE, INK, LINE, GREEN, RED } = PALETTE

const classificationTone = (c) => ({
  'True Positive': 'green', 'False Positive': 'red', Pending: 'amber',
}[c] || 'grey')

export default function Alerts() {
  const { scope, siteName } = useSite()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [severity, setSeverity] = useState('all')
  const [source, setSource] = useState('all')
  const [klass, setKlass] = useState('all')

  const rows = useMemo(() => scope(ALERT_ROWS), [scope])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((a) => (
      (severity === 'all' || a.severity === severity) &&
      (source === 'all' || a.source === source) &&
      (klass === 'all' || a.classification === klass) &&
      (!q || [a.alertId, a._asset, a.description, a.failureCode, a._failureMode].join(' ').toLowerCase().includes(q))
    ))
  }, [rows, query, severity, source, klass])

  const stats = [
    { label: 'Alerts', value: shown.length },
    { label: 'True positive', value: shown.filter((a) => a._truePositive).length, tone: 'green' },
    { label: 'False positive', value: shown.filter((a) => a._falsePositive).length, tone: 'red' },
    { label: 'Still open', value: shown.filter((a) => !/^Closed/i.test(a.status || '')).length, tone: 'amber' },
    { label: 'Led to a work order', value: shown.filter((a) => a._workOrder).length, tone: 'blue' },
  ]

  const columns = [
    { key: 'alertId', label: 'Alert', render: (a) => <span style={styles.mono}>{a.alertId}</span> },
    { key: 'timestamp', label: 'Raised', render: (a) => fmtDateTime(a.timestamp) },
    { key: '_asset', label: 'Asset', render: (a) => (
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{a._asset}</div>
        <div style={{ fontSize: 11, color: MUTE }}>{a._site}</div>
      </div>
    ) },
    { key: 'source', label: 'Source' },
    { key: 'failureCode', label: 'Failure mode', render: (a) => (
      <span><span style={styles.mono}>{a.failureCode}</span>{a._failureMode ? ` · ${a._failureMode}` : ''}</span>
    ) },
    { key: 'severity', label: 'Severity', render: (a) => <StatusBadge tone={toneOf(a.severity)}>{a.severity}</StatusBadge> },
    { key: 'classification', label: 'Classification', render: (a) => <StatusBadge tone={classificationTone(a.classification)}>{a.classification}</StatusBadge> },
    { key: 'status', label: 'Status', render: (a) => <StatusBadge>{a.status}</StatusBadge> },
  ]

  return (
    <div>
      <PageHeading
        title="Alert & Anomaly Register"
        subtitle="Every anomaly raised by the condition monitoring, its engineering review, and what it led to. Open a row for the full response chain."
      />

      <StatCards items={stats} />

      <Toolbar
        search={query} onSearch={setQuery} placeholder="Search alerts, assets, failure modes…"
        filters={[
          { label: 'Severity', value: severity, options: ['Critical', 'High', 'Medium', 'Low'], onChange: setSeverity },
          { label: 'Source', value: source, options: [...new Set(ALERT_ROWS.map((a) => a.source))], onChange: setSource },
          { label: 'Classification', value: klass, options: [...new Set(ALERT_ROWS.map((a) => a.classification).filter(Boolean))], onChange: setKlass },
        ]}
        right={siteName !== 'All Sites' ? <StatusBadge tone="blue">{siteName}</StatusBadge> : null}
      />

      <DataTable
        columns={columns}
        rows={shown}
        pageSize={12}
        onRowClick={(a) => router.push(`/portal/datacenter/alerts/${encodeURIComponent(a.alertId)}`)}
        empty="No alerts match these filters."
      />
    </div>
  )
}

// The rest moved to AlertView with the detail itself — a list screen holding
// styles for a panel it no longer renders is how dead CSS accumulates.
const styles = {
  mono: { fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 11.5, color: SUB },
}
