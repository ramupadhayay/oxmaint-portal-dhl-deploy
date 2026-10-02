'use client'

// The assistant, answering from the PoC's own records.
//
// Same approach as the CMMS portal's: it answers locally, off the arrays the
// screens are rendering. That makes every number it gives true by construction
// — ask how many alerts are still open and it is the number on the overview,
// because it is the same array — and it keeps working in a room with no
// internet, which is where these get shown.
//
// It recognises the questions someone actually asks about a condition-monitoring
// pilot and answers those exactly, rather than answering everything
// approximately. It does not claim to be a language model and does not pretend
// to know things the workbooks do not say.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { assetPath } from '@/lib/apiPath'
import {
  ORG, SUMMARY, ALERT_ROWS, ASSET_ROWS, WORK_ORDER_ROWS, CORRELATION_ROWS,
  KPI_ROWS, SITES, RISKS, WEEKLY_HEALTH, fmtDateTime,
} from '../lib/data'

const ACCENT = '#15227a'

const SUGGESTIONS = [
  'What did the monitoring catch?',
  'Which alerts are still open?',
  'How are the KPIs tracking?',
  'Which assets are critical?',
  'Any false positives?',
  'What is blocking the PoC?',
]

// Keyword intents. Ordered, because "open alerts" and "alerts" both match and
// the more specific answer has to win.
function answer(q) {
  const s = q.toLowerCase()
  const has = (...words) => words.some((w) => s.includes(w))

  if (has('lead time', 'catch', 'caught', 'ahead', 'early', 'detect')) {
    const confirmed = CORRELATION_ROWS.filter((c) => c.confirmed === 'Yes')
    return {
      text: `${confirmed.length} findings were confirmed on physical inspection. What each bought in warning time:`,
      lines: confirmed.map((c) => `${c._asset} — ${c.failureMode}. ${c.leadTime}`),
      go: { label: 'Open the correlation log', to: 'correlation' },
    }
  }

  if (has('false positive', 'accuracy', 'wrong')) {
    const fp = ALERT_ROWS.filter((a) => a._falsePositive)
    const tp = ALERT_ROWS.filter((a) => a._truePositive)
    return {
      text: `${tp.length} of ${ALERT_ROWS.length} alerts were confirmed true positives and ${fp.length} were false. Both are kept in the register — the Alert Accuracy and False Positive Rate KPIs are computed from them.`,
      lines: fp.map((a) => `${a.alertId} — ${a._asset}: ${a.reviewOutcome}`),
      go: { label: 'Open the alert register', to: 'alerts' },
    }
  }

  if (has('open alert', 'still open', 'outstanding', 'under investigation')) {
    const open = ALERT_ROWS.filter((a) => !/^Closed/i.test(a.status || ''))
    if (!open.length) return { text: 'Every alert in the register is closed.' }
    return {
      text: `${open.length} alert${open.length > 1 ? 's are' : ' is'} still open:`,
      lines: open.map((a) => `${a.alertId} — ${a._asset} (${a.severity}) · ${a.status}`),
      go: { label: 'Open the alert register', to: 'alerts' },
    }
  }

  if (has('alert', 'anomaly')) {
    return {
      text: `${SUMMARY.alerts} alerts have been raised across ${SUMMARY.sites} sites — ${SUMMARY.truePositives} true positive, ${SUMMARY.falsePositives} false, ${SUMMARY.alertsOpen} still open.`,
      lines: [...ALERT_ROWS].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0, 4)
        .map((a) => `${a.alertId} — ${a._asset} · ${a.severity} · ${fmtDateTime(a.timestamp)}`),
      go: { label: 'Open the alert register', to: 'alerts' },
    }
  }

  if (has('kpi', 'target', 'tracking', 'performance')) {
    const off = KPI_ROWS.filter((k) => !k._favourable)
    return {
      text: off.length
        ? `${KPI_ROWS.length - off.length} of ${KPI_ROWS.length} KPIs are at or better than target. Not yet there:`
        : `All ${KPI_ROWS.length} KPIs are at or better than target.`,
      lines: (off.length ? off : KPI_ROWS.slice(0, 5)).map((k) => `${k.kpi}: ${k._display} (target ${k.target})`),
      go: { label: 'Open the KPI dashboard', to: 'kpis' },
    }
  }

  if (has('critical', 'criticality', 'tier 1')) {
    const crit = ASSET_ROWS.filter((a) => a._included && a.criticality === 'Critical')
    return {
      text: `${crit.length} in-scope assets are rated Critical — Tier 1, immediate engineering response under 15 minutes.`,
      lines: crit.slice(0, 6).map((a) => `${a.assetId} — ${a.assetName} · ${a._site}`),
      go: { label: 'Open the asset register', to: 'assets' },
    }
  }

  if (has('work order', 'wo-', 'job')) {
    return {
      text: `${SUMMARY.workOrders} work orders — ${SUMMARY.conditionTriggered} raised by a condition-based alert, the rest calendar or reactive. ${SUMMARY.workOrdersOpen} still open.`,
      lines: WORK_ORDER_ROWS.slice(0, 4).map((w) => `${w.workOrderId} — ${w._asset} · ${w.triggerSource} · ${w.status}`),
      go: { label: 'Open work orders', to: 'work-orders' },
    }
  }

  if (has('asset', 'scope', 'fasm', 'excluded')) {
    return {
      text: `${SUMMARY.assetsInScope} assets are in scope and ${SUMMARY.assetsExcluded} are excluded. The excluded ones stay on the register with the reason why — that is part of the scope matrix.`,
      go: { label: 'Open the asset register', to: 'assets' },
    }
  }

  if (has('site', 'where', 'region', 'campus')) {
    return {
      text: `${SITES.length} sites across ${ORG.regions.join(', ')}:`,
      lines: SITES.map((s) => `${s.siteId} — ${s.siteName} · ${s.itLoadMw} MW · ${s.powerRedundancy} power`),
      go: { label: 'Open the site master', to: 'sites' },
    }
  }

  if (has('risk', 'blocking', 'blocker', 'dependency', 'assumption')) {
    const open = RISKS.filter((r) => r.status === 'Open')
    return {
      text: `${open.length} of ${RISKS.length} register entries are still open.`,
      lines: open.slice(0, 5).map((r) => `${r.id} (${r.category}) — ${r.description}`),
      go: { label: 'Open the risk register', to: 'risks' },
    }
  }

  if (has('health', 'availability', 'uptime', 'weekly', 'report')) {
    const w = WEEKLY_HEALTH[WEEKLY_HEALTH.length - 1]
    return {
      text: `Latest health report, week ending ${w.weekEnding} (${w.cadence}):`,
      lines: [
        `Sensor availability ${Math.round(w.sensorAvailability * 1000) / 10}%`,
        `Data acquisition reliability ${Math.round(w.dataReliability * 1000) / 10}%`,
        `Dashboard availability ${Math.round(w.dashboardAvailability * 1000) / 10}%`,
        w.observations,
      ],
      go: { label: 'Open the weekly reports', to: 'weekly-health' },
    }
  }

  if (has('pm', 'preventive', 'calendar', 'compliance')) {
    return {
      text: `The baseline calendar PM is untouched — removing it is out of scope. ${SUMMARY.pmOnTime} of ${SUMMARY.pmLogged} logged PM tasks were completed on time.`,
      go: { label: 'Open PM compliance', to: 'pm-compliance' },
    }
  }

  if (has('hello', 'hi ', 'hey', 'what can you')) {
    return {
      text: `I answer from this PoC's own records — ${ORG.siteCount} sites, ${SUMMARY.assetsInScope} in-scope assets, ${SUMMARY.alerts} alerts. Ask about what the monitoring caught, the KPIs, open alerts, or what is blocking the programme.`,
    }
  }

  return {
    text: 'I answer from the PoC records — alerts, assets, work orders, correlations, KPIs, risks and the weekly reports. Try one of the questions below.',
  }
}

export default function Assistant({ open, onClose }) {
  const router = useRouter()
  const [messages, setMessages] = useState([{
    from: 'ai',
    ...answer('hello'),
  }])
  const [input, setInput] = useState('')
  const bodyRef = useRef(null)

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [messages, open])

  const ask = (text) => {
    const q = text.trim()
    if (!q) return
    setInput('')
    setMessages((m) => [...m, { from: 'user', text: q }, { from: 'ai', ...answer(q) }])
  }

  if (!open) return null

  return (
    <div style={panel}>
      <div style={head}>
        <img src={assetPath('/oxmaint/logo-white.png')} alt="" aria-hidden="true" style={{ height: 20, width: 'auto' }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Oxmaint Assistant</div>
          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.75)' }}>Answers from this PoC&rsquo;s records</div>
        </div>
        <button onClick={onClose} style={closeBtn} aria-label="Close assistant">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div ref={bodyRef} style={body}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start', marginBottom: 9 }}>
            <div style={m.from === 'user' ? bubbleUser : bubbleAI}>
              <div>{m.text}</div>
              {m.lines?.length > 0 && (
                <ul style={{ margin: '7px 0 0', paddingLeft: 16, display: 'grid', gap: 4 }}>
                  {m.lines.filter(Boolean).map((l, j) => <li key={j} style={{ lineHeight: 1.45 }}>{l}</li>)}
                </ul>
              )}
              {m.go && (
                <button onClick={() => { router.push(`/portal/datacenter/${m.go.to}`); onClose() }} style={goBtn}>
                  {m.go.label} →
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 12px 8px' }}>
        {SUGGESTIONS.map((sug) => (
          <button key={sug} onClick={() => ask(sug)} style={chipBtn}>{sug}</button>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); ask(input) }} style={foot}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about the PoC…" style={field} />
        <button type="submit" style={send} aria-label="Send">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
    </div>
  )
}

const panel = {
  position: 'fixed', right: 20, bottom: 20, width: 372, maxWidth: 'calc(100vw - 40px)',
  height: 540, maxHeight: 'calc(100vh - 40px)', zIndex: 400,
  background: '#fff', border: '1px solid #e4e9f0', borderRadius: 16,
  boxShadow: '0 20px 50px rgba(15,23,42,0.20)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
}
const head = { display: 'flex', alignItems: 'center', gap: 9, padding: '11px 12px', background: ACCENT }
const closeBtn = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.16)', border: 'none', borderRadius: 7, cursor: 'pointer', flexShrink: 0 }
const body = { flex: 1, overflowY: 'auto', padding: '12px 12px 4px' }
const bubbleBase = { maxWidth: '90%', padding: '9px 12px', fontSize: 12.5, lineHeight: 1.55, borderRadius: 12 }
const bubbleUser = { ...bubbleBase, background: ACCENT, color: '#fff', borderBottomRightRadius: 4 }
const bubbleAI = { ...bubbleBase, background: '#f4f6fb', color: '#0f172a', borderBottomLeftRadius: 4, border: '1px solid #e8ecf1' }
const goBtn = { marginTop: 8, padding: '5px 10px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', background: '#fff', border: `1px solid ${ACCENT}33`, color: ACCENT, borderRadius: 7, cursor: 'pointer' }
const chipBtn = { padding: '4px 9px', fontSize: 11, fontFamily: 'inherit', fontWeight: 600, background: '#f4f6fb', border: '1px solid #e4e9f0', color: '#475569', borderRadius: 999, cursor: 'pointer' }
const foot = { display: 'flex', gap: 7, padding: '9px 12px 12px', borderTop: '1px solid #e8ecf1' }
const field = { flex: 1, minWidth: 0, padding: '9px 11px', fontSize: 12.5, fontFamily: 'inherit', border: '1px solid #e4e9f0', borderRadius: 9, outline: 'none', color: '#0f172a' }
const send = { width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: ACCENT, border: 'none', borderRadius: 9, cursor: 'pointer', flexShrink: 0 }
