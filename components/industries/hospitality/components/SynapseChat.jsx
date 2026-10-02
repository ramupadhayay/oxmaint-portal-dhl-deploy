'use client'

// Synapse AI — the assistant, answering from the plant's own data.
//
// The clone drives this through an n8n webhook on a host that does not exist
// outside their infrastructure, so lifting it verbatim would put a permanently
// failing fetch in the console and a chat window that never replies. The
// interesting half is not the transport anyway.
//
// So this answers locally, off the same records the screens are rendering. That
// makes it genuinely true — ask how many work orders are overdue and the number
// is the number on the dashboard, because it is the same array — and it means
// the assistant keeps working in a room with no internet, which is where these
// get shown.

import { useMemo, useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { OxmaintMark } from './Logo'
import { useRecords } from '../lib/store'
import {
  WORK_ORDERS, ASSETS, PARTS, PM_SCHEDULES, INSPECTIONS, TECHNICIANS,
  SUITES, REQUESTS, SITE, OPEN_STATUS, isPast, fmtDate, money, ORG,
} from '../lib/data'
import { ROTATION, TODAY_SCHEDULE } from '../lib/schedule'

const ACCENT = '#15227a'

// The questions a hotel engineer asks, which are not a plant's. "Which suites
// are due" has no equivalent in a factory, and "what stops production" has none
// here — a suite out of service is a room that cannot be sold tonight.
const SUGGESTIONS = [
  'What needs attention today?',
  'Which suites are due?',
  'Any guests waiting?',
  'What is overdue?',
  'Show me low stock',
  'How is PM compliance?',
]

// Intent matching by keyword. Not a language model, and it does not pretend to
// be one — it recognises the questions a maintenance manager actually asks and
// answers those exactly, rather than answering everything approximately.
function answer(question, d) {
  const q = question.toLowerCase()
  const has = (...words) => words.some((w) => q.includes(w))

  if (has('overdue', 'late', 'behind')) {
    const late = d.openWO.filter((w) => isPast(w.due_date))
    const latePM = d.pms.filter((p) => isPast(p.next_due))
    return {
      text: late.length || latePM.length
        ? `${late.length} work orders are past their due date and still open, and ${latePM.length} PM schedules are overdue.\n\nThe oldest is ${late[0]?.work_order_number || '—'} — ${late[0]?.title || ''} on ${late[0]?.asset_name || ''}, assigned to ${late[0]?.assigned_to_name || 'nobody'}.`
        : 'Nothing is overdue. Every open work order and PM schedule is still inside its window.',
      go: late.length ? 'work-orders' : 'pm-schedules',
      label: 'Open work orders',
    }
  }

  // Hotel-only: the rotation is the department's largest commitment and has no
  // equivalent in the plant version of this assistant.
  if (has('suite', 'rotation', 'room', 'due today', 'cycle')) {
    const dueToday = SUITES.filter((s) => s.state === 'Due today')
    const slipped = SUITES.filter((s) => s.state === 'Overdue')
    return {
      text: `${dueToday.length} suite${dueToday.length === 1 ? '' : 's'} due today${dueToday.length ? `: ${dueToday.map((s) => s.suite_number).join(', ')}` : ''}.\n\nThe rotation is on day ${ROTATION.cyclePosition} of ${ROTATION.cycleDays} with ${ROTATION.done} of ${ROTATION.total} done — the plan calls for ${ROTATION.expected} by now, so it is ${ROTATION.done >= ROTATION.expected ? 'on track' : `${ROTATION.expected - ROTATION.done} behind`}.${slipped.length ? `\n\n${slipped.length} slipped past their date: ${slipped.slice(0, 6).map((s) => s.suite_number).join(', ')}. Those carry to the top of the schedule.` : ''}`,
      go: 'suite-rotation', label: 'Suite rotation',
    }
  }

  if (has('guest', 'request', 'front desk', 'waiting', 'housekeeping')) {
    const open = REQUESTS.filter((r) => r.status === 'Open')
    const guest = open.filter((r) => String(r.source).startsWith('Front desk'))
    return {
      text: guest.length
        ? `${guest.length} guest-reported request${guest.length === 1 ? '' : 's'} waiting, out of ${open.length} untriaged in total.\n\n${guest.slice(0, 5).map((r) => `• ${r.request_number} — ${r.title}${r.suite_number ? ` (Suite ${r.suite_number})` : ''}`).join('\n')}\n\nThese are the ones with somebody in the building waiting on them.`
        : `Nothing from the front desk is waiting. ${open.length} request${open.length === 1 ? '' : 's'} from housekeeping and elsewhere still to triage.`,
      go: 'requests', label: 'Requests',
    }
  }

  if (has('down', 'broken', 'failed asset', 'not running', 'out of service')) {
    const down = d.assets.filter((a) => a.status === 'Down')
    return {
      text: down.length
        ? `${down.length} assets are down:\n\n${down.slice(0, 6).map((a) => `• ${a.asset_name} — ${a.location_name}, ${a.criticality} criticality`).join('\n')}${down.length > 6 ? `\n…and ${down.length - 6} more.` : ''}\n\nAnything down inside a suite usually means the room cannot be sold.`
        : 'Nothing is down. Every asset is either operational or under planned maintenance.',
      go: 'assets', label: 'Assets',
    }
  }

  if (has('stock', 'part', 'spare', 'inventory', 'reorder')) {
    const out = d.parts.filter((p) => p.status === 'Out of Stock')
    const low = d.parts.filter((p) => p.status === 'Low Stock')
    return {
      text: `${out.length} parts are out of stock and ${low.length} are below their reorder point.\n\n${[...out, ...low].slice(0, 5).map((p) => `• ${p.part_name} (${p.part_number}) — ${p.quantity_on_hand} on hand, minimum ${p.min_quantity}`).join('\n') || 'Nothing needs reordering.'}\n\nStock at cost is ${money(d.parts.reduce((n, p) => n + p.total_value, 0))}.`,
      go: 'parts', label: 'Parts',
    }
  }

  if (has('busy', 'busiest', 'workload', 'who is', 'technician', 'assigned')) {
    const load = TECHNICIANS.map((t) => ({
      name: t.name, role: t.role,
      open: d.openWO.filter((w) => w.assigned_to_name === t.name).length,
    })).sort((a, b) => b.open - a.open)
    return {
      text: `Current workload:\n\n${load.slice(0, 5).map((p) => `• ${p.name} (${p.role}) — ${p.open} open`).join('\n')}\n\n${load[0].name} is carrying the most at ${load[0].open}.`,
      go: 'teams', label: 'Teams',
    }
  }

  if (has('pm', 'preventive', 'compliance', 'schedule')) {
    const late = d.pms.filter((p) => isPast(p.next_due))
    const pct = d.pms.length ? Math.round(((d.pms.length - late.length) / d.pms.length) * 100) : 100
    return {
      text: `PM compliance is ${pct}% across ${d.pms.length} schedules — ${late.length} overdue.\n\n${late.slice(0, 4).map((p) => `• ${p.schedule_name}, was due ${fmtDate(p.next_due)}`).join('\n') || 'Every schedule is inside its window.'}\n\nThat measure counts schedules not yet past due. It says nothing about how well each was done.`,
      go: 'pm-schedules', label: 'PM schedules',
    }
  }

  if (has('inspect', 'audit', 'brand', 'fire', 'permit', 'certificate', 'finding')) {
    const soon = [...d.insp]
      .map((i) => ({ ...i, due: Math.round((new Date(i.next_date) - Date.now()) / 86400000) }))
      .sort((a, b) => a.due - b.due)
    const findings = d.insp.reduce((n, i) => n + (i.findings || 0), 0)
    return {
      text: `${d.insp.length} external inspections tracked, with ${findings} finding${findings === 1 ? '' : 's'} from the last round.\n\nNext up:\n${soon.slice(0, 4).map((i) => `• ${i.name} — ${i.due < 0 ? `${-i.due} days late` : `in ${i.due} days`}, signed by ${i.inspector}`).join('\n')}\n\nThese are the ones somebody outside the department signs.`,
      go: 'inspections', label: 'Inspections',
    }
  }

  if (has('cost', 'spend', 'budget', 'money', 'expensive')) {
    const total = d.wos.reduce((n, w) => n + (w.total_cost || 0), 0)
    const byAsset = new Map()
    d.wos.forEach((w) => byAsset.set(w.asset_name, (byAsset.get(w.asset_name) || 0) + (w.total_cost || 0)))
    const worst = [...byAsset.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
    return {
      text: `Maintenance spend is ${money(total)} across ${d.wos.length} work orders — ${money(Math.round(total / Math.max(1, d.wos.length)))} on average.\n\nMost expensive assets:\n${worst.map(([name, v]) => `• ${name} — ${money(v)}`).join('\n')}`,
      go: 'reports', label: 'Reports',
    }
  }

  if (has('attention', 'today', 'priority', 'critical', 'urgent', 'what should', 'shift')) {
    const critical = d.openWO.filter((w) => w.priority === 'Critical')
    const late = d.openWO.filter((w) => isPast(w.due_date))
    const slipped = SUITES.filter((s) => s.state === 'Overdue')
    const guest = REQUESTS.filter((r) => r.status === 'Open' && String(r.source).startsWith('Front desk'))
    const hrs = (m) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
    return {
      // Ordered the way the schedule is, and for the same reason: the things
      // already failed come before the things merely due.
      text: `Today is ${hrs(TODAY_SCHEDULE.totalMinutes)} of an ${TODAY_SCHEDULE.shiftMinutes / 60}-hour shift across ${TODAY_SCHEDULE.itemCount} items, on ${TODAY_SCHEDULE.technician?.name || 'nobody'}.\n\nWhere I would start:\n• ${slipped.length} suites past their rotation date\n• ${guest.length} guest requests waiting at the desk\n• ${critical.length} critical work orders open${critical[0] ? ` — ${critical[0].work_order_number}` : ''}\n• ${late.length} work orders overdue\n\nThe slipped suites and the waiting guests are the two that are already failures; the rest can be planned.`,
      go: 'daily-schedule', label: "Today's schedule",
    }
  }

  // Fall back honestly rather than inventing something.
  return {
    text: `I can answer from ${ORG.organization_name}'s live records — the day's schedule, the suite rotation, guest requests, work orders, assets, PM schedules, inventory, inspections and cost.\n\nTry one of the suggestions below, or ask about a specific area.`,
  }
}

export default function SynapseChat({ open: openProp, onOpen, onClose }) {
  const router = useRouter()
  // The CMMS version scopes every answer to the selected plant. This portal is
  // one hotel, so there is nothing to scope by and the property is named
  // outright.
  const siteName = SITE.site_name
  // Controlled when the header drives it, self-managed when it is not.
  //
  // Both directions have to go back to the parent. The first version only
  // reported closing, so the header could open the chat but the floating
  // launcher — which asks for the opposite of the current state — asked to open
  // and nothing happened. A controlled component that swallows half its own
  // events is worse than an uncontrolled one.
  const [openSelf, setOpenSelf] = useState(false)
  const controlled = openProp !== undefined
  const open = controlled ? openProp : openSelf
  const setOpen = (v) => {
    const next = typeof v === 'function' ? v(open) : v
    if (!controlled) { setOpenSelf(next); return }
    if (next) onOpen?.()
    else onClose?.()
  }
  const [input, setInput] = useState('')
  const [thread, setThread] = useState([])
  const [thinking, setThinking] = useState(false)
  const endRef = useRef(null)

  // The portal's own kind, so a work order closed on the Work Orders screen is
  // closed as far as the assistant is concerned too.
  const wos = useRecords('hosp_work_order', WORK_ORDERS, (w) => w.workorder_id || w.recordId)

  const d = useMemo(() => ({
    wos,
    openWO: wos.filter((w) => OPEN_STATUS.includes(w.status)),
    assets: ASSETS,
    parts: PARTS,
    pms: PM_SCHEDULES,
    insp: INSPECTIONS,
    siteName,
  }), [wos, siteName])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [thread, thinking])

  const ask = (text) => {
    const q = String(text || input).trim()
    if (!q) return
    setInput('')
    setThread((p) => [...p, { role: 'user', text: q }])
    setThinking(true)
    // A beat before answering. Instant replies to a question that takes a human
    // a minute read as canned, which is exactly what this is trying not to be.
    setTimeout(() => {
      setThread((p) => [...p, { role: 'ai', ...answer(q, d) }])
      setThinking(false)
    }, 450)
  }

  return (
    <>
      {/* The launcher carries the bull, reversed out of the navy, which is what
          the live product uses — a generic chat glyph here would be the one
          place on the screen that does not look like Oxmaint. */}
      <button onClick={() => setOpen((v) => !v)} title="Synapse AI" style={launcher}>
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        ) : (
          <OxmaintMark size={28} tone="light" />
        )}
      </button>

      {open && (
        <div style={panel}>
          <div style={head}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <OxmaintMark size={22} tone="light" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Synapse AI</div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.72)' }}>Reading {siteName} · on-prem</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={closeBtn}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>

          <div style={body}>
            {thread.length === 0 && (
              <div style={{ padding: '6px 2px 12px' }}>
                <p style={{ margin: '0 0 4px', fontSize: 12.5, color: '#0f172a', fontWeight: 700 }}>
                  Ask about {ORG.organization_name}.
                </p>
                <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.55 }}>
                  Every answer is counted from the records on these screens, so it matches what you see.
                </p>
              </div>
            )}

            {thread.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 9 }}>
                <div style={m.role === 'user' ? bubbleUser : bubbleAI}>
                  <span style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span>
                  {m.go && (
                    <button onClick={() => { setOpen(false); router.push('/portal/hospitality/' + m.go) }} style={goBtn}>
                      {m.label} →
                    </button>
                  )}
                </div>
              </div>
            ))}

            {thinking && (
              <div style={{ display: 'flex', gap: 4, padding: '6px 2px' }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{
                    width: 6, height: 6, borderRadius: '50%', background: '#cbd5e1',
                    animation: `oxPulse 1s ${i * 0.15}s infinite`,
                  }} />
                ))}
                <style>{'@keyframes oxPulse{0%,100%{opacity:.3}50%{opacity:1}}'}</style>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div style={{ padding: '0 12px 8px', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {SUGGESTIONS.slice(0, thread.length ? 3 : 6).map((s) => (
              <button key={s} onClick={() => ask(s)} style={chip}>{s}</button>
            ))}
          </div>

          <div style={foot}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') ask() }}
              placeholder="Ask Synapse AI…"
              style={field}
            />
            <button onClick={() => ask()} disabled={!input.trim()} style={{ ...send, opacity: input.trim() ? 1 : 0.4 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4z" /></svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}

const launcher = {
  position: 'fixed', bottom: 22, right: 22, width: 50, height: 50, borderRadius: '50%',
  background: `linear-gradient(135deg,#2536a8,${ACCENT})`, border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1400,
  boxShadow: '0 6px 20px rgba(21,34,122,0.38)',
}
const panel = {
  position: 'fixed', bottom: 84, right: 22, width: 'min(392px, calc(100vw - 44px))',
  height: 'min(552px, calc(100vh - 130px))', background: '#fff', borderRadius: 15,
  border: '1px solid #e8ecf1', boxShadow: '0 18px 48px rgba(15,23,42,0.22)',
  display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 1400,
}
const head = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '11px 13px', background: `linear-gradient(135deg,#2536a8,${ACCENT})`,
}
const dot = { width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 0 3px rgba(74,222,128,0.25)' }
const closeBtn = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.16)', border: 'none', borderRadius: 7, cursor: 'pointer' }
const body = { flex: 1, overflowY: 'auto', padding: '12px 12px 4px' }
const bubbleBase = { maxWidth: '86%', padding: '9px 12px', fontSize: 12.5, lineHeight: 1.55, borderRadius: 12 }
const bubbleUser = { ...bubbleBase, background: ACCENT, color: '#fff', borderBottomRightRadius: 4 }
const bubbleAI = { ...bubbleBase, background: '#f4f6fb', color: '#0f172a', borderBottomLeftRadius: 4, border: '1px solid #e8ecf1' }
const goBtn = {
  display: 'block', marginTop: 9, padding: '5px 10px', fontSize: 11, fontWeight: 700,
  color: ACCENT, background: '#fff', border: `1px solid ${ACCENT}`, borderRadius: 7,
  cursor: 'pointer', fontFamily: 'inherit',
}
const chip = {
  padding: '5px 9px', fontSize: 11, fontWeight: 600, color: '#475569', background: '#f8fafc',
  border: '1px solid #e8ecf1', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
}
const foot = { display: 'flex', gap: 7, padding: '9px 12px 12px', borderTop: '1px solid #e8ecf1' }
const field = {
  flex: 1, minWidth: 0, padding: '9px 11px', fontSize: 12.5, border: '1px solid #e8ecf1',
  borderRadius: 9, outline: 'none', fontFamily: 'inherit', color: '#0f172a',
}
const send = {
  width: 36, height: 36, flexShrink: 0, borderRadius: 9, border: 'none', cursor: 'pointer',
  background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center',
}
