// The client handover pack — the document that goes out by email when the
// portal is handed over.
//
// Three pages and no more: what the portal is, how each person signs in, and
// what is working in it today. It carries live credentials, so the button that
// makes it is administrator-only and the document says on its face that it is
// not a thing to forward.
//
// The module list is read from lib/help.js rather than typed again here. That
// file is already the manual, and a handover pack that describes the portal in
// its own words is a second description to keep in step — which nobody does.

import { HELP, HELP_ORDER } from './help'
import { ORG, permits, requirements, parameters, deviations } from './data'

const M = 46
const HEAD_BASE = 50
const BODY_TOP = 88
const FOOT = 58

const TEAL = [15, 118, 110]
const DEEP = [15, 23, 42]
const BODY = [51, 65, 85]
const SOFT = [110, 125, 140]
const RULE = [214, 226, 224]
const WASH = [240, 253, 250]
const WARN_BG = [255, 251, 235]
const WARN_BD = [253, 230, 138]
const WARN_INK = [146, 64, 14]

export const CONTACT = 'contact@ifactoryapp.com'

// Where the client actually signs in. The pack is often built on a developer's
// machine, and printing http://localhost:3000 in a document that goes to the
// client by email is worse than printing nothing — so an address that only
// resolves on the machine that made it is replaced by the real one.
const PUBLIC_SIGN_IN = 'https://waga.ifactoryai.com/portal/waga/login'
const publicUrl = (u) => (!u || /\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|\/|$)/i.test(u)
  ? PUBLIC_SIGN_IN
  : u)

// jsPDF's built-in fonts are CP1252. Anything outside it draws as a stray glyph
// with the wrong width, so it is mapped down before it reaches the page.
const CP1252 = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'
const T = (s) => String(s ?? '')
  .replace(/[→⇒➡]/g, '->').replace(/[←⇐]/g, '<-')
  .replace(/ /g, ' ')
  .split('').filter((c) => c.charCodeAt(0) <= 0xFF || CP1252.includes(c)).join('')

export async function handoverPdf({ members = [], byEmail = {}, signInUrl } = {}) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const width = W - M * 2
  let y = BODY_TOP
  let running = 'Client handover pack'

  const header = () => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...TEAL)
    doc.text('iFactory AI', M, HEAD_BASE)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...SOFT)
    doc.text(T(running), W - M, HEAD_BASE, { align: 'right' })
    doc.setDrawColor(...RULE); doc.setLineWidth(0.7)
    doc.line(M, HEAD_BASE + 11, W - M, HEAD_BASE + 11)
  }
  const page = () => { doc.addPage(); header(); y = BODY_TOP }
  const room = (h) => { if (y + h > H - FOOT) page() }

  const title = (t, size = 19) => {
    room(size + 16)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(size); doc.setTextColor(...DEEP)
    for (const ln of doc.splitTextToSize(T(t), width)) { doc.text(ln, M, y); y += size + 4 }
    y += 4
  }
  const h2 = (t) => {
    room(38)
    y += 8
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...TEAL)
    doc.text(T(t).toUpperCase(), M, y); y += 15
  }
  const para = (t, { size = 10.5, color = BODY, gap = 14.5, after = 2, indent = 0 } = {}) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(...color)
    for (const ln of doc.splitTextToSize(T(t), width - indent)) { room(gap); doc.text(ln, M + indent, y); y += gap }
    y += after
  }

  /* ── page 1 · what this is ─────────────────────────────────────────────── */

  doc.setFillColor(...TEAL); doc.rect(0, 0, W, 5, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...TEAL)
  doc.text('iFactory AI', M, 54)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...SOFT)
  doc.text('Client handover pack', W - M, 54, { align: 'right' })
  doc.setDrawColor(...RULE); doc.setLineWidth(0.7); doc.line(M, 66, W - M, 66)
  y = 100

  title(`${ORG.name} — Compliance & EHS Portal`, 22)
  para('This pack is everything needed to start using the portal: what it is, how each person signs '
    + 'in, and which parts of it are live today.', { size: 11.5, gap: 16, after: 8 })

  h2('What the portal is')
  para('A single place for the compliance and EHS work the trial covers. The permits and the '
    + 'obligations they impose are imported from the supplied workbook and never edited; what the '
    + 'portal adds on top is the record of the work done against them — a filing marked, a reading '
    + 'logged, a deviation raised and closed, a safety assessment signed.')
  para('Every figure traces back to the document it was read from, and every change made in the '
    + 'portal is written to an append-only audit trail on the Source & Verification screen.')

  h2('What the trial covers')
  const stats = [
    ['Trial sites', String(ORG.siteCount)],
    ['Permits tracked', String(permits.length)],
    ['Obligations in the register', String(requirements.length)],
    ['Limits and parameters', String(parameters.length)],
    ['Deviations recorded', String(deviations.length)],
  ]
  const rowH = 22
  const boxH = rowH * stats.length + 18
  room(boxH)
  doc.setFillColor(...WASH); doc.setDrawColor(...RULE); doc.setLineWidth(0.7)
  doc.roundedRect(M, y, width, boxH, 8, 8, 'FD')
  let sy = y + 22
  for (const [k, v] of stats) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...BODY)
    doc.text(T(k), M + 16, sy)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...DEEP)
    doc.text(v, W - M - 16, sy, { align: 'right' })
    sy += rowH
  }
  y += boxH + 12

  h2('Where it lives')
  para(publicUrl(signInUrl), { size: 11, color: TEAL, after: 4 })
  para('The portal is per-user: everyone signs in with their own email address, and what they can '
    + 'see is decided by their account rather than by a shared password.')

  /* ── page 2 · the accounts ─────────────────────────────────────────────── */

  running = 'Access and credentials'
  page()
  title('Signing in')
  para('Open the address above, enter your own email and the password beside your name, and you '
    + 'land on the Getting Started screen. The Help button in the corner of every screen explains '
    + 'that screen and can be downloaded as a guide.')

  room(58)
  doc.setFillColor(...WARN_BG); doc.setDrawColor(...WARN_BD); doc.setLineWidth(0.7)
  doc.roundedRect(M, y, width, 46, 8, 8, 'FD')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...WARN_INK)
  doc.text('THIS PAGE CARRIES LIVE PASSWORDS', M + 14, y + 19)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5)
  doc.text(T('Send it only to the people named on it, and ask each of them to change their password after the first sign-in.'), M + 14, y + 35)
  y += 58

  h2(`Accounts (${members.length})`)

  // The table draws itself rather than leaning on a helper, so a long name can
  // wrap without shunting the password out of its column.
  const COLS = [
    { k: 'name', label: 'Name', w: 0.26 },
    { k: 'email', label: 'Email', w: 0.32 },
    { k: 'dept', label: 'Department', w: 0.19 },
    { k: 'pw', label: 'Password', w: 0.23 },
  ].map((c) => ({ ...c, px: c.w * width }))

  const headRow = () => {
    room(26)
    doc.setFillColor(245, 249, 248); doc.setDrawColor(...RULE); doc.setLineWidth(0.7)
    doc.rect(M, y - 12, width, 22, 'FD')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...SOFT)
    let x = M + 8
    for (const c of COLS) { doc.text(T(c.label).toUpperCase(), x, y + 3); x += c.px }
    y += 20
  }
  headRow()

  for (const m of members) {
    const login = byEmail[String(m.email || '').toLowerCase()] || {}
    const cell = {
      name: m.name || '—',
      email: m.email || '—',
      dept: m.department || '—',
      pw: login.password || (login.role === 'admin' ? '(admin)' : 'not issued yet'),
    }
    const lines = {}
    let tall = 1
    for (const c of COLS) {
      lines[c.k] = doc.splitTextToSize(T(cell[c.k]), c.px - 12)
      tall = Math.max(tall, lines[c.k].length)
    }
    const rh = tall * 12 + 10
    if (y + rh > H - FOOT) { page(); headRow() }

    let x = M + 8
    for (const c of COLS) {
      const admin = login.role === 'admin'
      doc.setFont('helvetica', c.k === 'pw' ? 'bold' : 'normal')
      doc.setFontSize(c.k === 'pw' ? 9.5 : 9.5)
      doc.setTextColor(...(c.k === 'pw' ? DEEP : BODY))
      lines[c.k].forEach((ln, i) => doc.text(ln, x, y + 4 + i * 12))
      if (c.k === 'name' && admin) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...TEAL)
        doc.text('ADMINISTRATOR', x, y + 4 + lines.name.length * 12)
      }
      x += c.px
    }
    y += rh
    doc.setDrawColor(...RULE); doc.setLineWidth(0.5)
    doc.line(M, y - 6, W - M, y - 6)
  }
  y += 8
  para('An administrator can see every password on the Team screen. Everyone else sees only their '
    + 'own account.', { size: 9.5, color: SOFT, gap: 13 })

  /* ── page 3 · what is working ──────────────────────────────────────────── */

  running = 'What is working today'
  page()
  title('What is working today')
  para('Every screen below is live. You can open it, work it, and what you record is kept — filings, '
    + 'readings, deviations, assessments and incidents are all saved against the trial. The data '
    + 'shown is illustrative until the live import is signed off, so fill in your own detail as you go '
    + 'and it becomes the record.')

  // Two columns, drawn ROW BY ROW rather than column by column.
  //
  // Flowing each column independently is the obvious way and it looks wrong:
  // every entry starts wherever the one above it happened to end, so a
  // three-line description on the left pushes its column out of step with the
  // right and nothing after the first row lines up. Pairing them and giving the
  // row the height of its taller half costs a little white space and buys a
  // page that reads as a grid.
  const GUT = 22
  const colW = (width - GUT) / 2
  const entries = HELP_ORDER.map((k) => HELP[k]).filter(Boolean)
  const half = Math.ceil(entries.length / 2)
  const rows = Array.from({ length: half }, (_, i) => [entries[i], entries[i + half]])

  const measure = (h) => {
    const name = doc.splitTextToSize(T(h.title), colW - 58)
    const body = doc.splitTextToSize(T(h.purpose), colW - 10)
    return { name, body, height: Math.max(name.length * 12.5, 12.5) + 2 + body.length * 11 + 10 }
  }

  const drawEntry = (x, top, m) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...DEEP)
    m.name.forEach((ln, i) => doc.text(ln, x, top + i * 12.5))

    const pw = 50
    doc.setFillColor(...WASH); doc.setDrawColor(...RULE); doc.setLineWidth(0.6)
    doc.roundedRect(x + colW - pw, top - 8.5, pw, 13, 6.5, 6.5, 'FD')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...TEAL)
    doc.text('WORKING', x + colW - pw / 2, top + 0.5, { align: 'center' })

    let by = top + Math.max(m.name.length * 12.5, 12.5) + 2
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.8); doc.setTextColor(...BODY)
    m.body.forEach((ln) => { doc.text(ln, x + 10, by); by += 11 })
  }

  for (const [left, right] of rows) {
    const ml = left ? measure(left) : null
    const mr = right ? measure(right) : null
    const rowH = Math.max(ml?.height || 0, mr?.height || 0)
    room(rowH)
    if (ml) drawEntry(M, y, ml)
    if (mr) drawEntry(M + colW + GUT, y, mr)
    y += rowH
  }
  y += 4

  /* ── contact ───────────────────────────────────────────────────────────── */

  h2('Questions')
  const cRows = [['Product', 'iFactory AI — Compliance & EHS portal'], ['Client', ORG.name], ['Contact', CONTACT]]
  const ch = 26 * cRows.length + 22
  room(ch)
  doc.setFillColor(...WASH); doc.setDrawColor(...RULE); doc.setLineWidth(0.7)
  doc.roundedRect(M, y, width, ch, 8, 8, 'FD')
  let cy = y + 24
  for (const [k, v] of cRows) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...SOFT)
    doc.text(T(k), M + 16, cy)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...DEEP)
    doc.text(T(v), M + 92, cy)
    cy += 26
  }
  y += ch + 10
  para(`Anything this pack does not answer, write to ${CONTACT}.`, { size: 9.5, color: SOFT, gap: 13 })

  /* ── footer on every page ──────────────────────────────────────────────── */

  const n = doc.internal.getNumberOfPages()
  for (let p = 1; p <= n; p += 1) {
    doc.setPage(p)
    doc.setDrawColor(...RULE); doc.setLineWidth(0.7)
    doc.line(M, H - 40, W - M, H - 40)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...SOFT)
    doc.text(T(`iFactory AI — ${ORG.name} handover pack  ·  confidential  ·  ${CONTACT}`), M, H - 27)
    doc.text(`${p} of ${n}`, W - M, H - 27, { align: 'right' })
  }

  doc.save(`iFactory-AI-${String(ORG.name).replace(/[^\w]+/g, '-')}-Handover-Pack.pdf`)
}
