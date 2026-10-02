// The audit export, as a PDF.
//
// What an inspector asks for is not a screen — it is a package they can take
// away, page-numbered, dated, and complete enough to stand on its own. So this
// is a file rather than a print dialog: it can be handed over, mailed, or filed
// as the record of exactly what was produced on the day it was asked for.
//
// The pack is built in the order an inspection reads it: what was produced and
// under what scope, then the certification records, then the integrity tests
// behind them, then the audit trail. Nothing is summarised away — a pack that
// shows counts without the rows underneath is the pack that gets asked for
// again.
//
// jsPDF is imported dynamically so its ~350KB never lands in the bundle of a
// screen nobody exported from.

import { loadMark, masthead, pageFooter, clean } from './pdfBrand'

const A4 = { w: 595.28, h: 841.89 }
const M = 40
const ACCENT = [21, 34, 122]

/**
 * @param pack {
 *   title, scope: [{label, value}], generatedAt, generatedBy, org,
 *   documents: [...], tests: [...], audit: [...], note
 * }
 */
export async function auditPdf(pack) {
  const [{ jsPDF }, mark] = await Promise.all([import('jspdf'), loadMark()])
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  let y = M
  let page = 1

  const footer = () => pageFooter(doc, {
    width: A4.w, height: A4.h, margin: M, page,
    left: `HEPA certification audit package - generated ${pack.generatedAt}`,
  })

  const room = (need) => {
    if (y + need < A4.h - 50) return
    footer()
    doc.addPage()
    page += 1
    y = M
  }

  const heading = (text) => {
    room(40)
    y += 6
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11.5)
    doc.setTextColor(...ACCENT)
    doc.text(clean(text), M, y)
    doc.setTextColor(0)
    y += 6
    doc.setDrawColor(220, 226, 236)
    doc.line(M, y, A4.w - M, y)
    y += 13
  }

  // A table drawn by hand rather than pulled in from a plugin: four columns of
  // fixed width, a grey header row, and a rule under each line. Enough for
  // every table in the pack, and no second dependency.
  const table = (columns, rows, empty) => {
    const widths = columns.map((c) => c.w)
    const x0 = M

    const header = () => {
      doc.setFillColor(244, 247, 251)
      doc.rect(x0, y - 9, A4.w - M * 2, 15, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(90, 104, 128)
      let x = x0 + 4
      columns.forEach((c, i) => { doc.text(clean(c.label.toUpperCase()), x, y); x += widths[i] })
      doc.setTextColor(0)
      y += 13
    }

    header()

    if (!rows.length) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8.5)
      doc.setTextColor(140)
      doc.text(clean(empty || 'No records in scope.'), x0 + 4, y + 2)
      doc.setTextColor(0)
      y += 18
      return
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    for (const r of rows) {
      room(20)
      // A page break inside a table leaves the next page without column names,
      // so the header is redrawn whenever one happens.
      if (y === M) { y += 4; header(); doc.setFont('helvetica', 'normal'); doc.setFontSize(8) }
      let x = x0 + 4
      columns.forEach((c, i) => {
        const raw = clean(c.get(r))
        // Truncated to the column rather than allowed to run into the next
        // one, which is what makes a hand-drawn table look broken.
        const text = doc.splitTextToSize(raw, widths[i] - 8)[0] || ''
        doc.text(text, x, y)
        x += widths[i]
      })
      y += 11
      doc.setDrawColor(238, 242, 247)
      doc.line(x0, y - 4, A4.w - M, y - 4)
    }
    y += 6
  }

  y = masthead(doc, mark, {
    title: pack.title,
    subtitle: pack.org,
    org: `Generated ${pack.generatedAt}`,
    right: `by ${pack.generatedBy}`,
    width: A4.w, margin: M, accent: ACCENT,
  })

  heading('Scope of this package')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  for (const s of pack.scope) {
    room(16)
    doc.setTextColor(120)
    doc.text(clean(`${s.label}:`), M, y)
    doc.setTextColor(0)
    doc.text(clean(String(s.value)), M + 150, y)
    y += 13
  }
  y += 4

  if (pack.note) {
    room(40)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(120)
    for (const line of doc.splitTextToSize(clean(pack.note), A4.w - M * 2)) {
      room(14)
      doc.text(line, M, y)
      y += 10
    }
    doc.setTextColor(0)
    y += 6
  }

  // ── certification records ───────────────────────────────────────────────
  heading(`Certification records (${pack.documents.length})`)
  // Retention had 20pt, which truncated "2032" to "20" — a year that reads as a
  // count. Every column is now wide enough for its longest real value.
  table([
    { label: 'Document', w: 76, get: (r) => r.documentRef },
    { label: 'Filter', w: 56, get: (r) => r.relatedRecordId },
    { label: 'Cleanroom', w: 104, get: (r) => r.cleanroomName },
    { label: 'Stage', w: 100, get: (r) => r.stage },
    { label: 'Signed by', w: 72, get: (r) => r.signedBy || 'unsigned' },
    { label: 'Cert due', w: 66, get: (r) => r.nextCertDueOn || '-' },
    { label: 'Retained to', w: 40, get: (r) => (r.retentionExpiry || '').slice(0, 4) },
  ], pack.documents)

  // ── integrity tests ─────────────────────────────────────────────────────
  heading(`DOP/PAO integrity tests (${pack.tests.length})`)
  table([
    { label: 'Test', w: 62, get: (r) => r.testId },
    { label: 'Filter', w: 58, get: (r) => r.filterId },
    { label: 'Date', w: 68, get: (r) => r.date },
    { label: 'Points', w: 42, get: (r) => r.testPoints },
    { label: 'Penetration', w: 68, get: (r) => r.penetration },
    { label: 'Result', w: 46, get: (r) => r.result },
    { label: 'Technician', w: 78, get: (r) => r.technicianName },
    { label: 'Record', w: 92, get: (r) => r.lockStatus },
  ], pack.tests)

  // ── audit trail ─────────────────────────────────────────────────────────
  heading(`Audit trail (${pack.audit.length} entries)`)
  table([
    { label: 'When', w: 108, get: (r) => String(r.at || '').replace('T', ' ').slice(0, 19) },
    { label: 'Document', w: 78, get: (r) => r.documentRef },
    { label: 'Action', w: 128, get: (r) => r.action },
    { label: 'Actor', w: 88, get: (r) => r.actor },
    { label: 'Meaning', w: 105, get: (r) => r.meaning || '-' },
  ], pack.audit, 'No audit entries have been recorded in this scope during this session.')

  footer()
  const name = `HEPA-audit-package-${pack.generatedAt.slice(0, 10)}.pdf`
  doc.save(name)
  return name
}
