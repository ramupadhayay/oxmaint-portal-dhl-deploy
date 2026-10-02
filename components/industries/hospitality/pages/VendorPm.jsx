'use client'

// Seasonal PM and the contractors who do it.
//
// HOA maintenance is cyclical rather than continuous — pool opening and
// closing, irrigation winterisation, crack seal before the freeze-thaw, tree
// trimming before wind season. The article's point is that these live in
// somebody's head or in a property manager's calendar competing with forty
// other communities, and a missed one is only noticed when the consequence
// arrives. So the plan is laid out by season, not by date.
//
// The vendor half exists because of three specific failures the article names,
// and each is on this screen as a number rather than a claim:
//
//   an invoice arriving with no work order behind it — counted per vendor;
//   a certificate of insurance quietly lapsing — counted, and the ones inside
//   sixty days are at the top;
//   a contract auto-renewing without anyone checking the scope — flagged with
//   the date it renews.
//
// Contractor performance is computed from completed work rather than opinion,
// which is what makes rebidding at renewal a decision rather than a habit.

import { useMemo, useState } from 'react'
import {
  PageHeading, StatCards, Card, Section, DataTable, PALETTE,
} from '../lib/kit'
import { COMMUNITY, VENDORS, PM_PLAN, COMPONENT_TYPES } from '../lib/community'
import { COMPONENT_VIEW, money, moneyShort } from '../lib/reserve'
import { fmtDate } from '../lib/data'

const { INK, SUB, MUTE, LINE, ACCENT } = PALETTE

// The seasons an HOA plan is actually organised around, in the order they run.
const SEASONS = [
  { key: 'Spring', what: 'Pool opening, irrigation start-up, roof survey after winter', colour: '#16a34a', tint: '#f0fdf4', edge: '#bbf7d0' },
  { key: 'Summer', what: 'Peak use. Elevator inspection, weekly grounds and chemistry', colour: '#d97706', tint: '#fffbeb', edge: '#fde68a' },
  { key: 'Autumn', what: 'Winterisation, crack seal before freeze-thaw, tree trimming', colour: '#c2410c', tint: '#fff7ed', edge: '#fed7aa' },
  { key: 'Winter', what: 'Code inspections and the work that does not need weather', colour: '#2563eb', tint: '#eff6ff', edge: '#bfdbfe' },
  { key: 'All year', what: 'Cyclical regardless of season', colour: '#475569', tint: '#f8fafc', edge: '#e2e8f0' },
]

const seasonOf = (plan) => {
  const s = plan.season || ''
  if (/spring/i.test(s) && /autumn/i.test(s)) return 'All year'
  for (const { key } of SEASONS) if (s.toLowerCase().includes(key.toLowerCase())) return key
  if (/season|mar–nov|apr–oct|storm/i.test(s)) return 'All year'
  return 'All year'
}

const daysUntil = (iso) => Math.round((new Date(`${iso}T00:00:00Z`) - Date.now()) / 86400000)

export default function VendorPm() {
  const [season, setSeason] = useState('all')
  const [trade, setTrade] = useState('all')

  const plans = useMemo(() => PM_PLAN.map((p) => ({
    ...p,
    id: p.planId,
    seasonKey: seasonOf(p),
    vendorName: VENDORS.find((v) => v.vendorId === p.vendor)?.name || 'In-house',
    typeLabel: COMPONENT_TYPES[p.type]?.label || p.type,
    componentCount: p.components.length,
  })), [])

  const shownPlans = plans.filter((p) => season === 'all' || p.seasonKey === season)

  const vendors = useMemo(() => VENDORS.map((v) => {
    const coiDays = daysUntil(v.coiExpires)
    return {
      ...v,
      id: v.vendorId,
      coiDays,
      coiRisk: coiDays < 0 ? 'expired' : coiDays <= 60 ? 'soon' : 'ok',
      onTimeRate: v.jobs ? v.onTime / v.jobs : null,
      plans: plans.filter((p) => p.vendor === v.vendorId).length,
      // The article's invoice-without-a-work-order problem, as a count.
      unmatched: v.disputes,
    }
  }).sort((a, b) => a.coiDays - b.coiDays), [plans])

  const shownVendors = vendors.filter((v) => trade === 'all' || v.trade === trade)

  const coiAtRisk = vendors.filter((v) => v.coiRisk !== 'ok')
  const unmatched = vendors.reduce((n, v) => n + v.unmatched, 0)
  const contracted = vendors.reduce((n, v) => n + v.contractValue, 0)
  const autoRenewing = vendors.filter((v) => /auto-renew/i.test(v.contract))

  const planColumns = [
    { key: 'title', label: 'Task', render: (p) => <span><strong style={{ color: INK, fontSize: 12 }}>{p.title}</strong><span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{p.planId} · {p.typeLabel}</span></span> },
    { key: 'every', label: 'Frequency', render: (p) => <span style={styles.freq}>{p.every}</span> },
    {
      key: 'seasonKey',
      label: 'Season',
      render: (p) => {
        const s = SEASONS.find((x) => x.key === p.seasonKey)
        return <span style={{ ...styles.seasonChip, color: s.colour, background: s.tint, borderColor: s.edge }}>{p.season}</span>
      },
    },
    { key: 'componentCount', label: 'Components', align: 'center' },
    { key: 'vendorName', label: 'Carried out by', render: (p) => (p.vendor ? <span>{p.vendorName}<span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{p.vendor}</span></span> : <span style={{ color: MUTE }}>In-house</span>) },
  ]

  const vendorColumns = [
    { key: 'name', label: 'Contractor', render: (v) => <span><strong style={{ color: INK, fontSize: 12 }}>{v.name}</strong><span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{v.trade} · since {v.since}</span></span> },
    { key: 'contract', label: 'Contract', render: (v) => <span>{v.contract}<span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{v.contractValue ? `${money(v.contractValue)}/yr` : 'per project'}</span></span> },
    {
      key: 'coiDays',
      label: 'Insurance',
      render: (v) => (
        <span style={{ lineHeight: 1.3 }}>
          <strong style={{ fontSize: 12, color: v.coiRisk === 'expired' ? '#b91c1c' : v.coiRisk === 'soon' ? '#b45309' : INK }}>
            {v.coiRisk === 'expired' ? 'Expired' : `${v.coiDays} days`}
          </strong>
          <span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{fmtDate(v.coiExpires)}</span>
        </span>
      ),
      sortValue: (v) => v.coiDays,
    },
    { key: 'jobs', label: 'Jobs', align: 'center' },
    {
      key: 'onTimeRate',
      label: 'On time',
      align: 'right',
      render: (v) => (v.onTimeRate == null ? '—' : (
        <strong style={{ color: v.onTimeRate >= 0.9 ? '#047857' : v.onTimeRate >= 0.8 ? '#b45309' : '#b91c1c' }}>
          {Math.round(v.onTimeRate * 100)}%
        </strong>
      )),
      sortValue: (v) => v.onTimeRate ?? -1,
    },
    {
      key: 'unmatched',
      label: 'Invoices without a work order',
      align: 'center',
      render: (v) => (v.unmatched ? <strong style={{ color: '#b91c1c' }}>{v.unmatched}</strong> : <span style={{ color: MUTE }}>—</span>),
    },
    {
      key: 'rating',
      label: 'Rating',
      align: 'right',
      render: (v) => (
        <span style={{ fontWeight: 700, color: v.rating >= 4.3 ? '#047857' : v.rating >= 3.5 ? '#b45309' : '#b91c1c' }}>
          {v.rating.toFixed(1)}
        </span>
      ),
    },
    { key: 'plans', label: 'PM plans', align: 'center' },
  ]

  return (
    <div>
      <PageHeading
        title="Vendor & Seasonal PM"
        subtitle={`${COMMUNITY.name} — ${PM_PLAN.length} recurring plans laid out by season, and the ${VENDORS.length} contractors who carry them out, with what was approved against what was invoiced.`}
      />

      <StatCards items={[
        { label: 'Recurring plans', value: PM_PLAN.length, icon: 'list', note: 'seasonal and cyclical' },
        { label: 'Contractors', value: VENDORS.length, icon: 'people', note: `${moneyShort(contracted)} under contract` },
        { label: 'Insurance at risk', value: coiAtRisk.length, icon: 'alert', tone: coiAtRisk.length ? 'red' : 'green', note: 'expired or inside 60 days' },
        { label: 'Invoices unmatched', value: unmatched, icon: 'clock', tone: unmatched ? 'amber' : 'green', note: 'no work order behind them' },
        { label: 'Auto-renewing', value: autoRenewing.length, icon: 'chart', tone: autoRenewing.length ? 'amber' : undefined, note: 'scope not re-checked' },
      ]} />

      {/* ── what needs attention before anything else ──────────────────── */}
      {(coiAtRisk.length > 0 || autoRenewing.length > 0) && (
        <Card style={{ marginBottom: 14, borderColor: '#fecaca', background: '#fef7f7' }}>
          <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2.2"
              strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
            <div style={{ minWidth: 0, fontSize: 12, color: SUB, lineHeight: 1.65 }}>
              {coiAtRisk.map((v) => (
                <div key={v.vendorId} style={{ marginBottom: 4 }}>
                  <strong style={{ color: '#7f1d1d' }}>{v.name}</strong> —{' '}
                  {v.coiRisk === 'expired'
                    ? <>certificate of insurance <strong>expired</strong> on {fmtDate(v.coiExpires)}. No work should be scheduled until it is renewed.</>
                    : <>certificate of insurance expires in <strong>{v.coiDays} days</strong> ({fmtDate(v.coiExpires)}).</>}
                </div>
              ))}
              {autoRenewing.map((v) => (
                <div key={v.vendorId} style={{ marginBottom: 4 }}>
                  <strong style={{ color: '#7f1d1d' }}>{v.name}</strong> — {v.note}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* ── the year, by season ────────────────────────────────────────── */}
      <Section
        title="The year"
        right={(
          <button onClick={() => setSeason('all')} style={{ ...styles.seasonBtn, ...(season === 'all' ? styles.seasonBtnOn : null) }}>
            All {PM_PLAN.length}
          </button>
        )}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
          {SEASONS.map((s) => {
            const n = plans.filter((p) => p.seasonKey === s.key).length
            const on = season === s.key
            return (
              <div
                key={s.key}
                role="button"
                tabIndex={0}
                onClick={() => setSeason(on ? 'all' : s.key)}
                onKeyDown={(e) => { if (e.key === 'Enter') setSeason(on ? 'all' : s.key) }}
                style={{ ...styles.seasonCard, background: s.tint, borderColor: on ? s.colour : s.edge }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                  <strong style={{ fontSize: 12.5, color: INK }}>{s.key}</strong>
                  <span style={{ marginLeft: 'auto', fontSize: 20, fontWeight: 800, color: s.colour, lineHeight: 1 }}>{n}</span>
                </div>
                <div style={{ fontSize: 10.5, color: SUB, lineHeight: 1.5 }}>{s.what}</div>
              </div>
            )
          })}
        </div>
        <p style={styles.note}>
          Laid out by season rather than by date because that is the actual
          constraint — crack seal has to happen before the freeze-thaw, not on
          the fourteenth. Click a season to filter the plans below.
        </p>
      </Section>

      <Section title={`Recurring plans (${shownPlans.length})`}>
        <DataTable
          columns={planColumns}
          rows={shownPlans}
          pageSize={12}
          empty="No plan falls in this season."
        />
      </Section>

      {/* ── the contractors ────────────────────────────────────────────── */}
      <Section
        title={`Contractors (${shownVendors.length})`}
        right={(
          <select value={trade} onChange={(e) => setTrade(e.target.value)} style={styles.select}>
            <option value="all">All trades</option>
            {[...new Set(VENDORS.map((v) => v.trade))].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      >
        <DataTable
          columns={vendorColumns}
          rows={shownVendors}
          pageSize={10}
          empty="No contractor in this trade."
        />
        <p style={styles.note}>
          On-time rate and rating come from completed work rather than an
          opinion, which is what turns rebidding at contract renewal into a
          decision the board can defend. <strong style={{ color: INK }}>Invoices without a
          work order</strong> is the number the article is really about — an
          invoice with nothing behind it is money nobody approved.
        </p>
      </Section>

      <Card style={{ background: '#fcfdfe' }}>
        <p style={{ margin: 0, fontSize: 11.5, color: MUTE, lineHeight: 1.6 }}>
          Every plan here names the components it covers, so a completed visit
          updates their service date and condition on the{' '}
          <strong style={{ color: INK }}>Common Areas</strong> register — which is what keeps
          the reserve forecast moving as the estate actually ages, rather than on
          a schedule set once and never revisited.
        </p>
      </Card>
    </div>
  )
}

const styles = {
  seasonCard: {
    padding: '12px 14px', borderRadius: 11, cursor: 'pointer', userSelect: 'none',
    borderStyle: 'solid', borderWidth: 1,
  },
  seasonChip: {
    fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '2px 8px',
    borderStyle: 'solid', borderWidth: 1, whiteSpace: 'nowrap',
  },
  seasonBtn: {
    padding: '5px 12px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
    borderRadius: 8, background: '#fff', color: SUB, cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  seasonBtnOn: { background: ACCENT, color: '#fff', borderColor: ACCENT },
  freq: {
    fontSize: 10.5, fontWeight: 700, color: '#475569', background: '#f1f5f9',
    borderRadius: 6, padding: '2px 8px', whiteSpace: 'nowrap',
  },
  select: {
    padding: '6px 10px', fontSize: 12, fontFamily: 'inherit', borderRadius: 8,
    background: '#fff', color: INK, cursor: 'pointer', outline: 'none',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  note: {
    margin: '14px 0 0', paddingTop: 12, fontSize: 11.5, color: MUTE, lineHeight: 1.6,
    borderTopStyle: 'solid', borderTopWidth: 1, borderTopColor: LINE,
  },
}
