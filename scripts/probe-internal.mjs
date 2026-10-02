// Load /internal as a cleared staff account and check the WAGA figures are real.
//
//   node scripts/probe-internal.mjs
//
// Mints the same internal_token lib/internalAuth.js signs — `scope: 'internal'`
// rather than a role — so the gate is exercised rather than bypassed. The email
// it signs must be listed in INTERNAL_EMAILS or both the page and the route
// will, correctly, refuse it. An admin token would not open either; the
// credential side of that is covered by probe-internal-login.mjs.
//
// Two things here do write to the database, and both clean up after themselves:
//
//   A throwaway account holding the waga portal is created, signed in twice
//   through the real portal login route, and deleted. That is the only honest
//   way to prove the per-day sign-in history is being recorded, because the
//   alternative is signing in as one of WAGA's own people and inflating the
//   very number this screen reports.
//
// This connects to the live Atlas cluster. Nothing may be left behind.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import puppeteer from 'puppeteer-core'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const ROOT = process.cwd()
const OUT = process.env.OUT || ROOT
const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const pick = (k) => (env.match(new RegExp(`^${k}=(.+)$`, 'm')) || [])[1]?.trim()

const secret = pick('JWT_SECRET')
const uri = pick('MONGO_URI')
// Must be a cleared address, or the route answers 401 and rightly so.
const STAFF = process.env.INTERNAL_EMAIL
  || (pick('INTERNAL_EMAILS') || '').split(',')[0].trim()
  || 'internal@ifactoryai.com'

// Chrome talks to localhost; Node's fetch talks to 127.0.0.1. They disagree
// about which one resolves, and each has been wrong in the other's direction.
const PAGE = 'http://localhost:3000'
const API = 'http://127.0.0.1:3000'

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const iat = Math.floor(Date.now() / 1000)
const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ email: STAFF, scope: 'internal', iat, exp: iat + 43200 })}`
const TOKEN = `${body}.${crypto.createHmac('sha256', secret).update(body).digest('base64url')}`

// ── a throwaway sign-in, to prove the day-by-day history is recorded ────────
const PROBE_EMAIL = 'probe-internal-signin@ifactoryai.com'
const PROBE_PASSWORD = `probe-${crypto.randomUUID()}`

await mongoose.connect(uri, { serverSelectionTimeoutMS: 25000 })
const users = mongoose.connection.db.collection('users')

// Refuse to touch a real row. If this address somehow belongs to somebody, stop
// rather than overwrite them.
const clash = await users.findOne({ email: PROBE_EMAIL })
if (clash && clash.department !== 'Probe') {
  console.error(`${PROBE_EMAIL} already exists and is not a probe row — stopping`)
  await mongoose.disconnect()
  process.exit(1)
}

const now = new Date()
await users.deleteOne({ email: PROBE_EMAIL })
const { insertedId } = await users.insertOne({
  name: 'Sign-in probe', email: PROBE_EMAIL,
  password: await bcrypt.hash(PROBE_PASSWORD, 10),
  companyName: 'iFactory AI', countryCode: '+91', mobile: '0000000000',
  role: 'member', department: 'Probe', portals: ['waga'],
  visiblePassword: '', altPasswords: [], loginCount: 0, lastLoginAt: null,
  loginHistory: [], createdAt: now, updatedAt: now,
})

let cleaned = false
const cleanup = async () => {
  if (cleaned) return
  cleaned = true
  await users.deleteOne({ _id: insertedId })
  const left = await users.countDocuments({ email: PROBE_EMAIL })
  console.log(`cleanup    : probe account removed (${left === 0 ? 'gone' : 'STILL THERE'})`)
  await mongoose.disconnect()
}
process.on('uncaughtException', async (e) => { console.error(e); await cleanup(); process.exit(1) })

try {
  for (let i = 1; i <= 2; i += 1) {
    const r = await fetch(`${API}/api/portal/waga/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
      body: JSON.stringify({ email: PROBE_EMAIL, password: PROBE_PASSWORD }),
    })
    console.log(`waga login ${i}: ${r.status} ${(await r.json()).message || ''}`)
  }

  const after = await users.findOne({ _id: insertedId }, { projection: { loginCount: 1, lastLoginAt: 1, loginHistory: 1 } })
  const hist = after.loginHistory || []
  console.log(`history    : loginCount=${after.loginCount} historyRows=${hist.length}`
    + ` dated=${hist.filter((h) => h?.timestamp).length} ip=${hist[0]?.ip || '-'}`)
  if (hist.length !== 2) console.log('  ^ EXPECTED 2 — the per-day chart depends on this')

  // ── the screen ───────────────────────────────────────────────────────────
  const br = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--no-sandbox'],
  })
  const p = await br.newPage()
  await p.setViewport({ width: 1440, height: 1500 })
  // Headless Chrome reports a dark preference, and the page honours it — which
  // meant the first screenshot came out in night while being filed as day.
  // Asked for light explicitly, so the run starts where the filename says.
  await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
  await br.setCookie({ name: 'internal_token', value: TOKEN, domain: 'localhost', path: '/', httpOnly: true })

  const errs = []
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 180)))
  p.on('console', (m) => {
    const txt = m.text()
    if (m.type() === 'error' && !/Failed to load resource/.test(txt)) errs.push('console: ' + txt.slice(0, 180))
  })

  const res = await p.goto(`${PAGE}/internal`, { waitUntil: 'networkidle0', timeout: 240000 })
  await new Promise((r) => setTimeout(r, 3200))
  console.log(`\npage       : ${res.status()} ${new URL(p.url()).pathname}  (as ${STAFF})`)

  const view = await p.evaluate(() => {
    const t = document.body.innerText
    return {
      h1: document.querySelector('h1')?.textContent?.trim(),
      sections: ['Day by day', 'What they updated', 'Modules', 'People']
        .filter((s) => t.includes(s)),
      verdict: document.querySelector('h2')?.textContent?.trim(),
      // The other five portals must be gone, not merely de-emphasised.
      others: ['Data Center FSM', 'HEPA', 'Hospitality', 'DNA', 'Oxmaint CMMS'].filter((x) => t.includes(x)),
      caveat: /no analytics in this app/.test(t),
      historyNote: /Per-day sign-ins/.test(t),
      bars: document.querySelectorAll('span[title*="sign-in"]').length,
      untouched: /Never written to/.test(t),
      people: (t.match(/@waga-energy\.com/g) || []).length,
      probeGone: !t.includes('probe-internal-signin'),
    }
  })
  console.log(`title      : ${view.h1}`)
  console.log(`verdict    : ${view.verdict}`)
  console.log(`sections   : ${view.sections.length}/4  (${view.sections.join(', ')})`)
  console.log(`waga only  : other portals named = ${view.others.length ? view.others.join(', ') : 'none'}`)
  console.log(`chart      : ${view.bars} day slots`)
  console.log(`content    : caveat=${view.caveat} · history note=${view.historyNote}`
    + ` · untouched list=${view.untouched} · waga people rows=${view.people}`)
  await p.screenshot({ path: path.join(OUT, 'internal-waga-day.png'), fullPage: false })

  // The API's own answer, so the screen can be checked against its source.
  const api = await p.evaluate(async () => {
    const r = await fetch('/api/internal/usage?days=30')
    const j = await r.json()
    return {
      ok: j.ok,
      portal: j.portal?.label,
      summary: j.summary,
      modules: (j.modules || []).length,
      used: (j.modules || []).filter((m) => m.total > 0).map((m) => `${m.kind}=${m.total}`),
      activity: (j.activity || []).length,
      accounts: (j.accounts || []).length,
      loginDays: (j.timeline || []).filter((d) => d.logins > 0).length,
      historyFrom: j.limits?.signInHistoryFrom,
    }
  })
  console.log(`\napi ok     : ${api.ok} · portal=${api.portal} · modules=${api.modules} activity=${api.activity} accounts=${api.accounts}`)
  console.log(`  verdict=${api.summary?.verdict} logins=${api.summary?.loginsAllTime} (${api.summary?.loginsInWindow} dated)`
    + ` people=${api.summary?.signedInEver}/${api.summary?.accounts} records=${api.summary?.recordsInWindow}/${api.summary?.records}`)
  console.log(`  used modules: ${api.used.join(', ') || '(none)'}`)
  console.log(`  days with a sign-in: ${api.loginDays} · history from ${api.historyFrom || '(nothing dated yet)'}`)

  // ── day and night ────────────────────────────────────────────────────────
  const night = await p.evaluate(async () => {
    const btn = [...document.querySelectorAll('button')].find((e) => /Night|Day/.test(e.innerText))
    const before = getComputedStyle(document.body).backgroundColor
    btn?.click()
    await new Promise((r) => setTimeout(r, 500))
    return {
      clicked: !!btn,
      before,
      after: getComputedStyle(document.body).backgroundColor,
      stored: localStorage.getItem('internal.theme'),
      scheme: document.documentElement.style.colorScheme,
    }
  })
  await new Promise((r) => setTimeout(r, 600))
  console.log(`\ntheme      : clicked=${night.clicked} body ${night.before} -> ${night.after}`
    + ` · remembered=${night.stored} · color-scheme=${night.scheme}`)
  await p.screenshot({ path: path.join(OUT, 'internal-waga-night.png'), fullPage: false })

  // It has to survive a reload, or it is a toggle rather than a preference.
  await p.reload({ waitUntil: 'networkidle0', timeout: 240000 })
  await new Promise((r) => setTimeout(r, 2500))
  const kept = await p.evaluate(() => getComputedStyle(document.body).backgroundColor)
  console.log(`after reload: body ${kept} ${kept === night.after ? '(kept)' : '(LOST)'}`)

  console.log(`errors     : ${errs.length ? errs.slice(0, 3).join(' | ') : 'none'}`)
  await br.close()
} finally {
  await cleanup()
}
