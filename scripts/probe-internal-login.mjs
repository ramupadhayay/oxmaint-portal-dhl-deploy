// Sign in at the staff door for real, and prove no other credential opens it.
//
//   EMAIL=internal@ifactoryai.com PASSWORD='…' node scripts/probe-internal-login.mjs
//
// No minted cookie here — this posts the credential to /api/internal/login the
// way a person would, so the allowlist, the password, the cookie and the gate
// are all exercised together. A minted token proves the gate; only a real login
// proves the account.
//
// The negative cases matter more than the positive one. /internal used to open
// on the admin cookie, which meant every admin — including the client's own
// login, which carries role=admin — was one allowlist variable away from a page
// about their own usage. So this checks the door stays shut for an admin
// credential and for an address nobody cleared, not just that it opens for the
// right one.
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const OUT = process.env.OUT || process.cwd()
const BASE = 'http://localhost:3000'
// Taken from the environment, never defaulted. A credential with a fallback in
// the file is a credential in the repository's history.
const EMAIL = process.env.EMAIL
const PASSWORD = process.env.PASSWORD
if (!EMAIL || !PASSWORD) {
  console.error("set EMAIL and PASSWORD: EMAIL=… PASSWORD='…' node scripts/probe-internal-login.mjs")
  process.exit(1)
}
// Optional: a real admin credential, to prove the console's password is refused
// here. Skipped rather than faked when it is not supplied.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

const b = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox'],
})
const p = await b.newPage()
await p.setViewport({ width: 1440, height: 1400 })
await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])

const errs = []
p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 180)))
p.on('console', (m) => {
  const t = m.text()
  if (m.type() === 'error' && !/Failed to load resource/.test(t)) errs.push('console: ' + t.slice(0, 180))
})

const post = (url, body) => p.evaluate(async ([u, b2]) => {
  const r = await fetch(u, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b2),
  })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}, [url, body])

// ── before signing in, the door must be shut ──────────────────────────────
await p.goto(`${BASE}/internal`, { waitUntil: 'networkidle0', timeout: 240000 })
console.log(`signed out : /internal -> ${new URL(p.url()).pathname}${new URL(p.url()).search}  (expected /internal/login)`)
const form = await p.evaluate(() => ({
  h1: document.querySelector('h1')?.textContent?.trim(),
  fields: document.querySelectorAll('input').length,
  saysNotAdmin: /admin console password does not open this/i.test(document.body.innerText),
  branded: /Oxmaint AI/.test(document.body.innerText),
}))
console.log(`login page : "${form.h1}"  inputs=${form.fields} · warns about admin password=${form.saysNotAdmin}`
  + ` · unbranded=${!form.branded}`)
await p.screenshot({ path: path.join(OUT, 'internal-login.png'), fullPage: false })

// ── the wrong credentials ─────────────────────────────────────────────────
const notCleared = await post('/api/internal/login', { email: 'nobody@example.com', password: 'whatever' })
console.log(`\nnot cleared: ${notCleared.status}  "${notCleared.body.message || ''}"  (expected 401)`)

if (ADMIN_EMAIL && ADMIN_PASSWORD) {
  const asAdmin = await post('/api/internal/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  console.log(`admin creds: ${asAdmin.status}  "${asAdmin.body.message || ''}"  (expected 401 — admins are not internal)`)

  // And the console cookie itself must not open the page.
  const adminLogin = await post('/api/admin/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  console.log(`admin login: ${adminLogin.status} at /api/admin/login (its own door, should still work)`)
  await p.goto(`${BASE}/internal`, { waitUntil: 'networkidle0', timeout: 240000 })
  console.log(`admin cookie -> /internal -> ${new URL(p.url()).pathname}  (expected /internal/login)`)
  const api = await p.evaluate(async () => {
    const r = await fetch('/api/internal/usage?days=30')
    return { status: r.status, body: await r.json().catch(() => ({})) }
  })
  console.log(`admin cookie -> usage API: ${api.status}  "${api.body.error || ''}"  (expected 401)`)
  await p.deleteCookie({ name: 'admin_token', domain: 'localhost', path: '/' })
} else {
  console.log('admin creds: skipped (set ADMIN_EMAIL and ADMIN_PASSWORD to test the refusal)')
}

const wrongPw = await post('/api/internal/login', { email: EMAIL, password: 'not-the-password' })
console.log(`wrong pw   : ${wrongPw.status}  "${wrongPw.body.message || ''}"  (expected 401, same wording as above)`)

// ── the real thing, through the form rather than the API ──────────────────
await p.goto(`${BASE}/internal`, { waitUntil: 'networkidle0', timeout: 240000 })
await p.type('input[type="email"]', EMAIL)
await p.type('input[type="password"]', PASSWORD)
await Promise.all([
  p.waitForNavigation({ waitUntil: 'networkidle0', timeout: 240000 }),
  p.evaluate(() => document.querySelector('button[type="submit"]').click()),
])
await new Promise((r) => setTimeout(r, 2600))

const view = await p.evaluate(() => {
  const t = document.body.innerText
  return {
    path: location.pathname,
    h1: document.querySelector('h1')?.textContent?.trim(),
    sections: ['Day by day', 'What they updated', 'Modules', 'People'].filter((s) => t.includes(s)).length,
    verdict: document.querySelector('h2')?.textContent?.trim(),
    lastSignIn: (t.match(/LAST SIGN-IN\s*\n\s*([^\n]+)/i) || [])[1]?.trim(),
    // The other five portals were taken off this screen on purpose — they have
    // no sign-in to count, so they were noise on top of the one that does.
    otherPortals: ['Data Center FSM', 'HEPA', 'Hospitality', 'DNA', 'Oxmaint CMMS'].filter((x) => t.includes(x)),
    realActivity: /Team member added|Filed obligation|Site added/.test(t),
    caveat: /no analytics in this app/.test(t),
    signOut: [...document.querySelectorAll('button')].some((e) => /Sign out/.test(e.innerText)),
  }
})
console.log(`\nafter login: ${view.path}  "${view.h1}"  sections=${view.sections}/4`)
console.log(`verdict    : ${view.verdict}`)
console.log(`waga       : last sign-in = ${view.lastSignIn || '(not parsed)'}`)
console.log(`waga only  : other portals named = ${view.otherPortals.length ? view.otherPortals.join(', ') : 'none'}`)
console.log(`content    : real activity=${view.realActivity} · caveat=${view.caveat} · sign-out button=${view.signOut}`)

// Signed in, the sign-in page should not ask again.
await p.goto(`${BASE}/internal/login`, { waitUntil: 'networkidle0', timeout: 240000 })
console.log(`revisit login: -> ${new URL(p.url()).pathname}  (expected /internal)`)

// ── and this credential must open nothing else ────────────────────────────
for (const url of ['/admin/portals', '/portal/waga/overview']) {
  await p.goto(`${BASE}${url}`, { waitUntil: 'networkidle0', timeout: 240000 })
  const landed = new URL(p.url()).pathname
  console.log(`${url.padEnd(22)} -> ${landed}  ${landed === url ? '(REACHABLE)' : '(blocked)'}`)
}

// ── sign out ──────────────────────────────────────────────────────────────
await p.goto(`${BASE}/internal`, { waitUntil: 'networkidle0', timeout: 240000 })
await new Promise((r) => setTimeout(r, 2000))
await p.evaluate(() => [...document.querySelectorAll('button')].find((e) => /Sign out/.test(e.innerText))?.click())
await new Promise((r) => setTimeout(r, 2200))
console.log(`\nsign out   : -> ${new URL(p.url()).pathname}  (expected /internal/login)`)
await p.goto(`${BASE}/internal`, { waitUntil: 'networkidle0', timeout: 240000 })
console.log(`after out  : /internal -> ${new URL(p.url()).pathname}  (expected /internal/login)`)

console.log(`errors     : ${errs.length ? errs.slice(0, 3).join(' | ') : 'none'}`)
await b.close()
