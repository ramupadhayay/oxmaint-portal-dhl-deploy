// Open an asset from the register and check its record page.
//
//   node scripts/probe-assets.mjs
//
// The point of this rebuild is that an asset has a page rather than a drawer, so
// the check is that a card routes to it and that the page is filled from the
// work orders and inspections that actually name the asset.
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const OUT = process.env.OUT || process.cwd()
const BASE = 'http://localhost:3000/portal/oxmaint'

const b = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox'],
})
const p = await b.newPage()
await p.setViewport({ width: 1500, height: 1150 })

const errs = []
p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 180)))
p.on('console', (m) => {
  const t = m.text()
  if (m.type() === 'error' && !/Failed to load resource/.test(t)) errs.push('console: ' + t.slice(0, 180))
})

await p.goto(`${BASE}/assets`, { waitUntil: 'networkidle0', timeout: 240000 })
await new Promise((r) => setTimeout(r, 2400))

const list = await p.evaluate(() => {
  const t = document.body.innerText
  return {
    cards: document.querySelectorAll('[class*="cursor-pointer"]').length,
    toggle: [...document.querySelectorAll('button[title]')].map((e) => e.getAttribute('title')).filter((x) => ['Cards', 'List'].includes(x)),
    shown: (t.match(/(\d+) shown/) || [])[1],
  }
})
console.log(`list       : ${list.shown} shown · view toggle=[${list.toggle.join(', ')}]`)

// List view, then back to cards — both have to render.
await p.evaluate(() => [...document.querySelectorAll('button[title="List"]')][0]?.click())
await new Promise((r) => setTimeout(r, 900))
const rowsSeen = await p.evaluate(() => document.querySelectorAll('button.flex.w-full.items-center').length)
console.log(`list view  : ${rowsSeen} rows`)
await p.screenshot({ path: path.join(OUT, 'ox-assets-list.png') })

await p.evaluate(() => [...document.querySelectorAll('button[title="Cards"]')][0]?.click())
await new Promise((r) => setTimeout(r, 800))

// Open the first card.
const opened = await p.evaluate(() => {
  const card = [...document.querySelectorAll('[class*="cursor-pointer"]')]
    .find((e) => /^[A-Z]{3}-/.test((e.innerText || '').trim()))
  if (!card) return null
  const code = (card.innerText || '').split('\n')[0]
  card.click()
  return code
})
console.log(`clicked    : ${opened || 'NO CARD FOUND'}`)
await new Promise((r) => setTimeout(r, 3000))

const detail = await p.evaluate(() => {
  const t = document.body.innerText
  const panels = ['Basic information', 'Condition', 'Performance', 'Maintenance',
    'Inspections', 'Financial', 'IoT & PLC', 'What the record says']
  return {
    url: location.pathname,
    h1: document.querySelector('h1')?.textContent?.trim(),
    panels: panels.filter((x) => t.includes(x)),
    statusButtons: ['Operational', 'Under Maintenance', 'Down']
      .filter((s) => [...document.querySelectorAll('button')].some((e) => e.innerText.trim() === s)).length,
    openWo: (t.match(/Open work orders\s*\n?\s*(\d+)/) || [])[1],
    history: (t.match(/Work order history\s*\n?\s*(\d+)/) || [])[1],
    spend: (t.match(/Maintenance spend\s*\n?\s*(\$[\d,]+)/) || [])[1],
    back: t.includes('Back to Asset Master'),
  }
})
console.log(`url        : ${detail.url}`)
console.log(`asset      : ${detail.h1}`)
console.log(`panels     : ${detail.panels.length}/8  (${detail.panels.join(', ')})`)
console.log(`controls   : ${detail.statusButtons}/3 status buttons · back link=${detail.back}`)
console.log(`derived    : open WOs=${detail.openWo} · history=${detail.history} · spend=${detail.spend}`)
await p.screenshot({ path: path.join(OUT, 'ox-asset-detail.png'), fullPage: false })

console.log(`errors     : ${errs.length ? errs.slice(0, 3).join(' | ') : 'none'}`)
await b.close()
