// The maintenance report, as a document somebody can file or hand round.
//
// Drawn rather than screenshotted, for the same reasons the job sheet is: a
// canvas capture gives a PDF you cannot select text in, that carries the sidebar
// and the filter bar into a document, and that is unreadable at anything but the
// window width it was taken at.
//
// Every figure is passed in by the screen that is showing it rather than
// recomputed here. That is the point: the report and the page it was printed
// from cannot disagree, because there is only one set of arithmetic and this
// file does none of it.
//
// jsPDF is imported dynamically so its ~350KB stays out of the bundle of the
// nineteen screens that export nothing.

const A4 = { w: 595.28, h: 841.89 }
const M = 46
const INK = [15, 23, 42]
const SUB = [71, 85, 105]
const MUTE = [148, 163, 184]
const LINE = [226, 232, 240]
const RULE = [241, 245, 249]
const ACCENT = [21, 34, 122]

// The bar palette, matching the screen's so a reader moving between the two is
// looking at the same colours in the same order.
const BARS = [
  [21, 34, 122], [53, 71, 184], [100, 120, 216],
  [148, 163, 184], [180, 83, 9], [4, 120, 87],
]

// jsPDF's standard fonts are Latin-1 only, and this copy is full of en dashes
// and middots. Left alone they come out as mojibake in a client document.
const clean = (v) => String(v ?? '—')
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/[–—]/g, '-')
  .replace(/·/g, '-')
  .replace(/[^\x20-\xFF]/g, '')

/**
 * @param report.title     document title
 * @param report.org       the customer
 * @param report.scope     which department the figures cover
 * @param report.stats     [{ label, value, note }] — the headline row
 * @param report.sections  [{ title, unit, data: [{ name, value }] }]
 * @param report.notes     lines printed at the end, e.g. the sample-data caveat
 */
export async function reportPdf(report) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  let y = M

  const footer = () => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTE)
    doc.text(
      clean(`${report.org} - ${report.title} - generated ${new Date().toLocaleDateString('en-GB')}`),
      M, A4.h - 26
    )
    doc.text(String(doc.getNumberOfPages()), A4.w - M, A4.h - 26, { align: 'right' })
  }

  const room = (needed) => {
    if (y + needed <= A4.h - M - 30) return
    footer()
    doc.addPage()
    y = M
  }

  // ── header ─────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...ACCENT)
  doc.text('OXMAINT', M, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MUTE)
  doc.text(clean(report.org), A4.w - M, y, { align: 'right' })
  y += 8
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.6)
  doc.line(M, y, A4.w - M, y)
  y += 26

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(19)
  doc.setTextColor(...INK)
  doc.text(clean(report.title), M, y)
  y += 17

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...SUB)
  doc.text(clean(`${report.scope}  -  ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`), M, y)
  y += 22

  // ── headline figures ───────────────────────────────────────────────────
  //
  // Laid out as a grid of boxes rather than a sentence, because this is the row
  // a reader looks at first and a paragraph of numbers is not scannable.
  if (report.stats?.length) {
    const cols = Math.min(report.stats.length, 5)
    const gap = 10
    const w = (A4.w - M * 2 - gap * (cols - 1)) / cols
    const rows = Math.ceil(report.stats.length / cols)
    room(rows * 62 + 10)

    report.stats.forEach((s, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = M + col * (w + gap)
      const boxY = y + row * 62

      doc.setDrawColor(...LINE)
      doc.setFillColor(252, 253, 254)
      doc.roundedRect(x, boxY, w, 54, 5, 5, 'FD')

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...MUTE)
      doc.text(clean(s.label).toUpperCase(), x + 9, boxY + 15, { maxWidth: w - 18 })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(15)
      doc.setTextColor(...INK)
      doc.text(clean(s.value), x + 9, boxY + 33)

      if (s.note) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6.8)
        doc.setTextColor(...MUTE)
        doc.text(clean(s.note), x + 9, boxY + 46, { maxWidth: w - 18 })
      }
    })
    y += rows * 62 + 6
  }

  // ── each cross-tab ─────────────────────────────────────────────────────
  //
  // Two to a row where they fit, because these are short lists and one per row
  // would run a six-panel report to four pages of white space.
  const sections = (report.sections || []).filter((s) => s.data?.length)
  const colW = (A4.w - M * 2 - 22) / 2

  // Walked a row at a time rather than a section at a time, so the row's height
  // is known before either panel is drawn — the taller of the two sets where the
  // next row starts, and a page break is decided once for the pair rather than
  // leaving one panel stranded at the bottom of a page.
  const heightOf = (s) => 26 + s.data.length * 15 + 12

  for (let i = 0; i < sections.length; i += 2) {
    const pair = sections.slice(i, i + 2)
    const rowH = Math.max(...pair.map(heightOf))
    room(rowH)
    const rowTop = y
    pair.forEach((section, c) => drawSection(doc, section, M + c * (colW + 22), rowTop, colW))
    y = rowTop + rowH
  }

  // ── notes ──────────────────────────────────────────────────────────────
  if (report.notes?.length) {
    y += 8
    room(report.notes.length * 12 + 20)
    doc.setDrawColor(...LINE)
    doc.line(M, y, A4.w - M, y)
    y += 14
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTE)
    report.notes.forEach((n) => {
      const lines = doc.splitTextToSize(clean(n), A4.w - M * 2)
      lines.forEach((line, i) => doc.text(line, M, y + i * 10))
      y += lines.length * 10 + 4
    })
  }

  footer()
  doc.save(`${clean(report.org).replace(/[^a-zA-Z0-9]+/g, '-')}-${clean(report.title).replace(/[^a-zA-Z0-9]+/g, '-')}.pdf`)
}

function drawSection(doc, section, x, top, w) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...INK)
  doc.text(clean(section.title), x, top + 10)

  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.5)
  doc.line(x, top + 15, x + w, top + 15)

  const max = Math.max(1, ...section.data.map((d) => Number(d.value) || 0))
  const labelW = w * 0.44
  const valueW = 42
  const barW = w - labelW - valueW - 10

  section.data.forEach((d, i) => {
    const rowY = top + 28 + i * 15

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.8)
    doc.setTextColor(...SUB)
    // Truncated rather than wrapped: a two-line label inside a fixed-height row
    // overlaps the bar underneath it.
    let label = clean(d.name)
    while (doc.getTextWidth(label) > labelW - 6 && label.length > 4) label = label.slice(0, -2)
    if (label !== clean(d.name)) label += '...'
    doc.text(label, x, rowY)

    const track = barW
    const fill = Math.max(1.5, (Number(d.value) || 0) / max * track)
    const barY = rowY - 6

    doc.setFillColor(...RULE)
    doc.roundedRect(x + labelW, barY, track, 7, 2, 2, 'F')
    const c = BARS[i % BARS.length]
    doc.setFillColor(c[0], c[1], c[2])
    doc.roundedRect(x + labelW, barY, fill, 7, 2, 2, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.8)
    doc.setTextColor(...INK)
    doc.text(clean(`${d.value}${section.unit || ''}`), x + w, rowY, { align: 'right' })
  })
}
