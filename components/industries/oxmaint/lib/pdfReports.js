// The documents the portal produces.
//
// Each one is what a person actually needs to keep: a completed check they can
// file against an asset, and a management report someone reads away from the
// screen. They are built from the same records the screens show, so a PDF
// cannot disagree with the page it was exported from.

import { newDoc, TONE } from './pdf'
import { ORG, USER, fmtDate, money } from './data'

const resultTone = (r) => (r === 'Fail' ? TONE.bad : r === 'Pass' ? TONE.ok : TONE.warn)

/**
 * A completed checklist run.
 *
 * The failed lines are given their own section rather than being left to be
 * spotted among forty passes. "3 failed" at the top of a page nobody scrolls is
 * how a failed check gets filed and forgotten.
 */
export async function checklistRunPdf(run, items = []) {
  const doc = await newDoc({
    title: 'Inspection Checklist Report',
    subtitle: `${run.checklist_name} - ${ORG.organization_name}`,
    meta: [
      ['Checklist', run.checklist_name],
      ['Category', run.category || '-'],
      ['Asset', run.asset_name || 'Not asset-specific'],
      ['Completed by', run.completed_by_name || USER.name],
      ['Completed', fmtDate(run.completed_date)],
      ['Result', `${run.result} - ${run.score}%`],
    ],
  })

  doc.heading('Summary')
  doc.stats([
    { label: 'Items', value: String(run.items_total ?? items.length) },
    { label: 'Passed', value: String(run.items_passed ?? 0), tone: TONE.ok },
    { label: 'Failed', value: String(run.items_failed ?? 0), tone: (run.items_failed ? TONE.bad : TONE.ok) },
    { label: 'Not applicable', value: String(run.items_na ?? 0) },
    { label: 'Score', value: `${run.score ?? 0}%`, tone: resultTone(run.result) },
  ])

  if (run.items_failed > 0) {
    doc.heading(`Failed items (${run.items_failed})`)
    doc.table(
      [
        { header: '#', width: 0.5, value: (_, i) => String(i) },
        { header: 'Check', width: 6, value: (f) => (typeof f === 'string' ? f : f.text) },
        { header: 'Note', width: 5, value: (f) => (typeof f === 'string' ? '-' : (f.note || '-')) },
      ],
      (run.failures || []).map((f, i) => ({ ...(typeof f === 'string' ? { text: f } : f), _i: i + 1 })),
    )
  }

  if (items.length) {
    doc.heading('All items')
    doc.table(
      [
        { header: 'Check', width: 8, value: (r) => r.text },
        { header: 'Result', width: 2, value: (r) => r.result, tone: (r) => (r.result === 'Fail' ? TONE.bad : r.result === 'Pass' ? TONE.ok : TONE.mute) },
        { header: 'Note', width: 4, value: (r) => r.note || '-' },
      ],
      items,
    )
  }

  if (run.note) {
    doc.heading('Notes')
    doc.para(run.note)
  }

  doc.signature(run.completed_by_name || USER.name, 'Completed by')
  doc.save(`checklist-${String(run.checklist_name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${String(run.completed_date || '').slice(0, 10)}.pdf`)
}

/**
 * The management report behind the Reports screen.
 *
 * `sections` is what the caller is already showing, so the document is the page
 * rather than a second account of it.
 */
export async function managementReportPdf({ title, subtitle, stats = [], sections = [] }) {
  const doc = await newDoc({
    title,
    subtitle: subtitle || ORG.organization_name,
    meta: [
      ['Organisation', ORG.organization_name],
      ['Prepared by', USER.name],
      ['Prepared', fmtDate(new Date().toISOString())],
      ['Scope', subtitle || 'All sites'],
    ],
  })

  if (stats.length) {
    doc.heading('Headline figures')
    doc.stats(stats)
  }

  sections.forEach((s) => {
    doc.heading(s.title)
    if (s.note) doc.para(s.note)
    if (s.columns && s.rows) doc.table(s.columns, s.rows)
    if (s.fields) doc.fields(s.fields)
  })

  doc.signature(USER.name, USER.role_name)
  doc.save(`${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`)
}

export { money }
