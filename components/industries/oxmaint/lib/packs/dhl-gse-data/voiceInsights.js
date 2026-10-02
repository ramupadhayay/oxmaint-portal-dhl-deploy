/**
 * Current-period workmanship and spare-variant insights for the DHL CVG voice
 * projection. Computed from seeded WO quality flags and part-line variants —
 * not a live airline or SAP quality extract.
 */

export const QUALITY_WINDOWS = [7, 14, 30]

export const QUALITY_HONESTY =
  'Synthetic Oxmaint AI projection of workmanship and spare-variant outcomes — not live airline or production SAP data.'

export const WORKMANSHIP_PEERS = [
  { tech_id: 'TECH-0001', name: 'Alex Rivera', role: 'GSE Technician', profile: 'high' },
  { tech_id: 'EMP-010', name: 'Lena Keller', role: 'GSE Technician', profile: 'high' },
  { tech_id: 'EMP-013', name: 'Omar Novak', role: 'GSE Technician', profile: 'mid' },
  { tech_id: 'EMP-018', name: 'Taylor Okafor', role: 'Apprentice Technician', profile: 'rework' },
  { tech_id: 'EMP-020', name: 'Sam Kowalski', role: 'Apprentice Technician', profile: 'bounce' },
]

function rate(n, d) {
  if (!d) return 0
  return Math.round((n / d) * 1000) / 1000
}

function scoreOf({ closed, reopen14, bounce, nearPm, rework, firstTime }) {
  const r14 = rate(reopen14, closed)
  const b = rate(bounce, closed)
  const n = rate(nearPm, closed)
  const rw = rate(rework, closed)
  const ftf = rate(firstTime, closed)
  const raw = 100 - r14 * 28 - b * 22 - n * 14 - rw * 22 + ftf * 8
  return Math.max(35, Math.min(99, Math.round(raw)))
}

function bandOf(score) {
  if (score >= 88) return 'Excellent'
  if (score >= 75) return 'Solid'
  if (score >= 62) return 'Watch'
  return 'Coach'
}

export function computeWorkmanship(workOrders = []) {
  const closed = (workOrders || []).filter((w) => w.dhl_status === 'Closed' || w.status === 'Completed')
  const byTech = new Map()
  const ensure = (id, name) => {
    if (!byTech.has(id)) {
      byTech.set(id, {
        tech_id: id,
        name: name || id,
        closed: 0,
        reopen_7: 0,
        reopen_14: 0,
        reopen_30: 0,
        bounce_back: 0,
        near_pm: 0,
        rework: 0,
        first_time_fix: 0,
        samples: [],
      })
    }
    return byTech.get(id)
  }

  for (const w of closed) {
    const id = w.assigned_to_id || w.AssignedTo || 'unassigned'
    const row = ensure(id, w.assigned_to_name)
    row.closed += 1
    const q = w.quality || w.Quality || {}
    const reopenDays = Number(q.reopen_within_days) || (q.reopen || q.caused_reopen ? 14 : 0)
    if (q.reopen || q.caused_reopen) {
      if (reopenDays <= 7) row.reopen_7 += 1
      if (reopenDays <= 14) row.reopen_14 += 1
      if (reopenDays <= 30) row.reopen_30 += 1
    }
    if (q.bounce_back) row.bounce_back += 1
    if (q.near_pm) row.near_pm += 1
    if (q.rework || w.quality_flag === 'Rework' || w.QualityFlag === 'Rework') row.rework += 1
    if (q.first_time_fix) row.first_time_fix += 1
    if (q.reopen || q.caused_reopen || q.bounce_back || q.rework || q.near_pm) {
      row.samples.push({
        work_order: w.work_order_number || w.WorkOrderID,
        asset_id: w.asset_id || w.AssetID,
        title: w.title || w.FailureDesc,
        reopen_within_days: q.reopen_within_days || null,
        bounce_back: Boolean(q.bounce_back),
        near_pm: Boolean(q.near_pm),
        rework: Boolean(q.rework),
        first_time_fix: Boolean(q.first_time_fix),
      })
    }
  }

  const peerIds = new Set(WORKMANSHIP_PEERS.map((p) => p.tech_id))
  const technicians = WORKMANSHIP_PEERS.map((peer) => {
    const row = byTech.get(peer.tech_id) || ensure(peer.tech_id, peer.name)
    row.name = peer.name
    const score = scoreOf({
      closed: row.closed,
      reopen14: row.reopen_14,
      bounce: row.bounce_back,
      nearPm: row.near_pm,
      rework: row.rework,
      firstTime: row.first_time_fix,
    })
    return {
      ...row,
      role: peer.role,
      profile: peer.profile,
      reopen_7_rate: rate(row.reopen_7, row.closed),
      reopen_14_rate: rate(row.reopen_14, row.closed),
      reopen_30_rate: rate(row.reopen_30, row.closed),
      bounce_rate: rate(row.bounce_back, row.closed),
      near_pm_rate: rate(row.near_pm, row.closed),
      rework_rate: rate(row.rework, row.closed),
      first_time_fix_rate: rate(row.first_time_fix, row.closed),
      workmanship_score: score,
      band: bandOf(score),
      samples: row.samples.slice(0, 5),
    }
  }).sort((a, b) => b.workmanship_score - a.workmanship_score)

  const others = [...byTech.values()]
    .filter((r) => !peerIds.has(r.tech_id) && r.closed >= 8)
    .map((row) => {
      const score = scoreOf({
        closed: row.closed,
        reopen14: row.reopen_14,
        bounce: row.bounce_back,
        nearPm: row.near_pm,
        rework: row.rework,
        firstTime: row.first_time_fix,
      })
      return { ...row, workmanship_score: score, band: bandOf(score) }
    })
    .sort((a, b) => b.workmanship_score - a.workmanship_score)
    .slice(0, 4)

  return {
    honesty: QUALITY_HONESTY,
    windows_days: QUALITY_WINDOWS,
    technicians,
    shop_sample: others,
    how_to_read:
      'Score is 100 minus reopen (14-day), bounce-back, near-PM and rework rates, plus first-time-fix. Excellent is quiet closes; Watch / Coach is a mentoring queue, not a verdict.',
  }
}

export function computeSpareInsights(workOrders = []) {
  const groups = new Map()
  const bump = (key, seed, field) => {
    if (!groups.has(key)) {
      groups.set(key, {
        sku: seed.sku,
        name: seed.name,
        sap_material: seed.sap_material,
        channel: seed.channel,
        sku_variant: seed.sku_variant,
        vendor: seed.vendor,
        unit_cost: seed.unit_cost,
        installs: 0,
        fit_ok: 0,
        fit_issue: 0,
        early_failure: 0,
        repeat_pr: 0,
        parts_hold: 0,
        rework: 0,
      })
    }
    const g = groups.get(key)
    g[field] += 1
    return g
  }

  for (const w of workOrders || []) {
    const hold = w.dhl_status === 'Parts Hold' || w.Status === 'Parts Hold'
    const rework = Boolean((w.quality || w.Quality || {}).rework)
    for (const p of w.parts_needed || w.PartsNeeded || []) {
      if (!p.sku) continue
      const channel = p.channel || (p.sku_variant && /-AM$/.test(p.sku_variant) ? 'aftermarket' : 'oem')
      const key = `${p.sku}|${channel}`
      const seed = {
        sku: p.sku,
        name: p.name,
        sap_material: p.sap_material,
        channel,
        sku_variant: p.sku_variant || `${p.sku}-${channel === 'oem' ? 'OEM' : 'AM'}`,
        vendor: p.vendor || (channel === 'oem' ? 'OEM' : 'Aftermarket'),
        unit_cost: Number(p.unit_cost) || 0,
      }
      const g = bump(key, seed, 'installs')
      const outcome = p.install_outcome || 'fit_ok'
      if (g[outcome] != null) g[outcome] += 0
      if (outcome === 'fit_ok') g.fit_ok += 1
      else if (outcome === 'fit_issue') g.fit_issue += 1
      else if (outcome === 'early_failure') g.early_failure += 1
      else if (outcome === 'repeat_pr') g.repeat_pr += 1
      if (hold) g.parts_hold += 1
      if (rework) g.rework += 1
    }
  }

  const rows = [...groups.values()].map((g) => {
    const reliability = g.installs
      ? Math.round((1 - (g.fit_issue + g.early_failure * 1.4 + g.repeat_pr * 0.8) / Math.max(1, g.installs)) * 100)
      : 50
    const value = Math.round(reliability - Math.min(40, (g.unit_cost || 0) / 8))
    let verdict = 'Trial'
    if (reliability >= 86 && value >= 70) verdict = 'Best fit'
    else if (reliability >= 80 && g.channel === 'aftermarket') verdict = 'Higher value'
    else if (reliability < 62 || g.early_failure >= 3) verdict = 'Stay with OEM'
    else if (g.parts_hold >= 4 || g.repeat_pr >= 3) verdict = 'Drives holds'
    return {
      ...g,
      reliability: Math.max(20, Math.min(99, reliability)),
      value_score: value,
      verdict,
    }
  }).filter((g) => g.installs >= 2)

  const best = [...rows].sort((a, b) => b.reliability - a.reliability || b.value_score - a.value_score).slice(0, 6)
  const worst = [...rows].sort((a, b) => a.reliability - b.reliability || b.early_failure - a.early_failure).slice(0, 6)
  const holds = [...rows].sort((a, b) => b.parts_hold - a.parts_hold || b.repeat_pr - a.repeat_pr).slice(0, 5)

  return {
    honesty: QUALITY_HONESTY,
    variants: rows.sort((a, b) => a.sku.localeCompare(b.sku) || a.channel.localeCompare(b.channel)),
    best_fit: best,
    watch: worst,
    hold_drivers: holds,
    how_to_read:
      'OEM vs aftermarket variants on the voice register. Best fit is high reliability; higher value is reliable enough at a lower unit cost. Watch / drives-holds variants create fit issues, early failure, or repeat PRs.',
  }
}

export function computeVoiceInsights(workOrders = []) {
  return {
    workmanship: computeWorkmanship(workOrders),
    spares: computeSpareInsights(workOrders),
    honesty: QUALITY_HONESTY,
  }
}
