'use client'

// Is WAGA Energy using their portal, and what are they updating?
//
// One client on this screen, on purpose. The first version reported all six
// portals in a grid and it read as a dashboard rather than an answer — five of
// those are open demo links with no sign-in to count, so their cards were noise
// stacked on top of the only portal that has accounts behind it.
//
// So the screen answers in this order:
//
//   1. one sentence   — are they using it, yes or no, in words
//   2. five numbers   — the ones behind that sentence
//   3. the caveat     — what the numbers cannot see
//   4. the calendar   — which days had a sign-in, which had a change
//   5. the log        — what was actually updated, grouped by day
//   6. the modules    — including every one they have never touched
//   7. the people     — who signed in and who never has
//
// THE CAVEAT IS PART OF THE SCREEN, not a footnote. This app has no analytics:
// no page views, no time on page. What can be seen is sign-ins and writes. A
// compliance manager who signs in every morning to read next week's obligations
// and closes the tab appears here as a sign-in with zero activity — and
// reporting that as "not using it" would be wrong in the most expensive
// possible direction. So the middle verdict is its own state, and it says
// "reading, not writing" rather than anything that sounds like a failure.

import { useEffect, useMemo, useState } from 'react'
import { THEMES, preferredTheme, rememberTheme } from './theme'
import { apiUrl } from '@/lib/apiPath'

const WINDOWS = [7, 30, 90]

const day = (v) => (v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
const dayShort = (v) => (v ? new Date(v).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }) : '—')
const clock = (v) => (v ? new Date(v).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—')

/** How long ago, in the words somebody would use out loud. */
function ago(v) {
  if (!v) return 'never'
  const mins = Math.round((Date.now() - new Date(v).getTime()) / 60000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} h ago`
  const days = Math.round(hrs / 24)
  if (days === 1) return 'yesterday'
  if (days < 31) return `${days} days ago`
  const months = Math.round(days / 30)
  return months === 1 ? 'a month ago' : `${months} months ago`
}

// How stale is too stale. A week without a sign-in on a live account is worth a
// call; a month is worth worrying about.
const heat = (t, v) => {
  if (!v) return t.mute
  const days = (Date.now() - new Date(v).getTime()) / 86400000
  if (days <= 7) return t.green
  if (days <= 30) return t.amber
  return t.red
}

// The one-line answer, in the four states the API can return. Each is a
// sentence somebody could act on, and none of them is a score.
const VERDICT = {
  active: {
    tone: 'green',
    head: 'Using the portal',
    line: 'Somebody has signed in this week, and there are entries across more than one day of the window.',
  },
  thin: {
    tone: 'amber',
    head: 'Being opened, barely being filled in',
    line: 'Somebody signs in, but everything written in this window landed on a single day and amounts to '
      + 'a handful of rows. The registers below show which modules have never been touched at all.',
  },
  reading: {
    tone: 'amber',
    head: 'Signing in, but not entering anything',
    line: 'The portal is being opened. Nothing has been written in this window — which may mean '
      + 'they are reading their obligations rather than filing against them. That is a real use of it, '
      + 'and it is also the state worth a phone call.',
  },
  'writing-only': {
    tone: 'amber',
    head: 'Records written, but nobody has signed in lately',
    line: 'There are changes in the window with no recent sign-in behind them — worth checking who made them.',
  },
  quiet: {
    tone: 'red',
    head: 'Not being opened',
    line: 'No sign-in this week and nothing written in the window.',
  },
}

export default function InternalUsage() {
  const [mode, setMode] = useState('light')
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const t = THEMES[mode]
  const S = useMemo(() => sheet(t), [t])

  // Remembered per browser, and first time round it follows the machine's own
  // setting rather than assuming daylight. Read in an effect, not in the
  // initial state, because neither localStorage nor matchMedia exists on the
  // server and guessing there is what makes a page flash and mismatch.
  useEffect(() => { setMode(preferredTheme()) }, [])

  const flip = () => {
    const next = mode === 'dark' ? 'light' : 'dark'
    setMode(next)
    rememberTheme(next)
  }

  // Signing out has to be a request: the cookie is httpOnly, so the page cannot
  // clear it, and only the server that set it can expire it.
  const signOut = async () => {
    try { await fetch(apiUrl('/api/internal/logout'), { method: 'POST' }) } catch { /* still leave */ }
    window.location.href = '/internal/login'
  }

  // The page owns the whole viewport, so the body has to change with it —
  // otherwise the dark panel sits on a white margin.
  useEffect(() => {
    const prev = document.body.style.background
    document.body.style.background = t.bg
    document.documentElement.style.colorScheme = mode
    return () => { document.body.style.background = prev }
  }, [t.bg, mode])

  useEffect(() => {
    let live = true
    setLoading(true)
    setError('')
    fetch(apiUrl(`/api/internal/usage?days=${days}`))
      .then((r) => r.json())
      .then((j) => {
        if (!live) return
        if (!j.ok) setError(j.error || 'Could not read the usage figures.')
        else setData(j)
      })
      .catch(() => { if (live) setError('Could not reach the usage API.') })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [days])

  const s = data?.summary
  const v = s ? VERDICT[s.verdict] || VERDICT.quiet : null

  // The log reads as a diary, so it is grouped by date rather than run as one
  // long list of timestamps.
  const byDay = useMemo(() => {
    if (!data) return []
    const out = []
    for (const row of data.activity) {
      const key = new Date(row.at).toISOString().slice(0, 10)
      if (!out.length || out[out.length - 1].key !== key) out.push({ key, rows: [row] })
      else out[out.length - 1].rows.push(row)
    }
    return out
  }, [data])

  const used = useMemo(
    () => (data ? data.modules.filter((m) => m.total > 0).sort((a, b) => b.recent - a.recent || b.total - a.total) : []),
    [data],
  )
  const untouched = useMemo(() => (data ? data.modules.filter((m) => m.total === 0) : []), [data])

  const people = useMemo(() => {
    if (!data) return []
    return [...data.accounts].sort((a, b) => {
      const av = a.lastLogin ? new Date(a.lastLogin).getTime() : 0
      const bv = b.lastLogin ? new Date(b.lastLogin).getTime() : 0
      return bv - av || b.logins - a.logins
    })
  }, [data])

  const peak = useMemo(
    () => (data ? Math.max(1, ...data.timeline.map((d) => Math.max(d.writes, d.logins))) : 1),
    [data],
  )

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <header style={S.head}>
          <div style={{ minWidth: 0 }}>
            <div style={S.eyebrow}>Internal · staff only</div>
            <h1 style={S.h1}>
              WAGA Energy
              <span style={S.h1sub}>platform usage</span>
            </h1>
            <p style={S.lede}>
              Whether the client opens their portal, on which days, and what they change when they do.
              Counted from their own accounts and the rows their portal writes — no tracker is involved.
            </p>
          </div>

          <div style={S.tools}>
            <div style={S.seg}>
              {WINDOWS.map((d) => (
                <button
                  key={d} onClick={() => setDays(d)}
                  style={{ ...S.segBtn, ...(days === d ? S.segOn : null) }}
                >
                  {d}d
                </button>
              ))}
            </div>
            <button onClick={flip} style={S.icon} title={mode === 'dark' ? 'Switch to day' : 'Switch to night'}>
              {mode === 'dark' ? '☀' : '☾'}
              <span style={S.iconWord}>{mode === 'dark' ? 'Day' : 'Night'}</span>
            </button>
            <button onClick={signOut} style={S.link}>Sign out</button>
          </div>
        </header>

        {loading && <div style={S.state}>Reading the figures…</div>}
        {error && <div style={{ ...S.state, color: t.red }}>{error}</div>}

        {data && s && (
          <>
            {/* ── the answer, before any number ──────────────────────────── */}
            <section style={{ ...S.verdict, borderLeftColor: t[v.tone] }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ ...S.verdictTag, color: t[v.tone] }}>
                  <span style={{ ...S.pulse, background: t[v.tone] }} />
                  the answer
                </div>
                <h2 style={S.verdictHead}>{v.head}</h2>
                <p style={S.verdictLine}>{v.line}</p>
              </div>
              <div style={S.verdictSide}>
                <Fact S={S} k="Last sign-in" v={ago(s.lastLogin)} tone={heat(t, s.lastLogin)}
                  note={s.lastLogin ? `${day(s.lastLogin)} · ${clock(s.lastLogin)}` : 'no account has ever signed in'} />
                <Fact S={S} k="Last change" v={ago(s.lastWrite)} tone={heat(t, s.lastWrite)}
                  note={s.lastWrite ? `${day(s.lastWrite)} · ${clock(s.lastWrite)}` : 'nothing has ever been written'} />
              </div>
            </section>

            {/* ── the five numbers behind it ─────────────────────────────── */}
            <div style={S.tiles}>
              <Tile S={S} t={t} label="Sign-ins" value={s.loginsAllTime}
                foot={`all time · ${s.loginsInWindow} dated in these ${data.days} days`} />
              <Tile S={S} t={t} label="People who have signed in" value={`${s.signedInEver} of ${s.accounts}`}
                foot={`${s.accounts - s.signedInEver} named account${s.accounts - s.signedInEver === 1 ? '' : 's'} never used`}
                tone={s.signedInEver === 0 ? t.red : s.signedInEver < s.accounts / 2 ? t.amber : t.green} />
              <Tile S={S} t={t} label="Records written" value={s.recordsInWindow}
                foot={`in window · ${s.records} all time`}
                tone={s.recordsInWindow === 0 ? t.amber : t.green} />
              <Tile S={S} t={t} label="Days with a change" value={`${s.writeDays}/${data.days}`}
                foot={s.writeDays === 0 ? 'no day in the window' : 'days something was entered'}
                tone={s.writeDays === 0 ? t.amber : t.green} />
              <Tile S={S} t={t} label="Modules touched" value={`${s.modulesUsed} of ${s.modulesTotal}`}
                foot={`${s.modulesTotal - s.modulesUsed} never written to`}
                tone={s.modulesUsed <= 2 ? t.amber : t.green} />
            </div>

            {/* Not a footnote. The most expensive mistake this screen can cause
                is reading "no activity" as "not using it", so the correction
                sits above the chart rather than under it. */}
            <div style={S.note}>
              <b>Sign-ins and writes only.</b> There is no analytics in this app — no page views, no
              time on page. Someone who signs in and only <i>reads</i> their obligations shows here as a
              sign-in with no activity. That is a gap in what is measured, not evidence of an unused portal.
              {data.limits.signInHistoryFrom ? (
                <> Per-day sign-ins are known from <b>{day(data.limits.signInHistoryFrom)}</b> onward; before
                  that only the latest sign-in per account was ever stored.</>
              ) : (
                <> <b>Per-day sign-ins start from the next login.</b> Until now only the count and the latest
                  sign-in were stored per account, so the sign-in bars below are empty for past days —
                  that is missing history, not a quiet client.</>
              )}
            </div>

            {/* ── the calendar ───────────────────────────────────────────── */}
            <section style={S.section}>
              <div style={S.h2row}>
                <h2 style={S.h2}>Day by day</h2>
                <div style={S.legend}>
                  <span style={S.legendItem}><i style={{ ...S.swatch, background: t.accent }} />sign-ins</span>
                  <span style={S.legendItem}><i style={{ ...S.swatch, background: t.writes }} />records written</span>
                </div>
              </div>
              <div style={S.chart}>
                {data.timeline.map((d) => (
                  <span
                    key={d.day}
                    title={`${dayShort(d.day)} — ${d.logins} sign-in${d.logins === 1 ? '' : 's'}, ${d.writes} record${d.writes === 1 ? '' : 's'}`}
                    style={S.slot}
                  >
                    <span style={S.pair}>
                      <Bar S={S} colour={t.accent} value={d.logins} peak={peak} line={t.hair} />
                      <Bar S={S} colour={t.writes} value={d.writes} peak={peak} line={t.hair} />
                    </span>
                  </span>
                ))}
              </div>
              <div style={S.axis}>
                <span>{day(data.timeline[0]?.day)}</span>
                <span style={{ color: t.mute }}>
                  {s.signInDays} day{s.signInDays === 1 ? '' : 's'} with a sign-in ·{' '}
                  {s.writeDays} with a change
                </span>
                <span>{day(data.timeline[data.timeline.length - 1]?.day)}</span>
              </div>
            </section>

            {/* ── what was actually updated ──────────────────────────────── */}
            <section style={S.section}>
              <div style={S.h2row}>
                <h2 style={S.h2}>What they updated</h2>
                <span style={S.h2note}>newest first · {data.activity.length} entr{data.activity.length === 1 ? 'y' : 'ies'}</span>
              </div>
              {byDay.length === 0 ? (
                <p style={S.empty}>Nothing has ever been written in this portal.</p>
              ) : (
                <div style={S.panel}>
                  {byDay.map((group) => (
                    <div key={group.key}>
                      <div style={S.dayHead}>
                        <span>{dayShort(group.key)}</span>
                        <span style={{ color: t.mute, fontWeight: 500 }}>
                          {group.rows.length} update{group.rows.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      {group.rows.map((a, i) => (
                        <div key={`${a.at}-${i}`} style={S.row}>
                          <span style={S.rowTime}>{clock(a.at)}</span>
                          <span style={{ minWidth: 0, flex: 1 }}>
                            <span style={S.rowWhat}>{a.what || a.label}</span>
                            <span style={S.rowMeta}>
                              {a.label}
                              {a.by ? ` · ${a.by}` : ''}
                              {a.detail ? ` · ${a.detail}` : ''}
                              {a.site ? ` · ${a.site}` : ''}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── which modules, including the untouched ones ─────────────── */}
            <section style={S.section}>
              <div style={S.h2row}>
                <h2 style={S.h2}>Modules</h2>
                <span style={S.h2note}>what they write to, and what they never have</span>
              </div>

              {used.length === 0 ? (
                <p style={S.empty}>No module has been written to.</p>
              ) : (
                <div style={S.panel}>
                  <div style={S.colHead}>
                    <span style={S.colHeadFirst}>module</span>
                    <span>window</span><span>all time</span><span>last written</span>
                  </div>
                  {used.map((m) => (
                    <div key={m.kind} style={S.row}>
                      <span style={{ ...S.rowDot, background: t.writes }} />
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={S.rowWhat}>{m.label}</span>
                        <span style={S.rowMeta}>
                          {m.kind}
                          {m.actors.length ? ` · ${m.actors.slice(0, 3).join(', ')}` : ''}
                        </span>
                      </span>
                      <span style={{ ...S.num, color: m.recent ? t.ink : t.mute }}>{m.recent}</span>
                      <span style={{ ...S.num, color: t.mute }}>{m.total}</span>
                      <span style={S.rowTime}>{ago(m.last)}</span>
                    </div>
                  ))}
                </div>
              )}

              {untouched.length > 0 && (
                <div style={S.untouched}>
                  <b style={{ color: t.sub }}>Never written to</b>
                  <span style={S.chips}>
                    {untouched.map((m) => <span key={m.kind} style={S.chip}>{m.label}</span>)}
                  </span>
                </div>
              )}
            </section>

            {/* ── who has an account, and whether they use it ────────────── */}
            <section style={S.section}>
              <div style={S.h2row}>
                <h2 style={S.h2}>People</h2>
                <span style={S.h2note}>
                  {s.signedInEver} of {s.accounts} have ever signed in
                </span>
              </div>
              <div style={S.panel}>
                <div style={{ ...S.colHead, gridTemplateColumns: '1fr 52px 74px' }}>
                  <span style={S.colHeadFirst}>person</span>
                  <span>sign-ins</span><span>last seen</span>
                </div>
                {people.map((a) => (
                  <div key={a.email} style={S.row}>
                    <span style={{ ...S.rowDot, background: a.logins ? heat(t, a.lastLogin) : t.line }} />
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={S.rowWhat}>{a.name || a.email}</span>
                      <span style={S.rowMeta}>
                        {a.email}
                        {a.department ? ` · ${a.department}` : ''}
                        {a.role && a.role !== 'member' ? ` · ${a.role}` : ''}
                      </span>
                    </span>
                    <span style={{ ...S.num, color: a.logins ? t.ink : t.mute }}>{a.logins}</span>
                    <span style={{
                      ...S.rowTime, color: a.logins ? heat(t, a.lastLogin) : t.mute,
                      fontWeight: a.logins ? 700 : 500,
                    }}>
                      {ago(a.lastLogin)}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <footer style={S.foot}>
              Read at {day(data.generatedAt)} · {clock(data.generatedAt)} · window {data.days} days ·
              {' '}not tracked: {data.limits.notTracked.join(', ')}. Other portals are deliberately
              off this screen — they have no sign-in to count.
            </footer>
          </>
        )}
      </div>
    </div>
  )
}

/** One bar of the day pair. Zero draws a hairline, so an empty day is visibly empty rather than absent. */
function Bar({ S, colour, value, peak, line }) {
  const h = value ? Math.max(4, Math.round((value / peak) * 100)) : 0
  return (
    <span style={{
      ...S.bar,
      height: `${h}%`,
      background: value ? colour : 'transparent',
      borderBottom: value ? 'none' : `2px solid ${line}`,
    }} />
  )
}

function Fact({ S, k, v, tone, note }) {
  return (
    <div style={S.fact}>
      <div style={S.factK}>{k}</div>
      <div style={{ ...S.factV, color: tone }}>{v}</div>
      <div style={S.factNote}>{note}</div>
    </div>
  )
}

function Tile({ S, t, label, value, foot, tone }) {
  return (
    <div style={S.tile}>
      <div style={S.tileK}>{label}</div>
      <div style={{ ...S.tileV, color: tone || t.ink }}>{value}</div>
      <div style={S.tileFoot}>{foot}</div>
    </div>
  )
}

// Tailwind's preflight is deliberately off in this app, so a bare <button>
// keeps the browser's own chrome. Every button below states its border and
// background rather than trusting a reset that is not there.
const sheet = (t) => ({
  page: { minHeight: '100vh', background: t.bg, fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', color: t.ink },
  wrap: { maxWidth: 1180, margin: '0 auto', padding: '30px 24px 64px' },

  head: { display: 'flex', gap: 24, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 22 },
  eyebrow: { fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', color: t.red, marginBottom: 7 },
  h1: { margin: 0, fontSize: 31, fontWeight: 800, letterSpacing: -0.6, color: t.ink, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  h1sub: { fontSize: 14, fontWeight: 600, color: t.mute, letterSpacing: 0 },
  lede: { margin: '9px 0 0', fontSize: 13, color: t.sub, lineHeight: 1.65, maxWidth: 620 },

  tools: { display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' },
  seg: { display: 'flex', background: t.panel, borderRadius: 10, padding: 3, gap: 2, borderStyle: 'solid', borderWidth: 1, borderColor: t.line },
  segBtn: {
    padding: '6px 12px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
    borderRadius: 7, background: 'transparent', color: t.sub, borderStyle: 'none', borderWidth: 0,
  },
  segOn: { background: t.accent, color: t.bg },
  icon: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: 13, fontWeight: 700,
    fontFamily: 'inherit', cursor: 'pointer', borderRadius: 10, background: t.panel, color: t.sub,
    borderStyle: 'solid', borderWidth: 1, borderColor: t.line,
  },
  iconWord: { fontSize: 12 },
  link: {
    padding: '9px 13px', fontSize: 12, fontWeight: 700, borderRadius: 10, cursor: 'pointer',
    background: t.panel, color: t.accent, textDecoration: 'none', fontFamily: 'inherit',
    borderStyle: 'solid', borderWidth: 1, borderColor: t.line,
  },

  state: { padding: '48px 0', textAlign: 'center', fontSize: 13, color: t.sub },

  verdict: {
    display: 'flex', gap: 26, alignItems: 'stretch', flexWrap: 'wrap',
    padding: '18px 20px', borderRadius: 14, background: t.panel, boxShadow: t.shadow,
    borderStyle: 'solid', borderWidth: 1, borderColor: t.line,
    borderLeftStyle: 'solid', borderLeftWidth: 4, marginBottom: 14,
  },
  verdictTag: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 10, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 8 },
  pulse: { width: 7, height: 7, borderRadius: '50%', display: 'inline-block' },
  verdictHead: { margin: 0, fontSize: 20, fontWeight: 800, color: t.ink, letterSpacing: -0.3 },
  verdictLine: { margin: '7px 0 0', fontSize: 12.5, color: t.sub, lineHeight: 1.65, maxWidth: 560 },
  verdictSide: { display: 'flex', gap: 22, flexShrink: 0, alignItems: 'flex-start' },
  fact: { minWidth: 132 },
  factK: { fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: t.mute },
  factV: { fontSize: 17, fontWeight: 800, marginTop: 5, letterSpacing: -0.2 },
  factNote: { fontSize: 10.5, color: t.mute, marginTop: 3 },

  tiles: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(178px,1fr))', gap: 10, marginBottom: 14 },
  tile: {
    padding: '13px 15px', borderRadius: 12, background: t.panel, boxShadow: t.shadow,
    borderStyle: 'solid', borderWidth: 1, borderColor: t.line,
  },
  tileK: { fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: t.mute, lineHeight: 1.4 },
  tileV: { fontSize: 24, fontWeight: 800, marginTop: 7, letterSpacing: -0.6 },
  tileFoot: { fontSize: 10.5, color: t.mute, marginTop: 4, lineHeight: 1.45 },

  note: {
    padding: '12px 15px', borderRadius: 12, background: t.noteBg, color: t.noteInk,
    fontSize: 12, lineHeight: 1.7, marginBottom: 26,
    borderLeftStyle: 'solid', borderLeftWidth: 3, borderLeftColor: t.noteEdge,
  },

  section: { marginBottom: 26 },
  h2row: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 11 },
  h2: { margin: 0, fontSize: 14.5, fontWeight: 800, color: t.ink },
  h2note: { fontSize: 11.5, color: t.mute },

  legend: { display: 'flex', gap: 14 },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: t.sub },
  swatch: { width: 9, height: 9, borderRadius: 2, display: 'inline-block' },

  chart: {
    display: 'flex', alignItems: 'flex-end', gap: 3, height: 116,
    padding: '12px 12px 10px', borderRadius: 12, background: t.panel, boxShadow: t.shadow,
    borderStyle: 'solid', borderWidth: 1, borderColor: t.line,
  },
  slot: { flex: 1, minWidth: 4, height: '100%', display: 'flex', alignItems: 'flex-end' },
  pair: { display: 'flex', alignItems: 'flex-end', gap: 1, width: '100%', height: '100%' },
  bar: { display: 'block', flex: 1, borderRadius: '3px 3px 0 0', minHeight: 0 },
  axis: { display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 7, fontSize: 10.5, color: t.sub, flexWrap: 'wrap' },

  panel: {
    background: t.panel, borderRadius: 12, overflow: 'hidden', boxShadow: t.shadow,
    borderStyle: 'solid', borderWidth: 1, borderColor: t.line,
  },
  dayHead: {
    display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 15px',
    background: t.panel2, fontSize: 11, fontWeight: 800, color: t.sub,
    letterSpacing: 0.3, textTransform: 'uppercase',
    borderBottomStyle: 'solid', borderBottomWidth: 1, borderBottomColor: t.line,
  },
  row: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 15px', borderBottom: `1px solid ${t.hair}` },
  rowDot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  rowTime: { fontSize: 11, color: t.mute, flexShrink: 0, minWidth: 74, textAlign: 'right', whiteSpace: 'nowrap' },
  rowWhat: { display: 'block', fontSize: 12.5, fontWeight: 600, color: t.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowMeta: { display: 'block', fontSize: 10.5, color: t.mute, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  num: { fontSize: 12, fontWeight: 700, minWidth: 52, textAlign: 'right', flexShrink: 0 },

  // A header row, above the numbers rather than below them. The column widths
  // repeat the row's own — `num` twice and `rowTime` — and the left padding adds
  // the row's dot and its gap, so a label sits over the figures it names
  // instead of near them. Change one and the other has to change with it.
  colHead: {
    display: 'grid', gridTemplateColumns: '1fr 52px 52px 74px', gap: 12,
    padding: '8px 15px 8px 34px', background: t.panel2,
    fontSize: 9.5, fontWeight: 700, color: t.mute, textTransform: 'uppercase',
    letterSpacing: 0.5, textAlign: 'right',
    borderBottomStyle: 'solid', borderBottomWidth: 1, borderBottomColor: t.line,
  },
  colHeadFirst: { textAlign: 'left' },
  untouched: { display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap', marginTop: 12, fontSize: 11 },
  chips: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chip: {
    padding: '4px 9px', borderRadius: 20, fontSize: 11, color: t.mute, background: t.panel,
    borderStyle: 'solid', borderWidth: 1, borderColor: t.line,
  },

  empty: {
    margin: 0, padding: '22px 15px', background: t.panel, borderRadius: 12, fontSize: 12.5, color: t.mute,
    borderStyle: 'solid', borderWidth: 1, borderColor: t.line,
  },
  foot: { marginTop: 26, paddingTop: 15, borderTop: `1px solid ${t.line}`, fontSize: 11, color: t.mute, lineHeight: 1.7 },
})
