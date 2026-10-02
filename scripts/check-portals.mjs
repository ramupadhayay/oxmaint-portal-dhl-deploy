// Does every screen in every portal actually render?
//
// Run against a dev or production server: `npm run check -- http://localhost:3000`
//
// This exists because two bugs reached the browser that a status check could
// not see. A React error during server rendering does not return 500 — Next
// recovers by re-rendering on the client, so the response is 200 with a shell
// around an error. A check that asserts on the status code, or on the page
// being "big enough", passes both times.
//
// IT DRIVES A BROWSER, because the HTML no longer holds the answer. The portal
// screens are loaded with `ssr: false` on purpose — every register is dated
// relative to a moving demo clock, so server markup and browser markup disagree
// and React throws the server's work away. What the server now sends is a
// skeleton. This script used to fetch that HTML and grep it, which meant that
// after the change it reported two dozen failures against screens that were
// perfectly fine — and a check nobody believes is a check nobody reads. So the
// page is opened in Chrome, given a moment to paint, and the marker is looked
// for in the rendered text.
//
// Two things follow from that and are worth keeping. Case does not count: the
// stat captions are upper-cased in CSS, so "Contractor hours" in the source is
// CONTRACTOR HOURS on screen. And an uncaught error in the browser fails the
// screen on its own, marker or no marker — that is the failure this script was
// written for, and it is now visible directly rather than by its markup.
//
// Sections are read from each portal's own router rather than listed here — a
// screen dropped from the map is exactly what slipped through once before.

import { readFileSync, readdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import jwt from 'jsonwebtoken'
import puppeteer from 'puppeteer-core'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const base = (process.argv[2] || 'http://localhost:3001').replace(/\/$/, '')

// WAGA is gated behind a per-user login now, so a plain fetch of its screens
// lands on the sign-in page and every marker is "missing". Rather than depend on
// an account existing, the check mints its own short-lived WAGA token with the
// same secret the server verifies — a trusted local tool reading the same env
// the dev server does — and sends it as the cookie for that portal. No account,
// no committed password, and the gated screens are checked like every other.
const readEnvFile = (f) => {
  try {
    return Object.fromEntries(readFileSync(join(root, f), 'utf8').split('\n')
      .map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
  } catch { return {} }
}
const CHECK_ENV = { ...readEnvFile('.env.local'), ...readEnvFile('.env'), ...process.env }
const wagaCookie = `waga_token=${jwt.sign(
  { email: 'portal-check', portal: 'waga' },
  CHECK_ENV.JWT_SECRET || 'oxmaint-dev-secret-change-me',
  { expiresIn: '10m' },
)}`
// Set on the browser once, below, rather than per request — a cookie the whole
// session carries is closer to what a signed-in person has anyway.

// The sections each portal claims to serve, taken from its own router.
//
// Every file in the route folder, not one named file. The oxmaint portal's map
// moved out of `page.js` into `SectionClient.jsx` when the sections were made
// to prerender, and because this only read `page.js` it quietly found zero
// sections and stopped checking all ninety-eight screens — the precise failure
// the comment above warns about, one level down. Reading the folder means the
// map can move again without taking the check with it.
function sectionsOf(portal) {
  const dir = join(root, 'app', 'portal', portal, '[section]')
  const keys = new Set()
  for (const file of readdirSync(dir)) {
    if (!/\.(js|jsx|ts|tsx)$/.test(file)) continue
    const src = readFileSync(join(dir, file), 'utf8')
    for (const m of src.matchAll(/^\s{2}'([a-z0-9-]+)':/gm)) keys.add(m[1])
  }
  return [...keys]
}

// A page that rendered says something a shell never does. Where a marker is not
// listed the section's own name in the sidebar is enough, so the fallback is a
// generic one that still proves React got past the error boundary.
const MARKERS = {
  datacenter: {
    // Was the amber "Illustrative PoC data" pill, which is gone: the portal now
    // reads as a product rather than as a document review, and a badge on every
    // screen saying otherwise was the loudest tell. The New menu's trigger took
    // its place — it is on every screen for the same reason, and it proves the
    // header rendered rather than merely that a string is somewhere on the page.
    _default: { selector: '[aria-haspopup="menu"]' },
    overview: 'Future State Maintenance',
    // A pattern, not WO-1001: the list opens newest first and pages at twelve,
    // so pinning the marker to one number made the check depend on where that
    // row happens to sit rather than on the table having real work in it.
    'work-orders': { re: 'WO-\\d{4}' },
    alerts: 'ALT-0001',
    assets: 'Final Asset Scope Matrix',
    sites: 'Ashburn',
    readings: 'RDG-0001',
    correlation: 'COR-001',
    'compute-telemetry': 'AI infra health score',
    'pm-calendar': 'PMs this month',
    'pm-compliance': 'On-time adherence',
    bms: 'BMS-0001',
    epms: 'EPMS-0001',
    dcim: 'DCIM-0001',
    oem: 'OEM-0001',
    battery: 'String 1',
    kpis: 'Sensor Availability',
    risks: 'RSK-001',
    benefits: 'BEN-001',
    'weekly-health': 'WHR-01',
    'pm-compliance': 'PMC-001',
    incidents: 'INC-2025-014',
    // The inspection screens are generated, so the markers are the labels the
    // screen always renders rather than a row id that moves when the PM library
    // does.
    'inspection-reports': 'Raised here',
    'checklists': 'Written here',
    'inspection-reminder': 'Due this week',
    'asset-qr': 'Tags generated',
    'go-no-go': 'The rule this applies',
    systems: 'SYS-BMS',
    'failure-codes': 'V01',
    'pm-tasks': 'PM-CRAH-01',
  },
  // Markers chosen to prove the data reached the page rather than that the
  // shell rendered: a permit number, a requirement id, a real deviation, a
  // verification check.
  waga: {
    _default: 'WAGA',
    overview: 'Compliance Overview',
    sites: 'From the workbook',
    permits: '42-00254A',
    requirements: 'REQ-WBU06-AIR-002',
    calendar: 'Generated schedule',
    parameters: '99 TPY',
    deviations: 'DEV-WBU07-002',
    safety: 'Recommended trial scope',
    'pre-task': 'Task Hazard Analysis',
    loto: 'Lock record',
    incidents: 'Awaiting source',
    training: 'NFPA 70E',
    reports: 'Permits and licenses',
    team: 'Joe Rengers',
    sources: 'V-001',
  },
  // Markers chosen to prove the data reached the page rather than that the
  // shell rendered: an asset id, a work order number, a part number, a real
  // technician, the AI comparison denominator.
  dna: {
    _default: 'DNA',
    overview: 'Overview',
    kpis: 'Scorecard',
    reports: 'Mean time to repair',
    assets: 'AST-1203',
    'asset-qr': 'Assets QR',
    'my-tasks': 'My Tasks',
    'work-orders': 'WO-2001',
    requests: 'Awaiting planner',
    'pm-schedules': 'PM-001',
    calendar: 'Calendar',
    downtime: 'DT-501',
    parts: 'Out of stock',
    stocks: 'Value by storeroom',
    vendors: 'Groz-Beckert',
    labour: 'Hours by technician',
    'purchase-orders': 'PO-3007',
    'demand-parts': 'Requisition',
    team: 'Carlos Mendez',
    'ai-estimates': 'Mean absolute error',
    locations: 'DNA-WEAVE',
    sources: 'Read Me tab, verbatim',
  },
  oxmaint: { _default: 'Oxmaint' },
  // Every hospitality screen renders the property in the header, so the default
  // proves React got past the error boundary. The rest are the one phrase each
  // screen renders whatever the data does — not a row id, which moves when the
  // rotation advances overnight.
  // Apostrophes were avoided here because the markers used to be matched
  // against served HTML, where an apostrophe is escaped and the literal never
  // appears. They are matched against rendered text now, so that constraint is
  // gone — but nothing is gained by putting one back, either.
  // The property name is not the default here either: the customer's name lives
  // in the profile menu, not the chrome, so it is not on every page.
  hepa: {
    _default: 'Oxmaint',
    overview: 'Audit readiness',
    'work-orders': 'PM04',
    'pm-schedules': 'Quarterly',
    requests: 'Request Status Overview',
    'requests/REQ-6001': 'What was reported',
    checklists: 'Annex B',
    // The Inspection group. Each marker is the one phrase the screen renders
    // whatever the data does — not a row id, which moves as the anchor advances.
    inspections: 'Pressure cascade round',
    'inspection-reminder': 'Overdue',
    incidents: 'Root cause',
    cleanrooms: 'aseptic',
    technicians: 'took each reading',
    reports: 'ISO grade',
    filters: 'Cleanroom',
    tests: 'Penetration',
    leaks: 'Pressure differential',
    replacements: 'Chain of custody',
    repository: 'central store',
    retention: 'Retention',
    'audit-export': 'Export',
    lifecycle: 'Locked',
    // The signature panel only renders once a record is selected, so the marker
    // is the regulation named in the subtitle, which is always on the page.
    approvals: '21 CFR Part 11',
    notifications: 'Escalate',
    'sap-assets': 'Functional location',
    'sap-sync': 'SAP Integration Portal',
    settings: 'Threshold',
  },
  hospitality: {
    'common-areas': 'Community asset health',
    reserve: 'capital forecast',
    'vendor-pm': 'The year',
    _default: 'Oxmaint',
    overview: 'Where the work is',
    'daily-schedule': 'Shift budget',
    'suite-rotation': 'Cycle progress',
    'my-tasks': 'Closed this month',
    calendar: 'Average day',
    suites: 'Pet friendly',
    assets: 'In suite',
    'asset-qr': 'Labels on this sheet',
    locations: 'Areas',
    'work-orders': 'Due this week',
    requests: 'Guest waiting',
    'pm-schedules': 'Where the month goes',
    checklists: 'Checkpoints',
    compliance: 'Tracked checks',
    inspections: 'Signed by',
    // Not a phrase from the drawer: that only renders once a row is clicked,
    // so it is absent from the page this check actually fetches.
    incidents: 'High severity',
    kpis: 'Mean time to repair',
    reports: 'Backlog carried',
    parts: 'Stock value',
    vendors: 'Average lead time',
    teams: 'From housekeeping',
    settings: 'The rotation',
  },
}

// Record pages, so the /<section>/<id> route is covered too.
const RECORDS = [
  // Power & Capacity, ported from the electrical portal. Each marker is a value
  // from the screen's own fixtures, so a shell that renders headings alone fails.
  ['datacenter', 'power-architecture', 'Copper follows current'],
  ['datacenter', 'dcim-floor', 'Return air 36.8'],
  ['datacenter', 'gpu-power', '10.8 kW left'],
  ['datacenter', 'capacity-planner', 'NVIDIA B200'],
  ['datacenter', 'ups-health', 'Module 3B'],
  ['datacenter', 'alerts/ALT-0003', 'Response workflow'],
  ['datacenter', 'work-orders/WO-1001', 'Feedback to analytics'],
  ['datacenter', 'assets/IAD35-PUMP-01', 'Alerts raised against this asset'],
  ['datacenter', 'sites/IAD35', 'PoC critical zone'],
  ['datacenter', 'correlation/COR-001', 'Detection lead time'],
  // The root cause itself rather than a field label: the incident page draws a
  // chart of all seven and prose blocks, so a marker that only proves the shell
  // rendered would not notice the record failing to join.
  ['datacenter', 'incidents/INC-2025-014', 'Capacitor failure'],
  // Generated ids, and deterministic — the same asset and task always produce
  // the same inspection. If this one stops resolving, the generator changed and
  // that is worth knowing.
  ['datacenter', 'inspection-reports/INS-48171', 'PM reference'],
  ['datacenter', 'inspection-reminder/REM-76148', 'Assigned to'],
  ['datacenter', 'inspection-reports/new', 'Start New Inspection'],
  // A checklist's own page. The library card shows an item's text and nothing
  // else it carries, so this is the only screen where the acceptable band, the
  // instruction and the capture requirements are readable.
  // The one answer to "where do I enter something?". It is in the header, so
  // it has to be on every screen — a create affordance that only appears on the
  // three screens that already had one has answered nothing.
  // The architecture splits asset health in two over one set of readings, so
  // each door has to prove it is showing its own slice rather than the estate.
  ['datacenter', 'power-health', 'Power Asset Health'],
  ['datacenter', 'mechanical-health', 'Mechanical Asset Health'],
  // Each of these is a sub-module the product routes separately and this build
  // serves from one tabbed screen. The marker is the sub-module's own content,
  // not the tab strip, which renders on all of them either way.
  // `tab` means the pill is the SELECTED one, which is the point: every tab in
  // the strip carries its own label on every sub-module, so plain text would
  // pass even when the wrong one is open.
  ['oxmaint', 'synapse-p2p', { tab: 'P-2-P' }],
  ['oxmaint', 'help-privacy', { tab: 'Privacy policy' }],
  ['oxmaint', 'partner-vendor', { tab: 'Vendors' }],
  ['oxmaint', 'explore-apps', 'IBM Maximo'],
  ['datacenter', 'manufacturers', { selector: '[aria-haspopup="menu"]' }],
  ['datacenter', 'checklists/CHK-ELEC', 'Checklist Items'],
  ['datacenter', 'checklists/CHK-ELEC', 'What it can be run against'],
  ['datacenter', 'checklists/new', 'Create Inspection Checklist'],
  // The builder's own furniture, not just its heading — the three-column
  // layout, the sections panel and the generation affordance are the port, and
  // a title alone would still pass if any of them stopped rendering.
  ['datacenter', 'checklists/new', 'Inspection Sections'],
  ['datacenter', 'checklists/new', 'Save Draft'],
  ['datacenter', 'alerts/DOES-NOT-EXIST', 'No alert with that reference'],

  // The hospitality portal's record pages and its three create forms. These
  // replaced side drawers, so unlike a drawer they are reachable by URL — which
  // is the whole reason they can be checked at all.
  // The CMMS portal's record pages. A section that has one is reachable by URL;
  // a section that has none falls through to a page saying so, and the last
  // line here is what proves the fallback still works rather than 404ing.
  ['oxmaint', 'work-orders/wo_0001', 'Back to Work Orders'],
  ['oxmaint', 'assets/ast_0001', 'Back to Asset Master'],
  ['oxmaint', 'assets/new', 'Back to Asset Master'],
  ['oxmaint', 'pm-schedules/pms_0003', 'Work orders raised by this schedule'],
  ['oxmaint', 'pm-schedules/pms_0003', 'Generate work order'],
  ['oxmaint', 'pm-schedules/DOES-NOT-EXIST', 'No schedule with that reference'],
  ['oxmaint', 'purchase-orders/po_0001', 'Order lines'],
  ['oxmaint', 'purchase-orders/po_0001', 'Receive into stock'],
  // A received order says so and offers no receipt, which is what stops a
  // delivery being booked into stock twice.
  ['oxmaint', 'purchase-orders/po_0004', 'booked into stock when the order was received'],
  ['oxmaint', 'purchase-orders/DOES-NOT-EXIST', 'No purchase order with that reference'],
  ['oxmaint', 'parts/prt_0001', 'No record page for this section'],
  // The GSE module belongs to the DHL pack. Under any other pack its routes
  // must still answer and explain themselves — a deep link into a module this
  // build does not have should never 404, because that reads as broken rather
  // than as configured differently.
  // The portal switcher sits in the sidebar footer on every screen of this
  // portal. It is how the loaded organisation gets changed without an
  // environment variable, so it disappearing is worth catching here rather than
  // ten minutes before a call.
  ['oxmaint', 'dashboard', 'Switch portal'],
  ['oxmaint', 'gse-readiness', 'is not switched on here'],
  ['oxmaint', 'gse-rfp', 'is not switched on here'],
  ['oxmaint', 'fls-compliance', 'is not switched on here'],
  ['oxmaint', 'fls-survey', 'is not switched on here'],
  ['oxmaint', 'fls-evidence', 'is not switched on here'],
  ['oxmaint', 'fls-ilsm', 'is not switched on here'],
  ['oxmaint', 'fls-soc', 'is not switched on here'],
  // Documents take a real file, labour knows contractors, and the audit trail
  // can be exported. Each marker is text only the rebuilt screen carries.
  ['oxmaint', 'documents', 'Expired certificates'],
  ['oxmaint', 'labour', 'Contractor hours'],
  ['oxmaint', 'audit-trail', 'Export Excel'],
  ['hospitality', 'suites/104', 'Rotation slot'],
  ['hospitality', 'assets/ast_p_poolpump_1', 'Pool Pump'],
  ['hospitality', 'work-orders/wo_0001', 'WO-4100'],
  ['hospitality', 'requests/req_001', 'REQ-900'],
  ['hospitality', 'incidents/inc_001', 'INC-300'],
  ['hospitality', 'work-orders/new', 'Raise a work order'],
  ['hospitality', 'requests/new', 'Raise a request'],
  ['hospitality', 'checklists/new', 'Build a checklist'],
  ['hospitality', 'suites/DOES-NOT-EXIST', 'Nothing here with that reference'],
  ['waga', 'requirements', 'Last filed'],
  ['waga', 'requirements', 'Evidenced'],
  ['waga', 'requirements/REQ-WBU06-NPDES-003', 'Compliance history'],
  ['waga', 'permits/PERMIT-WBU06-AIR-001', 'Obligations under this permit'],
  ['waga', 'permits/PERMIT-WBU07-TV-001', 'Renewal application due'],
  ['waga', 'requirements/REQ-WBU06-AIR-002', 'Projected occurrences'],
  // A standing obligation and an event-driven one: both must explain why they
  // carry no dates rather than showing an empty schedule.
  ['waga', 'requirements/REQ-WBU06-AIR-001', 'Why this has no due dates'],
  ['waga', 'requirements/REQ-WBU06-CH105-002', 'Why this has no due dates'],
  ['waga', 'permits/DOES-NOT-EXIST', 'No permit with that reference'],
  ['dna', 'work-orders/WO-2001', 'Loom stopped mid-run'],
  ['dna', 'work-orders/WO-2003', 'Ran longer than estimated'],
  ['dna', 'assets/AST-1203', 'This machine is down'],
  ['dna', 'assets/AST-1502', 'no PM schedule and no work order'],
  ['dna', 'pm-schedules/PM-001', 'Checklist'],
  ['dna', 'purchase-orders/PO-3007', 'Raised for'],
  // The order whose Raised for line names a work order, and the one whose
  // reference does not hold up — both need the resolution to still be working.
  ['dna', 'purchase-orders/PO-3013', 'still outstanding'],
  ['dna', 'purchase-orders/PO-3014', 'does not hold up'],
  ['dna', 'assets/DOES-NOT-EXIST', 'No asset with that reference'],
  // Compute Telemetry node drill-down — the critical node with the XID fault,
  // and a plain node, both need their device panels to render.
  ['datacenter', 'compute-telemetry/IAD35-RACK-05-N02', 'Predictive health'],
  ['datacenter', 'compute-telemetry/FRA15-RACK-01-N01', 'Media life used'],
  ['datacenter', 'compute-telemetry/DOES-NOT-EXIST', 'Node not found'],
  // The PM compliance record is now a rich maintenance record, not the log line.
  ['datacenter', 'pm-compliance/PMC-004', 'Checklist worked'],
  ['datacenter', 'pm-compliance/PMC-002', 'Readings taken'],
]

let failures = 0

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
// Four at a time. One page is slow over two hundred screens; many pages make a
// dev server compile several routes at once and time each other out.
const LANES = Number(process.env.CHECK_LANES || 4)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

// The WAGA cookie belongs to the browser, not to one request, so it is set once
// on the host under test and every lane inherits it.
const host = new URL(base)
await browser.setCookie({
  name: 'waga_token',
  value: wagaCookie.replace('waga_token=', ''),
  domain: host.hostname,
  path: '/',
})

// What a marker can be:
//   'text'                    — somewhere in the rendered page, case-insensitive
//   { re: 'WO-\d{4}' }        — a pattern, for a list whose top row moves
//   { selector }              — an element that exists
//   { selector, text }        — an element matching both
//   { tab: 'P-2-P' }          — a tab button that is the selected one
const findMarker = (marker) => (m) => {
  const norm = (v) => (v || '').replace(/\s+/g, ' ').trim().toLowerCase()
  if (typeof m === 'string') return norm(document.body.innerText).includes(norm(m))
  if (m.re) return new RegExp(m.re, 'i').test(document.body.innerText)
  if (m.tab) {
    return [...document.querySelectorAll('button')].some((b) => {
      if (norm(b.innerText) !== norm(m.tab)) return false
      const bg = getComputedStyle(b).backgroundColor
      // The selected pill is painted; the rest are white or transparent.
      return bg && !/rgba?\(0, 0, 0, 0\)|rgb\(255, 255, 255\)/.test(bg)
    })
  }
  const hits = [...document.querySelectorAll(m.selector)]
  if (!hits.length) return false
  return m.text ? hits.some((el) => norm(el.innerText).includes(norm(m.text))) : true
}

const describe = (m) => {
  if (typeof m === 'string') return `"${m}"`
  if (m.re) return `anything matching /${m.re}/`
  if (m.tab) return `selected tab "${m.tab}"`
  return `${m.selector}${m.text ? ` with "${m.text}"` : ''}`
}

async function check(page, label, url, marker) {
  const errors = []
  const onError = (e) => errors.push(String(e.message || e).split('\n')[0].slice(0, 120))
  const onConsole = (msg) => {
    if (msg.type() !== 'error') return
    const t = msg.text()
    // A missing favicon or a blocked font is not a broken screen.
    if (/Failed to load resource|favicon|net::ERR/.test(t)) return
    errors.push(`console: ${t.split('\n')[0].slice(0, 120)}`)
  }
  page.on('pageerror', onError)
  page.on('console', onConsole)

  try {
    const res = await page.goto(url, { waitUntil: 'networkidle0', timeout: 90000 })
    if (res && res.status() !== 200) {
      console.log(`  FAIL  ${label} — HTTP ${res.status()}`)
      failures++
      return
    }
    // The screens paint after load. A second look, longer, before calling a
    // marker missing: under four lanes a dev server can still be compiling.
    let found = false
    for (const settle of [700, 2500]) {
      await wait(settle)
      if (!marker) { found = true; break }
      found = await page.evaluate(findMarker(marker), marker)
      if (found) break
    }
    if (errors.length) {
      console.log(`  FAIL  ${label} — ${errors[0]}`)
      failures++
      return
    }
    if (!found) {
      console.log(`  FAIL  ${label} — no ${describe(marker)} on the screen`)
      failures++
    }
  } catch (e) {
    console.log(`  FAIL  ${label} — ${String(e.message).split('\n')[0].slice(0, 120)}`)
    failures++
  } finally {
    page.off('pageerror', onError)
    page.off('console', onConsole)
  }
}

// Run a batch of checks across the lanes, in order, so the output still reads
// portal by portal.
async function run(jobs) {
  const pages = await Promise.all(Array.from({ length: Math.min(LANES, jobs.length) }, () => browser.newPage()))
  let next = 0
  await Promise.all(pages.map(async (page) => {
    await page.setViewport({ width: 1500, height: 1200 })
    for (;;) {
      const i = next++
      if (i >= jobs.length) break
      const { label, url, marker } = jobs[i]
      await check(page, label, url, marker)
    }
    await page.close()
  }))
}

// The one hand-written list left in this script, and the one that has to be
// kept up. Sections come from each portal's own router precisely because a
// hand-written section list once hid a dropped screen for a week; a portal
// missing from here is the same failure one level up, so adding a portal means
// adding it on this line.
for (const portal of ['datacenter', 'oxmaint', 'hospitality', 'waga', 'dna', 'hepa']) {
  const sections = sectionsOf(portal)
  console.log(`\n${portal}: ${sections.length} sections`)
  // A portal that suddenly serves nothing is a routing change nobody meant, and
  // silence here is what let it go unnoticed before.
  if (!sections.length) {
    console.log(`  FAIL  ${portal} — no sections found in its route folder`)
    failures++
    continue
  }
  await run(sections.map((s) => ({
    label: `${portal}/${s}`,
    url: `${base}/portal/${portal}/${s}`,
    marker: MARKERS[portal][s] ?? MARKERS[portal]._default,
  })))
}

console.log('\nrecord pages')
await run(RECORDS.map(([portal, path, marker]) => ({
  label: `${portal}/${path}`,
  url: `${base}/portal/${portal}/${path}`,
  marker,
})))

await browser.close()
console.log(failures ? `\n${failures} failure(s).` : '\nall screens rendered.')
process.exit(failures ? 1 : 0)
