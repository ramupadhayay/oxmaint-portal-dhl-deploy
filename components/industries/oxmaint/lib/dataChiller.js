// Chiller AI — the derived layer behind the module's five screens.
//
// The pack (lib/packs/chiller.js) says which parameters exist and what a healthy
// range is; data.js generates the plant. Neither knows what a *leaking* chiller
// looks like, and that is the whole story this module tells — so the physics
// lives here: two hidden drivers per machine, charge loss and water-side
// fouling, and every series, state, score and alert below is a consequence of
// one or both.
//
// Deriving it all from two drivers rather than drawing each parameter
// independently is what makes the demo defensible. A chiller whose subcooling
// has fallen also has a superheat that has risen, a suction pressure that has
// sagged and a purge unit running longer — because they all read the same
// number. Drawn separately they would contradict one another, and that
// correlation is the entire detection argument.
//
// Nothing here is measured. The leak score is a weighted model and the cost of
// efficiency drift is an estimate over stated assumptions; both are labelled as
// such on the screens that show them.

import {
  ASSETS, WORK_ORDERS, TECHNICIANS, SITES, DOMAIN, EPOCH,
  seed, pick, between, daysFrom, daysUntil,
} from './data'

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const mean = (xs) => (xs.length ? xs.reduce((n, x) => n + x, 0) / xs.length : 0)

// A different pack switches this module off entirely. Everything below degrades
// to an empty list rather than throwing, so the routes survive a pack swap.
// The chiller pack's module, not any pack's. `Boolean(DOMAIN)` switched these
// screens on for every pack with a module of its own — the DHL and hospital
// builds opened Chiller AI onto a DOMAIN with no chiller arrays and crashed.
export const MODULE_ACTIVE = DOMAIN?.key === 'chiller'
export const PARAMS = DOMAIN?.parameters || []
const MONITORED = DOMAIN?.monitoredKinds || []
const REFRIGERANTS = DOMAIN?.refrigerants || ['R-134a']

export const WINDOW_DAYS = 90

// Tone names, not colours — the pages own their palette, and this file must not
// pull React or the UI kit in behind it.
export const STATE_TONE = { Normal: 'green', Warning: 'amber', Alarm: 'red' }
export const BAND_TONE = { High: 'red', Elevated: 'amber', Low: 'blue', Minimal: 'green' }

const STATE_RANK = { Alarm: 0, Warning: 1, Normal: 2 }
export const worstState = (params = []) => (
  params.reduce((worst, p) => (STATE_RANK[p.state] < STATE_RANK[worst] ? p.state : worst), 'Normal')
)

/**
 * Judge a reading against the pack's ranges.
 *
 * Each band in the pack is one-sided: for superheat the warn band sits above
 * normal, for subcooling below it. `invert` says which side is the failing one,
 * and the other side is deliberately left alone — a chiller running a little
 * cooler than its normal band is not a fault this module claims to see, and
 * flagging it would fill the screen with noise.
 */
export function paramState(param, value) {
  if (!param) return 'Normal'
  if (param.invert) {
    return value >= param.normal[0] ? 'Normal' : value >= param.warn[0] ? 'Warning' : 'Alarm'
  }
  return value <= param.normal[1] ? 'Normal' : value <= param.warn[1] ? 'Warning' : 'Alarm'
}

// Day-to-day jitter on top of a slower weekly wander. A single per-sample draw
// gives a hairball that hides the drift the module exists to show; the weekly
// term is what makes a 90-day trend readable at sparkline size.
const series = (key, base, amp, drift, dp = 1) => (
  Array.from({ length: WINDOW_DAYS }, (_, i) => {
    const t = i / (WINDOW_DAYS - 1)
    const wander = between(`${key}w${Math.floor(i / 7)}`, -amp, amp, 3)
    const jitter = between(`${key}d${i}`, -amp * 0.55, amp * 0.55, 3)
    return Number((base + drift * t + wander + jitter).toFixed(dp))
  })
)

// First week against last week, not first sample against last. One noisy day at
// either end can swing a two-point read by more than the drift it is supposed to
// detect, which would put a healthy machine at the top of the leak ranking.
const trendOf = (s) => Number((mean(s.slice(-7)) - mean(s.slice(0, 7))).toFixed(2))

// ── the refrigerant charge log ───────────────────────────────────────────
const REFRIGERANT_WORK = /recharge|refrigerant|leak test|charge/i
const GAS_HANDLERS = TECHNICIANS.filter((t) => t.trade === 'Refrigeration')

const chargeLog = (asset, leak, chargeLb) => {
  // The asset's own completed refrigerant work is the record of what actually
  // happened. Where the modelled charge loss implies more gas went in than the
  // work orders account for, the extra lines are marked as charge-log entries so
  // the two are never confused on screen.
  const fromWork = WORK_ORDERS
    .filter((w) => w.asset_id === asset.asset_id && w.status === 'Completed' && REFRIGERANT_WORK.test(w.title))
    .map((w) => ({
      date: w.completed_date || w.created_date,
      pounds: Math.max(5, Math.round(chargeLb * between(`${w.workorder_id}lb`, 0.03, 0.08, 3))),
      technician: w.assigned_to_name,
      reference: w.work_order_number,
      source: 'Work order',
    }))

  const implied = leak >= 0.62 ? 3 : leak >= 0.4 ? 2 : leak >= 0.2 ? 1 : 0
  const extra = Array.from({ length: Math.max(0, implied - fromWork.length) }, (_, i) => ({
    date: daysFrom(-between(`${asset.asset_id}tu${i}`, 25, 330)),
    pounds: Math.max(5, Math.round(chargeLb * between(`${asset.asset_id}tl${i}`, 0.03, 0.075, 3))),
    technician: (GAS_HANDLERS.length ? pick(`${asset.asset_id}tt${i}`, GAS_HANDLERS) : { name: '—' }).name,
    reference: '—',
    source: 'Charge log',
  }))

  return [...fromWork, ...extra].sort((a, b) => new Date(b.date) - new Date(a.date))
}

// ── one chiller ──────────────────────────────────────────────────────────
const build = (a) => {
  const k = a.asset_id
  const wear = clamp((100 - a.health_score) / 45, 0, 1)

  // Charge loss, 0 meaning the machine is holding its nameplate charge. Roughly
  // half the fleet sits at zero on purpose: a ranking in which every machine is
  // leaking ranks nothing, and an audience reads it as the model firing at
  // random rather than at a fault.
  const draw = seed(k + 'charge')
  const leak = draw < 0.55 ? 0
    : Number(clamp(0.18 + 0.5 * wear + 0.55 * ((draw - 0.55) / 0.45), 0, 1).toFixed(3))

  // Water-side fouling, driven by time since the last service rather than by a
  // free draw — so the condenser-approach story on this screen agrees with the
  // maintenance history the rest of the portal already shows for the same asset.
  const sinceService = clamp(Math.abs(daysUntil(a.last_maintenance_date)) / 90, 0, 1)
  const foul = Number(clamp(sinceService * 0.55 + (seed(k + 'foul') - 0.55) * 1.4, 0, 1).toFixed(3))

  // Leaving water holds setpoint until the machine genuinely runs out of
  // capacity, so chilled water supply only moves once the other two are well
  // advanced. Without this every drifting chiller also missed setpoint, which no
  // operator would leave running.
  const capacityShort = Math.max(0, (leak + foul) / 2 - 0.45)

  const shape = {
    superheat: { base: between(k + 'sh', 8.6, 11.2, 1), amp: 0.42, drift: 6.5 * leak, dp: 1 },
    subcooling: { base: between(k + 'sc', 10.8, 14.2, 1), amp: 0.46, drift: -7.5 * leak, dp: 1 },
    suction_pressure: { base: between(k + 'sp', 60, 70, 1), amp: 1.3, drift: -15 * leak, dp: 1 },
    discharge_pressure: { base: between(k + 'dp', 190, 224, 0), amp: 3.6, drift: 46 * foul, dp: 0 },
    approach: { base: between(k + 'ap', 1.7, 3.05, 2), amp: 0.13, drift: 3.2 * foul, dp: 2 },
    // Fouling makes the compressor work harder; a machine short of charge moves
    // less mass and draws less. Read alone the two cancel, which is exactly why
    // the pack's note says to read current with runtime rather than on its own.
    compressor_current: { base: between(k + 'cc', 200, 300, 0), amp: 6.5, drift: 74 * foul - 42 * leak, dp: 0 },
    cop: { base: between(k + 'cop', 5.6, 6.6, 2), amp: 0.1, drift: -(0.9 * leak + 1.1 * foul), dp: 2 },
    chw_supply: { base: between(k + 'chw', 42.4, 44.3, 1), amp: 0.22, drift: 6 * capacityShort, dp: 1 },
  }

  const parameters = PARAMS.map((p) => {
    const s = shape[p.key] || { base: mean(p.normal), amp: 0.1, drift: 0, dp: 1 }
    const data = series(k + p.key, s.base, s.amp, s.drift, s.dp)
    const value = data[data.length - 1]
    return { ...p, series: data, value, start: data[0], trend: trendOf(data), state: paramState(p, value) }
  })

  const byKey = Object.fromEntries(parameters.map((p) => [p.key, p]))
  const alarms = parameters.filter((p) => p.state === 'Alarm').length
  const warnings = parameters.filter((p) => p.state === 'Warning').length

  const tons = Math.round(between(k + 'ton', 250, 1400) / 50) * 50
  const load_pct = between(k + 'load', 45, 94)
  const runtime_hours_30d = between(k + 'rt', 380, 700)
  // A machine short of charge satisfies its setpoint early and stops, so it
  // starts more often. Cycling is read beside the leak score for that reason.
  const starts_per_day = Math.round(between(k + 'st', 2, 5) + leak * 7)

  // Purge runtime rises both when air is drawn in through a low-side leak and
  // when non-condensables build up on their own, so it is evidence rather than
  // proof — which is why it carries less weight in the score than the two
  // refrigeration temperatures.
  const purge_min_per_day = Math.round(3 + 26 * leak + 9 * foul + between(k + 'pu', 0, 3))

  const cop_now = byKey.cop ? byKey.cop.value : 0
  const cop_design = shape.cop.base
  const nameplate_charge_lb = tons * 2

  const top_ups = chargeLog(a, leak, nameplate_charge_lb)
  const recent = top_ups.filter((t) => daysUntil(t.date) > -365)

  // Twelve months of efficiency that land on today's reading in the final month.
  // Generating the monthly series independently of the 90-day one would let the
  // efficiency screen and the monitoring screen disagree about the same machine
  // on the same day, and that is the disagreement an audience notices first.
  const cop_months = Array.from({ length: 12 }, (_, m) => Number((
    cop_design + (cop_now - cop_design) * (m / 11) + between(`${k}cm${m}`, -0.07, 0.07, 3)
  ).toFixed(2)))

  return {
    ...a,
    id: a.asset_id,
    refrigerant: pick(k + 'ref', REFRIGERANTS),
    tons,
    nameplate_charge_lb,
    load_pct,
    runtime_hours_30d,
    starts_per_day,
    avg_run_minutes: Math.round((runtime_hours_30d * 60) / 30 / Math.max(1, starts_per_day)),
    cycling_state: starts_per_day >= 10 ? 'Alarm' : starts_per_day >= 7 ? 'Warning' : 'Normal',
    purge_min_per_day,
    parameters,
    byKey,
    alarms,
    warnings,
    worst_state: worstState(parameters),
    cop_now,
    cop_design,
    cop_months,
    kw_per_ton: cop_now ? Number((3.51685 / cop_now).toFixed(3)) : null,
    kw_per_ton_design: Number((3.51685 / cop_design).toFixed(3)),
    top_ups,
    added_12m_lb: recent.reduce((n, t) => n + t.pounds, 0),
    top_ups_12m: recent.length,
    // Anchored on the asset record's own health score so this module and the
    // asset register never rank the same machine differently, then pulled down
    // by whatever is currently out of band.
    health_index: Math.round(clamp(a.health_score - alarms * 12 - warnings * 5, 5, 100)),
    charge_loss: leak,
    fouling: foul,
  }
}

// ── leak risk ────────────────────────────────────────────────────────────
//
// Five named factors with fixed weights, published so the number can be argued
// with. A single opaque probability is the thing a reliability engineer refuses
// to act on, and rightly — this is a model over operating data, not a sniffer
// reading, and the breakdown is what makes it usable anyway.
export const LEAK_FACTORS = [
  { key: 'subcooling_fall', label: 'Subcooling falling', weight: 30, note: 'Last seven days against the first seven of the 90-day window. Full weight at a 7.5 °F fall.' },
  { key: 'superheat_rise', label: 'Superheat rising', weight: 22, note: 'Same window. Full weight at a 6.5 °F rise.' },
  { key: 'suction_fall', label: 'Suction pressure falling', weight: 18, note: 'Same window. Full weight at a 15 psi fall.' },
  { key: 'purge_runtime', label: 'Purge unit runtime', weight: 15, note: 'Counts above 6 minutes per day; full weight at 36.' },
  { key: 'top_ups', label: 'Refrigerant added', weight: 15, note: 'Top-ups recorded against the asset in the last 12 months. Full weight at three.' },
]

const WEIGHT = Object.fromEntries(LEAK_FACTORS.map((f) => [f.key, f.weight]))

export const leakBand = (score) => (score >= 65 ? 'High' : score >= 40 ? 'Elevated' : score >= 18 ? 'Low' : 'Minimal')

const signed = (v, unit, dp = 1) => `${v >= 0 ? '+' : '-'}${Math.abs(v).toFixed(dp)} ${unit}`

/**
 * A 0–100 refrigerant-loss probability with its working shown.
 *
 * Returns the factors as well as the number, because every screen that displays
 * the score also has to be able to answer "why".
 */
export function leakScore(chiller) {
  if (!chiller || !chiller.byKey) return { score: 0, band: 'Minimal', factors: [] }
  const p = chiller.byKey
  const subFall = -(p.subcooling ? p.subcooling.trend : 0)
  const shRise = p.superheat ? p.superheat.trend : 0
  const sucFall = -(p.suction_pressure ? p.suction_pressure.trend : 0)
  const purge = chiller.purge_min_per_day || 0
  const tops = chiller.top_ups_12m || 0

  const raw = [
    {
      key: 'subcooling_fall',
      ratio: clamp(subFall / 7.5, 0, 1),
      value: signed(-subFall, '°F'),
      detail: p.subcooling ? `${p.subcooling.value.toFixed(1)} °F now, normal ${p.subcooling.normal[0]}–${p.subcooling.normal[1]} °F` : '—',
    },
    {
      key: 'superheat_rise',
      ratio: clamp(shRise / 6.5, 0, 1),
      value: signed(shRise, '°F'),
      detail: p.superheat ? `${p.superheat.value.toFixed(1)} °F now, normal ${p.superheat.normal[0]}–${p.superheat.normal[1]} °F` : '—',
    },
    {
      key: 'suction_fall',
      ratio: clamp(sucFall / 15, 0, 1),
      value: signed(-sucFall, 'psi'),
      detail: p.suction_pressure ? `${p.suction_pressure.value.toFixed(1)} psi now, normal ${p.suction_pressure.normal[0]}–${p.suction_pressure.normal[1]} psi` : '—',
    },
    {
      key: 'purge_runtime',
      ratio: clamp((purge - 6) / 30, 0, 1),
      value: `${purge} min/day`,
      detail: 'Above 6 min/day suggests air or non-condensables entering the machine',
    },
    {
      key: 'top_ups',
      ratio: clamp(tops / 3, 0, 1),
      value: tops === 1 ? '1 top-up' : `${tops} top-ups`,
      detail: `${chiller.added_12m_lb || 0} lb added in the last 12 months`,
    },
  ]

  const factors = raw.map((f) => {
    const meta = LEAK_FACTORS.find((m) => m.key === f.key)
    return {
      ...f,
      label: meta.label,
      note: meta.note,
      weight: WEIGHT[f.key],
      contribution: Number((WEIGHT[f.key] * f.ratio).toFixed(1)),
    }
  })

  const score = Math.round(clamp(factors.reduce((n, f) => n + f.contribution, 0), 0, 100))
  return { score, band: leakBand(score), factors }
}

const BASE = MONITORED.length
  ? ASSETS.filter((a) => MONITORED.includes(a.asset_type)).map(build)
  : []

/** The refrigerant-carrying assets, enriched with 90 days of every parameter. */
export const CHILLERS = BASE.map((c) => {
  const s = leakScore(c)
  return { ...c, leak_score: s.score, leak_band: s.band, leak_factors: s.factors }
})

/** The same machines, ranked by modelled refrigerant-loss probability. */
export const LEAK_RISK = [...CHILLERS].sort((a, b) => b.leak_score - a.leak_score)

export function stateTotals(chillers = []) {
  const out = { Normal: 0, Warning: 0, Alarm: 0 }
  chillers.forEach((c) => c.parameters.forEach((p) => { out[p.state] += 1 }))
  return [
    { name: 'Normal', value: out.Normal },
    { name: 'Warning', value: out.Warning },
    { name: 'Alarm', value: out.Alarm },
  ]
}

// ── efficiency ───────────────────────────────────────────────────────────
//
// Weighted by tonnage throughout. An unweighted fleet COP lets a 250-ton machine
// pull the headline as hard as a 1,400-ton one, which is not how the electricity
// bill works.
const weighted = (rows, get) => {
  const tons = rows.reduce((n, r) => n + r.tons, 0)
  return tons ? Number((rows.reduce((n, r) => n + get(r) * r.tons, 0) / tons).toFixed(2)) : 0
}

export const COP_BASELINE = weighted(CHILLERS, (c) => c.cop_design)

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(EPOCH)
  d.setMonth(d.getMonth() - (11 - i))
  return d.toLocaleString('en-GB', { month: 'short' })
})

/** Twelve months of achieved COP per site, each row against its own baseline. */
export const COP_TREND = SITES.flatMap((s) => {
  const fleet = CHILLERS.filter((c) => c.site_id === s.site_id)
  const tons = fleet.reduce((n, c) => n + c.tons, 0)
  const baseline = weighted(fleet, (c) => c.cop_design)
  return MONTHS.map((month, m) => ({
    id: `${s.site_id}-${m}`,
    site_id: s.site_id,
    site_name: s.site_name,
    month,
    month_index: m,
    tons,
    chillers: fleet.length,
    cop: weighted(fleet, (c) => c.cop_months[m]),
    baseline,
  }))
}).filter((r) => r.chillers > 0)

// The two numbers behind every money figure this module shows. They are stated
// on screen rather than buried here, because a cost of drift is an estimate and
// an estimate with hidden inputs is worth nothing to the person reading it.
export const ENERGY_ASSUMPTIONS = {
  hours_per_year: 6000,
  tariff_per_kwh: 0.12,
  kw_per_ton_of_refrigeration: 3.51685,
}

/** Estimated annual energy penalty of a machine's drift from its own baseline. */
export function driftCost(c) {
  if (!c || !c.cop_now || !c.cop_design) return { excess_kw_per_ton: 0, kw_lost: 0, kwh_year: 0, cost_year: 0 }
  const excess = Math.max(0, (3.51685 / c.cop_now) - (3.51685 / c.cop_design))
  const kw = excess * c.tons * (c.load_pct / 100)
  const kwh = kw * ENERGY_ASSUMPTIONS.hours_per_year
  return {
    excess_kw_per_ton: Number(excess.toFixed(3)),
    kw_lost: Number(kw.toFixed(1)),
    kwh_year: Math.round(kwh),
    cost_year: Math.round(kwh * ENERGY_ASSUMPTIONS.tariff_per_kwh),
  }
}

/** Percentage drop from a machine's commissioning COP to today's. */
export const copDriftPct = (c) => (
  c && c.cop_design ? Number((((c.cop_design - c.cop_now) / c.cop_design) * 100).toFixed(1)) : 0
)

// ── predictive alerts ────────────────────────────────────────────────────
//
// One rule per failure mode the overview names, each carrying the parameters
// that triggered it and the inspection it asks for. A chiller can raise more
// than one: fouling and charge loss are independent, and merging them into a
// single "fault" would send a technician to look at the wrong thing.
const ALERT_RULES = [
  {
    key: 'refrigerant-loss',
    test: (c) => c.leak_score >= 40,
    severity: (c) => (c.leak_score >= 65 ? 'Critical' : 'High'),
    cause: 'Progressive refrigerant loss',
    params: ['subcooling', 'superheat', 'suction_pressure'],
    action: 'Electronic leak test of the condenser barrel, tube sheets, flanges and relief piping. Read the purge log before adding any charge.',
    work: /leak|refrigerant|recharge|subcooling/i,
  },
  {
    key: 'condenser-fouling',
    test: (c) => c.byKey.approach && c.byKey.approach.state !== 'Normal',
    severity: (c) => (c.byKey.approach.state === 'Alarm' ? 'High' : 'Medium'),
    cause: 'Condenser fouling or tube scaling',
    params: ['approach', 'discharge_pressure'],
    action: 'Brush and inspect the condenser tubes at the next window, and sample the condenser water for hardness and biological growth.',
    work: /approach|condenser|tube/i,
  },
  {
    key: 'non-condensables',
    test: (c) => c.byKey.discharge_pressure && c.byKey.discharge_pressure.state !== 'Normal'
      && c.byKey.approach && c.byKey.approach.state === 'Normal',
    severity: () => 'Medium',
    cause: 'Non-condensables in the condenser',
    params: ['discharge_pressure', 'approach'],
    action: 'Check purge unit operation and purge the machine. Confirm the purge is not itself pulling air in through a low-side leak.',
    work: /purge|non-condensable|discharge/i,
  },
  {
    key: 'efficiency-drift',
    test: (c) => c.byKey.cop && c.byKey.cop.state !== 'Normal',
    severity: (c) => (c.byKey.cop.state === 'Alarm' ? 'High' : 'Medium'),
    cause: 'Efficiency drift against the commissioning baseline',
    params: ['cop', 'approach'],
    action: 'Log a performance test at matched load and ambient before attributing the drift to the machine.',
    work: /cop|efficiency|baseline/i,
  },
  {
    key: 'cycling',
    test: (c) => c.cycling_state !== 'Normal',
    severity: (c) => (c.cycling_state === 'Alarm' ? 'High' : 'Medium'),
    cause: 'Abnormal compressor cycling',
    params: ['compressor_current', 'suction_pressure'],
    action: 'Review staging setpoints against the load profile and confirm the machine is not being held below its minimum step.',
    work: /cycl|compressor/i,
  },
  {
    key: 'capacity',
    test: (c) => c.byKey.chw_supply && c.byKey.chw_supply.state !== 'Normal',
    severity: (c) => (c.byKey.chw_supply.state === 'Alarm' ? 'Critical' : 'High'),
    cause: 'Leaving chilled water above setpoint',
    params: ['chw_supply', 'cop'],
    action: 'Confirm load and available capacity, then check the charge before staging another machine on.',
    work: /chilled water|capacity|setpoint/i,
  },
]

const SEV_RANK = { Critical: 0, High: 1, Medium: 2 }

export const CHILLER_ALERTS = CHILLERS.flatMap((c) => (
  ALERT_RULES.filter((r) => r.test(c)).map((r) => {
    const id = `alr_${c.asset_id}_${r.key}`
    // An alert reads as actioned only where the asset already carries matching
    // work. A flag drawn at random would put "work order raised" against a
    // chiller whose work-order list is empty, and that is the first
    // inconsistency an audience checks.
    const wo = WORK_ORDERS.find((w) => w.asset_id === c.asset_id && r.work.test(w.title))
    return {
      id,
      alert_id: id,
      rule: r.key,
      asset_id: c.asset_id,
      asset_name: c.asset_name,
      asset_code: c.asset_code,
      asset_type: c.asset_type,
      site_id: c.site_id,
      site_name: c.site_name,
      location_name: c.functional_location_name,
      severity: r.severity(c),
      cause: r.cause,
      parameters: r.params
        .map((key) => c.byKey[key])
        .filter(Boolean)
        .map((p) => ({ key: p.key, label: p.label, unit: p.unit, value: p.value, state: p.state, trend: p.trend })),
      action: r.action,
      detected_date: daysFrom(-between(id + 'd', 0, 21)),
      work_order_number: wo ? wo.work_order_number : null,
      work_order_raised: Boolean(wo),
      leak_score: c.leak_score,
    }
  })
)).sort((a, b) => (SEV_RANK[a.severity] - SEV_RANK[b.severity])
  || (new Date(b.detected_date) - new Date(a.detected_date)))
