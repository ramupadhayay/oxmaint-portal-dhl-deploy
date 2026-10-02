'use client'

// The landing a person sees after signing in — who they are, what this portal
// is, and one click into every part of it.
//
// A greeting by name and a map of the sections is the difference between a portal
// that drops you on a dashboard and one that says "here is what you can do."

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Section, PALETTE } from '../lib/kit'
import { MENU, iconForSection } from '../lib/nav'
import { ORG, permits, requirements, parameters, deviations } from '../lib/data'
import { useRecords } from '../lib/store'
import { useSite } from '../lib/siteStore'
import { permitKey, requirementKey, deviationKey } from '../lib/keys'
import { apiUrl } from '@/lib/apiPath'

const { INK, SUB, MUTE, LINE, ACCENT } = PALETTE

// A short line of what each section is for, so a card says more than its label.
const ABOUT = {
  overview: 'Where you stand — permits, deadlines and open deviations at a glance.',
  permits: 'Licenses and authorizations, their validity and renewal status.',
  requirements: 'Every obligation the trial permits impose, with frequency and deadline.',
  calendar: 'The filing calendar — what is due, when, and marking it filed.',
  parameters: 'Emission limits and operating parameters, and the readings against them.',
  deviations: 'Deviations and the CAPA worked to close each one.',
  safety: 'The Safety & EHS module — scope and workflows.',
  'pre-task': 'The pre-task safety assessment (JSA), filled before work starts.',
  loto: 'Lockout / tagout and permit to work, with lock verification.',
  incidents: 'Incident reports and root-cause analysis.',
  training: 'Training records and competency against the requirements.',
  team: 'The people with access to this portal, and their logins.',
  sources: 'Where every figure came from — the verification and audit trail.',
}

export default function GettingStarted() {
  const router = useRouter()
  const go = (key) => router.push(`/portal/waga/${key}`)
  const [me, setMe] = useState(null)
  // 'Hello' until mount, so the server render and the first client render agree
  // and there is no hydration mismatch; the real greeting is set below.
  const [greet, setGreet] = useState('Hello')
  useEffect(() => {
    let live = true
    fetch(apiUrl('/api/portal/waga/me')).then((r) => (r.ok ? r.json() : null)).then((d) => { if (live && d) setMe(d) }).catch(() => {})
    // The greeting follows the viewer's own clock. This portal is handed to
    // teams in other countries, so a fixed hour would greet "Good morning" at
    // their midnight. Read the hour after mount only — never in render, which
    // would disagree with the server's — and the browser's local hour is
    // already the viewer's timezone, so no per-country configuration is needed.
    const h = new Date().getHours()
    setGreet(h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')
    return () => { live = false }
  }, [])

  const first = (me?.name || '').split(' ')[0]

  // The sections, flattened out of the nav, minus this one.
  const cards = MENU.flatMap((g) => (g.single
    ? [{ key: g.key, label: g.label, icon: g.icon || g.key, group: null }]
    : g.children.map((c) => ({ key: c.key, label: c.label, icon: g.icon, group: g.label }))))
    .filter((c) => c.key !== 'getting-started')

  // Counted from the registers as they stand, not the workbook alone. A site,
  // permit, obligation or deviation added in the portal is a real one, and a
  // landing page that leaves it out tells the person who just added it that it
  // did not save.
  const { sites } = useSite()
  const allPermits = useRecords('waga_permit_event', permits, permitKey)
  const allRequirements = useRecords('waga_requirement', requirements, requirementKey)
  const allDeviations = useRecords('waga_deviation', deviations, deviationKey)

  const stats = [
    ['Trial sites', sites.length || ORG.siteCount],
    ['Permits', allPermits.length],
    ['Obligations', allRequirements.length],
    ['Limits tracked', parameters.length],
    ['Open deviations', allDeviations.filter((d) => d.status !== 'Closed').length],
  ]

  return (
    <div>
      {/* Hello */}
      <div style={styles.hero}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={styles.helloRow}>
            <span style={styles.wave}>👋</span>
            <h1 style={styles.hello}>{greet}{first ? `, ${first}` : ''}</h1>
          </div>
          <p style={styles.heroSub}>
            Welcome to <b>{ORG.name}</b>&apos;s compliance &amp; EHS portal on <b>iFactory AI</b>
            {me?.department ? ` — ${me.department}` : ''}{me?.isAdmin ? ' · Administrator' : ''}.
          </p>
          <p style={styles.heroBody}>
            Everything the trial covers is one click below: what you are permitted to do, what that
            obliges you to record, when it is due, the limits you must stay under, and the safety
            workflows your crews sign. Pick a section to jump straight in.
          </p>
        </div>
        <div style={styles.heroStats}>
          {stats.map(([label, value]) => (
            <div key={label} style={styles.heroStat}>
              <div style={styles.heroStatV}>{value}</div>
              <div style={styles.heroStatK}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <Section title="Jump to a section" right={<button onClick={() => go('overview')} style={styles.link}>Open the dashboard →</button>}>
        <div style={styles.grid}>
          {cards.map((c) => (
            <button key={c.key} onClick={() => go(c.key)} style={styles.card}>
              <span style={styles.cardIcon}>{iconForSection(c.key, ACCENT)}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={styles.cardTop}>
                  <span style={styles.cardLabel}>{c.label}</span>
                  {c.group && <span style={styles.cardGroup}>{c.group}</span>}
                </span>
                <span style={styles.cardAbout}>{ABOUT[c.key] || 'Open this section.'}</span>
              </span>
              <span style={styles.cardArrow}>→</span>
            </button>
          ))}
        </div>
      </Section>
    </div>
  )
}

const styles = {
  hero: { display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg,#0f766e 0%,#115e59 55%,#134e4a 100%)', borderRadius: 16, padding: '22px 24px', marginBottom: 18, color: '#fff' },
  helloRow: { display: 'flex', alignItems: 'center', gap: 10 },
  wave: { fontSize: 26 },
  hello: { margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' },
  heroSub: { margin: '8px 0 0', fontSize: 14, color: '#d7f0ec', lineHeight: 1.5 },
  heroBody: { margin: '10px 0 0', fontSize: 12.5, color: '#bfe4de', lineHeight: 1.6, maxWidth: 620 },
  heroStats: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  heroStat: { background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 11, padding: '10px 14px', minWidth: 78, textAlign: 'center' },
  heroStatV: { fontSize: 22, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums', lineHeight: 1 },
  heroStatK: { fontSize: 10, fontWeight: 600, color: '#cdece7', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.03em' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 },
  card: { display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', transition: 'border-color .15s, box-shadow .15s' },
  cardIcon: { flexShrink: 0, width: 38, height: 38, borderRadius: 10, background: '#eef2ff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  cardTop: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardLabel: { fontSize: 13.5, fontWeight: 700, color: INK },
  cardGroup: { fontSize: 10, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: '0.03em', background: '#f1f5f9', border: `1px solid ${LINE}`, borderRadius: 999, padding: '1px 7px' },
  cardAbout: { display: 'block', fontSize: 11.5, color: SUB, marginTop: 3, lineHeight: 1.45 },
  cardArrow: { color: '#cbd5e1', fontSize: 17, fontWeight: 700, flexShrink: 0 },
  link: { background: 'none', border: 'none', color: '#15227a', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
}
