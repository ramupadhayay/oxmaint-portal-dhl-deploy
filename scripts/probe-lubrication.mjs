// Walk a lubrication route and sign it off.
//
//   node scripts/probe-lubrication.mjs
//
// The runner is the point of this screen: signing off has to stamp today onto
// every point marked done and book its next visit, which is what makes the
// overdue figure fall. Status codes cannot see any of that, so this drives it.
//
// Writes a real round and real point updates, then removes them — this dev
// server shares a database with the deployed portals.
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const OUT = process.env.OUT || process.cwd()
const URL = 'http://localhost:3000/portal/oxmaint/lubrication'

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

const click = (label, last = false) => p.evaluate(([needle, useLast]) => {
  const vis = [...document.querySelectorAll('button,[role="button"]')].filter((e) => e.offsetParent !== null)
  const pool = vis.filter((e) => (e.innerText || '').trim() === needle)
  const hit = useLast ? pool[pool.length - 1] : pool[0]
  if (!hit) return false
  hit.click()
  return true
}, [label, last])

const tiles = () => p.evaluate(() => {
  const t = document.body.innerText
  const g = (l) => {
    const i = t.indexOf(l)
    if (i < 0) return '?'
    const m = t.slice(i + l.length, i + l.length + 30).match(/\d+/)
    return m ? m[0] : '?'
  }
  return { points: g('Lubrication points'), overdue: g('Overdue'), today: g('Points done today') }
})

await p.goto(URL, { waitUntil: 'networkidle0', timeout: 240000 })
await new Promise((r) => setTimeout(r, 2400))

const before = await tiles()
console.log(`before     : points=${before.points} overdue=${before.overdue} doneToday=${before.today}`)

// The worst route — the one whose button went primary because something is late.
const route = await p.evaluate(() => {
  // Walk up from each "Run route" button to the smallest ancestor that is the
  // whole card — the one whose text carries both the percentage and the overdue
  // count. Picking a route with nothing overdue proves the runner works but not
  // that it clears anything, which is the half that matters.
  const buttons = [...document.querySelectorAll('button')]
    .filter((e) => (e.innerText || '').trim() === 'Run route')
  let best = null
  for (const btn of buttons) {
    let el = btn
    for (let i = 0; i < 6 && el; i += 1) {
      const txt = el.innerText || ''
      if (/on schedule/.test(txt) && /\d+ overdue/.test(txt)) break
      el = el.parentElement
    }
    const txt = el?.innerText || ''
    const late = Number((txt.match(/(\d+) overdue/) || [0, 0])[1])
    if (late > 0 && (!best || late > best.late)) {
      best = { btn, late, name: (txt.split('\n')[0] || '').trim() }
    }
  }
  if (best) { best.btn.click(); return `${best.name} (${best.late} overdue)` }
  buttons[0]?.click()
  return '(no overdue route found — took the first)'
})
console.log(`opened     : ${route}`)
await new Promise((r) => setTimeout(r, 1200))

const runner = await p.evaluate(() => {
  const t = document.body.innerText
  return {
    progress: (t.match(/Progress\s*\n?\s*(\d+)%/) || [])[1],
    markAll: t.includes('Mark all done'),
    outcomes: ['Done', 'Skipped', 'Blocked'].filter((o) => t.includes(o)).length,
  }
})
console.log(`runner     : progress=${runner.progress}% · markAll=${runner.markAll} · outcomes=${runner.outcomes}/3`)
await p.screenshot({ path: path.join(OUT, 'ox-lube-runner.png') })

console.log(`mark all   : ${await click('Mark all done') ? 'clicked' : 'BUTTON MISSING'}`)
await new Promise((r) => setTimeout(r, 900))
const ready = await p.evaluate(() => {
  const t = document.body.innerText
  return {
    progress: (t.match(/Progress\s*\n?\s*(\d+)%/) || [])[1],
    signoff: [...document.querySelectorAll('button')].some((e) => (e.innerText || '').trim() === 'Sign off round'),
  }
})
console.log(`after mark : progress=${ready.progress}% · sign-off enabled=${ready.signoff}`)

console.log(`sign off   : ${await click('Sign off round') ? 'clicked' : 'BUTTON MISSING'}`)
await new Promise((r) => setTimeout(r, 4000))

const after = await tiles()
console.log(`after      : points=${after.points} overdue=${after.overdue} doneToday=${after.today}`)
console.log(`effect     : overdue fell=${Number(after.overdue) < Number(before.overdue)} · doneToday rose=${Number(after.today) > Number(before.today)}`)
await p.screenshot({ path: path.join(OUT, 'ox-lube-after.png') })

// ── clean up ──────────────────────────────────────────────────────────────
const removed = await p.evaluate(async () => {
  const out = []
  for (const kind of ['lube_run', 'lube_point', 'work_order']) {
    const r = await fetch(`/api/oxmaint/records?kind=${kind}`)
    const j = await r.json()
    for (const row of j.records || []) {
      if (kind === 'work_order' && !String(row.source || '').startsWith('Lubrication route')) continue
      await fetch(`/api/oxmaint/records?kind=${kind}&recordId=${row.recordId}`, { method: 'DELETE' })
      out.push(`${kind}/${row.recordId}`)
    }
  }
  return out
})
console.log(`cleaned    : ${removed.length} record(s)`)
console.log(`errors     : ${errs.length ? errs.slice(0, 3).join(' | ') : 'none'}`)

await b.close()
