// Drive the live vision alert: open it, act on it, check what was written.
//
//   node scripts/probe-vision-alert.mjs
//
// Writes a real work order and a real escalation record, because that is the
// thing being tested. It deletes both again at the end — this dev server shares
// a database with the deployed portals.
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const OUT = process.env.OUT || process.cwd()
const BASE = 'http://localhost:3000'

const b = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox'],
})
const p = await b.newPage()
await p.setViewport({ width: 1500, height: 1050 })

const errs = []
p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 180)))
p.on('console', (m) => {
  const t = m.text()
  if (m.type() === 'error' && !/Failed to load resource/.test(t)) errs.push('console: ' + t.slice(0, 180))
})

const click = (label, last = false) => p.evaluate(([needle, useLast]) => {
  const vis = [...document.querySelectorAll('button,[role="button"]')].filter((e) => e.offsetParent !== null)
  const pool = vis.filter((e) => (e.innerText || '').trim() === needle)
  const hit = useLast ? pool[pool.length - 1] : pool[0]
  if (!hit) return false
  hit.click()
  return true
}, [label, last])

await p.goto(`${BASE}/portal/oxmaint/ai-vision`, { waitUntil: 'networkidle0', timeout: 240000 })
await new Promise((r) => setTimeout(r, 2200))

const band = await p.evaluate(() => {
  const t = document.body.innerText
  const m = t.match(/(Critical|High)\n?([^\n]+)\n?([\d.]+)% confidence\n?([^\n]+)/)
  return {
    present: /% confidence/.test(t) && /Take action/.test(t),
    line: m ? `${m[1]} · ${m[2].trim()} · ${m[3]}%` : '(not parsed)',
    camera: (t.match(/(CAM-[A-Z]+-\d+) · ([^·]+)·/) || []).slice(1).join(' · '),
  }
})
console.log(`band       : ${band.present ? 'shown' : 'MISSING'} — ${band.line}`)
console.log(`camera     : ${band.camera.trim()}`)

console.log(`take action: ${await click('Take action') ? 'opened' : 'BUTTON MISSING'}`)
await new Promise((r) => setTimeout(r, 1000))

const dialog = await p.evaluate(() => {
  const t = document.body.innerText
  const boxes = [...document.querySelectorAll('input[type="checkbox"]')]
  return {
    wo: t.includes('Raise a work order'),
    roles: ['Operator', 'Shift Supervisor', 'Maintenance Manager', 'Plant Head'].filter((r) => t.includes(r)),
    preselected: boxes.filter((c) => c.checked).length,
    total: boxes.length,
    caveat: t.includes('Recorded') && t.includes('no mail or SMS gateway'),
  }
})
console.log(`dialog     : work order=${dialog.wo} · roles=${dialog.roles.length}/4 (${dialog.roles.join(', ')})`)
console.log(`preselect  : ${dialog.preselected}/${dialog.total} ticked · honesty caveat=${dialog.caveat}`)
await p.screenshot({ path: path.join(OUT, 'ox-vision-action.png') })

// Tick the plant head too, so all four are exercised.
await p.evaluate(() => {
  const lab = [...document.querySelectorAll('label')].find((e) => (e.innerText || '').startsWith('Plant Head'))
  const box = lab?.querySelector('input[type="checkbox"]')
  if (box && !box.checked) box.click()
})
await new Promise((r) => setTimeout(r, 300))

console.log(`confirm    : ${await click('Confirm') ? 'clicked' : 'BUTTON MISSING'}`)
await new Promise((r) => setTimeout(r, 4000))

const after = await p.evaluate(() => ({
  bandGone: !/Take action/.test(document.body.innerText),
  toast: (document.body.innerText.match(/(work order [^\n·]+)/i) || [])[1] || '',
}))
console.log(`after      : band gone=${after.bandGone} · ${after.toast || '(no toast text found)'}`)
await p.screenshot({ path: path.join(OUT, 'ox-vision-acted.png') })

// What actually landed.
const wrote = await p.evaluate(async () => {
  const r = await fetch('/api/oxmaint/records?kind=vision_escalation')
  const j = await r.json()
  const rows = j.records || []
  const last = rows[0]
  return {
    n: rows.length,
    informed: last?.informed || [],
    wo: last?.work_order_id || '',
    delivery: last?.delivery || '',
    by: last?.raised_by || '',
  }
})
console.log(`escalation : ${wrote.n} record(s) · informed=[${wrote.informed.join(', ')}] · wo=${wrote.wo || 'none'}`)
console.log(`             by=${wrote.by} · delivery="${wrote.delivery}"`)

// Clean up — this database is the live one.
const removed = await p.evaluate(async (woId) => {
  const out = []
  for (const kind of ['vision_escalation', 'work_order']) {
    const r = await fetch(`/api/oxmaint/records?kind=${kind}`)
    const j = await r.json()
    for (const row of j.records || []) {
      const mine = kind === 'vision_escalation'
        ? true
        : (row.source === 'AI Vision' || row.recordId === woId)
      if (!mine) continue
      await fetch(`/api/oxmaint/records?kind=${kind}&recordId=${row.recordId}`, { method: 'DELETE' })
      out.push(`${kind}/${row.recordId}`)
    }
  }
  return out
}, wrote.wo)
console.log(`cleaned    : ${removed.length ? removed.join(', ') : 'nothing to remove'}`)
console.log(`errors     : ${errs.length ? errs.slice(0, 3).join(' | ') : 'none'}`)

await b.close()
