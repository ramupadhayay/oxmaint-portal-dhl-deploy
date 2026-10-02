'use client'

// PDF export for the Reports module — the same drawn (not screenshotted)
// document the CMMS portal files, on this portal's data.
//
// The drawing surface is shared: `newDoc` in the CMMS kit is generic — a header,
// a stats row, a table, a signature block — and re-using it means the two
// portals' reports come out looking like one product rather than two. What is
// this portal's is the content: the packs each Reports tab hands over, built
// from the same figures the screen shows so the document and the screen can
// never disagree.

import { newDoc, TONE } from '../../oxmaint/lib/pdf'

export { TONE }

/**
 * Render a Reports tab to a filed PDF.
 *
 * `stats` is the headline KPI row; `sections` are `{ title, note?, columns, rows }`
 * tables. `date` is passed in rather than read here, because a module that reads
 * the wall clock is one a server render would flag — the caller stamps it in the
 * click handler where the clock is fair game.
 */
export async function reportsPdf({ title, subtitle, date, meta = [], stats = [], sections = [] }) {
  const doc = await newDoc({
    title,
    subtitle,
    meta: meta.length ? meta : [
      ['Programme', 'Data Center Predictive Maintenance PoC'],
      ['Prepared', date || ''],
      ['Scope', subtitle || 'All sites'],
      ['Basis', 'Computed from the portal’s own records'],
    ],
  })

  if (stats.length) {
    doc.heading('Headline figures')
    doc.stats(stats)
  }

  sections.forEach((s) => {
    doc.heading(s.title)
    if (s.note) doc.para(s.note)
    if (s.columns && s.rows?.length) doc.table(s.columns, s.rows)
    else if (s.columns) doc.para('No rows for this cut in the current scope.', TONE.mute)
  })

  doc.signature('QHSE / Site Operations', 'Reviewed by')
  const slug = String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-')
  doc.save(`${slug}-${(date || '').replace(/[^0-9]/g, '') || 'report'}.pdf`)
}
