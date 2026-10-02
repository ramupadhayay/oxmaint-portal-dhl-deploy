// Browser check for the CMMS portal. Status codes hide client-side breakage, so
// this renders each screen and reports React errors and console errors too.
//
//   node scripts/verify-oxmaint.mjs [section ...]
//
// Chrome must be driven at http://localhost, never 127.0.0.1 — Next's dev server
// answers 403 for its own chunks cross-origin, which leaves a page rendered but
// unhydrated and every interactive check silently false.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = process.env.OUT || ROOT
const BASE = process.env.OX_BASE || 'http://localhost:3000'
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const SECTIONS = process.argv.slice(2).length ? process.argv.slice(2) : [
  'my-tasks', 'work-orders', 'requests', 'pm-schedules', 'approvals',
  'lubrication', 'workflow-designer', 'inspections', 'reminder',
  'incidents', 'checklists', 'rca', 'ai-vision',
]

const browser = await puppeteer.launch({ headless: 'new', executablePath: CHROME, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1500, height: 1050 })

let bad = 0
for (const s of SECTIONS) {
  const errs = []
  const onErr = (e) => errs.push(String(e.message || e).slice(0, 170))
  const onLog = (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 170)) }
  page.on('pageerror', onErr)
  page.on('console', onLog)

  const res = await page.goto(`${BASE}/portal/oxmaint/${s}`, { waitUntil: 'networkidle0', timeout: 240000 })
  await new Promise((r) => setTimeout(r, 1600))
  const h1 = await page.evaluate(() => document.querySelector('h1,h2')?.textContent?.trim().slice(0, 44) || '')
  await page.screenshot({ path: path.join(OUT, `ox-${s}.png`) })

  const state = errs.length ? `ERR ${errs[0]}` : 'ok'
  if (state !== 'ok') bad += 1
  console.log(`${s.padEnd(19)} ${res.status()}  ${h1.padEnd(30)} ${state}`)

  page.off('pageerror', onErr)
  page.off('console', onLog)
}
console.log(bad ? `\n${bad} section(s) need attention` : '\nall sections clean')
await browser.close()
