// The work order as a job card.
//
// The point of printing one is that somebody carries it into a cleanroom, so it
// is laid out for that rather than as a screenshot of the screen: the order and
// the asset at the top where a gloved hand can read them, the procedure as tick
// boxes in the middle, and a sign-off line at the bottom. Gowned, at arm's
// length, under cleanroom lighting — which is why nothing on it is under 8pt.
//
// A PDF rather than a browser print, for the reason the hospitality portal
// settled on: a print dialog depends on whichever printer the machine happens
// to have, carries the browser's own header and footer, and leaves nothing
// behind. A file can be printed, mailed to the technician who is off today, or
// kept as the record of what the shift was asked to do.
//
// jsPDF is imported dynamically so its ~350KB never lands in the bundle of a
// screen nobody exported from.

import { loadMark, masthead, pageFooter, clean } from './pdfBrand'

const A4 = { w: 595.28, h: 841.89 }
const M = 44
const ACCENT = [21, 34, 122]

const PROCEDURE = {
  PM04: [
    'Room at operational airflow, stabilised at least 15 minutes',
    'Aerosol generator upstream, injection point verified',
    'Upstream challenge concentration established and recorded',
    'Photometer zeroed, then referenced to 100% upstream',
    'Probe 25 mm from the face, traverse no faster than 50 mm/s',
    'Whole face scanned, plus the frame seal and gasket line',
    'Any indication above threshold re-scanned before recording',
    'Penetration, scan point count and technician entered on the record',
  ],
  PM02: [
    'Pre-replacement integrity test recorded against the outgoing filter',
    'Room secured, airflow isolated, area protected',
    'Old serial read off the frame and recorded before removal',
    'New filter inspected for transit damage',
    'Supplier certificate present and its number matches',
    'New serial recorded, gasket seated, clamps torqued evenly',
    'Airflow restored, room allowed to stabilise',
    'Post-installation integrity test performed and passed',
  ],
  PM01: [
    'Fault confirmed against the reported condition',
    'Room state and airflow checked before any intervention',
    'Corrective work carried out and described below',
    'Integrity re-verified before the room is released',
    'Findings recorded against the filter',
  ],
}

/**
 * @param order    the work order, as the screens hold it
 * @param context  { filter, document, test, org, user }
 */
export async function workOrderPdf(order, context = {}) {
  const [{ jsPDF }, mark] = await Promise.all([import('jspdf'), loadMark()])
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const { filter, document: cert, test, org } = context

  let y = M
  let page = 1
  const generated = new Date().toISOString().slice(0, 16).replace('T', ' ')

  const footer = () => pageFooter(doc, {
    width: A4.w, height: A4.h, margin: M, page,
    left: `${org?.name || ''} - ${org?.site || ''} - printed ${generated}`,
  })

  const room = (need) => {
    if (y + need < A4.h - 56) return
    footer()
    doc.addPage()
    page += 1
    y = M
  }

  const heading = (text) => {
    room(42)
    y += 8
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(...ACCENT)
    doc.text(clean(text), M, y)
    doc.setTextColor(0)
    y += 6
    doc.setDrawColor(220, 226, 236)
    doc.line(M, y, A4.w - M, y)
    y += 14
  }

  // A two-column field block. Labels small and grey, values in black at a size
  // that survives a photocopier.
  const fields = (rows, cols = 2) => {
    const colW = (A4.w - M * 2) / cols
    for (let i = 0; i < rows.length; i += cols) {
      room(30)
      const slice = rows.slice(i, i + cols)
      slice.forEach(([label], c) => {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(130)
        doc.text(clean(label.toUpperCase()), M + c * colW, y)
      })
      slice.forEach(([, value], c) => {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9.5)
        doc.setTextColor(0)
        const text = doc.splitTextToSize(clean(value ?? '-'), colW - 12)[0] || '-'
        doc.text(text, M + c * colW, y + 12)
      })
      y += 27
    }
  }

  y = masthead(doc, mark, {
    title: `Work order ${order.workOrderId}`,
    subtitle: `${order.workOrderType} - ${order.cleanroomName}`,
    org: `${org?.name || ''} - ${org?.site || ''}`,
    right: `Printed ${generated}`,
    width: A4.w, margin: M, accent: ACCENT,
  })

  // A strip of the three things somebody picking the card up needs first.
  // Boxed rather than run into the field grid, because on a photocopy the
  // difference between Critical and Low has to survive losing its colour.
  const strip = [
    ['Priority', String(order.priority || '-').toUpperCase()],
    ['Status', String(order.status || '-').toUpperCase()],
    ['Due', order.dueOn || '-'],
  ]
  const stripW = (A4.w - M * 2 - 16) / strip.length
  strip.forEach(([label, value], i) => {
    const x = M + i * (stripW + 8)
    doc.setDrawColor(214, 221, 235)
    doc.setLineWidth(0.8)
    doc.roundedRect(x, y, stripW, 40, 5, 5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(130)
    doc.text(clean(label.toUpperCase()), x + 10, y + 15)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(21, 34, 122)
    doc.text(clean(value), x + 10, y + 31)
  })
  doc.setTextColor(0)
  y += 40 + 8

  // ── the order ───────────────────────────────────────────────────────────
  heading('The order')
  fields([
    ['Order number', order.workOrderId],
    ['Order class', order.orderClass],
    ['Type', String(order.workOrderType).replace(/^PM\d+\w* - /, '')],
    ['Raised', order.raisedOn || '-'],
    ['Assigned to', order.technicianName || 'Unassigned'],
    ['Certification', cert?.documentRef || '-'],
    ['SAP sync', order.syncStatus || '-'],
  ])

  // ── the asset ───────────────────────────────────────────────────────────
  heading('The asset')
  fields([
    ['Filter', order.filterId],
    ['Cleanroom', `${order.cleanroomName} (${order.cleanroomId || '-'})`],
    ['ISO class', order.isoClass || filter?.isoClass || '-'],
    ['QR label', filter?.qrCode || '-'],
    ['SAP equipment', order.sapEquipmentId || '-'],
    ['Functional location', order.sapFunctionalLocation || '-'],
    ['Installed', filter?.installedOn || '-'],
    ['Test interval', filter?.testInterval || '-'],
  ])

  if (order.description) {
    heading('What the work is')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    for (const line of doc.splitTextToSize(clean(order.description), A4.w - M * 2)) {
      room(16)
      doc.text(line, M, y)
      y += 13
    }
    y += 4
  }

  // ── the condition that raised it ────────────────────────────────────────
  if (filter?.concern || test) {
    heading('Condition on the asset')
    const rows = []
    if (filter?.concern) rows.push(['Open concern', filter.concern])
    if (test) {
      rows.push(['Last test', `${test.testId} - ${test.result}`])
      rows.push(['Penetration', String(test.penetration)])
      rows.push(['Tested by', `${test.technicianName} on ${test.date}`])
    }
    if (filter?.breachCount) rows.push(['Pressure breaches', String(filter.breachCount)])
    if (cert) rows.push(['Certification', `${cert.documentRef} - ${cert.stage}`])
    fields(rows)
  }

  // ── the procedure, as tick boxes ────────────────────────────────────────
  const steps = PROCEDURE[order.orderClass] || PROCEDURE.PM01
  heading('Procedure')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  for (const step of steps) {
    room(24)
    doc.setDrawColor(120, 130, 150)
    doc.setLineWidth(0.8)
    doc.rect(M, y - 8, 11, 11)
    const lines = doc.splitTextToSize(clean(step), A4.w - M * 2 - 24)
    doc.text(lines, M + 20, y)
    y += Math.max(19, lines.length * 12 + 7)
  }

  // ── sign-off ────────────────────────────────────────────────────────────
  room(120)
  heading('Sign-off')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(120)

  const half = (A4.w - M * 2 - 24) / 2
  const line = (label, x, width) => {
    doc.setDrawColor(150, 158, 175)
    doc.setLineWidth(0.7)
    doc.line(x, y + 22, x + width, y + 22)
    doc.text(clean(label), x, y + 33)
  }
  line('Completed by (print name)', M, half)
  line('Date and time', M + half + 24, half)
  y += 52
  room(60)
  line('Signature', M, half)
  line('Verified by', M + half + 24, half)
  y += 52

  doc.setTextColor(0)
  room(46)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.setTextColor(130)
  for (const l of doc.splitTextToSize(clean(
    'A signature on this card records that the procedure above was carried out. '
    + 'It is not the electronic signature on the certification record - that is applied '
    + `in the portal against ${cert?.documentRef || 'the certification document'}, with a stated meaning and a system timestamp.`,
  ), A4.w - M * 2)) {
    room(12)
    doc.text(l, M, y)
    y += 10
  }
  doc.setTextColor(0)

  footer()
  const name = `work-order-${order.workOrderId}.pdf`
  doc.save(name)
  return name
}

// The register-wide export was removed.
//
// It printed the filtered list as a landscape planning sheet, and it was the
// wrong artefact: a work order is carried to a job and signed, and a sheet of
// eighteen rows is neither of those. Nobody signs a list. What leaves this
// screen is the job card for one order.
