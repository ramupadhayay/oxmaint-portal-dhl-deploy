// Build a workflow, pause a rule, reload, and check both survived.
//
//   node scripts/probe-workflow.mjs
//
// Writes real records because that is the thing under test, and deletes them
// again — this dev server shares a database with the deployed portals.
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const OUT = process.env.OUT || process.cwd()
const URL = 'http://localhost:3000/portal/oxmaint/workflow-designer'

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

const click = (label, last = false) => p.evaluate(([needle, useLast]) => {
  const vis = [...document.querySelectorAll('button,[role="button"]')].filter((e) => e.offsetParent !== null)
  const pool = vis.filter((e) => (e.innerText || '').trim() === needle)
  const hit = useLast ? pool[pool.length - 1] : pool[0]
  if (!hit) return false
  hit.click()
  return true
}, [label, last])

const counts = () => p.evaluate(() => {
  const t = document.body.innerText
  const g = (l) => {
    const i = t.indexOf(l)
    if (i < 0) return '?'
    const m = t.slice(i + l.length, i + l.length + 24).match(/\d+/)
    return m ? m[0] : '?'
  }
  return { total: g('WORKFLOWS'), active: g('ACTIVE'), paused: g('PAUSED'), draft: g('DRAFT') }
})

const NAME = 'Probe — escalate breakdowns'

await p.goto(URL, { waitUntil: 'networkidle0', timeout: 240000 })
await new Promise((r) => setTimeout(r, 2200))
const before = await counts()
console.log(`before     : workflows=${before.total} active=${before.active} paused=${before.paused} draft=${before.draft}`)

// ── build one ─────────────────────────────────────────────────────────────
console.log(`new        : ${await click('New workflow') ? 'builder opened' : 'BUTTON DEAD'}`)
await new Promise((r) => setTimeout(r, 900))

await p.evaluate((name) => {
  const set = (el, v) => {
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement : HTMLInputElement
    Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, v)
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  }
  const labelled = (txt) => [...document.querySelectorAll('label')]
    .find((l) => (l.innerText || '').startsWith(txt))
  set(labelled('Name').querySelector('input'), name)
  set(labelled('When').querySelector('select'), 'Work order raised')
}, NAME)
await new Promise((r) => setTimeout(r, 700))

const picked = await p.evaluate(() => {
  const chip = (t) => [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === t)
  const c = chip('Priority is Critical')
  const a = chip('Notify the maintenance supervisor')
  if (c) c.click()
  if (a) a.click()
  return { condition: Boolean(c), action: Boolean(a) }
})
console.log(`picked     : condition=${picked.condition} action=${picked.action}`)

await p.evaluate(() => {
  const l = [...document.querySelectorAll('label')].find((e) => (e.innerText || '').startsWith('Start as'))
  const sel = l?.querySelector('select')
  if (!sel) return
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, 'Active')
  sel.dispatchEvent(new Event('change', { bubbles: true }))
})
await p.screenshot({ path: path.join(OUT, 'ox-workflow-builder.png') })

console.log(`create     : ${await click('Create workflow') ? 'clicked' : 'BUTTON MISSING'}`)
await new Promise((r) => setTimeout(r, 3500))
const afterCreate = await counts()
console.log(`created    : workflows=${afterCreate.total} active=${afterCreate.active}`)

// ── pause a seeded rule ───────────────────────────────────────────────────
console.log(`pause      : ${await click('Pause') ? 'clicked' : 'BUTTON MISSING'}`)
await new Promise((r) => setTimeout(r, 3000))
const afterPause = await counts()
console.log(`paused     : active=${afterPause.active} paused=${afterPause.paused}`)

// ── reload: did either survive? ───────────────────────────────────────────
await p.goto(URL, { waitUntil: 'networkidle0', timeout: 240000 })
await new Promise((r) => setTimeout(r, 2600))
const reloaded = await counts()
const survived = await p.evaluate((n) => document.body.innerText.includes(n), NAME)
console.log(`reload     : workflows=${reloaded.total} active=${reloaded.active} paused=${reloaded.paused}`)
console.log(`persisted  : new rule=${survived} · pause held=${reloaded.paused > before.paused}`)
await p.screenshot({ path: path.join(OUT, 'ox-workflow-after.png') })

// ── clean up ──────────────────────────────────────────────────────────────
const removed = await p.evaluate(async () => {
  const r = await fetch('/api/oxmaint/records?kind=workflow')
  const j = await r.json()
  const out = []
  for (const row of j.records || []) {
    await fetch(`/api/oxmaint/records?kind=workflow&recordId=${row.recordId}`, { method: 'DELETE' })
    out.push(row.recordId)
  }
  return out
})
console.log(`cleaned    : ${removed.length} record(s)`)
console.log(`errors     : ${errs.length ? errs.slice(0, 3).join(' | ') : 'none'}`)

await b.close()
