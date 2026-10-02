// The work order as a document somebody can carry onto the floor.
//
// Drawn, not screenshotted. Rendering the page to canvas gives a PDF you cannot
// select text in, that carries the sidebar into a document someone files, and
// that reflows to nothing. Laying it out costs more here and produces a job
// sheet a technician can take to the machine and a supervisor can sign.
//
// jsPDF is imported dynamically so its ~350KB never lands in the bundle of the
// twelve screens that do not export anything.

const A4 = { w: 595.28, h: 841.89 }
const M = 48
const INK = [15, 23, 42]
const SUB = [71, 85, 105]
const MUTE = [148, 163, 184]
const LINE = [226, 232, 240]
const ACCENT = [21, 34, 122]
const AMBER = [180, 83, 9]
const GREEN = [4, 120, 87]

const PRIORITY_RGB = {
  Critical: [185, 28, 28], High: [180, 83, 9], Medium: [29, 78, 216], Low: [100, 116, 139],
}

// jsPDF's standard fonts are Latin-1 only, and this data carries en dashes and
// middots. Left alone they come out as mojibake in the middle of a client
// document, so every string goes through here on the way in.
const clean = (v) => String(v ?? '—')
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/[–—]/g, '-')
  .replace(/·/g, '-')
  .replace(/[^\x20-\xFF]/g, '')

/**
 * @param wo    the joined work order
 * @param opts  { org, asset, parts, downtime } — everything the sheet shows
 *              beyond the job itself, passed in so this file needs no imports
 *              from the data layer and can be reused for a different dataset.
 */
export async function workOrderPdf(wo, { org, asset, parts = [], schedule } = {}) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  let y = M

  const footer = () => {
    const page = doc.getNumberOfPages()
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTE)
    doc.text(clean(`${org?.name || ''} - work order ${wo.woNo} - generated ${new Date().toLocaleDateString('en-GB')}`), M, A4.h - 26)
    doc.text(String(page), A4.w - M, A4.h - 26, { align: 'right' })
  }

  const room = (needed) => {
    if (y + needed <= A4.h - M - 30) return
    footer()
    doc.addPage()
    y = M
  }

  const heading = (label) => {
    room(36)
    y += 8
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...MUTE)
    doc.text(clean(label).toUpperCase(), M, y)
    y += 7
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.6)
    doc.line(M, y, A4.w - M, y)
    y += 13
  }

  const field = (label, value) => {
    const valueWidth = A4.w - M - 190
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const lines = doc.splitTextToSize(clean(value), valueWidth)
    const height = Math.max(14, lines.length * 12)
    room(height + 4)
    doc.setTextColor(...SUB)
    doc.text(clean(label), M, y)
    doc.setTextColor(...INK)
    lines.forEach((line, i) => doc.text(line, M + 140, y + i * 12))
    y += height
  }

  const chip = (label, rgb, x) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    const w = doc.getTextWidth(clean(label)) + 16
    doc.setFillColor(rgb[0], rgb[1], rgb[2])
    doc.roundedRect(x, y - 9, w, 15, 4, 4, 'F')
    doc.setTextColor(255, 255, 255)
    doc.text(clean(label), x + 8, y + 1.5)
    return w + 6
  }

  // ── header ─────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...ACCENT)
  doc.text('OXMAINT', M, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MUTE)
  doc.text(clean(org?.name || ''), A4.w - M, y, { align: 'right' })
  y += 8
  doc.setDrawColor(...LINE)
  doc.line(M, y, A4.w - M, y)
  y += 26

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...INK)
  doc.splitTextToSize(clean(wo.title), A4.w - M * 2).forEach((line, i) => {
    doc.text(line, M, y + i * 21)
  })
  y += doc.splitTextToSize(clean(wo.title), A4.w - M * 2).length * 21 + 4

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...SUB)
  doc.text(clean(`${wo.woNo}  -  ${wo.type}`), M, y)
  y += 20

  let x = M
  x += chip(wo.priority, PRIORITY_RGB[wo.priority] || PRIORITY_RGB.Low, x)
  x += chip(wo.status, wo.status === 'Completed' ? GREEN : ACCENT, x)
  if (wo._overdue) chip(`${Math.abs(wo._daysToDue)} days late`, [185, 28, 28], x)
  y += 20

  // ── the job ────────────────────────────────────────────────────────────
  heading('The job')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...INK)
  const desc = doc.splitTextToSize(clean(wo.description), A4.w - M * 2)
  room(desc.length * 13 + 8)
  desc.forEach((line, i) => doc.text(line, M, y + i * 13))
  y += desc.length * 13 + 8

  heading('Detail')
  field('Work order', wo.woNo)
  field('Type', wo.type)
  field('Priority', wo.priority)
  field('Status', wo.status)
  field('Requested by', wo.requestedBy)
  field('Assigned to', wo.assignedTo)
  field('Raised', wo.dateRequested)
  field('Due', wo.dueDate)
  if (wo.dateCompleted) field('Completed', wo.dateCompleted)

  // ── asset ──────────────────────────────────────────────────────────────
  if (asset) {
    heading('Asset')
    field('Asset', `${asset.name} (${asset.assetId})`)
    field('Make and model', `${asset.manufacturer} ${asset.model}`)
    field('Serial number', asset.serial)
    field('Location', asset._locationName)
    field('Criticality', asset.criticality)
    field('Status', asset.status)
  }

  // ── time ───────────────────────────────────────────────────────────────
  heading('Time')
  field('AI estimated duration', wo.aiEstimateHrs !== null ? `${wo.aiEstimateHrs.toFixed(1)} hours` : 'Not estimated')
  field('Actual duration', wo.actualHrs !== null ? `${wo.actualHrs.toFixed(1)} hours` : 'Not yet recorded')
  if (wo._variance !== null) {
    field('Variance', wo._variance === 0
      ? 'Matched the estimate'
      : `${wo._variance > 0 ? 'Ran over by' : 'Came in short by'} ${Math.abs(wo._variance).toFixed(1)} hours`)
  }

  // ── parts ──────────────────────────────────────────────────────────────
  if (parts.length) {
    heading(`Spares that fit this asset (${parts.length})`)
    doc.setFontSize(8.5)
    parts.forEach((p) => {
      room(15)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...INK)
      doc.text(clean(`${p.partNo}  ${p.name}`), M, y)
      doc.setTextColor(p._state === 'In stock' ? SUB[0] : AMBER[0], p._state === 'In stock' ? SUB[1] : AMBER[1], p._state === 'In stock' ? SUB[2] : AMBER[2])
      doc.text(clean(`${p.qtyOnHand} of ${p.reorderPoint}  ${p._state}`), A4.w - M, y, { align: 'right' })
      y += 14
    })
    y += 4
  }

  if (schedule) {
    heading('Related PM schedule')
    field('Schedule', `${schedule.pmId} - ${schedule.task}`)
    field('Frequency', schedule.frequency)
    field('Next due', schedule.nextDue)
  }

  // ── sign-off ───────────────────────────────────────────────────────────
  heading('Sign-off')
  room(96)
  const colW = (A4.w - M * 2 - 24) / 2
  const boxes = [['Work carried out by', 'Date'], ['Checked by', 'Date']]
  boxes.forEach((pair, i) => {
    const bx = M + i * (colW + 24)
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.6)
    doc.rect(bx, y, colW, 70)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTE)
    doc.text(clean(pair[0]), bx + 10, y + 16)
    doc.line(bx + 10, y + 44, bx + colW - 10, y + 44)
    doc.text(clean(pair[1]), bx + 10, y + 60)
  })
  y += 82

  doc.setFontSize(7.5)
  doc.setTextColor(...MUTE)
  const note = doc.splitTextToSize(
    clean('Demonstration data. Generated from the DNA Technical Fabrics CMMS sample dataset - not a production maintenance record.'),
    A4.w - M * 2
  )
  room(note.length * 10 + 6)
  note.forEach((line, i) => doc.text(line, M, y + i * 10))

  footer()
  doc.save(`${wo.woNo}-${clean(wo.title).replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 40)}.pdf`)
}
