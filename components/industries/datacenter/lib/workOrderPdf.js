// The work order, as a document somebody can file.
//
// Drawn, not screenshotted. Rendering the page to canvas gives a PDF you cannot
// select text in, that carries the sidebar and the chat launcher into a
// document someone attaches to a compliance pack, and that reflows to nothing.
// Laying it out costs more here and produces something a facility manager can
// keep.
//
// Two documents come out of this file and they are deliberately different
// shapes. The job sheet is one order, portrait, with a sign-off block — it is
// carried to a machine and signed. The register is the filtered list, landscape,
// with no signature line anywhere on it — nobody signs a list, and a sheet that
// offers a signature box for eighteen rows invites somebody to sign for work
// they did not witness.
//
// jsPDF is imported dynamically so its ~350KB never lands in the bundle of the
// twenty-seven screens that do not export anything.

const A4 = { w: 595.28, h: 841.89 }
const LANDSCAPE = { w: 841.89, h: 595.28 }
const M = 48                     // page margin
const INK = [15, 23, 42]
const SUB = [71, 85, 105]
const MUTE = [148, 163, 184]
const LINE = [226, 232, 240]
const ACCENT = [21, 34, 122]

const PRIORITY_RGB = {
  Critical: [185, 28, 28], High: [180, 83, 9], Medium: [29, 78, 216], Low: [100, 116, 139],
}

// jsPDF's standard fonts are Latin-1 only, and this data is full of en dashes,
// middots and curly quotes. Left alone they render as mojibake in the middle of
// a client document, which reads as a broken export rather than as a font
// limitation — so every string goes through here on the way onto the page.
const clean = (v) => String(v ?? '—')
  .replace(/[‐-―]/g, '-')
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/·/g, '-')
  .replace(/…/g, '...')
  .replace(/[^\x20-\xFF]/g, '')

// The document header both sheets wear — the product's own work-order document
// design: a thin brand rule, a blue logo mark, the product and organisation on
// the left, the document reference on the right, and a divider under it. A clean
// white header rather than a colour band, so the title below always sits in
// white space and can never ride into the branding however long it wraps.
//
// Returns the y at which the body should start.
function band(doc, { width, org, right, rightLabel }) {
  const top = M
  // Thin accent rule across the very top.
  doc.setFillColor(...ACCENT)
  doc.rect(0, 0, width, 5, 'F')

  // Logo mark.
  doc.setFillColor(...ACCENT)
  doc.roundedRect(M, top, 30, 30, 6, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(255, 255, 255)
  doc.text('O', M + 15, top + 20.5, { align: 'center' })

  // Product + organisation.
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...ACCENT)
  doc.text('Oxmaint AI', M + 40, top + 13)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...SUB)
  doc.text(clean(`${org?.name || 'Data Center Operations'}${org?.programme ? ` - ${org.programme}` : ''}`), M + 40, top + 26)

  // Document reference, right-aligned.
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MUTE)
  doc.text(clean(rightLabel).toUpperCase(), width - M, top + 8, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...INK)
  doc.text(clean(right), width - M, top + 25, { align: 'right' })

  // Divider under the header.
  doc.setDrawColor(...LINE)
  doc.setLineWidth(1)
  doc.line(M, top + 44, width - M, top + 44)
  return top + 44
}

/**
 * One work order, as the job sheet.
 *
 * @param wo    the joined work order, exactly as the record page holds it
 * @param opts  { org, alert, asset } — everything the sheet shows beyond the
 *              order itself, passed in rather than imported so this file has no
 *              dependency on the data layer and survives a pack swap.
 */
export async function workOrderPdf(wo, { org, alert, asset } = {}) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

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

  // Label left, value right, wrapping — the shape of every field on the record
  // page, so the document and the screen read the same way.
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
    doc.text(clean(`${org?.name || ''} - ${org?.programme || ''}`), M, A4.h - 28)
    doc.text(`Page ${page}`, A4.w - M, A4.h - 28, { align: 'right' })
    doc.text('Not an operational maintenance record', M, A4.h - 17)
  }

  // ── document header + title, drawn at absolute coordinates ───────────────
  //
  // Deliberately NOT using the shared `y` cursor or the `text()` helper here.
  // Every line below is placed at a known, fixed coordinate well clear of the
  // 92pt header, so the title can never land in the branding — whatever a bundler
  // or a stale hot-reload does to the surrounding code. Only after the title
  // block is the shared cursor set, for the body to flow from.
  band(doc, { width: A4.w, org, right: wo.workOrderId, rightLabel: 'Work Order' })

  const TITLE_TOP = 122               // header divider sits at 92; 30pt of clear air
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...INK)
  const titleLines = doc.splitTextToSize(clean(wo._asset || wo.assetId), A4.w - M * 2)
  titleLines.forEach((ln, i) => doc.text(ln, M, TITLE_TOP + i * 19))
  let cursor = TITLE_TOP + titleLines.length * 19 + 3

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...SUB)
  const subLines = doc.splitTextToSize(clean(`${wo.triggerSource || ''}${wo._site ? `  -  ${wo._site}` : ''}`), A4.w - M * 2)
  subLines.forEach((ln, i) => doc.text(ln, M, cursor + i * 13))
  cursor += subLines.length * 13 + 18

  // Status + priority chips, on the line at `cursor`.
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
  if (wo.status) cx += chip(wo.status, wo.status === 'Completed' ? [4, 120, 87] : [180, 83, 9], cx)

  // Hand the shared cursor to the body from here down.
  y = cursor + 24
  rule()

  // ── the record ─────────────────────────────────────────────────────────
  heading('Work order')
  field('Raised', wo.dateRaised)
  field('Completed', wo.dateCompleted || 'Not yet')
  field('Priority', wo.priority)
  field('Status', wo.status)
  field('Assigned to', wo.assignedTo)
  field('Trigger source', wo.triggerSource)
  if (wo.alertId) field('Linked alert', wo.alertId)
  field('Description', wo.description)

  if (asset) {
    heading('Asset')
    field('Asset', `${asset.assetId} - ${asset.assetName}`)
    field('Class', asset.assetClass)
    field('Site', asset._site)
    field('Location', asset._location)
    field('Criticality', `${asset.criticality}${asset._tier ? ` (${asset._tier})` : ''}`)
    if (asset._sla) field('Response SLA', asset._sla)
    if (asset.manufacturer) field('Manufacturer', asset.manufacturer)
  }

  // ── what triggered it ──────────────────────────────────────────────────
  //
  // The alert goes on the paper in full, not as a reference. An analytics
  // programme is judged on whether the thing it predicted was the thing the
  // engineer found, and that comparison is only possible if the prediction
  // travels with the job. A sheet that says "see ALT-0003" sends the reader
  // back to a screen they do not have open.
  if (alert) {
    heading('The alert that raised it')
    field('Alert', `${alert.alertId} - ${alert.severity}`)
    field('Raised', alert.dateRaised || alert.timestamp)
    field('Monitoring source', alert.source || alert.triggeringSensors)
    field('Failure mode', `${alert.failureCode}${alert._failureMode ? ` - ${alert._failureMode}` : ''}`)
    // Only the monitoring feed carries a confidence figure; the SOW alert
    // register does not. Printing "-" against Confidence on every sheet would
    // read as a system that lost the number rather than one that was never
    // given it, so the row appears only where there is a figure behind it.
    if (typeof alert.confidence === 'number') {
      field('Model confidence', `${alert.confidence}%${alert._agreeing > 1 ? ` - corroborated by ${alert._agreeing} sensors` : ''}`)
    }
    field('Description', alert.description)
    if (alert.reviewOutcome) field('Engineering review', alert.reviewOutcome)
    if (alert.validated) field('Condition validated', alert.validated)
    if (alert.classification) field('Classification', alert.classification)
    // Whether the prediction held up, and by how much warning. This is the
    // number the PoC is actually being bought on.
    if (alert._correlation) {
      field('Inspection finding', alert._correlation.finding)
      field('Confirmed', alert._correlation.confirmed)
      if (alert._correlation.leadTime) field('Lead time', alert._correlation.leadTime)
    }
  } else {
    // The register is a comparison — condition-based work against the calendar
    // and reactive baseline it is measured against — so the absence of an alert
    // is a finding rather than a blank. Saying so on the sheet keeps a reader
    // from assuming the link was lost somewhere in the export.
    //
    // Prose across the full width rather than a labelled field: it is a
    // sentence, not a value, and setting it in the narrow value column costs a
    // line that pushes the sign-off onto a page of its own.
    heading('What triggered it')
    y += text(
      'No condition-based alert preceded this order. It came from the scheduled programme or an operator report - part of the baseline the condition-based work is measured against.',
      M, { size: 9.5, color: SUB, maxWidth: A4.w - M * 2 },
    )
    y += 6
  }

  if (wo.action || wo.outcome || wo.feedback) {
    heading('Findings and outcome')
    if (wo.action) field('Action / finding', wo.action)
    if (wo.outcome) field('Outcome', wo.outcome)
    // Step 7 of the SOW response workflow, and the reason the PoC keeps these
    // records at all — so it is labelled as what it is rather than as "notes".
    if (wo.feedback) field('Feedback to analytics', wo.feedback)
  }

  // ── sign-off ───────────────────────────────────────────────────────────
  //
  // Two rows of ruled lines rather than empty boxes: a box invites a scrawl
  // anywhere inside it, and a scanned sheet with a signature floating in white
  // space is worth less to an auditor than one sitting on a line under a label.
  //
  // Room for the whole block is claimed before the heading is drawn, so it
  // moves to the next page intact. Split across a break — print-name at the
  // foot of one page, signature at the head of the next — it becomes two
  // half-blocks somebody signs the wrong half of.
  room(128)
  heading('Sign-off')
  y += 6
  const colW = (A4.w - M * 2 - 24) / 2
  // 26pt of clear paper above each rule, which is about 9mm — enough for a
  // signature and tight enough that the block still lands on the page the work
  // is described on for a short order.
  const signRow = (left, right) => {
    doc.setDrawColor(...LINE)
    ;[left, right].forEach((label, i) => {
      const cx = M + i * (colW + 24)
      doc.line(cx, y + 26, cx + colW, y + 26)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...MUTE)
      doc.text(clean(label), cx, y + 38)
    })
    y += 46
  }
  signRow('Completed by (print name)', 'Date and time')
  signRow('Signature', 'Verified by')

  footer()
  const name = `${clean(wo.workOrderId)}.pdf`
  doc.save(name)
  return name
}

// The register columns. Widths sum to the landscape text column, so a change
// here is the one place the table geometry lives.
const COLUMNS = [
  { key: 'workOrderId', label: 'WO', w: 62 },
  { key: 'dateRaised', label: 'Raised', w: 58 },
  { key: '_asset', label: 'Asset', w: 158 },
  { key: '_site', label: 'Site', w: 88 },
  { key: 'triggerSource', label: 'Trigger', w: 112 },
  { key: 'alertId', label: 'Alert', w: 56 },
  { key: 'priority', label: 'Priority', w: 52 },
  { key: 'status', label: 'Status', w: 76 },
  { key: 'assignedTo', label: 'Assigned to', w: 100 },
]

/**
 * The filtered register, as a landscape sheet.
 *
 * @param orders  the rows currently on screen — already searched and filtered.
 *                Handing this the whole register instead would produce a
 *                document that disagrees with the screen it was exported from,
 *                and somebody would go and work the wrong list.
 * @param opts    { org, scope } — scope is the sentence naming which filters
 *                were applied, printed under the title so the sheet says what
 *                it is a list of.
 */
export async function workOrderListPdf(orders = [], { org, scope, total } = {}) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' })

  const W = LANDSCAPE.w
  const H = LANDSCAPE.h
  const tableW = COLUMNS.reduce((sum, c) => sum + c.w, 0)
  let y = 0

  const footer = () => {
    const page = doc.getNumberOfPages()
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTE)
    doc.text(clean(`${org?.name || ''} - ${org?.programme || ''}`), M, H - 28)
    doc.text(`Page ${page}`, W - M, H - 28, { align: 'right' })
    doc.text('Not an operational maintenance record', M, H - 17)
  }

  const headerRow = () => {
    doc.setFillColor(241, 245, 249)
    doc.rect(M, y, tableW, 20, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...SUB)
    let cx = M
    COLUMNS.forEach((c) => {
      doc.text(clean(c.label).toUpperCase(), cx + 6, y + 13)
      cx += c.w
    })
    y += 20
  }

  // ── page one ───────────────────────────────────────────────────────────
  band(doc, { width: W, org, right: `${orders.length}${total && total !== orders.length ? ` of ${total}` : ''}`, rightLabel: 'Work orders on this sheet' })

  y = 104
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...INK)
  doc.text('Work order register', M, y)
  y += 18

  // The scope line is the point of the whole export. Somebody who filtered to
  // Critical and open, printed it, and walked away with a sheet that looks
  // identical to the unfiltered register has been handed a trap.
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...SUB)
  const scopeLines = doc.splitTextToSize(clean(scope || 'The whole register, unfiltered.'), W - M * 2)
  scopeLines.forEach((line, i) => doc.text(line, M, y + i * 12))
  y += scopeLines.length * 12 + 8

  doc.setFontSize(8.5)
  doc.setTextColor(...MUTE)
  doc.text(clean(`Exported ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`), M, y)
  y += 16

  headerRow()

  // ── rows ───────────────────────────────────────────────────────────────
  doc.setFontSize(8.5)
  orders.forEach((wo, index) => {
    const asset = doc.splitTextToSize(clean(wo._asset || wo.assetId), COLUMNS[2].w - 12).slice(0, 2)
    const rowH = Math.max(20, asset.length * 10 + 10)

    if (y + rowH > H - M - 30) {
      footer()
      doc.addPage()
      y = M
      headerRow()
      doc.setFontSize(8.5)
    }

    // Banded rather than ruled between every row: nine columns of short strings
    // under horizontal rules turns into a grid the eye loses its place in, and
    // this sheet gets read across rather than down.
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252)
      doc.rect(M, y, tableW, rowH, 'F')
    }

    let cx = M
    const cell = (value, w, opts = {}) => {
      doc.setFont('helvetica', opts.bold ? 'bold' : 'normal')
      doc.setTextColor(...(opts.color || INK))
      const line = doc.splitTextToSize(clean(value), w - 12)[0] || '-'
      doc.text(line, cx + 6, y + 13)
      cx += w
    }

    cell(wo.workOrderId, COLUMNS[0].w, { bold: true })
    cell(wo.dateRaised, COLUMNS[1].w, { color: SUB })

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...INK)
    asset.forEach((line, i) => doc.text(line, cx + 6, y + 13 + i * 10))
    cx += COLUMNS[2].w

    cell(wo._site, COLUMNS[3].w, { color: SUB })
    // The one distinction the sheet exists to show, so it carries the accent
    // rather than sitting in the same grey as the rest of the row.
    cell(wo.triggerSource, COLUMNS[4].w, { color: wo._conditionBased ? ACCENT : SUB, bold: !!wo._conditionBased })
    cell(wo.alertId || '-', COLUMNS[5].w, { color: SUB })
    cell(wo.priority, COLUMNS[6].w, { bold: true, color: PRIORITY_RGB[wo.priority] || SUB })
    cell(wo.status, COLUMNS[7].w, { color: wo.status === 'Completed' ? [4, 120, 87] : [180, 83, 9] })
    cell(wo.assignedTo, COLUMNS[8].w, { color: SUB })

    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.4)
    doc.line(M, y + rowH, M + tableW, y + rowH)
    y += rowH
  })

  if (!orders.length) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9.5)
    doc.setTextColor(...MUTE)
    doc.text('No work order matches these filters.', M + 6, y + 16)
    y += 30
  }

  // ── what the list adds up to ───────────────────────────────────────────
  //
  // The same four counts the screen shows above the table, recomputed over the
  // exported rows. A total taken from the unfiltered register on a filtered
  // sheet is the same lie as exporting the wrong rows, one line further down.
  const counts = [
    ['Work orders', orders.length],
    ['Condition-triggered', orders.filter((w) => w._conditionBased).length],
    ['Completed', orders.filter((w) => w.status === 'Completed').length],
    ['Open', orders.filter((w) => w.status !== 'Completed').length],
  ]
  if (y + 46 > H - M - 30) {
    footer()
    doc.addPage()
    y = M
  }
  y += 14
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...SUB)
  doc.text(clean(counts.map(([label, n]) => `${label}: ${n}`).join('   ·   ')), M, y)

  footer()
  // The count is in the filename on purpose: a filtered export and a full one
  // landing in the same downloads folder under the same name is how the wrong
  // sheet gets attached to an email.
  const name = `work-orders-${orders.length}${total && total !== orders.length ? `-of-${total}` : ''}.pdf`
  doc.save(name)
  return name
}
