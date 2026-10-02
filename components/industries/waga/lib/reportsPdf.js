'use client'

// The WAGA compliance report, as a PDF.
//
// Built on the shared drawing surface in oxmaint/lib/pdf.js rather than a second
// one, so a table looks the same here as it does everywhere else in this
// deployment — and so a fix to page breaks is a fix in all of them. What this
// module adds is the part that is WAGA's: the brand on the header, the cover
// block that states what the document is, and the basis line, which says in
// plain words which figures came from the workbook and which the portal worked
// out. A compliance report that does not distinguish those is a report its
// reader has to take on trust.
//
// The clock is read once, by the caller, and passed in. A report generated twice
// in a minute should differ only where the data differs.

import { newDoc, TONE } from '../../oxmaint/lib/pdf'
import { ORG } from './data'

const BRAND = 'iFactory AI'

const toneOf = (t) => (t === 'ok' ? TONE.ok : t === 'warn' ? TONE.warn : t === 'bad' ? TONE.bad : undefined)

// `stats` divides the content width by however many items it is handed, so eight
// on an A4 page is a 64pt box and a truncated label. Five is the widest row that
// still reads.
const PER_ROW = 5
const inRows = (items) => {
  const out = []
  for (let i = 0; i < items.length; i += PER_ROW) out.push(items.slice(i, i + PER_ROW))
  return out
}
const drawStats = (doc, items) => {
  for (const row of inRows(items)) {
    doc.stats(row.map((s) => ({ label: s.label, value: String(s.value), tone: toneOf(s.tone) })))
  }
}

/**
 * @param title     the document's name
 * @param scopeName which slice of the estate it covers
 * @param generated an ISO string or display date, supplied by the caller
 * @param overview  headline figures, drawn on the first page
 * @param reports   the report objects from reportsData.js
 * @param persisted whether records are being stored, so the document can say
 */
export async function wagaReportPdf({
  title = 'Compliance report',
  scopeName = 'All Trial Sites',
  generated,
  overview = null,
  reports = [],
  persisted = null,
  filename,
}) {
  const doc = await newDoc({
    brand: BRAND,
    // Landscape: these are wide tables. A permit register carries ten columns,
    // and on portrait A4 the site code wraps mid-word.
    orientation: 'landscape',
    title,
    subtitle: `${ORG.name} · ${ORG.programme}`,
    meta: [
      ['Client', ORG.name],
      ['Programme', ORG.programme],
      ['Scope', scopeName],
      ['Prepared', generated],
      ['Basis', 'Imported permit workbook, plus records created in this portal'],
    ],
  })

  doc.gap(4)
  doc.para(
    'Figures headed as counts are counted from the imported workbook. Anything dated that the workbook '
    + 'did not state is worked out by the portal from the recurrence rule written on the obligation, and '
    + 'the section it appears in says so. Blank fields are blank in the source documents; the workbook is '
    + 'explicit that they are not to be filled in.',
    TONE.sub,
  )

  if (persisted === false) {
    doc.gap(6)
    doc.para(
      'No records database is configured for this deployment, so anything recorded in the portal during '
      + 'this session is not included below.',
      TONE.warn,
    )
  }

  if (overview) {
    doc.gap(10)
    doc.heading('At a glance')
    drawStats(doc, [
      { label: 'Sites', value: overview.sites },
      { label: 'Countries', value: overview.countries },
      { label: 'Permits', value: overview.permits },
      { label: 'Obligations', value: overview.obligations },
      { label: 'Limits', value: overview.limits },
      { label: 'Past due', value: overview.pastDue, tone: overview.pastDue ? 'warn' : 'ok' },
      { label: 'Open deviations', value: overview.openDeviations, tone: overview.openDeviations ? 'warn' : 'ok' },
      { label: 'Filings recorded', value: overview.filings },
      { label: 'Evidence files held', value: overview.filesHeld },
    ])
  }

  for (const r of reports) {
    doc.gap(16)
    // Enough room for the heading, its note, the figure strip and a few rows.
    // Less than this and a section opens with two rows before breaking, which
    // reads as a printing fault rather than a long table.
    doc.room(170)
    doc.heading(r.derived ? `${r.title}  (projected by the portal)` : r.title)
    if (r.note) doc.para(r.note, TONE.sub)

    if (r.stats?.length) {
      doc.gap(6)
      drawStats(doc, r.stats)
    }

    doc.gap(8)
    if (!r.rows.length) {
      doc.para('Nothing in this scope.', TONE.mute)
    } else {
      // The columns are handed over whole: `table` calls `c.value(row)` itself,
      // so the same accessor draws the screen, the PDF and the CSV.
      doc.table(
        r.columns.map((c) => ({
          header: c.header, width: c.width || 1, align: c.align, value: c.value,
        })),
        r.rows,
      )
    }
  }

  doc.gap(20)
  doc.signature('QHSE / Site Ops', 'Reviewed by')
  doc.save(filename || 'waga-compliance-report.pdf')
}
