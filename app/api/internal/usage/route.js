// Is WAGA Energy using their portal, and what are they updating?
//
// One client, deliberately. There was a version of this that reported all six
// portals side by side, and it read as a dashboard rather than an answer: five
// of those portals are open demo links with no sign-in to count, so their rows
// were noise sitting on top of the only account-backed portal we have. WAGA is
// the paying question, so WAGA is the whole screen.
//
// Everything is counted from two things the app already writes:
//
//   `users`          — one row per person, with `loginCount`, `lastLoginAt` and
//                      `loginHistory` (one entry per sign-in; see the WAGA login
//                      route, which is what fills it).
//   `oxmaintrecords` — every row the portal has created, with its kind, the
//                      moment, and the name it was created under. WAGA's kinds
//                      all carry a `waga_` prefix, which is what separates them
//                      from the other packs sharing this collection.
//
// WHAT THIS CAN AND CANNOT SEE, because the difference decides how the numbers
// should be read and the screen says it out loud:
//
//   It can see  — that somebody signed in, when, and on which days; and every
//                 row the portal has written, what kind, when, by whom. The
//                 audit trail states its own actions in words.
//
//   It cannot see — page views, time on page, or anything that was only read.
//                 There is no analytics script in this app. A compliance
//                 manager who signs in every morning to check next week's
//                 obligations and closes the tab appears here as a sign-in with
//                 no activity. That is not idleness and must not be reported as
//                 idleness.
//
//   It could not see, until now — which days somebody signed in. `loginHistory`
//                 was empty on every account until the login route began
//                 writing it, so the per-day sign-in count is only true from
//                 the first entry onward. `signInHistoryFrom` carries that date
//                 so the screen can say so instead of drawing zeroes as fact.
//
// Gated on the internal cookie from /internal/login — not the admin one. It
// answers questions about a client's behaviour, which is not something the
// client's own login, which also holds role=admin, should be able to ask.

import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { INTERNAL_COOKIE, verifyInternalToken } from '@/lib/internalAuth'
import mongoose from 'mongoose'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DAY = 86400000
const PORTAL = 'waga'

// Every module the portal can write, in the order it appears in their sidebar,
// with what a row of it means in words.
//
// The full list is here on purpose, not just the kinds that happen to have rows.
// "Which modules are they using" is only half an answer without "and which have
// they never touched once" — a register nobody has filed against is the thing
// worth a phone call, and it has no rows to be found by counting rows.
const MODULES = [
  { kind: 'waga_filing', label: 'Compliance filing recorded' },
  { kind: 'waga_attachment', label: 'Evidence file attached' },
  { kind: 'waga_deviation', label: 'Deviation raised or worked' },
  { kind: 'waga_reading', label: 'Monitoring reading logged' },
  { kind: 'waga_permit_event', label: 'Permit renewal event' },
  { kind: 'waga_incident', label: 'Incident reported' },
  { kind: 'waga_jsa', label: 'Pre-task safety assessment' },
  { kind: 'waga_loto', label: 'LOTO / permit to work' },
  { kind: 'waga_training', label: 'Training completion' },
  { kind: 'waga_member', label: 'Team member added' },
  { kind: 'waga_site', label: 'Site added' },
  { kind: 'waga_audit', label: 'Audit trail entry' },
]
const LABEL = new Map(MODULES.map((m) => [m.kind, m.label]))

const ymd = (d) => new Date(d).toISOString().slice(0, 10)

export async function GET(request) {
  // The same check proxy.js makes on the page, made again here.
  //
  // The proxy guards the page; it does not guard this route, and an API that
  // trusts its caller to have come through the front door is an API anybody can
  // call directly. `verifyInternalToken` re-tests the allowlist as well as the
  // signature, so clearing somebody out of INTERNAL_EMAILS closes this too.
  //
  // An admin cookie is not accepted. This screen reports on a client whose own
  // login also carries role=admin.
  const staff = verifyInternalToken(request.cookies.get(INTERNAL_COOKIE)?.value)
  if (!staff) {
    return NextResponse.json({ ok: false, error: 'Internal sign-in required.' }, { status: 401 })
  }

  const days = Math.min(180, Math.max(7, Number(request.nextUrl.searchParams.get('days')) || 30))

  try {
    await dbConnect()
  } catch {
    return NextResponse.json({ ok: false, error: 'No database configured.' }, { status: 200 })
  }

  const db = mongoose.connection.db
  const records = db.collection('oxmaintrecords')
  const since = new Date(Date.now() - days * DAY)

  // WAGA's rows, and only live ones.
  //
  // `deleted:false` matters more here than it looks: this collection holds 66
  // soft-deleted waga rows, every one of them from our own verify harnesses
  // (actors 't', 'smoke test'), created and removed minutes apart. Counting
  // them would report our own testing as the client working.
  const MINE = { kind: { $regex: '^waga_' }, deleted: { $ne: true } }

  try {
    // ── the people ────────────────────────────────────────────────────────
    const users = await db.collection('users').find(
      { portals: PORTAL },
      {
        projection: {
          name: 1, email: 1, role: 1, department: 1,
          loginCount: 1, lastLoginAt: 1, loginHistory: 1, createdAt: 1,
        },
      },
    ).toArray()

    const accounts = users.map((u) => {
      const history = (u.loginHistory || [])
        .map((h) => h?.timestamp)
        .filter(Boolean)
        .sort((a, b) => new Date(b) - new Date(a))
      return {
        name: u.name || '',
        email: u.email || '',
        role: u.role || 'member',
        department: u.department || '',
        logins: u.loginCount || 0,
        // Sign-ins we have a date for, which is not the same as `logins` and is
        // never larger than it.
        loginsInWindow: history.filter((t) => new Date(t) >= since).length,
        lastLogin: u.lastLoginAt || history[0] || null,
        created: u.createdAt || null,
      }
    })

    // Every dated sign-in, flattened, so the timeline can count days.
    const loginDays = new Map()
    let historyFrom = null
    for (const u of users) {
      for (const h of u.loginHistory || []) {
        if (!h?.timestamp) continue
        const t = new Date(h.timestamp)
        if (!historyFrom || t < historyFrom) historyFrom = t
        if (t < since) continue
        const key = ymd(t)
        loginDays.set(key, (loginDays.get(key) || 0) + 1)
      }
    }

    // ── what they have written, by module ─────────────────────────────────
    const grouped = await records.aggregate([
      { $match: MINE },
      {
        $group: {
          _id: '$kind',
          total: { $sum: 1 },
          recent: { $sum: { $cond: [{ $gte: ['$createdAt', since] }, 1, 0] } },
          first: { $min: '$createdAt' },
          last: { $max: '$createdAt' },
          actors: { $addToSet: '$createdByName' },
        },
      },
    ]).toArray()

    const found = new Map(grouped.map((g) => [g._id, g]))
    const modules = MODULES.map((m) => {
      const g = found.get(m.kind)
      return {
        kind: m.kind,
        label: m.label,
        total: g?.total || 0,
        recent: g?.recent || 0,
        first: g?.first || null,
        last: g?.last || null,
        actors: (g?.actors || []).filter(Boolean),
      }
    })
    // Anything written under a waga_ kind this list does not name — a module
    // added to the portal and not added here — still gets reported rather than
    // silently dropped.
    for (const g of grouped) {
      if (LABEL.has(g._id)) continue
      modules.push({
        kind: g._id, label: g._id, total: g.total, recent: g.recent,
        first: g.first, last: g.last, actors: (g.actors || []).filter(Boolean),
      })
    }

    // ── a day-by-day count of writes ──────────────────────────────────────
    const daily = await records.aggregate([
      { $match: { ...MINE, createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } },
    ]).toArray()
    const writesByDay = new Map(daily.map((d) => [d._id, d.n]))

    // Every day in the window, including the empty ones. A chart drawn only
    // from the days that had something hides the gaps, and the gaps are the
    // answer to "are they using it".
    const timeline = []
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = ymd(Date.now() - i * DAY)
      timeline.push({ day: d, writes: writesByDay.get(d) || 0, logins: loginDays.get(d) || 0 })
    }

    // ── what they actually did, newest first ──────────────────────────────
    const latest = await records.find(MINE, {
      projection: {
        kind: 1, createdAt: 1, createdByName: 1, title: 1,
        'data.action': 1, 'data.subject': 1, 'data.detail': 1,
        'data.actor': 1, 'data.siteId': 1, 'data.name': 1, 'data.role': 1,
      },
    }).sort({ createdAt: -1 }).limit(120).toArray()

    // The audit trail and the row it describes are one event, saved twice: add a
    // team member and the portal writes both `waga_audit` ("Team member added —
    // Marina Casadei") and the `waga_member` row itself, in the same second.
    // Listing both reads as two separate things happening. The audit line is the
    // one with words, so the bare row is folded into it when they coincide.
    const auditAt = latest.filter((r) => r.kind === 'waga_audit').map((r) => new Date(r.createdAt).getTime())
    const paired = (r) => r.kind !== 'waga_audit'
      && auditAt.some((t) => Math.abs(t - new Date(r.createdAt).getTime()) <= 3000)

    const activity = latest.filter((r) => !paired(r)).slice(0, 80).map((r) => ({
      at: r.createdAt,
      kind: r.kind,
      label: LABEL.get(r.kind) || r.kind,
      // The audit trail already says what happened in words; everything else is
      // named by its own title, and falls back to its module name.
      what: r.data?.action
        ? `${r.data.action}${r.data.subject ? ` — ${r.data.subject}` : ''}`
        : (r.title || r.data?.name || ''),
      detail: r.data?.detail || r.data?.role || '',
      by: r.data?.actor || r.createdByName || '',
      site: r.data?.siteId || '',
    }))

    // ── the one-line answer ───────────────────────────────────────────────
    const lastWrite = modules.reduce((max, m) => (m.last && (!max || m.last > max) ? m.last : max), null)
    const lastLogin = accounts.reduce((max, a) => (a.lastLogin && (!max || a.lastLogin > max) ? a.lastLogin : max), null)
    const writesInWindow = timeline.reduce((n, d) => n + d.writes, 0)
    const daysSinceLogin = lastLogin ? Math.floor((Date.now() - new Date(lastLogin).getTime()) / DAY) : null

    // Deliberately not a score. Each state is a sentence somebody could act on,
    // and the difference between the middle ones is the whole point of the
    // screen: signing in and writing nothing is a real and common state, and it
    // is not the same as having gone quiet.
    //
    // `thin` exists because "they signed in and wrote something" was reading as
    // a clean bill of health off the back of two rows on one day. A single
    // afternoon of entries in a month is being opened, not being used, and the
    // sentence should not have to be corrected by the tiles underneath it.
    const writeDays = timeline.filter((d) => d.writes > 0).length
    let verdict = 'quiet'
    if (daysSinceLogin !== null && daysSinceLogin <= 7) {
      if (writesInWindow === 0) verdict = 'reading'
      else verdict = writeDays <= 1 || writesInWindow <= 3 ? 'thin' : 'active'
    } else if (writesInWindow > 0) verdict = 'writing-only'

    return NextResponse.json({
      ok: true,
      days,
      generatedAt: new Date().toISOString(),
      portal: { id: PORTAL, label: 'WAGA Energy' },
      summary: {
        verdict,
        lastLogin,
        lastWrite,
        daysSinceLogin,
        accounts: accounts.length,
        signedInEver: accounts.filter((a) => a.logins > 0).length,
        loginsAllTime: accounts.reduce((n, a) => n + a.logins, 0),
        loginsInWindow: accounts.reduce((n, a) => n + a.loginsInWindow, 0),
        records: modules.reduce((n, m) => n + m.total, 0),
        recordsInWindow: writesInWindow,
        writeDays,
        signInDays: timeline.filter((d) => d.logins > 0).length,
        modulesUsed: modules.filter((m) => m.total > 0).length,
        modulesTotal: modules.length,
      },
      timeline,
      activity,
      modules,
      accounts,
      // Repeated in the payload so anything reading this API — not only the
      // screen — carries the caveat along with the numbers.
      limits: {
        tracked: ['sign-ins (count, last time, and the day of each one from ' + (historyFrom ? ymd(historyFrom) : 'now') + ')',
          'every record the portal writes, with its module, moment and author'],
        notTracked: ['page views', 'time on page', 'anything read rather than written'],
        signInHistoryFrom: historyFrom ? historyFrom.toISOString() : null,
        note: 'A client who signs in and only reads appears here as a sign-in with no activity. '
          + 'That is a gap in what is measured, not evidence that nobody is using the portal.',
      },
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}
