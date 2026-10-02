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
import { useSite } from '../lib/siteStore'
import { OxmaintMark } from './Logo'
import { useRecords } from '../lib/store'
import {
  WORK_ORDERS, ASSETS, PARTS, PM_SCHEDULES, INSPECTIONS, TECHNICIANS,
  OPEN_STATUS, isPast, fmtDate, money, ORG,
} from '../lib/data'

const ACCENT = '#15227a'

const SUGGESTIONS = [
  'What needs attention today?',
  'Which assets are down?',
  'What is overdue?',
  'Show me low stock',
  'Who is busiest?',
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

  if (has('down', 'broken', 'failed asset', 'not running')) {
    const down = d.assets.filter((a) => a.status === 'Down')
    return {
      text: down.length
        ? `${down.length} assets are down:\n\n${down.slice(0, 6).map((a) => `• ${a.asset_name} (${a.asset_code}) at ${a.site_name} — ${a.criticality} criticality`).join('\n')}${down.length > 6 ? `\n…and ${down.length - 6} more.` : ''}`
        : 'Nothing is down. All assets are either operational or under planned maintenance.',
      go: 'assets', label: 'Asset master',
    }
  }

  if (has('stock', 'part', 'spare', 'inventory', 'reorder')) {
    const out = d.parts.filter((p) => p.status === 'Out of Stock')
    const low = d.parts.filter((p) => p.status === 'Low Stock')
    return {
      text: `${out.length} parts are out of stock and ${low.length} are below their reorder point.\n\n${[...out, ...low].slice(0, 5).map((p) => `• ${p.part_name} (${p.part_number}) — ${p.quantity_on_hand} of ${p.minimum_quantity} ${p.unit}`).join('\n') || 'Nothing needs reordering.'}\n\nStock at cost is ${money(d.parts.reduce((n, p) => n + p.total_value, 0))}.`,
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
      go: 'members', label: 'Members',
    }
  }

  if (has('pm', 'preventive', 'compliance', 'schedule')) {
    const late = d.pms.filter((p) => isPast(p.next_due))
    const pct = d.pms.length ? Math.round(((d.pms.length - late.length) / d.pms.length) * 100) : 100
    return {
      text: `PM compliance is ${pct}% across ${d.pms.length} schedules — ${late.length} overdue.\n\n${late.slice(0, 4).map((p) => `• ${p.schedule_name} on ${p.asset_name}, was due ${fmtDate(p.next_due)}`).join('\n') || 'Every schedule is inside its window.'}`,
      go: 'pm-schedules', label: 'PM schedules',
    }
  }

  if (has('inspect', 'checklist', 'pass rate', 'finding')) {
    const failed = d.insp.filter((i) => i.result === 'Fail')
    const rate = d.insp.length ? Math.round((d.insp.filter((i) => i.result === 'Pass').length / d.insp.length) * 100) : 0
    return {
      text: `Inspection pass rate is ${rate}% across ${d.insp.length} inspections. ${failed.length} failed, with ${d.insp.reduce((n, i) => n + i.findings_count, 0)} findings open.\n\n${failed.slice(0, 4).map((i) => `• ${i.inspection_number} — ${i.asset_name}, scored ${i.score}%`).join('\n')}`,
      go: 'inspections', label: 'Inspection reports',
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

  if (has('attention', 'today', 'priority', 'critical', 'urgent', 'what should')) {
    const critical = d.openWO.filter((w) => w.priority === 'Critical')
    const late = d.openWO.filter((w) => isPast(w.due_date))
    const down = d.assets.filter((a) => a.status === 'Down')
    return {
      text: `Where I would start at ${d.siteName}:\n\n• ${critical.length} critical work orders open${critical[0] ? ` — ${critical[0].work_order_number} on ${critical[0].asset_name}` : ''}\n• ${late.length} work orders overdue\n• ${down.length} assets down\n• ${d.parts.filter((p) => p.status !== 'In Stock').length} parts at or below reorder\n\nThe critical work is the part that stops production; the rest can be planned.`,
      go: 'work-orders', label: 'Work orders',
    }
  }

  // Fall back honestly rather than inventing something.
  return {
    text: `I can answer from ${ORG.organization_name}'s live records — work orders, assets, PM schedules, inventory, inspections, cost and workload.\n\nTry one of the suggestions below, or ask about a specific area.`,
  }
}

export default function SynapseChat() {
  const router = useRouter()
  const { scope, siteName } = useSite()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [thread, setThread] = useState([])
  const [thinking, setThinking] = useState(false)
  const endRef = useRef(null)

  const wos = useRecords('work_order', WORK_ORDERS, (w) => w.workorder_id || w.recordId)

  const d = useMemo(() => {
    const scoped = scope(wos)
    return {
      wos: scoped,
      openWO: scoped.filter((w) => OPEN_STATUS.includes(w.status)),
      assets: scope(ASSETS),
      parts: scope(PARTS),
      pms: scope(PM_SCHEDULES),
      insp: scope(INSPECTIONS),
      siteName,
    }
  }, [scope, wos, siteName])

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
                    <button onClick={() => { setOpen(false); router.push('/portal/oxmaint/' + m.go) }} style={goBtn}>
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
