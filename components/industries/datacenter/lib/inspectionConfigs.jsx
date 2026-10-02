// The record pages behind the Inspection module's three registers.
//
// RecordView reads CONFIGS[section] to render one row on its own page, and
// registers.jsx merges these in. They live here rather than beside the list
// screens because the list screens are the product's card layout and share
// nothing with a config but the data: keeping the two apart stops a change to
// one silently rewriting the other, and keeps registers.jsx importing from a
// module that imports nothing back.

'use client'

import { StatusBadge, PALETTE } from './kit'
import { Mono, Wrap } from '../components/cells'
import {
  INSPECTION_REPORTS, INSPECTION_REMINDERS, INCIDENT_ROWS,
} from './inspections'
import { fmtDate, toneOf } from './data'

const { MUTE } = PALETTE

const resultTone = (r) => ({
  Passed: 'green', 'Passed with observations': 'amber', Failed: 'red',
}[r] || 'grey')

const dueTone = (s) => ({
  Overdue: 'red', 'Due this week': 'amber', 'Due this month': 'blue', Scheduled: 'grey',
}[s] || 'grey')

// The asset cell all three registers share: the machine, and under it the site,
// because "CRAH Unit 01" on its own does not say which of six buildings.
const assetCell = (width) => (r) => (
  <div style={{ minWidth: 0 }}>
    <div style={{ fontWeight: 600 }}><Wrap width={width}>{r._asset}</Wrap></div>
    <div style={{ fontSize: 11, color: MUTE }}>{r._site}</div>
  </div>
)

export const INSPECTION_CONFIGS = {
  // ── 1. Inspection Reports ──────────────────────────────────────────────
  'inspection-reports': {
    title: 'Inspection Reports',
    subtitle: 'What has been inspected, by whom, and what they found.',
    rows: INSPECTION_REPORTS,
    idOf: (r) => r.reportId,
    recordTitle: (r) => `${r.reportId} — ${r._asset}`,
    recordSubtitle: (r) => `${r.task} · inspected ${fmtDate(r.date)} by ${r.inspector}`,
    pageSize: 15,
    search: ['reportId', '_asset', 'task', 'inspector', 'assetClass'],
    filters: [
      { label: 'Result', field: 'result' },
      { label: 'Criticality', field: 'criticality' },
      { label: 'Inspector', field: 'inspector' },
    ],
    stats: (r) => [
      { label: 'Reports', value: r.length },
      { label: 'Passed', value: r.filter((x) => x.result === 'Passed').length, tone: 'green' },
      { label: 'With observations', value: r.filter((x) => x.result === 'Passed with observations').length, tone: 'amber' },
      { label: 'Failed', value: r.filter((x) => x._failed).length, tone: r.some((x) => x._failed) ? 'red' : 'green' },
      { label: 'Average score', value: r.length ? Math.round(r.reduce((n, x) => n + x.score, 0) / r.length) : '—' },
    ],
    columns: [
      { key: 'reportId', label: 'Report', render: (r) => <Mono>{r.reportId}</Mono> },
      { key: 'date', label: 'Inspected', render: (r) => fmtDate(r.date) },
      { key: '_asset', label: 'Asset', render: assetCell(230) },
      { key: 'task', label: 'Task', render: (r) => <Wrap width={230}>{r.task}</Wrap> },
      { key: 'criticality', label: 'Criticality', render: (r) => <StatusBadge tone={toneOf(r.criticality)}>{r.criticality}</StatusBadge> },
      { key: 'inspector', label: 'Inspector' },
      { key: 'score', label: 'Score', align: 'right', render: (r) => <strong>{r.score}</strong> },
      { key: 'result', label: 'Result', render: (r) => <StatusBadge tone={resultTone(r.result)}>{r.result}</StatusBadge> },
    ],
    facts: (r) => [
      ['Asset', `${r.assetId} — ${r._asset}`],
      ['Class', r.assetClass],
      ['Site', r._site],
      ['Location', r._location],
      ['Criticality', <StatusBadge key="c" tone={toneOf(r.criticality)}>{r.criticality}</StatusBadge>],
      ['Task', r.task],
      ['PM reference', r.taskId],
      ['Standard', r.standard],
      ['Frequency', r.frequency],
      ['Inspected', fmtDate(r.date)],
      ['Inspector', r.inspector],
      ['Team', r.team],
      ['Score', `${r.score} / 100`],
      ['Result', <StatusBadge key="r" tone={resultTone(r.result)}>{r.result}</StatusBadge>],
      ['Findings', r.findings || 'No findings recorded — the inspection passed clean.'],
    ],
  },

  // ── 2. Inspection Reminder ─────────────────────────────────────────────
  'inspection-reminder': {
    title: 'Inspection Reminder',
    subtitle: "What is due, and what has slipped past its date. Each is scheduled on its own task's frequency from the PM library.",
    rows: INSPECTION_REMINDERS,
    idOf: (r) => r.reminderId,
    recordTitle: (r) => `${r.reminderId} — ${r._asset}`,
    recordSubtitle: (r) => `${r.task} · due ${fmtDate(r.dueDate)}`,
    pageSize: 15,
    search: ['reminderId', '_asset', 'task', 'assignedTo', 'assetClass'],
    filters: [
      { label: 'Status', field: 'status' },
      { label: 'Frequency', field: 'frequency' },
      { label: 'Criticality', field: 'criticality' },
    ],
    stats: (r) => [
      { label: 'Reminders', value: r.length },
      { label: 'Overdue', value: r.filter((x) => x._overdue).length, tone: r.some((x) => x._overdue) ? 'red' : 'green' },
      { label: 'Due this week', value: r.filter((x) => !x._overdue && x._daysAway <= 7).length, tone: 'amber' },
      { label: 'On critical assets', value: r.filter((x) => x.criticality === 'Critical').length, tone: 'red' },
      { label: 'Scheduled', value: r.filter((x) => x.status === 'Scheduled').length },
    ],
    columns: [
      // Sorted on the offset rather than the date string, so "12 days late"
      // and "in 3 days" order the way the column reads.
      { key: 'dueDate', label: 'Due', sortValue: (r) => r._daysAway, render: (r) => (
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{fmtDate(r.dueDate)}</div>
          <div style={{ fontSize: 11, color: r._overdue ? '#b91c1c' : MUTE }}>
            {r._overdue ? `${Math.abs(r._daysAway)} days late` : `in ${r._daysAway} days`}
          </div>
        </div>
      ) },
      { key: '_asset', label: 'Asset', render: assetCell(230) },
      { key: 'task', label: 'Task', render: (r) => <Wrap width={230}>{r.task}</Wrap> },
      { key: 'frequency', label: 'Frequency', render: (r) => <StatusBadge tone="blue">{r.frequency}</StatusBadge> },
      { key: 'criticality', label: 'Criticality', render: (r) => <StatusBadge tone={toneOf(r.criticality)}>{r.criticality}</StatusBadge> },
      { key: 'assignedTo', label: 'Assigned to', render: (r) => <Wrap width={200}>{r.assignedTo}</Wrap> },
      { key: 'status', label: 'Status', render: (r) => <StatusBadge tone={dueTone(r.status)}>{r.status}</StatusBadge> },
    ],
    // The record page is ReminderView, not the generic one — a reminder is a
    // decision and the facts that decide it do not fit a label/value list. These
    // stay as the register's own description of a row, and as what the generic
    // page would fall back to if the special-case registration ever went away.
    facts: (r) => [
      ['Asset', `${r.assetId} — ${r._asset}`],
      ['Class', r.assetClass],
      ['Site', `${r._site}${r._location ? ` · ${r._location}` : ''}`],
      ['Criticality', <StatusBadge key="c" tone={toneOf(r.criticality)}>{r.criticality}</StatusBadge>],
      ['Task', r.task],
      ['PM reference', r.taskId],
      ['Standard', r.standard],
      ['Frequency', `${r.frequency} — every ${r._intervalDays} days`],
      ['Due', fmtDate(r.dueDate)],
      ['Status', <StatusBadge key="s" tone={dueTone(r.status)}>{r.status}</StatusBadge>],
      ['Next occurrence after this', fmtDate(r._nextAfter)],
      ['Last done', r._last
        ? `${fmtDate(r._last.date)} — ${r._last.result}, scored ${r._last.score} by ${r._last.inspector}`
        : 'No completed report against this task on this asset'],
      ['Inspection history on the asset', r._adherence
        ? `${r._adherence.passed} of ${r._adherence.total} passed clean, average score ${r._adherence.averageScore}`
        : '—'],
      ['Client PM compliance log', r._pmLog
        ? `${r._pmLog.onTime} on time, ${r._pmLog.late} late, of ${r._pmLog.logged} logged`
        : 'This asset is not on the compliance sheet'],
      ['Assigned to', r.assignedTo],
      ['Escalates to', `${r._escalation.role}${r._escalation.raci ? ` (${r._escalation.raci})` : ''}`],
      ['Response SLA', r._escalation.sla],
      [`${r._redundancy?.path || 'Site'} redundancy`, r._redundancy
        ? `${r._redundancy.value} — ${r._redundancy.canIsolate ? 'the asset can be isolated for the window' : 'isolating it drops a live path'}`
        : '—'],
      ['Failure modes on the asset', r._failureModes.map((f) => `${f.code} ${f.mode}`).join(', ') || '—'],
      ['Past failures', r._incidents.length
        ? r._incidents.map((i) => `${i.incidentId} — ${i.description}`).join(' · ')
        : 'None on the client’s pre-PoC incident sheet'],
    ],
  },

  // ── 3. Incident Reports ────────────────────────────────────────────────
  incidents: {
    title: 'Incident Reports',
    subtitle: 'Past failures, their root cause and how each was found. The absence of historical condition data is itself a risk, and this is the baseline the monitoring is measured against.',
    rows: INCIDENT_ROWS,
    idOf: (i) => i.incidentId,
    recordTitle: (i) => `${i.incidentId} — ${i._asset}`,
    recordSubtitle: (i) => `${fmtDate(i.date)} · ${i._site}`,
    search: ['incidentId', '_asset', 'assetId', 'description', 'rootCause', 'detectionMethod'],
    filters: [
      { label: 'Detection', field: 'detectionMethod' },
      { label: 'Criticality', field: '_criticality' },
    ],
    stats: (r) => [
      { label: 'Incidents', value: r.length },
      {
        label: 'Customer-facing',
        value: r.filter((i) => i._customerImpact).length,
        tone: r.some((i) => i._customerImpact) ? 'red' : 'green',
        note: 'redundancy held elsewhere',
      },
      { label: 'On critical assets', value: r.filter((i) => i._criticality === 'Critical').length, tone: 'amber' },
      { label: 'Found by alarm', value: r.filter((i) => /alarm/i.test(i.detectionMethod || '')).length },
    ],
    columns: [
      { key: 'incidentId', label: 'Incident', render: (i) => <Mono>{i.incidentId}</Mono> },
      { key: 'date', label: 'Date', render: (i) => fmtDate(i.date) },
      { key: '_asset', label: 'Asset', render: assetCell(220) },
      { key: 'description', label: 'Failure', render: (i) => <Wrap width={270}>{i.description}</Wrap> },
      { key: 'rootCause', label: 'Root cause', render: (i) => <Wrap width={210}>{i.rootCause}</Wrap> },
      { key: 'detectionMethod', label: 'Detected by', render: (i) => <Wrap width={180}>{i.detectionMethod}</Wrap> },
      { key: 'downtime', label: 'Downtime', render: (i) => <Wrap width={120}>{i.downtime}</Wrap> },
      { key: 'customerImpact', label: 'Customer impact', render: (i) => (
        <StatusBadge tone={i._customerImpact ? 'red' : 'green'}>{i.customerImpact}</StatusBadge>
      ) },
    ],
    facts: (i) => [
      ['Asset', `${i.assetId} — ${i._asset}`],
      ['Class', i._assetClass],
      ['Site', i._site],
      ['Criticality', i._criticality && <StatusBadge key="c" tone={toneOf(i._criticality)}>{i._criticality}</StatusBadge>],
      ['Date', fmtDate(i.date)],
      ['Failure', i.description],
      ['Root cause', i.rootCause],
      ['Detection method', i.detectionMethod],
      ['Downtime', i.downtime],
      ['Customer-facing impact', <StatusBadge key="x" tone={i._customerImpact ? 'red' : 'green'}>{i.customerImpact}</StatusBadge>],
    ],
  },
}
