'use client'

// Reserve planning.
//
// This is the screen the article is really about, and its own sentence says
// why: "The most valuable output from reserve planning is not a number — it is
// the 5 to 20 year cash flow forecast that shows when the major expenditures
// are coming, whether the current reserve balance will cover them, and what the
// annual contribution increase required to close any gap looks like."
//
// So the forecast leads, and it is drawn rather than tabulated, because the
// thing a board has never seen is the shape: a balance that looks comfortable
// for four years and then falls off a cliff when two roofs and an elevator land
// in the same decade. A table of the same numbers does not show a cliff.
//
// The contribution slider is the argument, not a toy. A board sets dues by what
// feels acceptable; this shows what the replacement schedule actually requires,
// and the year the current answer runs out. Move it and the curve lifts off the
// floor — that is the governance conversation the article says boards cannot
// currently have.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, Card, Section, DataTable, PALETTE,
} from '../lib/kit'
import { COMMUNITY } from '../lib/community'
import {
  COMPONENT_VIEW, POSITION, forecast, requiredContribution, specialAssessmentPerUnit,
  INFLATION, INTEREST, THIS_YEAR, money, moneyShort, pct,
} from '../lib/reserve'

const { INK, SUB, MUTE, LINE, ACCENT } = PALETTE

const RISK = {
  Critical: { colour: '#b91c1c', tint: '#fef2f2', edge: '#fecaca', what: 'Below 30% funded. A special assessment is not a risk here, it is a schedule.' },
  High: { colour: '#c2410c', tint: '#fff7ed', edge: '#fed7aa', what: 'Below 50% funded — the level widely considered high risk.' },
  Fair: { colour: '#b45309', tint: '#fffbeb', edge: '#fde68a', what: 'Between 50% and 70%. Behind, but recoverable with a contribution increase.' },
  Strong: { colour: '#047857', tint: '#f0fdf4', edge: '#bbf7d0', what: 'At or above 70% funded. The schedule is covered.' },
}

export default function ReservePlanning() {
  const router = useRouter()
  const [years, setYears] = useState(20)
  const [contribution, setContribution] = useState(COMMUNITY.annualReserveContribution)

  const current = useMemo(() => forecast(years, COMMUNITY.annualReserveContribution), [years])
  const proposed = useMemo(() => forecast(years, contribution), [years, contribution])
  const required = useMemo(() => requiredContribution(years), [years])
  const assessment = useMemo(() => specialAssessmentPerUnit(years), [years])

  const risk = RISK[POSITION.risk]
  const changed = contribution !== COMMUNITY.annualReserveContribution
  const solvent = !proposed.rows.some((r) => r.negative)

  const perUnitMonth = Math.round(contribution / COMMUNITY.units / 12)
  const increase = perUnitMonth - POSITION.contributingPerUnitMonth

  // Components ranked by what they will cost and when. This is the list a board
  // reads down when it asks "what is coming".
  const upcoming = useMemo(() => [...COMPONENT_VIEW]
    .sort((a, b) => a.dueYear - b.dueYear || b.futureCost - a.futureCost)
    .map((c) => ({ ...c, id: c.componentId })), [])

  const columns = [
    { key: 'name', label: 'Component', render: (c) => <span><strong style={{ color: INK, fontSize: 12 }}>{c.name}</strong><span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{c.componentId} · {c.location}</span></span> },
    { key: 'installed', label: 'Installed', align: 'center' },
    { key: 'usefulLife', label: 'Useful life', align: 'center', render: (c) => <span>{c.usefulLife}<span style={{ fontSize: 10.5, color: MUTE }}> yr</span></span> },
    { key: 'remaining', label: 'Remaining', align: 'center', render: (c) => (c.overdue ? <strong style={{ color: '#b91c1c' }}>past due</strong> : <span>{c.remaining}<span style={{ fontSize: 10.5, color: MUTE }}> yr</span></span>), sortValue: (c) => (c.overdue ? -1 : c.remaining) },
    { key: 'dueYear', label: 'Replacement due', align: 'center', render: (c) => <strong style={{ color: c.dueYear <= THIS_YEAR + 5 ? '#b91c1c' : INK }}>{c.dueYear}</strong> },
    { key: 'replacementCost', label: 'Cost today', align: 'right', render: (c) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(c.replacementCost)}</span> },
    { key: 'futureCost', label: 'Cost when due', align: 'right', render: (c) => <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: INK }}>{money(c.futureCost)}</span> },
    { key: 'annualShare', label: 'Annual share', align: 'right', render: (c) => <span style={{ fontVariantNumeric: 'tabular-nums', color: SUB }}>{money(c.annualShare)}</span> },
  ]

  return (
    <div>
      <PageHeading
        title="Reserve Planning"
        subtitle={`${COMMUNITY.name} — component life, replacement cost and the ${years}-year capital forecast. What the schedule requires, rather than what dues have historically covered.`}
        right={(
          <div style={{ display: 'flex', gap: 6 }}>
            {[5, 10, 20].map((y) => (
              <button key={y} onClick={() => setYears(y)}
                style={{ ...styles.yearBtn, ...(years === y ? styles.yearBtnOn : null) }}>
                {y} yr
              </button>
            ))}
          </div>
        )}
      />

      {/* ── the position ───────────────────────────────────────────────── */}
      <Card style={{ marginBottom: 14, borderColor: risk.edge, background: risk.tint }}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 168 }}>
            <div style={styles.bigLabel}>Percent funded</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: risk.colour, lineHeight: 1 }}>
              {pct(POSITION.percentFunded)}
            </div>
            <div style={{ ...styles.riskChip, color: risk.colour, borderColor: risk.edge }}>{POSITION.risk}</div>
          </div>

          <div style={{ flex: '1 1 300px', minWidth: 0 }}>
            <div style={styles.fundTrack}>
              <div style={{ width: `${Math.min(100, POSITION.percentFunded * 100)}%`, height: '100%', background: risk.colour, borderRadius: 999 }} />
              <span style={{ ...styles.fundMark, left: '50%' }} />
              <span style={{ ...styles.fundMark, left: '70%', opacity: 0.5 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: MUTE, marginTop: 5 }}>
              <span>$0</span>
              <span>50% — high-risk line</span>
              <span>{money(POSITION.fullyFunded)} fully funded</span>
            </div>
            <p style={{ margin: '11px 0 0', fontSize: 12, color: SUB, lineHeight: 1.6 }}>
              {risk.what} The account holds <strong style={{ color: INK }}>{money(POSITION.balance)}</strong> against a
              fully funded balance of <strong style={{ color: INK }}>{money(POSITION.fullyFunded)}</strong> — the share of
              every component&apos;s cost that its life has already used up. The shortfall is{' '}
              <strong style={{ color: risk.colour }}>{money(POSITION.shortfall)}</strong>.
            </p>
          </div>
        </div>
      </Card>

      <StatCards items={[
        { label: 'Reserve balance', value: moneyShort(POSITION.balance), icon: 'chart', note: `of ${moneyShort(POSITION.fullyFunded)} fully funded` },
        { label: 'Contributing', value: `${moneyShort(POSITION.contributing)}/yr`, icon: 'list', note: `$${POSITION.contributingPerUnitMonth} per unit per month` },
        { label: 'Schedule requires', value: `${moneyShort(POSITION.annualRequirement)}/yr`, icon: 'clock', tone: POSITION.annualGap ? 'amber' : 'green', note: `$${POSITION.perUnitMonth} per unit per month` },
        { label: 'Annual gap', value: moneyShort(POSITION.annualGap), icon: 'alert', tone: POSITION.annualGap ? 'red' : 'green', note: 'the number dues are set below' },
        { label: 'Balance runs out', value: current.firstNegative || 'holds', icon: current.firstNegative ? 'alert' : 'tick', tone: current.firstNegative ? 'red' : 'green', note: current.firstNegative ? `${current.firstNegative - THIS_YEAR} years away` : `over ${years} years` },
      ]} />

      {/* ── the forecast ───────────────────────────────────────────────── */}
      <Section
        title={`${years}-year capital forecast`}
        right={<span style={{ fontSize: 11.5, color: MUTE }}>{INFLATION * 100}% cost inflation · {INTEREST * 100}% interest</span>}
      >
        <Forecast current={current} proposed={changed ? proposed : null} years={years} />

        <div style={styles.sliderRow}>
          <div style={{ minWidth: 0, flex: '1 1 300px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7, flexWrap: 'wrap', gap: 8 }}>
              <span style={styles.bigLabel}>Annual reserve contribution</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: changed ? ACCENT : INK, fontVariantNumeric: 'tabular-nums' }}>
                {money(contribution)}
                <span style={{ fontWeight: 500, color: MUTE }}> · ${perUnitMonth}/unit/month</span>
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(required + 60000, 320000)}
              step={2000}
              value={contribution}
              onChange={(e) => setContribution(Number(e.target.value))}
              aria-label="Annual reserve contribution"
              style={styles.slider}
            />
            <div style={{ display: 'flex', gap: 7, marginTop: 9, flexWrap: 'wrap' }}>
              <button onClick={() => setContribution(COMMUNITY.annualReserveContribution)} style={styles.preset}>
                Today · {moneyShort(COMMUNITY.annualReserveContribution)}
              </button>
              <button onClick={() => setContribution(POSITION.annualRequirement)} style={styles.preset}>
                Keeps pace · {moneyShort(POSITION.annualRequirement)}
              </button>
              <button onClick={() => setContribution(required)} style={{ ...styles.preset, ...styles.presetKey }}>
                Stays solvent · {moneyShort(required)}
              </button>
            </div>
          </div>

          <div style={{ minWidth: 190, flexShrink: 0 }}>
            <div style={{ ...styles.verdict, borderColor: solvent ? '#bbf7d0' : '#fecaca', background: solvent ? '#f0fdf4' : '#fef2f2' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: solvent ? '#047857' : '#b91c1c', marginBottom: 5 }}>
                {solvent ? 'Covers the schedule' : 'Runs out'}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: solvent ? '#047857' : '#b91c1c', lineHeight: 1.1 }}>
                {solvent ? `Through ${THIS_YEAR + years - 1}` : proposed.firstNegative}
              </div>
              {changed && (
                <div style={{ fontSize: 11, color: SUB, marginTop: 7, lineHeight: 1.5 }}>
                  {increase > 0
                    ? <>An increase of <strong style={{ color: INK }}>${increase} per unit per month</strong> on today&apos;s contribution.</>
                    : increase < 0
                      ? <>A reduction of <strong style={{ color: INK }}>${Math.abs(increase)} per unit per month</strong>.</>
                      : 'Unchanged from today.'}
                </div>
              )}
            </div>
          </div>
        </div>

        <p style={styles.note}>
          The shape is the point. A balance that looks comfortable for four years
          and then falls away is not visible in a bank statement — it becomes
          visible when the replacement schedule is drawn against it. Left where
          it is, the alternative to a contribution increase is a special
          assessment of roughly{' '}
          <strong style={{ color: '#b91c1c' }}>${assessment.toLocaleString('en-US')} per unit</strong>.
        </p>
      </Section>

      {/* ── year by year ───────────────────────────────────────────────── */}
      <Section title="Year by year">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 620 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ ...styles.th, textAlign: 'left' }}>Year</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Opening</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Contribution</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Replacements due</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Closing</th>
                <th style={{ ...styles.th, textAlign: 'left' }}>What falls due</th>
              </tr>
            </thead>
            <tbody>
              {(changed ? proposed : current).rows.map((r) => (
                <tr key={r.year} style={{ borderBottom: `1px solid ${LINE}`, background: r.negative ? '#fef7f7' : undefined }}>
                  <td style={{ ...styles.td, fontWeight: 700, color: INK }}>{r.year}</td>
                  <td style={{ ...styles.td, textAlign: 'right', color: SUB }}>{money(r.opening)}</td>
                  <td style={{ ...styles.td, textAlign: 'right', color: SUB }}>{money(r.contribution)}</td>
                  <td style={{ ...styles.td, textAlign: 'right', color: r.spend ? '#b45309' : MUTE, fontWeight: r.spend ? 700 : 500 }}>
                    {r.spend ? money(r.spend) : '—'}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right', fontWeight: 800, color: r.negative ? '#b91c1c' : INK }}>
                    {money(r.closing)}
                  </td>
                  <td style={{ ...styles.td, fontSize: 11, color: MUTE }}>
                    {r.due.length ? r.due.map((c) => c.name).join(', ') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── the components behind it ───────────────────────────────────── */}
      <Section title={`Component life (${upcoming.length})`} right={<span style={{ fontSize: 11.5, color: MUTE }}>soonest due first</span>}>
        <DataTable
          columns={columns}
          rows={upcoming}
          pageSize={12}
          onRowClick={(c) => router.push(`/portal/hospitality/common-areas/${c.componentId}`)}
        />
        <p style={styles.note}>
          <strong style={{ color: INK }}>Cost when due</strong> applies {INFLATION * 100}% annual
          inflation to the replacement estimate, because ignoring it understates
          the gap. <strong style={{ color: INK }}>Annual share</strong> is the component&apos;s
          cost over its life — the sum of that column is what has to go in every
          year for the account to keep pace.
        </p>
      </Section>

      <Card style={{ background: '#fcfdfe' }}>
        <p style={{ margin: 0, fontSize: 11.5, color: MUTE, lineHeight: 1.6 }}>
          <strong style={{ color: INK }}>{COMMUNITY.note}</strong> This screen uses the
          straight-line component method against the common area register, which
          is what makes the forecast move when a component is re-costed or its
          condition changes. It is a planning view, not a study.
        </p>
      </Card>
    </div>
  )
}

/**
 * The forecast, drawn.
 *
 * Two lines when a contribution has been changed — where it is heading now and
 * where it would head — because the comparison is the argument. The zero line
 * is drawn across, and the area below it filled, so "the year it runs out" is
 * something the eye finds rather than something the reader computes.
 */
function Forecast({ current, proposed, years }) {
  const W = 100
  const H = 40

  const all = [...current.rows, ...(proposed?.rows || [])]
  const top = Math.max(...all.map((r) => r.closing), 0)
  const bottom = Math.min(...all.map((r) => r.closing), 0)
  const span = (top - bottom) || 1
  const y = (v) => H - ((v - bottom) / span) * H
  const x = (i) => (i / Math.max(1, current.rows.length - 1)) * W

  const path = (rows) => rows.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(r.closing).toFixed(2)}`).join(' ')
  const zeroY = y(0)

  return (
    <>
      {/* The markers are HTML over the chart, not circles inside it.
          `preserveAspectRatio="none"` is what lets the line fill whatever width
          the card has, but it stretches the coordinate system with it — twelve
          times across and five down here — so an SVG circle came out as a flat
          ellipse two and a half times wider than tall. Strokes survive that
          because of vectorEffect; a radius does not. Positioning the dots in
          percentages outside the SVG sidesteps the distortion entirely. */}
      <div style={{ position: 'relative', height: 190 }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
          style={{ width: '100%', height: '100%', display: 'block' }}>
          <defs>
            <linearGradient id="hospResFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#15227a" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#15227a" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Everything under this line is money the association does not have. */}
          <rect x="0" y={zeroY} width={W} height={Math.max(0, H - zeroY)} fill="#fef2f2" />
          <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke="#dc2626" strokeWidth="1"
            strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />

          <path d={`${path(current.rows)} L${W},${H} L0,${H} Z`} fill="url(#hospResFill)" />
          <path d={path(current.rows)} fill="none" stroke="#15227a" strokeWidth="2"
            strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />

          {proposed && (
            <path d={path(proposed.rows)} fill="none" stroke="#16a34a" strokeWidth="2"
              strokeDasharray="4 2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          )}
        </svg>

        {current.rows.map((r, i) => {
          const size = r.spend ? 9 : 6
          return (
            <span
              key={r.year}
              title={`${r.year} — closing ${money(r.closing)}${r.spend ? `, ${money(r.spend)} due` : ''}`}
              style={{
                position: 'absolute',
                left: `${(x(i) / W) * 100}%`,
                top: `${(y(r.closing) / H) * 100}%`,
                width: size,
                height: size,
                marginLeft: -size / 2,
                marginTop: -size / 2,
                borderRadius: '50%',
                background: r.negative ? '#dc2626' : r.spend ? '#15227a' : '#fff',
                borderStyle: 'solid',
                borderWidth: 1.5,
                borderColor: r.negative ? '#dc2626' : '#15227a',
                pointerEvents: 'auto',
              }}
            />
          )
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: MUTE, marginTop: 6 }}>
        {current.rows.filter((_, i) => i % Math.max(1, Math.round(years / 6)) === 0).map((r) => (
          <span key={r.year}>{r.year}</span>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 11, flexWrap: 'wrap', fontSize: 11, color: SUB }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 2, background: '#15227a', borderRadius: 2 }} /> At today&apos;s contribution
        </span>
        {proposed && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 14, height: 2, background: '#16a34a', borderRadius: 2 }} /> At the proposed contribution
          </span>
        )}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#fef2f2', borderStyle: 'solid', borderWidth: 1, borderColor: '#fecaca' }} /> Below zero
        </span>
      </div>
    </>
  )
}

const styles = {
  bigLabel: {
    fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase',
    letterSpacing: 0.4, marginBottom: 5,
  },
  riskChip: {
    display: 'inline-block', marginTop: 8, fontSize: 10.5, fontWeight: 800,
    letterSpacing: 0.3, textTransform: 'uppercase', background: '#fff',
    borderRadius: 999, padding: '2px 10px', borderStyle: 'solid', borderWidth: 1,
  },
  fundTrack: {
    position: 'relative', height: 12, background: 'rgba(255,255,255,0.75)',
    borderRadius: 999, overflow: 'visible',
  },
  fundMark: { position: 'absolute', top: -3, bottom: -3, width: 2, background: '#475569', borderRadius: 2 },
  yearBtn: {
    padding: '6px 12px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
    borderRadius: 8, background: '#fff', color: SUB, cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  yearBtnOn: { background: ACCENT, color: '#fff', borderColor: ACCENT },
  sliderRow: {
    display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start',
    marginTop: 18, paddingTop: 16,
    borderTopStyle: 'solid', borderTopWidth: 1, borderTopColor: LINE,
  },
  slider: { width: '100%', accentColor: ACCENT, cursor: 'pointer' },
  preset: {
    padding: '5px 11px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
    borderRadius: 999, background: '#fff', color: SUB, cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  presetKey: { color: '#047857', background: '#f0fdf4', borderColor: '#bbf7d0' },
  verdict: { padding: '12px 14px', borderRadius: 11, borderStyle: 'solid', borderWidth: 1 },
  th: {
    padding: '10px 12px', fontSize: 10.5, fontWeight: 700, color: SUB,
    textTransform: 'uppercase', letterSpacing: 0.4,
    borderBottomStyle: 'solid', borderBottomWidth: 1, borderBottomColor: LINE,
    whiteSpace: 'nowrap',
  },
  td: { padding: '9px 12px', fontVariantNumeric: 'tabular-nums' },
  note: {
    margin: '14px 0 0', paddingTop: 12, fontSize: 11.5, color: MUTE, lineHeight: 1.6,
    borderTopStyle: 'solid', borderTopWidth: 1, borderTopColor: LINE,
  },
}
