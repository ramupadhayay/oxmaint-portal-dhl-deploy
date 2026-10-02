// The work order, as a job sheet somebody carries to the machine.
//
// Drawn, not screenshotted. Rendering the page to canvas gives a PDF you cannot
// select text in, that carries the sidebar and the chat launcher into a document
// someone files against a statutory examination, and that reflows to nothing.
// Laying it out costs more here and produces something a maintenance manager can
// keep.
//
// Nothing is imported. The sheet takes the organisation, the asset and the order
// as arguments rather than reading the data layer, so it survives a pack swap —
// a chiller estate and a press shop produce the same document from the same
// code, and neither can drag its vocabulary in here.
//
// jsPDF is loaded dynamically so its ~350KB never lands in the bundle of the
// fifty-odd screens that export nothing.

const A4 = { w: 595.28, h: 841.89 }
const M = 48                     // page margin
const INK = [15, 23, 42]
const SUB = [71, 85, 105]
const MUTE = [148, 163, 184]
const LINE = [226, 232, 240]
const ACCENT = [21, 34, 122]

const PRIORITY_RGB = {
  Critical: [185, 28, 28], High: [180, 83, 9], Medium: [29, 78, 216], Low: [100, 116, 139],
}
// Anything the table has not seen is work still in flight, which is amber.
const STATUS_RGB = {
  Completed: [4, 120, 87], Closed: [4, 120, 87],
  Cancelled: [100, 116, 139], 'On Hold': [100, 116, 139],
}

// jsPDF's standard fonts are Latin-1 only, and this data is full of en dashes,
// middots and curly quotes. Left alone they render as mojibake in the middle of
// a document a technician signs, which reads as a broken export rather than as a
// font limitation — so every string goes through here on the way onto the page.
const clean = (v) => String(v ?? '—')
  .replace(/[‐-―]/g, '-')
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/·/g, '-')
  .replace(/…/g, '...')
  .replace(/°/g, ' deg')
  .replace(/[^\x20-\xFF]/g, '')

// A fixed month table rather than toLocaleString. The sheet has to come out
// identical on a technician's phone and on a planner's desktop, and the locale
// is the one thing about the machine we cannot see — an ISO timestamp printed
// raw is worse still, because nobody reads a due date off a Z suffix.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const date = (iso) => {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return clean(iso)
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

const hours = (v) => (v === null || v === undefined || v === '' ? '-' : `${Number(v)} h`)

// Guarded the same way the screen's money helper is, and for the same reason: a
// record created through the API rather than the form can arrive without a cost,
// and "$NaN" on a signed document does not read as missing data, it reads as
// arithmetic nobody can trust.
const money = (v, symbol) => {
  const n = Number(v)
  return Number.isFinite(n)
    ? `${symbol || '$'}${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : '-'
}

// The document header — a thin brand rule, the product mark, the organisation on
// the left and the work order reference on the right. A white header rather than
// a colour band, so a long title below always sits on clear paper and can never
// ride into the branding however far it wraps.
function band(doc, { width, org, right, rightLabel }) {
  const top = M
  doc.setFillColor(...ACCENT)
  doc.rect(0, 0, width, 5, 'F')

  doc.setFillColor(...ACCENT)
  doc.roundedRect(M, top, 30, 30, 6, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(255, 255, 255)
  doc.text('O', M + 15, top + 20.5, { align: 'center' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...ACCENT)
  doc.text('Oxmaint AI', M + 40, top + 13)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...SUB)
  doc.text(clean(`${org?.organization_name || 'Maintenance'}${org?.industry ? ` - ${org.industry}` : ''}`), M + 40, top + 26)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MUTE)
  doc.text(clean(rightLabel).toUpperCase(), width - M, top + 8, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...INK)
  doc.text(clean(right), width - M, top + 25, { align: 'right' })

  doc.setDrawColor(...LINE)
  doc.setLineWidth(1)
  doc.line(M, top + 44, width - M, top + 44)
  return top + 44
}

/**
 * One work order, as the job sheet.
 *
 * @param wo    the work order as the list holds it — snake_case throughout,
 *              including whatever the completion modal booked against it.
 * @param opts  { org, asset } — the organisation for the letterhead and the
 *              asset record for the nameplate. Both optional: a job raised
 *              against a functional location has no asset behind it, and the
 *              sheet falls back to what the order itself carries.
 */
export async function workOrderPdf(wo, { org, asset } = {}) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  const cur = org?.currency_symbol
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
  let y = M

  const room = (needed) => {
    if (y + needed <= A4.h - M - 28) return
    footer()
    doc.addPage()
    y = M
  }

  const text = (s, x, opts = {}) => {
    const { size = 10, color = INK, style = 'normal', maxWidth } = opts
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(...color)
    const lines = maxWidth ? doc.splitTextToSize(clean(s), maxWidth) : [clean(s)]
    lines.forEach((line, i) => doc.text(line, x, y + i * (size + 3)))
    return lines.length * (size + 3)
  }

  const rule = () => {
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.6)
    doc.line(M, y, A4.w - M, y)
    y += 14
  }

  const heading = (label) => {
    room(34)
    y += 6
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...MUTE)
    doc.text(clean(label).toUpperCase(), M, y)
    y += 6
    rule()
  }

  // Label left, value right, wrapping — the shape of every row in the detail
  // drawer, so the document and the screen read the same way.
  const field = (label, value) => {
    const valueWidth = A4.w - M - 170
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const lines = doc.splitTextToSize(clean(value), valueWidth)
    const height = Math.max(14, lines.length * 13)
    room(height + 6)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...SUB)
    doc.text(clean(label).toUpperCase(), M, y + 9)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...INK)
    lines.forEach((line, i) => doc.text(line, M + 122, y + 9 + i * 13))

    y += height + 4
  }

  const footer = () => {
    const page = doc.getNumberOfPages()
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTE)
    doc.text(clean(`${org?.organization_name || 'Oxmaint AI'} - work order job sheet`), M, A4.h - 28)
    doc.text(`Page ${page}`, A4.w - M, A4.h - 28, { align: 'right' })
    doc.text(clean(`${wo.work_order_number || ''} - generated ${stamp}`), M, A4.h - 17)
  }

  // ── document header + title, drawn at absolute coordinates ───────────────
  //
  // Deliberately NOT using the shared `y` cursor or the `text()` helper here.
  // Every line below is placed at a known, fixed coordinate well clear of the
  // 92pt header, so the title can never land in the branding — whatever a
  // bundler or a stale hot-reload does to the surrounding code. Only after the
  // title block is the shared cursor set, for the body to flow from.
  band(doc, { width: A4.w, org, right: wo.work_order_number, rightLabel: 'Work order' })

  const TITLE_TOP = 122               // header divider sits at 92; 30pt of clear air
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...INK)
  const titleLines = doc.splitTextToSize(clean(wo.title || wo.asset_name), A4.w - M * 2)
  titleLines.forEach((ln, i) => doc.text(ln, M, TITLE_TOP + i * 19))
  let cursor = TITLE_TOP + titleLines.length * 19 + 3

  // The order carries its own copy of the asset's name, code and location, so
  // the sheet still says where the job is when the asset record cannot be
  // resolved — a job raised against a functional location has no asset at all.
  const code = wo.asset_code || asset?.asset_code
  const assetName = wo.asset_name || asset?.asset_name
  const location = wo.location_name || asset?.functional_location_name
  const site = wo.site_name || asset?.site_name
  const where = [
    assetName,
    code ? `(${code})` : '',
    location ? `- ${location}` : '',
    site ? `- ${site}` : '',
  ].filter(Boolean).join(' ')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...SUB)
  const subLines = doc.splitTextToSize(clean(where), A4.w - M * 2)
  subLines.forEach((ln, i) => doc.text(ln, M, cursor + i * 13))
  cursor += subLines.length * 13 + 18

  // Status, priority and type chips, on the line at `cursor`.
  const chip = (label, rgb, cx) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    const w = doc.getTextWidth(clean(label)) + 16
    doc.setFillColor(...rgb)
    doc.roundedRect(cx, cursor - 10, w, 17, 4, 4, 'F')
    doc.setTextColor(255, 255, 255)
    doc.text(clean(label), cx + 8, cursor + 1.5)
    return w + 7
  }
  let cx = M
  if (wo.priority) cx += chip(wo.priority, PRIORITY_RGB[wo.priority] || [100, 116, 139], cx)
  if (wo.status) cx += chip(wo.status, STATUS_RGB[wo.status] || [180, 83, 9], cx)
  if (wo.work_order_type) cx += chip(wo.work_order_type, [71, 85, 105], cx)

  // Hand the shared cursor to the body from here down.
  y = cursor + 24
  rule()

  // ── the order ──────────────────────────────────────────────────────────
  heading('Work order')
  field('Work order no.', wo.work_order_number)
  field('Type', wo.work_order_type)
  field('Priority', wo.priority)
  field('Status', wo.status)
  field('Raised by', wo.created_by_name)
  field('Raised on', date(wo.created_date))
  field('Due', date(wo.due_date))
  if (wo.started_date) field('Started', date(wo.started_date))
  field('Completed', wo.completed_date ? date(wo.completed_date) : 'Not yet')
  field('Assigned to', wo.assigned_to_name || 'Unassigned')
  field('Description', wo.description)

  // ── the asset ──────────────────────────────────────────────────────────
  //
  // The nameplate goes on the paper in full rather than as a reference. A
  // technician standing at the machine with a sheet that says "see the asset
  // record" cannot check the serial number against the one in front of them,
  // which is the one check that catches work booked to the wrong unit.
  heading('Asset')
  field('Asset', [assetName, code ? `(${code})` : ''].filter(Boolean).join(' ') || '-')
  if (asset?.asset_type) field('Type', asset.asset_type)
  if (asset?.manufacturer || asset?.model) field('Manufacturer / model', [asset?.manufacturer, asset?.model].filter(Boolean).join(' '))
  if (asset?.serial_number) field('Serial number', asset.serial_number)
  field('Site', site)
  field('Functional location', location)
  if (asset?.criticality) field('Criticality', asset.criticality)
  if (asset?.running_hours != null) field('Running hours', `${Number(asset.running_hours).toLocaleString('en-US')} h`)

  // ── time and cost ──────────────────────────────────────────────────────
  //
  // Estimate beside actual, with the difference spelled out. The variance is
  // the number a planner comes to this sheet for, and asking them to subtract
  // two figures on a printed page is how estimates stop being corrected.
  heading('Time and cost')
  field('Estimated hours', hours(wo.estimated_hours))
  field('Actual hours', hours(wo.actual_hours))
  if (wo.actual_hours != null && wo.estimated_hours != null) {
    const delta = Number(wo.actual_hours) - Number(wo.estimated_hours)
    const rounded = Math.round(delta * 100) / 100
    field('Variance', rounded === 0 ? 'On estimate' : `${rounded > 0 ? '+' : ''}${rounded} h ${rounded > 0 ? 'over' : 'under'}`)
  }
  field('Downtime', hours(wo.downtime_hours ?? 0))
  if (wo.labour_cost != null) {
    field('Labour', `${hours(wo.actual_hours)} at ${money(wo.labour_rate, cur)}/h = ${money(wo.labour_cost, cur)}`)
  }
  if (wo.parts_cost != null) field('Parts', money(wo.parts_cost, cur))
  field('Total cost', money(wo.total_cost || 0, cur))

  // ── parts drawn against the job ────────────────────────────────────────
  const parts = Array.isArray(wo.parts_used) ? wo.parts_used : []
  if (parts.length) {
    heading('Parts used')
    room(20)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTE)
    doc.text('QTY', M, y + 8)
    doc.text('PART', M + 60, y + 8)
    doc.text('PART NUMBER', M + 295, y + 8)
    doc.text('VALUE', A4.w - M, y + 8, { align: 'right' })
    y += 14
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.6)
    doc.line(M, y - 3, A4.w - M, y - 3)

    parts.forEach((l) => {
      room(20)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(...INK)
      doc.text(clean(`${l.quantity} ${l.unit || ''}`.trim()), M, y + 9)
      doc.text(doc.splitTextToSize(clean(l.part_name), 228)[0] || '-', M + 60, y + 9)
      doc.setTextColor(...SUB)
      doc.text(clean(l.part_number || '-'), M + 295, y + 9)
      doc.setTextColor(...INK)
      doc.text(money(l.line_value, cur), A4.w - M, y + 9, { align: 'right' })
      y += 16
      doc.setDrawColor(...LINE)
      doc.setLineWidth(0.4)
      doc.line(M, y - 3, A4.w - M, y - 3)
    })
    y += 4
  }

  // ── the task list, where the job carries one ───────────────────────────
  const tasks = Array.isArray(wo.tasks) ? wo.tasks : []
  if (tasks.length) {
    heading('Task list')
    tasks.forEach((t, i) => {
      const label = typeof t === 'string' ? t : t.description || t.label
      if (!label) return
      const trade = typeof t === 'object' ? [t.trade, t.hours ? `${t.hours} h` : ''].filter(Boolean).join(' - ') : ''
      room(22)
      // A box beside each line rather than a bullet: this sheet is worked
      // through at the machine, and a line with nothing to tick is a line
      // somebody loses their place in.
      doc.setDrawColor(...LINE)
      doc.setLineWidth(0.8)
      doc.rect(M, y + 1, 9, 9, 'S')
      y += text(`${i + 1}. ${label}${trade ? `  (${trade})` : ''}`, M + 17, { size: 9.5, maxWidth: A4.w - M * 2 - 17 })
      y += 3
    })
    y += 4
  }

  if (wo.completion_note) {
    heading('What was done')
    y += text(wo.completion_note, M, { size: 9.5, color: SUB, maxWidth: A4.w - M * 2 })
    y += 6
  }

  // ── sign-off ───────────────────────────────────────────────────────────
  //
  // Two rows of ruled lines rather than empty boxes: a box invites a scrawl
  // anywhere inside it, and a scanned sheet with a signature floating in white
  // space is worth less to an auditor than one sitting on a line under a label.
  //
  // Room for the whole block is claimed before the heading is drawn, so it moves
  // to the next page intact. Split across a break — print-name at the foot of
  // one page, signature at the head of the next — it becomes two half-blocks
  // somebody signs the wrong half of.
  room(128)
  heading('Sign-off')
  y += 6
  const colW = (A4.w - M * 2 - 24) / 2
  // 26pt of clear paper above each rule, which is about 9mm — enough for a
  // signature and tight enough that the block still lands on the page the work
  // is described on for a short job.
  const signRow = (left, right) => {
    doc.setDrawColor(...LINE)
    ;[left, right].forEach((label, i) => {
      const lx = M + i * (colW + 24)
      doc.line(lx, y + 26, lx + colW, y + 26)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...MUTE)
      doc.text(clean(label), lx, y + 38)
    })
    y += 46
  }
  signRow('Completed by (print name)', 'Date and time')
  signRow('Signature', 'Isolation removed and asset returned to service by')

  footer()
  const name = `${clean(wo.work_order_number || 'work-order')}-job-sheet.pdf`
  doc.save(name)
  return name
}
