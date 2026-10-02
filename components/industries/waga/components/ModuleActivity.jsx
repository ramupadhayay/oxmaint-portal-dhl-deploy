'use client'

// What was recorded on this screen — shown on the screen it was recorded on.
//
// The portal's history lived in one place, Source & Verification, two screens
// away from where the work happens. Somebody who logged a reading on the limits
// screen or closed an isolation on LOTO saw a count go up and nothing else: not
// the value, not the remark, not who or when. This is that history, narrowed to
// one module and put where it was made.
//
// Most rows come from the append-only audit trail, so a screen shows the same
// record Source & Verification and our internal usage screen read. Two kinds
// come from their own records instead, because their audit line drops what the
// person typed: a reading's remark, and a filing's evidence, files and note. A
// screen passes those records in, and the audit lines they would duplicate are
// left out of its module's list below.

import { Section, DataTable, StatusBadge } from '../lib/kit'
import { TwoLine } from './cells'
import { useCreated } from '../lib/store'
import { useSite } from '../lib/siteStore'
import { fmtDate } from '../lib/data'

/** The audit actions each module writes, as its screens log them. */
export const MODULE_ACTIONS = {
  // Readings come from their records, which carry the remark.
  parameters: [/^Deviation raised \(auto\)$/, /^Limit added$/],
  deviations: [/^Deviation raised/, /^Deviation →/],
  incidents: [/^Incident reported$/, /^Incident →/],
  loto: [/^LOTO opened$/, /^LOTO closed out$/],
  'pre-task': [/^JSA submitted$/],
  training: [/^Training completed$/],
  permits: [/^Permit added$/, /^Renewal submitted$/, /^Renewal received$/],
  // Filings come from their records, which carry the evidence and the note.
  requirements: [/^Obligation added$/],
  calendar: [],
  sites: [/^Added site$/],
  team: [/^Team member added$/],
}

export const newestFirst = (a, b) => String(b.at || '').localeCompare(String(a.at || ''))

/** One module's lines from the audit trail, shaped for the table. */
export function auditRowsFor(audit, module) {
  const patterns = MODULE_ACTIONS[module] || []
  return audit
    .filter((a) => patterns.some((re) => re.test(String(a.action || ''))))
    .map((a) => ({
      at: a.at || a._createdAt, action: a.action, subject: a.subject, detail: a.detail, actor: a.actor,
      // Written since the trail learned which site it was about. A line from
      // before that carries none, and a line with none is organisation-wide —
      // the same rule every other table in the portal scopes by.
      siteId: a.siteId || '',
    }))
}

/** Monitoring readings, with their value, judgment and remark. */
export function readingRows(readings) {
  return readings.map((r) => ({
    at: r._createdAt,
    siteId: r.siteId || '',
    action: r.judgment === 'Breach' ? 'Reading — breach' : 'Reading logged',
    subject: `${r.parameter} · ${r.scope}`,
    detail: [
      `${r.value}${r.unit ? ` ${r.unit}` : ''}${r.limitValue != null ? ` against ${r.limitValue}` : ''} — ${r.judgment}`,
      r.readingDate && `read ${fmtDate(r.readingDate)}`,
      r.note && `Note: ${r.note}`,
    ].filter(Boolean).join(' · '),
    actor: r.readBy || 'QHSE / Site Ops',
  }))
}

/** Filings, with the date filed, the due date, the evidence and the note. */
export function filingRows(filings) {
  return filings.map((f) => ({
    at: f._createdAt,
    siteId: f.siteId || '',
    action: 'Filed obligation',
    subject: `${f.title || f.requirementId}${f.siteCode ? ` (${f.siteCode})` : ''}`,
    detail: [
      f.filedDate && `filed ${fmtDate(f.filedDate)}`,
      f.dueDate && `due ${fmtDate(f.dueDate)}`,
      f.evidenceRef && `evidence: ${f.evidenceRef}`,
      f.attachmentCount ? `${f.attachmentCount} file${f.attachmentCount === 1 ? '' : 's'}` : '',
      f.note && `Note: ${f.note}`,
    ].filter(Boolean).join(' · '),
    actor: f.filedBy,
  }))
}

// The instant, not the date — two entries on one afternoon need their order.
export const fmtAt = (iso) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

// Colour by what happened, not by module: something that needs attention reads
// amber wherever it appears, something finished reads green.
const toneOf = (action = '') => (
  /breach|raised|reported|opened|exceed/i.test(action) ? 'amber'
    : /closed|filed|completed|received|added|logged/i.test(action) ? 'green'
      : 'blue'
)

/**
 * @param module    key into MODULE_ACTIONS — which audit lines belong here
 * @param readings  waga_reading records, when the screen shows readings
 * @param filings   waga_filing records, when the screen shows filings
 * @param rows      any further rows already shaped { at, action, subject, detail, actor }
 */
export default function ModuleActivity({
  module,
  readings = [],
  filings = [],
  rows = [],
  title = 'Recorded in the portal',
  empty = 'Nothing has been recorded on this screen yet.',
  pageSize = 8,
}) {
  const audit = useCreated('waga_audit')
  const { scope, scopeName, level } = useSite()

  // The scope the rest of the screen is under applies here too. It did not, and
  // a site added in the portal showed another site's filing under a register
  // that was otherwise empty — the one row on the page was the one row that did
  // not belong to it.
  const all = scope([
    ...auditRowsFor(audit, module),
    ...readingRows(readings),
    ...filingRows(filings),
    ...rows,
  ]).sort(newestFirst)

  return (
    <Section
      title={`${title} (${all.length})`}
      right={<span style={{ fontSize: 11.5, color: '#94a3b8' }}>Newest first · who, when and what was entered</span>}
    >
      <DataTable
        rows={all}
        pageSize={pageSize}
        empty={level === 'all' ? empty : `${empty} Scope: ${scopeName}.`}
        columns={[
          {
            key: 'at', label: 'When', width: 170,
            render: (a) => <span style={{ fontSize: 11.5, color: '#475569', fontVariantNumeric: 'tabular-nums' }}>{fmtAt(a.at)}</span>,
          },
          { key: 'action', label: 'Action', width: 200, render: (a) => <StatusBadge tone={toneOf(a.action)}>{a.action}</StatusBadge> },
          { key: 'subject', label: 'Detail', render: (a) => <TwoLine top={a.subject} bottom={a.detail || ''} /> },
          { key: 'actor', label: 'By', width: 140, render: (a) => <span style={{ fontSize: 12, color: '#334155' }}>{a.actor || '—'}</span> },
        ]}
      />
    </Section>
  )
}
