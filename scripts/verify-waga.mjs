// Browser check for the WAGA portal.
//
//   node scripts/verify-waga.mjs [section ...]
//
// Two things this has to do that a plain fetch cannot:
//  1. Sign in. The portal is gated per user, so the run mints the same waga_token
//     the login route would issue, from JWT_SECRET in .env.local.
//  2. Drive http://localhost, never 127.0.0.1 — Next's dev server answers 403 for
//     its own chunks cross-origin, which leaves the page rendered but unhydrated.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const puppeteer = (await import('puppeteer-core').catch(() => null))?.default
if (!puppeteer) { console.error('npm i --no-save puppeteer-core'); process.exit(1) }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = process.env.OUT || ROOT
const BASE = process.env.WAGA_BASE || 'http://localhost:3000'
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const AS = process.env.WAGA_USER || 'wagaenergy@gmail.com'

const secret = (fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(/^JWT_SECRET=(.+)$/m) || [])[1]?.trim()
if (!secret) { console.error('No JWT_SECRET in .env.local'); process.exit(1) }
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const iat = Math.floor(Date.now() / 1000)
const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ email: AS, portal: 'waga', iat, exp: iat + 604800 })}`
const TOKEN = `${body}.${crypto.createHmac('sha256', secret).update(body).digest('base64url')}`

const SECTIONS = process.argv.slice(2).length ? process.argv.slice(2) : [
  'getting-started', 'overview', 'sites', 'permits', 'requirements', 'calendar',
  'parameters', 'deviations', 'safety', 'pre-task', 'loto', 'incidents',
  'training', 'reports', 'team', 'sources',
]

const browser = await puppeteer.launch({ headless: 'new', executablePath: CHROME, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 })
await browser.setCookie({ name: 'waga_token', value: TOKEN, domain: 'localhost', path: '/', httpOnly: true })

let bad = 0
for (const s of SECTIONS) {
  const errs = []
  const onErr = (e) => errs.push(String(e.message || e).slice(0, 160))
  const onLog = (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) }
  page.on('pageerror', onErr)
  page.on('console', onLog)

  const res = await page.goto(`${BASE}/portal/waga/${s}`, { waitUntil: 'networkidle0', timeout: 180000 })
  await new Promise((r) => setTimeout(r, 1600))
  const probe = await page.evaluate(() => ({
    h1: document.querySelector('h1,h2')?.textContent?.trim().slice(0, 60),
    onLogin: location.pathname.includes('/login'),
  }))
  await page.screenshot({ path: path.join(OUT, `waga-${s}.png`) })
  const state = probe.onLogin ? 'REDIRECTED TO LOGIN' : errs.length ? `ERR ${errs[0]}` : 'ok'
  if (state !== 'ok') bad += 1
  console.log(`${s.padEnd(16)} ${res.status()}  ${String(probe.h1 || '').padEnd(34)} ${state}`)

  page.off('pageerror', onErr)
  page.off('console', onLog)
}
console.log(bad ? `\n${bad} section(s) need attention` : '\nall sections clean')
await browser.close()
