// Regenerate the screenshots behind the WAGA portal's in-app help.
//
//   node scripts/capture-waga-help.mjs            (dev server must be running)
//
// One dependency, deliberately not in package.json so it is not installed for
// everyone who builds the app:  npm i --no-save puppeteer-core
//
// Two things about this that are not obvious and cost an afternoon each:
//
//  1. It must drive http://localhost, never 127.0.0.1. Next's dev server treats
//     the other as a foreign origin and answers 403 for its own chunks, which
//     leaves the page server-rendered but never hydrated — screenshots still
//     look right, and not one click does anything.
//  2. Every shot re-navigates first. Without that, a dialog opened for one frame
//     is still standing in front of the next, and every later shot of that
//     section shows the same modal.
//
// A step that fails is reported and skipped rather than aborting the run, so one
// renamed button costs one frame and not the whole set. Captions live here and
// in components/industries/waga/lib/help.js — keep the two in step.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const puppeteer = (await import('puppeteer-core').catch(() => null))?.default
if (!puppeteer) {
  console.error('puppeteer-core is not installed.  npm i --no-save puppeteer-core')
  process.exit(1)
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public/waga/help')
const BASE = process.env.WAGA_BASE || 'http://localhost:3000'
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const AS = process.env.WAGA_USER || 'wagaenergy@gmail.com'

const VIEW = { width: 1380, height: 860, deviceScaleFactor: 1 }
const QUALITY = 72

const RECIPES = {
  'getting-started': { shots: [
    { caption: 'The landing page — who is signed in, and what the trial covers', actions: [] },
    { caption: '"Jump to a section" — every screen of the portal, one click away', actions: [{ type: 'scroll', to: 'bottom' }] },
  ] },
  overview: { shots: [
    { caption: 'The dashboard as it opens — the six headline counts for the trial', actions: [] },
  ], lowerCaption: 'Upcoming compliance work on the left, permit health on the right' },
  sites: { shots: [
    { caption: 'The estate — which sites came from the workbook, and which were added here', actions: [] },
    { caption: '"Add a site" grows the estate, and the country filter with it', actions: [{ type: 'clickText', text: 'Add a site' }] },
  ] },
  permits: { shots: [
    { caption: 'The permit register — each authorization, its agency, expiry and status', actions: [] },
    { caption: '"Renewal" on a row records a renewal application against that permit', actions: [{ type: 'clickText', text: 'Renewal' }] },
    { caption: '"New permit" adds a licence that was not in the imported workbook', actions: [{ type: 'clickText', text: 'New permit' }] },
  ] },
  requirements: { shots: [
    { caption: 'The obligation register — every requirement the permits impose', actions: [] },
    { caption: '"Record filing" marks an obligation met and attaches the evidence for it', actions: [{ type: 'clickText', text: 'Record filing' }] },
  ], lowerCaption: 'Each row carries its frequency, deadline and the permit it came from' },
  calendar: { shots: [
    { caption: 'The generated schedule — occurrences projected from each recurrence rule', actions: [] },
    { caption: '"Mark filed" records who filed an occurrence, when, and against what evidence', actions: [{ type: 'clickText', text: 'Mark filed' }] },
    { caption: 'Further down the schedule — later occurrences and who each is submitted to', actions: [{ type: 'scroll', to: 'bottom' }] },
  ] },
  parameters: { shots: [
    { caption: 'Permit limits and the readings logged against them', actions: [] },
    { caption: '"Log reading" records a measured value against a limit', actions: [{ type: 'clickText', text: 'Log reading' }] },
  ], lowerCaption: '"Where each limit comes from" traces every threshold to its permit clause' },
  deviations: { shots: [
    { caption: 'The deviation register — what went wrong and how it was closed', actions: [] },
    { caption: '"Report deviation" opens a new deviation; corrective action follows it', actions: [{ type: 'clickText', text: 'Report deviation' }] },
  ] },
  safety: { shots: [
    { caption: 'The Safety & EHS overview — what the digitised checklist covers', actions: [] },
  ], lowerCaption: "The recommended trial scope and the checklist's own structure" },
  'pre-task': { shots: [
    { caption: 'Completed pre-task assessments, newest first', actions: [] },
    { caption: '"New assessment" opens the JSA — general and emergency information first', actions: [{ type: 'clickText', text: 'New assessment' }] },
  ], lowerCaption: 'The workbook import schema this assessment was mapped from' },
  loto: { shots: [
    { caption: 'Lock records and permits to work, with their verification state', actions: [] },
    { caption: '"Open isolation" places the locks and records who verified them', actions: [{ type: 'clickText', text: 'Open isolation' }] },
  ] },
  incidents: { shots: [
    { caption: 'The incident register — occurrence, investigation and OSHA recordability', actions: [] },
    { caption: '"Report incident" captures the event and the immediate action taken', actions: [{ type: 'clickText', text: 'Report incident' }] },
  ] },
  training: { shots: [
    { caption: 'The training matrix — who holds which qualification', actions: [] },
    { caption: '"Record completion" logs a training against a person', actions: [{ type: 'clickText', text: 'Record completion' }] },
    { caption: 'Training that is also a permit condition, listed separately', actions: [{ type: 'scroll', to: 'bottom' }] },
  ] },
  reports: { shots: [
    { caption: 'The estate rolled up, with every report one click away', actions: [] },
    { caption: 'Each report says what its rows are and where they came from', actions: [{ type: 'clickText', text: 'Countries' }] },
  ], lowerCaption: 'Every report exports as a PDF for a meeting or a CSV for a spreadsheet' },
  team: { shots: [
    { caption: 'The people with access to this portal, and their login state', actions: [] },
    { caption: '"Add user" registers a person who works this trial', actions: [{ type: 'clickText', text: 'Add user' }] },
  ] },
  sources: { shots: [
    { caption: 'The source documents every figure in the portal was read from', actions: [] },
    { caption: 'The verification log — an append-only audit trail of every check', actions: [{ type: 'scroll', to: 'bottom' }] },
  ], lowerCaption: 'The rules this import follows, and the workbook rows carried unmodified' },
}

// The waga_token, signed the way lib/wagaAuth.js signs it.
const secret = (fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(/^JWT_SECRET=(.+)$/m) || [])[1]?.trim()
if (!secret) { console.error('No JWT_SECRET in .env.local'); process.exit(1) }
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const iat = Math.floor(Date.now() / 1000)
const jwtBody = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ email: AS, portal: 'waga', iat, exp: iat + 604800 })}`
const TOKEN = `${jwtBody}.${crypto.createHmac('sha256', secret).update(jwtBody).digest('base64url')}`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function act(page, a) {
  if (a.type === 'clickText') {
    // Buttons before rows, exact label before partial: a row contains its own
    // action button's text and is matched first, so a naive search clicks the
    // row and never opens the dialog the caption promises.
    const ok = await page.evaluate((t) => {
      const vis = (e) => e.offsetParent !== null
      const txt = (e) => (e.innerText || '').trim()
      const c = [...document.querySelectorAll('button,a,[role="button"]')].filter(vis)
      const hit = c.find((e) => txt(e) === t) || c.find((e) => txt(e).includes(t))
        || [...document.querySelectorAll('tr,li,th,td')].filter(vis).find((e) => txt(e).includes(t))
      if (!hit) return false
      hit.click(); return true
    }, a.text)
    if (!ok) throw new Error(`no visible control "${a.text}"`)
  } else if (a.type === 'scroll') {
    await page.evaluate((to) => {
      if (to === 'bottom') window.scrollTo({ top: document.body.scrollHeight })
      else if (to === 'top') window.scrollTo({ top: 0 })
      else document.querySelector(to)?.scrollIntoView({ block: 'center' })
    }, a.to)
  } else if (a.type === 'wait') {
    await sleep(a.ms || 500)
  } else {
    throw new Error('unknown action ' + a.type)
  }
  // A dialog fades and slides in. Shooting 550ms after the click caught the JSA
  // form mid-transition — half transparent, with the page still legible through
  // it — and that frame went into the manual. Give an opening dialog long enough
  // to finish arriving.
  await sleep(a.type === 'clickText' || a.type === 'clickNth' ? 1600 : 650)
}

fs.mkdirSync(OUT, { recursive: true })
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
  defaultViewport: VIEW,
})
const page = await browser.newPage()
await page.setCookie({ name: 'waga_token', value: TOKEN, domain: new URL(BASE).hostname, path: '/' })

const manifest = {}
const problems = []

for (const [key, recipe] of Object.entries(RECIPES)) {
  const shots = []
  const fresh = async () => {
    await page.goto(`${BASE}/portal/waga/${key}`, { waitUntil: 'networkidle2', timeout: 90000 })
    await sleep(2000)
  }
  const grab = async (caption) => {
    const file = `${key}-${shots.length + 1}.jpg`
    await page.screenshot({ path: path.join(OUT, file), type: 'jpeg', quality: QUALITY })
    shots.push({ file, caption, kb: +(fs.statSync(path.join(OUT, file)).size / 1024).toFixed(0) })
  }

  try {
    await fresh()
    const hydrated = await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => Object.keys(b).some((k) => k.startsWith('__react'))))
    if (!hydrated) problems.push(`${key}: NOT hydrated — are you on localhost rather than 127.0.0.1?`)
    const docH = await page.evaluate(() => document.documentElement.scrollHeight)

    for (const [i, shot] of recipe.shots.entries()) {
      try {
        if (i > 0) await fresh()
        for (const a of shot.actions || []) await act(page, a)
        await grab(shot.caption)
      } catch (e) { problems.push(`${key} · "${shot.caption}": ${e.message}`) }
    }

    if (docH > VIEW.height * 1.45 && shots.length < 5) {
      await fresh()
      await page.evaluate(() => window.scrollTo({ top: Math.round(document.documentElement.scrollHeight * 0.55) }))
      await sleep(700)
      await grab(recipe.lowerCaption || 'Further down the same screen')
    }

    manifest[key] = shots
    console.log(`${key.padEnd(17)} ${shots.length} shot(s)  ${shots.map((s) => s.kb + 'KB').join(' ')}`)
  } catch (e) {
    problems.push(`${key}: PAGE FAILED — ${e.message}`)
  }
}

const all = Object.values(manifest).flat()
console.log('---')
console.log(`${Object.keys(manifest).length} sections · ${all.length} shots · ${all.reduce((a, s) => a + s.kb, 0)} KB`)
if (problems.length) { console.log('--- problems ---'); problems.forEach((p) => console.log('  ' + p)) }
console.log('\nNow check components/industries/waga/lib/help.js still lists exactly these files.')
await browser.close()
