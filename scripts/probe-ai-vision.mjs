// Click a camera panel and check the detection modal opens with real content.
//
//   node scripts/probe-ai-vision.mjs
//
// The reference frames may not be on disk yet; the panel falls back to its
// striped placeholder and everything else still has to work, which is what this
// checks. Image 404s are expected and are reported separately from real errors.
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const OUT = process.env.OUT || process.cwd()
const b = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox'],
})
const p = await b.newPage()
await p.setViewport({ width: 1500, height: 1050 })

const missingImages = new Set()
const errs = []
p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 180)))
p.on('response', (r) => { if (r.status() === 404 && /\/oxmaint\/vision\//.test(r.url())) missingImages.add(r.url().split('/').pop()) })
p.on('console', (m) => {
  const t = m.text()
  if (m.type() === 'error' && !/Failed to load resource/.test(t)) errs.push('console: ' + t.slice(0, 180))
})

await p.goto('http://localhost:3000/portal/oxmaint/ai-vision', { waitUntil: 'networkidle0', timeout: 240000 })
await new Promise((r) => setTimeout(r, 2000))

const grid = await p.evaluate(() => {
  const panels = [...document.querySelectorAll('[role="button"][title^="Open CAM"]')]
  return {
    panels: panels.length,
    firstTitle: panels[0]?.getAttribute('title') || '',
    saysDetections: panels.filter((e) => /detection/i.test(e.innerText)).length,
    saysView: panels.filter((e) => /View detections/.test(e.innerText)).length,
  }
})
console.log(`panels        : ${grid.panels}  (${grid.firstTitle})`)
console.log(`detection line: ${grid.saysDetections}/${grid.panels}   "View detections": ${grid.saysView}/${grid.panels}`)
await p.screenshot({ path: path.join(OUT, 'ox-vision-grid.png') })

const opened = await p.evaluate(() => {
  const el = [...document.querySelectorAll('[role="button"][title^="Open CAM"]')]
    .find((e) => !/offline/i.test(e.innerText))
  if (!el) return false
  el.click()
  return true
})
console.log(`click         : ${opened ? 'opened an online camera' : 'NO ONLINE PANEL FOUND'}`)
await new Promise((r) => setTimeout(r, 1400))

const modal = await p.evaluate(() => {
  const t = document.body.innerText
  return {
    watches: t.includes('What this camera watches'),
    detections: (t.match(/Detections in this frame \((\d+)\)/) || [])[1],
    alerts: (t.match(/Alerts raised by this camera \((\d+)\)/) || [])[1],
    illustrative: t.includes('Illustrative reference frame'),
    caveat: t.includes('no video is carried into this portal') || t.includes('no video is'),
    facts: ['Status', 'Location', 'Assets in frame', 'Frame rate', 'Mean confidence', 'Inferences today']
      .filter((k) => t.includes(k)).length,
  }
})
console.log(`modal         : watches=${modal.watches} · detections=${modal.detections} · alerts=${modal.alerts} · facts=${modal.facts}/6`)
console.log(`honesty       : "Illustrative" label=${modal.illustrative} · caveat=${modal.caveat}`)
await p.screenshot({ path: path.join(OUT, 'ox-vision-modal.png') })

console.log(`frames missing: ${missingImages.size ? [...missingImages].join(', ') : 'none — all present'}`)
console.log(`errors        : ${errs.length ? errs.slice(0, 3).join(' | ') : 'none'}`)
await b.close()
