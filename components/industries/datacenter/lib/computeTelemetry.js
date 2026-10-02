'use client'

// Compute Telemetry — the per-device layer the facility modules don't reach.
//
// The BMS module owns HVAC, water and PLC; the electrical module owns switchgear
// and UPS; the DCIM screens stop at the hall, aisle and rack-power aggregate.
// None of them descend to an individual GPU, server node, rack PDU outlet or
// NVMe drive — which is exactly the compute telemetry a hyperscale operator runs
// on. This module adds it, sourced (in this proof of concept, modelled) from the
// three vendors that expose it:
//   • NVIDIA DCGM / NVML  — per-GPU utilisation, temperature, power, ECC, XID,
//     throttling, clocks, memory.
//   • Dell iDRAC (Redfish) — server chassis: inlet/exhaust, node power, PSU,
//     fans, CPU envelope, firmware.
//   • Micron              — NVMe SSD SMART (media wear, spare, drive temp) and
//     DIMM correctable-error rate.
//
// Deterministic fixtures, no live polling: every reading is derived from a stable
// hash of the device's index, and the sparkline windows are baked from the same
// hash so a line and the figure beside it can never disagree — the rule every
// screen in this portal follows. Nothing here is presented as a live API read;
// values are labelled modelled at the point of display.

// ── deterministic helpers (no Date.now / Math.random — hydration-safe) ───────
const h = (n) => Math.abs((n * 2654435761) % 100000) / 100000 // stable [0,1)
const between = (n, lo, hi) => lo + h(n) * (hi - lo)
const pick = (n, arr) => arr[Math.floor(h(n) * arr.length) % arr.length]
const round = (n, d = 0) => { const p = 10 ** d; return Math.round(n * p) / p }
// A 7-point history that lands on `end`, drifting up over the window with a
// little seeded jitter. Same seed → same line, every render.
const spark = (seed, end, amp) =>
  Array.from({ length: 7 }, (_, i) => round(end - amp * (6 - i) / 6 + (h(seed + i * 17) - 0.5) * amp * 0.35, 1))

// ── the compute estate ───────────────────────────────────────────────────────
// Two hyperscale sites carry dense GPU compute (the topology map's top picks:
// FRA15 Frankfurt 20 MW, IAD35 Ashburn 18 MW). Names/regions are the estate's.
const SITES = {
  FRA15: { name: 'Hanauer Landstrasse Campus - Building 15', region: 'EMEA', pue: 1.24, wue: 0.38 },
  IAD35: { name: 'Ashburn Campus - Building 35', region: 'NAM', pue: 1.31, wue: 0.51 },
}

const GPU_MODELS = [
  { model: 'NVIDIA H100 SXM', tdp: 700, mem: 80, hbmAlarm: 87 },
  { model: 'NVIDIA H200 SXM', tdp: 700, mem: 141, hbmAlarm: 87 },
]
const NODE_MODEL = 'Dell PowerEdge XE9680'
const GPUS_PER_NODE = 8

// Rack layout: [siteId, hall, row, nodeCount, gpuModelIndex]. Kept explicit so a
// rack reads like a real position, not a generated blob.
const RACK_LAYOUT = [
  ['FRA15', 'Data Hall 3', 'Row C-2', 4, 1],
  ['FRA15', 'Data Hall 3', 'Row C-3', 4, 1],
  ['FRA15', 'Data Hall 3', 'Row C-4', 4, 0],
  ['FRA15', 'Data Hall 2', 'Row B-1', 4, 0],
  ['IAD35', 'Data Hall 1', 'Row A-5', 4, 1],
  ['IAD35', 'Data Hall 1', 'Row A-6', 4, 0],
]

// XID fault codes DCGM surfaces, with a human label — used on the critical nodes.
const XID = { 79: 'GPU fell off the bus', 48: 'Double-bit ECC error', 63: 'Row-remap recording event', 94: 'Contained ECC error' }

const SSD_MODEL = 'Micron 7450 PRO NVMe'
const DIMM_MODEL = 'Micron DDR5 RDIMM 96GB'
const PSU_MODEL = 'Dell 3000W Titanium'

// Provenance — every device row carries which vendor feed reports it.
export const SOURCES = {
  dcgm: { key: 'dcgm', label: 'NVIDIA DCGM', short: 'DCGM', tone: 'green' },
  idrac: { key: 'idrac', label: 'Dell iDRAC · Redfish', short: 'iDRAC', tone: 'blue' },
  micron: { key: 'micron', label: 'Micron SMART', short: 'Micron', tone: 'violet' },
}

// The GPU metrics the detail view sparklines, mirroring the SENSORS descriptor
// shape the monitoring module uses.
export const GPU_METRICS = [
  { key: 'util', label: 'SM utilisation', unit: '%', decimals: 0, color: '#15227a' },
  { key: 'temp', label: 'GPU core temp', unit: '°C', decimals: 0, color: '#c2410c' },
  { key: 'power', label: 'Power draw', unit: 'W', decimals: 0, color: '#0891b2' },
]

// ── build the fleet ──────────────────────────────────────────────────────────
// One pass builds racks → nodes → GPUs → components, all keyed off a per-node
// seed so the whole tree is stable and a node's parts agree with its rollup.

function buildGpu(nodeSeed, gi, gpuModel, stress) {
  const seed = nodeSeed * 101 + gi * 7
  // stress 0 = healthy, 1 = warm/warning, 2 = faulting/critical
  const util = round(between(seed + 1, stress === 0 ? 62 : 74, 96))
  const temp = round(between(seed + 2, 52, 68) + stress * 11) // °C
  const hbmTemp = round(temp + between(seed + 3, 6, 12))
  const power = round(between(seed + 4, 380, gpuModel.tdp) - (stress === 0 ? 40 : 0))
  const eccSbe = Math.floor(between(seed + 5, 0, stress === 0 ? 3 : 40))
  const eccDbe = stress === 2 && h(seed + 6) > 0.5 ? Math.floor(between(seed + 6, 1, 4)) : 0
  const xidCode = stress === 2 && gi % 8 === 3 ? pick(seed + 7, [79, 48, 63]) : null
  const rowRemap = stress === 2 && h(seed + 8) > 0.6 ? Math.floor(between(seed + 8, 1, 3)) : 0
  const throttleSec = temp > 84 ? Math.floor(between(seed + 9, 40, 900)) : 0
  return {
    gpuId: `GPU${String(gi).padStart(2, '0')}`,
    index: gi,
    model: gpuModel.model,
    util, temp, hbmTemp, power,
    powerLimit: gpuModel.tdp,
    smClock: Math.floor(between(seed + 10, 1590, 1980)),
    memUsedGb: round(between(seed + 11, gpuModel.mem * 0.5, gpuModel.mem * 0.95)),
    memTotalGb: gpuModel.mem,
    eccSbe, eccDbe,
    xid: xidCode ? { code: xidCode, label: XID[xidCode] } : null,
    rowRemap, throttleSec,
    availability: round(100 - (stress === 2 ? between(seed + 12, 0.4, 3) : between(seed + 12, 0, 0.15)), 2),
    _spark: {
      util: spark(seed + 20, util, 14),
      temp: spark(seed + 21, temp, 10),
      power: spark(seed + 22, power, 90),
    },
    _hbmAlarm: gpuModel.hbmAlarm,
    _over: temp >= 84 || eccDbe > 0 || Boolean(xidCode),
  }
}

function healthOf(node, gpus) {
  const faulting = gpus.some((g) => g.eccDbe > 0 || g.xid || g.rowRemap > 0)
  const hot = gpus.some((g) => g.temp >= 84 || g.hbmTemp >= g._hbmAlarm)
  const wear = node._ssdMaxWear >= 90 || node._psuDrift
  if (faulting || node._ssdMaxWear >= 95) return { band: 'red', label: 'Critical' }
  if (hot || wear || node._ssdMaxWear >= 80) return { band: 'amber', label: 'Warning' }
  return { band: 'green', label: 'Healthy' }
}

function buildComponents(nodeSeed, stress) {
  // Micron NVMe drives
  const ssds = Array.from({ length: 2 }, (_, i) => {
    const seed = nodeSeed * 211 + i * 13
    const wear = round(between(seed + 1, 12, 55) + (stress === 2 ? between(seed + 2, 30, 45) : stress === 1 ? 20 : 0))
    const spare = round(100 - between(seed + 3, 0, 6) - Math.max(0, wear - 80) * 1.5)
    return {
      id: `NVMe${i}`, model: SSD_MODEL,
      wearPct: Math.min(99, wear), tempC: round(between(seed + 4, 38, 52) + stress * 5),
      sparePct: Math.max(0, round(spare)),
      reallocated: wear > 85 ? Math.floor(between(seed + 5, 1, 20)) : 0,
      uncorrErr: wear > 92 ? Math.floor(between(seed + 6, 1, 8)) : 0,
      powerOnHrs: Math.floor(between(seed + 7, 9000, 26000)),
    }
  })
  // Micron DIMMs — one aggregate row of the channel's correctable-error rate
  const dimmEccPerHr = round(between(nodeSeed * 307 + 1, 0, stress === 0 ? 2 : 60), stress === 0 ? 1 : 0)
  // Dell power — two redundant feeds (A/B), each a 3× 3000 W Titanium shelf: the
  // XE9680's 6-PSU, 3+3 complement, so a single feed (9 kW) carries the whole
  // node with the other in reserve. Delivered load and redundancy are settled in
  // the node assembly once the node's draw is known.
  const psus = ['A', 'B'].map((feed, i) => {
    const seed = nodeSeed * 409 + i * 17
    const drift = stress === 2 && i === 1 && h(seed) > 0.55
    return {
      id: `Feed ${feed}`, feed, psuCount: 3, model: PSU_MODEL, ratedW: 9000,
      efficiency: round(between(seed + 1, 92, 96) - (drift ? between(seed + 2, 3, 6) : 0), 1),
      _drift: drift,
    }
  })
  // Dell fans
  const fans = round(between(nodeSeed * 503 + 1, 68, 92) + stress * 6)
  return { ssds, dimmEccPerHr, psus, fans }
}

// Remaining-useful-life + failure probability, driven by the actual degradation
// signals above — not invented independently of the readings.
function predictiveFor(node) {
  const items = []
  const worstGpu = node.gpus.reduce((w, g) => {
    const score = g.eccDbe * 40 + (g.xid ? 60 : 0) + g.rowRemap * 25 + Math.max(0, g.throttleSec / 30) + Math.max(0, g.temp - 80) * 2
    return score > w.score ? { score, g } : w
  }, { score: 0, g: null })
  if (worstGpu.score > 8) {
    const rul = Math.max(3, Math.round(180 - worstGpu.score * 1.4))
    items.push({ component: `GPU ${worstGpu.g.gpuId}`, source: 'dcgm', rulDays: rul, failProb: Math.min(96, Math.round(worstGpu.score * 0.9)), driver: worstGpu.g.xid ? `XID ${worstGpu.g.xid.code}` : worstGpu.g.eccDbe ? `${worstGpu.g.eccDbe} uncorrectable ECC` : 'thermal violations' })
  }
  const worstSsd = node.ssds.reduce((w, s) => (s.wearPct > (w?.wearPct ?? -1) ? s : w), null)
  if (worstSsd && worstSsd.wearPct >= 80) {
    const rul = Math.max(5, Math.round((100 - worstSsd.wearPct) * 9))
    items.push({ component: `SSD ${worstSsd.id}`, source: 'micron', rulDays: rul, failProb: Math.min(94, Math.round((worstSsd.wearPct - 60) * 2)), driver: `${worstSsd.wearPct}% media life used` })
  }
  if (node.dimmEccPerHr >= 30) {
    items.push({ component: 'DIMM channel', source: 'micron', rulDays: Math.max(7, Math.round(140 - node.dimmEccPerHr)), failProb: Math.min(88, Math.round(node.dimmEccPerHr)), driver: `${node.dimmEccPerHr} correctable errors/hr` })
  }
  const degPsu = node.psus.find((p) => p._drift)
  if (degPsu) items.push({ component: `PSU feed ${degPsu.feed}`, source: 'idrac', rulDays: Math.round(between(node._seed + 71, 20, 60)), failProb: Math.round(between(node._seed + 72, 45, 70)), driver: `efficiency drift to ${degPsu.efficiency}%` })
  return items.sort((a, b) => a.rulDays - b.rulDays)
}

// Build every rack → node → gpu → component, once.
const RACKS = []
const NODES = []
let nodeCounter = 0
RACK_LAYOUT.forEach(([siteId, hall, row, nodeCount, gmi], ri) => {
  const gpuModel = GPU_MODELS[gmi]
  const rackNum = String(ri + 1).padStart(2, '0')
  const rackId = `${siteId}-RACK-${rackNum}`
  const rackNodes = []
  for (let n = 0; n < nodeCount; n += 1) {
    nodeCounter += 1
    const seed = nodeCounter * 971
    // Deterministic stress bucket — most healthy, a few warm, a couple faulting.
    const roll = h(seed * 3)
    const stress = roll > 0.9 ? 2 : roll > 0.72 ? 1 : 0
    const gpus = Array.from({ length: GPUS_PER_NODE }, (_, gi) => buildGpu(seed, gi, gpuModel, stress))
    const comp = buildComponents(seed, stress)
    const nodeNum = String(n + 1).padStart(2, '0')
    const node = {
      nodeId: `${rackId}-N${nodeNum}`,
      _seed: seed,
      rackId, siteId, _site: SITES[siteId].name, _region: SITES[siteId].region,
      hall, row, model: NODE_MODEL, gpuModel: gpuModel.model, gpuCount: GPUS_PER_NODE,
      gpus,
      ssds: comp.ssds, dimmEccPerHr: comp.dimmEccPerHr, psus: comp.psus, fans: comp.fans,
      _ssdMaxWear: Math.max(...comp.ssds.map((s) => s.wearPct)),
      _psuDrift: comp.psus.some((p) => p._drift),
      // node rollup
      gpuUtil: round(gpus.reduce((s, g) => s + g.util, 0) / gpus.length),
      peakGpuTemp: Math.max(...gpus.map((g) => g.temp)),
      peakHbmTemp: Math.max(...gpus.map((g) => g.hbmTemp)),
      // 8 GPUs at load + the host envelope (2 CPUs, DIMMs, NICs, fans, PSU loss):
      // a Dell XE9680-class node peaks near 10 kW.
      nodePowerKw: round((gpus.reduce((s, g) => s + g.power, 0) + between(seed + 5, 2600, 4200)) / 1000, 1),
      cpuUtil: round(between(seed + 6, 30, 70)),
      cpuPkgTemp: round(between(seed + 7, 48, 74)),
      inletC: round(between(seed + 8, 20, 26) + stress * 1.5, 1),
      exhaustC: round(between(seed + 9, 38, 46) + stress * 3, 1),
      eccDbeTotal: gpus.reduce((s, g) => s + g.eccDbe, 0),
      xidCount: gpus.filter((g) => g.xid).length,
      sources: ['dcgm', 'idrac', 'micron'],
    }
    // Now the node's draw is known: split it across the two feeds and settle
    // redundancy — a single 9 kW feed carries the whole node, the other in reserve.
    const nodeW = node.nodePowerKw * 1000
    node.psus.forEach((p) => { p.deliveredW = Math.round(nodeW / 2) })
    node.psuRedundant = node.psus[0].ratedW >= nodeW
    node.health = healthOf(node, gpus)
    node.predictive = predictiveFor(node)
    node.soonestRul = node.predictive.length ? node.predictive[0].rulDays : null
    node.topFailProb = node.predictive.length ? Math.max(...node.predictive.map((p) => p.failProb)) : 0
    NODES.push(node)
    rackNodes.push(node)
  }
  // Rack PDU — A/B feed, per-phase load derived from the rack's node draw.
  const rackKw = round(rackNodes.reduce((s, nn) => s + nn.nodePowerKw, 0), 1)
  // A GPU rack is sized for its nodes — a liquid/rear-door-cooled row runs ~11-12
  // kW per node of breaker headroom, so a 4-node rack is a ~44-48 kW position.
  const designKw = nodeCount * (gpuModel.model.includes('H200') ? 12 : 11)
  const phases = ['L1', 'L2', 'L3'].map((ph, pi) => {
    const load = round(rackKw / 3 * between(ri * 3 + pi + 1, 0.86, 1.14), 1)
    return { phase: ph, kw: load, amps: round(load * 1000 / 415, 1), pctOfRating: round((load / (designKw / 3)) * 100) }
  })
  RACKS.push({
    rackId, siteId, _site: SITES[siteId].name, hall, row,
    gpuModel: gpuModel.model, nodeCount, gpuCount: nodeCount * GPUS_PER_NODE,
    drawKw: rackKw, designKw, pctOfDesign: round((rackKw / designKw) * 100),
    headroomKw: round(designKw - rackKw, 1),
    inletC: round(rackNodes.reduce((s, nn) => s + nn.inletC, 0) / rackNodes.length, 1),
    exhaustC: round(rackNodes.reduce((s, nn) => s + nn.exhaustC, 0) / rackNodes.length, 1),
    deltaT: round(rackNodes.reduce((s, nn) => s + (nn.exhaustC - nn.inletC), 0) / rackNodes.length, 1),
    rpduId: `${rackId.replace('-RACK-', '-RPDU-')}`,
    phases,
    phaseImbalancePct: round((Math.max(...phases.map((p) => p.kw)) - Math.min(...phases.map((p) => p.kw))) / (rackKw / 3 || 1) * 100),
    _band: rackKw / designKw > 0.9 ? 'red' : rackKw / designKw > 0.78 ? 'amber' : 'green',
    _nodes: rackNodes.map((nn) => nn.nodeId),
  })
})

export const COMPUTE_RACKS = RACKS
export const COMPUTE_NODES = NODES
export const nodeById = new Map(NODES.map((n) => [n.nodeId, n]))
export const rackById = new Map(RACKS.map((r) => [r.rackId, r]))

// ── summaries ────────────────────────────────────────────────────────────────
export function fleetSummary(nodes = NODES) {
  const gpuCount = nodes.reduce((s, n) => s + n.gpuCount, 0)
  const drawKw = round(nodes.reduce((s, n) => s + n.nodePowerKw, 0), 1)
  const drawMw = round(drawKw / 1000, 2)
  const avgUtil = nodes.length ? round(nodes.reduce((s, n) => s + n.gpuUtil, 0) / nodes.length) : 0
  const avgInlet = nodes.length ? round(nodes.reduce((s, n) => s + n.inletC, 0) / nodes.length, 1) : 0
  const critical = nodes.filter((n) => n.health.band === 'red').length
  const warning = nodes.filter((n) => n.health.band === 'amber').length
  const healthy = nodes.length - critical - warning
  const atRisk = nodes.filter((n) => n.predictive.length).length
  // AI infrastructure health score — a 0-100 composite: full marks minus penalties
  // for critical/warning nodes and the fleet's worst failure probability.
  const worstFail = nodes.reduce((m, n) => Math.max(m, n.topFailProb), 0)
  const healthScore = Math.max(0, round(100 - critical * 6 - warning * 2 - worstFail * 0.15))
  // Availability from the GPUs' own availability figures.
  const avail = gpuCount
    ? round(nodes.reduce((s, n) => s + n.gpus.reduce((a, g) => a + g.availability, 0), 0) / gpuCount, 3)
    : 100
  return { nodes: nodes.length, gpuCount, drawKw, drawMw, avgUtil, avgInlet, critical, warning, healthy, atRisk, healthScore, avail, worstFail }
}

// Per-site (hall) roll-up: PUE/WUE from the site, IT load + health from its nodes.
export function siteRollup(nodes = NODES) {
  const ids = [...new Set(nodes.map((n) => n.siteId))]
  return ids.map((siteId) => {
    const sn = nodes.filter((n) => n.siteId === siteId)
    const itKw = round(sn.reduce((s, n) => s + n.nodePowerKw, 0), 1)
    return {
      siteId, name: SITES[siteId]?.name || siteId, region: SITES[siteId]?.region || '',
      nodes: sn.length, gpus: sn.reduce((s, n) => s + n.gpuCount, 0),
      itLoadMw: round(itKw / 1000, 2),
      pue: SITES[siteId]?.pue ?? null, wue: SITES[siteId]?.wue ?? null,
      critical: sn.filter((n) => n.health.band === 'red').length,
      avgUtil: sn.length ? round(sn.reduce((s, n) => s + n.gpuUtil, 0) / sn.length) : 0,
    }
  })
}

// The nodes with an open predictive finding, soonest RUL first — the at-risk feed.
export function atRiskNodes(nodes = NODES, limit = 6) {
  return nodes
    .filter((n) => n.predictive.length)
    .sort((a, b) => (a.soonestRul ?? 9999) - (b.soonestRul ?? 9999) || b.topFailProb - a.topFailProb)
    .slice(0, limit)
}

// A flat fleet table row per node — what the overview lists.
export function fleetRows(nodes = NODES) {
  return nodes.map((n) => ({
    nodeId: n.nodeId, siteId: n.siteId, _site: n._site, rackId: n.rackId, hall: n.hall, row: n.row,
    model: n.model, gpuModel: n.gpuModel, gpuCount: n.gpuCount,
    gpuUtil: n.gpuUtil, peakGpuTemp: n.peakGpuTemp, nodePowerKw: n.nodePowerKw, inletC: n.inletC,
    band: n.health.band, health: n.health.label,
    soonestRul: n.soonestRul, topFailProb: n.topFailProb,
  }))
}
