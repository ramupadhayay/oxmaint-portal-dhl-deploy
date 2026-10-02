// The day's schedule as a PDF, rather than a browser print.
//
// The request was to *hand* someone a schedule. A print dialog is not that: it
// depends on whichever printer and page settings the machine happens to have,
// it carries the browser's own header and footer, and there is nothing left
// over afterwards. A PDF is a file — it can be printed, mailed to the tech who
// is off today, or kept as the record of what the shift was asked to do.
//
// jsPDF is imported dynamically so its ~350KB never lands in the bundle of a
// screen nobody exported from.

const A4 = { w: 595.28, h: 841.89 }
const M = 44

// jsPDF's standard fonts are Latin-1 only, and this data is full of en dashes
// and curly quotes. Left alone they come out as mojibake, which looks like a
// broken export rather than a font limitation.
const clean = (s) => String(s ?? '')
  .replace(/[‐-―]/g, '-')
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/·/g, '-')
  .replace(/[…]/g, '...')

const hhmm = (m) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`

export async function schedulePdf(day, { org, doneSet, idFor } = {}) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  let y = M
  let page = 1

  const footer = () => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(clean(`${org?.organization_name || ''} - maintenance schedule`), M, A4.h - 26)
    doc.text(`Page ${page}`, A4.w - M, A4.h - 26, { align: 'right' })
    doc.setTextColor(0)
  }

  const room = (need) => {
    if (y + need < A4.h - 56) return
    footer()
    doc.addPage()
    page += 1
    y = M
  }

  // ── heading ─────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(19)
  doc.setTextColor(21, 34, 122)
  doc.text('Maintenance schedule', M, y)
  doc.setTextColor(0)
  y += 20

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.setTextColor(90)
  const d = new Date(day.date)
  const when = d.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  doc.text(clean(`${when}   ${day.technician?.name || 'Unassigned'}`), M, y)
  y += 14
  doc.text(clean(`${day.itemCount} items   ${hhmm(day.totalMinutes)} planned of a ${day.shiftMinutes / 60}-hour shift`), M, y)
  doc.setTextColor(0)
  y += 16

  doc.setDrawColor(220)
  doc.line(M, y, A4.w - M, y)
  y += 20

  // ── the groups, in the order they are to be walked ──────────────────────
  for (const g of day.groups) {
    room(64)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(clean(`${g.title}  (${g.items.length})`), M, y)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(140)
    doc.text(clean(g.note), A4.w - M, y, { align: 'right' })
    doc.setTextColor(0)
    y += 13

    for (const item of g.items) {
      room(30)

      const done = doneSet && idFor ? doneSet.has(idFor(day.date, item.key)) : false

      // A box to tick, because the sheet is walked with a pen. A pre-ticked one
      // for anything already done before the export, so the paper matches the
      // screen it came from.
      doc.setDrawColor(150)
      doc.rect(M, y - 7.5, 9, 9)
      if (done) {
        doc.setDrawColor(16, 150, 100)
        doc.setLineWidth(1.2)
        doc.line(M + 1.8, y - 3.2, M + 3.8, y - 1)
        doc.line(M + 3.8, y - 1, M + 7.2, y - 5.6)
        doc.setLineWidth(0.6)
        doc.setDrawColor(150)
      }

      doc.setFont('helvetica', done ? 'normal' : 'bold')
      doc.setFontSize(9.8)
      doc.setTextColor(done ? 140 : 20)
      const label = doc.splitTextToSize(clean(item.label), A4.w - M * 2 - 76)
      doc.text(label[0], M + 16, y)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(110)
      doc.text(`${item.minutes}m`, A4.w - M, y, { align: 'right' })

      y += 11
      const detail = [item.detail, item.why, item.compliance].filter(Boolean).join('  -  ')
      if (detail) {
        doc.setFontSize(8.2)
        doc.setTextColor(140)
        doc.text(clean(detail).slice(0, 110), M + 16, y)
        y += 10
      }
      doc.setTextColor(0)
      y += 5
    }

    y += 8
  }

  // ── sign-off, because a schedule handed over comes back ─────────────────
  room(70)
  doc.setDrawColor(220)
  doc.line(M, y, A4.w - M, y)
  y += 22
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text('Completed by', M, y)
  doc.text('Date', M + 250, y)
  doc.setDrawColor(180)
  doc.line(M + 70, y + 2, M + 230, y + 2)
  doc.line(M + 285, y + 2, M + 400, y + 2)
  doc.setTextColor(0)

  footer()

  const stamp = day.date.slice(0, 10)
  doc.save(`schedule-${stamp}.pdf`)
}
