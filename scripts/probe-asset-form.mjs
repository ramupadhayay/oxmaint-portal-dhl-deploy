// Add an asset from the page, then edit it — and check both stuck.
//
//   node scripts/probe-asset-form.mjs
//
// The whole point of moving this off a modal is the fields a modal dropped, so
// the check fills one from each section and reads them back off the record page.
// The asset is deleted at the end; this dev server shares a database with the
// deployed portals.
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const OUT = process.env.OUT || process.cwd()
const BASE = 'http://localhost:3000/portal/oxmaint'
const NAME = 'Probe Compressor 99'

const b = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox'],
})
const p = await b.newPage()
await p.setViewport({ width: 1500, height: 1200 })

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

// A labelled text/number/date input.
const type = (label, value) => p.evaluate(([l, v]) => {
  const box = [...document.querySelectorAll('label')]
    .find((e) => (e.innerText || '').replace('*', '').trim() === l)?.parentElement
  const input = box?.querySelector('input, textarea')
  if (!input) return false
  const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(input, v)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  return true
}, [label, value])

// A shadcn Select: click the trigger, then the option by its text.
const choose = async (label, option) => {
  const opened = await p.evaluate((l) => {
    const box = [...document.querySelectorAll('label')]
      .find((e) => (e.innerText || '').replace('*', '').trim() === l)?.parentElement
    const trig = box?.querySelector('[role="combobox"]')
    if (!trig) return false
    trig.click()
    return true
  }, label)
  if (!opened) return false
  await new Promise((r) => setTimeout(r, 450))
  const picked = await p.evaluate((o) => {
    const item = [...document.querySelectorAll('[role="option"]')]
      .find((e) => (e.innerText || '').trim() === o)
    if (!item) return false
    item.click()
    return true
  }, option)
  await new Promise((r) => setTimeout(r, 400))
  return picked
}

// ── add ───────────────────────────────────────────────────────────────────
await p.goto(`${BASE}/assets/new`, { waitUntil: 'networkidle0', timeout: 240000 })
await new Promise((r) => setTimeout(r, 2200))

const form = await p.evaluate(() => {
  const t = document.body.innerText
  return ['Basic information', 'Equipment details', 'Dates and timeline',
    'Financial information', 'Maintenance information'].filter((s) => t.includes(s))
})
console.log(`add form   : ${form.length}/5 sections (${form.join(', ')})`)

console.log(`name       : ${await type('Asset name', NAME)}`)
console.log(`type       : ${await choose('Type', 'Air Handling Unit')}`)
const site = await p.evaluate(() => {
  const box = [...document.querySelectorAll('label')].find((e) => (e.innerText || '').replace('*', '').trim() === 'Site')?.parentElement
  box?.querySelector('[role="combobox"]')?.click()
  return true
})
await new Promise((r) => setTimeout(r, 450))
const siteName = await p.evaluate(() => {
  const first = [...document.querySelectorAll('[role="option"]')][0]
  const n = first?.innerText.trim()
  first?.click()
  return n
})
console.log(`site       : ${site ? siteName : 'FAILED'}`)
await new Promise((r) => setTimeout(r, 500))

// One field from each of the other sections — the ones a modal used to drop.
console.log(`serial     : ${await type('Serial number', 'SN-PROBE-001')}`)
console.log(`cost       : ${await type('Purchase cost', '48000')}`)
console.log(`supplier   : ${await type('Supplier', 'Probe Supplies Ltd')}`)
await p.screenshot({ path: path.join(OUT, 'ox-asset-add.png') })

console.log(`create     : ${await click('Create asset') ? 'clicked' : 'BUTTON MISSING'}`)
await new Promise((r) => setTimeout(r, 4000))

const after = await p.evaluate(() => ({
  url: location.pathname,
  h1: document.querySelector('h1')?.textContent?.trim(),
  serial: document.body.innerText.includes('SN-PROBE-001'),
  supplier: document.body.innerText.includes('Probe Supplies Ltd'),
  cost: /\$48,000/.test(document.body.innerText),
}))
console.log(`landed     : ${after.url}  "${after.h1}"`)
console.log(`kept       : serial=${after.serial} · cost=${after.cost} · supplier=${after.supplier}`)
await p.screenshot({ path: path.join(OUT, 'ox-asset-created.png') })

const newId = after.url.split('/').pop()

// ── edit ──────────────────────────────────────────────────────────────────
await p.goto(`${BASE}/assets/${newId}/edit`, { waitUntil: 'networkidle0', timeout: 240000 })
await new Promise((r) => setTimeout(r, 2400))
const prefilled = await p.evaluate((n) => {
  const box = [...document.querySelectorAll('label')].find((e) => (e.innerText || '').replace('*', '').trim() === 'Asset name')?.parentElement
  return box?.querySelector('input')?.value === n
}, NAME)
console.log(`edit form  : prefilled=${prefilled}`)

console.log(`rename     : ${await type('Asset name', `${NAME} (edited)`)}`)
console.log(`save       : ${await click('Save changes') ? 'clicked' : 'BUTTON MISSING'}`)
await new Promise((r) => setTimeout(r, 4000))
const edited = await p.evaluate(() => ({
  url: location.pathname,
  h1: document.querySelector('h1')?.textContent?.trim(),
}))
console.log(`after edit : ${edited.url}  "${edited.h1}"`)
await p.screenshot({ path: path.join(OUT, 'ox-asset-edited.png') })

// ── clean up ──────────────────────────────────────────────────────────────
//
// Only the asset this run created. The `asset` kind also holds overlay records
// against seeded assets — a status change, a criticality edit — written by
// whoever was last on the screen. Deleting the whole kind takes those with it,
// which is exactly what an earlier version of this script did.
const removed = await p.evaluate(async (mine) => {
  const r = await fetch(`/api/oxmaint/records?kind=asset&recordId=${mine}`)
  const j = await r.json()
  if (!(j.records || []).length) return []
  await fetch(`/api/oxmaint/records?kind=asset&recordId=${mine}`, { method: 'DELETE' })
  return [mine]
}, newId)
console.log(`cleaned    : ${removed.length} record(s)`)
console.log(`errors     : ${errs.length ? errs.slice(0, 3).join(' | ') : 'none'}`)

await b.close()
