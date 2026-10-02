// Approve one request from the card, check it moves, then put it back.
//
//   node scripts/probe-approvals.mjs
//
// A decision here writes to the record it belongs to — a work order, a purchase
// order — not to an approvals table of its own, so the check has to follow it
// there. The write is reverted at the end; this dev server shares a database
// with the deployed portals.
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const OUT = process.env.OUT || process.cwd()
const URL = 'http://localhost:3000/portal/oxmaint/approvals'

const b = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox'],
})
const p = await b.newPage()
await p.setViewport({ width: 1500, height: 1100 })

const errs = []
p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 180)))
p.on('console', (m) => {
  const t = m.text()
  if (m.type() === 'error' && !/Failed to load resource/.test(t)) errs.push('console: ' + t.slice(0, 180))
})

const tabCounts = () => p.evaluate(() => {
  const t = document.body.innerText
  const g = (l) => {
    const m = t.match(new RegExp(l + '\\s*\\n?\\s*(\\d+)'))
    return m ? m[1] : '0'
  }
  return { pending: g('Pending'), approved: g('Approved'), rejected: g('Rejected') }
})

// Which records already carry a decision, so the revert only undoes ours.
const decided = () => p.evaluate(async () => {
  const r = await fetch('/api/oxmaint/records')
  const j = await r.json()
  const out = []
  for (const kind of ['work_order', 'purchase_order', 'scrap', 'permit']) {
    for (const row of j.byKind?.[kind] || []) {
      if (row.approval_status) out.push(`${kind}/${row.recordId}/${row.approval_status}`)
    }
  }
  return out
})

await p.goto(URL, { waitUntil: 'networkidle0', timeout: 240000 })
await new Promise((r) => setTimeout(r, 2400))

const before = await tabCounts()
const wasDecided = await decided()
console.log(`before     : pending=${before.pending} approved=${before.approved} rejected=${before.rejected}`)
console.log(`pre-decided: ${wasDecided.length ? wasDecided.join(', ') : 'none'}`)

const card = await p.evaluate(() => {
  const el = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === 'Approve')
  if (!el) return null
  const c = el.closest('div.h-full') || el.parentElement.parentElement
  const ref = (c?.innerText || '').match(/\b((?:WO|PO|SCR|PTW)-\d+)\b/)
  el.click()
  return ref ? ref[1] : '(no ref found)'
})
console.log(`approved   : ${card || 'NO APPROVE BUTTON'}`)
await new Promise((r) => setTimeout(r, 3500))

const after = await tabCounts()
console.log(`after      : pending=${after.pending} approved=${after.approved} rejected=${after.rejected}`)
console.log(`moved      : ${Number(after.pending) === Number(before.pending) - 1 && Number(after.approved) === Number(before.approved) + 1}`)
await p.screenshot({ path: path.join(OUT, 'ox-approvals-after.png') })

// Does it survive a reload? The decision lives on the source record, so this is
// the check that it was written rather than held on screen.
await p.goto(URL, { waitUntil: 'networkidle0', timeout: 240000 })
await new Promise((r) => setTimeout(r, 2400))
const reloaded = await tabCounts()
console.log(`reload     : pending=${reloaded.pending} approved=${reloaded.approved} · persisted=${reloaded.approved === after.approved}`)

// ── revert only what this run decided ─────────────────────────────────────
const reverted = await p.evaluate(async (was) => {
  const r = await fetch('/api/oxmaint/records')
  const j = await r.json()
  const out = []
  for (const kind of ['work_order', 'purchase_order', 'scrap', 'permit']) {
    for (const row of j.byKind?.[kind] || []) {
      if (!row.approval_status) continue
      const key = `${kind}/${row.recordId}/${row.approval_status}`
      if (was.includes(key)) continue
      await fetch(`/api/oxmaint/records?kind=${kind}&recordId=${row.recordId}`, { method: 'DELETE' })
      out.push(key)
    }
  }
  return out
}, wasDecided)
console.log(`reverted   : ${reverted.length ? reverted.join(', ') : 'nothing to revert'}`)
console.log(`errors     : ${errs.length ? errs.slice(0, 3).join(' | ') : 'none'}`)

await b.close()
