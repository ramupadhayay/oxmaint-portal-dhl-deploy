'use client'

// The risk model behind the AI Auditor.
//
// The auditor used to be a findings report — a list of things that were wrong,
// with no path from a finding to its resolution. This turns each finding into a
// tracked risk against the site's uptime SLA: it inherits the affected asset's
// criticality as a work-order priority, gets a deadline derived from the restore
// time the client committed to for that asset class — not a generic due date —
// and an escalation state that moves on its own as the clock runs down. Nothing
// here is invented: the criticality tiers, their response SLAs and their
// business impact all come from the client's own criticality sheet, and the SLA
// bands are the ones written into the Data Center Overview & Reports spec (§3.2).
//
// A risk is a finding plus the fields the spec's data model asks for (§6.1) —
// risk_id, sla_deadline, escalation_state, resolution_status, source — computed
// against a single `now` so every row on the screen agrees what time it is.

import { criticalityByRating } from './data'

// Restore SLA per asset class, in hours (spec §3.2). These are the window from
// detection to service restored — the clock a data-center manager actually
// cares about — not the sub-minute detect-to-WO target. They are defaults for
// the data-center template; the spec is explicit that a tenant admin must be
// able to override them per contract, so they live here as one editable table
// rather than scattered through the code. Never hard-code an hours literal
// anywhere else.
//
// Critical splits in the spec (Tier-1 cooling 4 h, Tier-1 power 2 h); this estate
// is chiller-heavy, so Critical defaults to the cooling band and the power path
// is tightened by class below.
export const SLA_HOURS = { Critical: 4, High: 24, Medium: 72, Low: 72 }

// The power path restores faster than cooling at the same criticality — a UPS or
// switchgear Tier-1 is a 2-hour window, not 4. Detected by class so the band
// still comes from a table, not a per-asset literal.
const POWER_CLASS = /ups|switchgear|generator|\bpdu\b|rectifier|transformer|static switch/i
const powerSlaHours = (criticality, cls) =>
  criticality === 'Critical' && POWER_CLASS.test(String(cls || '')) ? 2 : SLA_HOURS[criticality] ?? 72

// The hours past the SLA deadline at which the risk pages on-call rather than
// merely sitting breached (spec: auto-escalate at +48 h on Tier-1). Below High
// the loop does not page automatically.
const PAGE_AFTER = { Critical: 48, High: 72 }

// Criticality maps straight to work-order priority — a P1 is a Tier-1 asset's
// risk, not a separate judgement.
export const PRIORITY = { Critical: 'P1', High: 'P2', Medium: 'P3', Low: 'P4' }

// Who a breach escalates to, by tier. A Tier-1 outage window is a site decision,
// so it goes to leadership; below that it stays with the people who run the work.
export const ESCALATES_TO = {
  Critical: 'Site Leadership', High: 'Regional Operations',
  Medium: 'Site Engineering', Low: 'Site Engineering',
}

const HOUR = 3600e3
const RANK = { Critical: 0, High: 1, Medium: 2, Low: 3 }

const classOf = (rec) => rec._register?.assetClass || rec._register?.class || rec._register?.type || ''

// Day-granular dates, anchored to mid-morning so a same-day deadline is not
// already at midnight. Returns a Date or null.
const at = (d) => (d ? new Date(`${d}T09:00:00`) : null)

// A work order id that is really a dash or a "pending" placeholder is no work
// order at all. The workbook writes an em dash where none has been raised, and
// treating that as a link both mislabels the risk as resolved-in-progress and
// makes a "View —" button that opens on a work order that does not exist.
const realWoId = (v) => {
  const s = String(v ?? '').trim()
  return s && !/^[—–-]+$/.test(s) && !/^(pending|tbd|n\/a|none)$/i.test(s) ? s : null
}

/**
 * One finding as a tracked risk, against `now`.
 *
 * `overlay` carries anything recorded in the portal for this risk — a work order
 * auto-raised here, a resolution logged — and wins over the seeded record so a
 * risk that has been worked reads as worked. It is how the loop closes without
 * editing the client's workbook.
 */
export function riskFor(rec, now, overlay = {}) {
  // The asset's criticality drives everything; the recommendation's own urgency
  // is the fallback only when a finding is not tied to a registered asset.
  const criticality = rec._register?.criticality || rec.urgency || 'Medium'
  const grade = criticalityByRating.get(criticality) || {}
  const cls = classOf(rec)

  const issued = at(rec.dateIssued)
  const slaH = powerSlaHours(criticality, cls)
  const slaMs = slaH * HOUR
  const deadline = issued ? new Date(issued.getTime() + slaMs) : null

  const resolvedAt = overlay.resolvedAt || (rec._closed ? rec.dateClosed : null)
  const resolved = Boolean(resolvedAt)
  const verified = resolved && (overlay.resolution_status === 'verified_clear' || (!overlay.resolvedAt && rec._truePositive))
  const workOrderId = realWoId(overlay.workOrderId) || realWoId(rec.workOrderId)

  // escalation_state: none / warned / paged / breached (spec §6.1). A resolved
  // risk has cleared, so its state is none whatever the clock now reads.
  const pastMs = deadline ? now - deadline : 0
  let escalation_state
  if (resolved) escalation_state = 'none'
  else if (deadline && pastMs > (PAGE_AFTER[criticality] ?? Infinity) * HOUR) escalation_state = 'paged'
  else if (deadline && pastMs > 0) escalation_state = 'breached'
  else if (deadline && now > new Date(deadline.getTime() - slaMs * 0.25)) escalation_state = 'warned'
  else escalation_state = 'none'

  // resolution_status: open / wo_linked / resolved / verified_clear (spec §6.1).
  // "Listed" is not a status.
  let resolution_status
  if (verified) resolution_status = 'verified_clear'
  else if (resolved) resolution_status = 'resolved'
  else if (workOrderId) resolution_status = 'wo_linked'
  else resolution_status = 'open'

  // Where the work-order that carries this risk came from (spec §6.1). Seeded
  // findings come off the detection/Chiller-AI layer; anything the loop raises
  // here is stamped auditor by the overlay.
  const source = overlay.source || (realWoId(rec.workOrderId) ? 'predictive' : null)

  const resolveHours = resolved && issued && at(resolvedAt) ? (at(resolvedAt) - issued) / HOUR : null
  const ageHours = issued ? (now - issued) / HOUR : null
  const highOrCrit = criticality === 'Critical' || criticality === 'High'

  return {
    ...rec,
    risk_id: rec.recId,
    criticality,
    tier: grade.tier || null,
    assetClass: cls || null,
    priority: PRIORITY[criticality] || 'P4',
    businessImpact: grade.businessImpact || null,
    redundancyImpact: grade.redundancyImpact || null,
    escalatesTo: ESCALATES_TO[criticality] || 'Site Engineering',
    slaText: grade.responseSla || null,
    slaHours: slaH,
    sla_deadline: deadline ? deadline.toISOString() : null,
    escalation_state,
    resolution_status,
    source,
    workOrderId,
    linked_finding_id: workOrderId ? rec.recId : null,
    resolvedAt: resolved ? resolvedAt : null,
    resolveHours,
    ageHours,
    _pastSla: escalation_state === 'breached' || escalation_state === 'paged',
    _escalated: escalation_state === 'paged',
    _resolved: resolved,
    _highOrCrit: highOrCrit,
    // The spec's cardinal rule: no Critical/High finding may exist without a path
    // to resolution. An orphan is one with neither a linked work order nor a
    // recorded resolution.
    _orphan: highOrCrit && !workOrderId && !resolved,
  }
}

/**
 * Every finding as a risk, ranked by business impact: most critical first, then
 * the ones already past their SLA above the ones still inside it, then oldest.
 */
export function buildRisks(recs, now, overlays = {}) {
  return recs
    .map((r) => riskFor(r, now, overlays[r.recId] || {}))
    .sort((a, b) => (
      (RANK[a.criticality] - RANK[b.criticality])
      || (Number(b._pastSla) - Number(a._pastSla))
      || (Number(a._resolved) - Number(b._resolved))
      || String(a.dateIssued).localeCompare(String(b.dateIssued))
    ))
}

/**
 * The five numbers the dashboard leads with — the shift the spec asks for, from
 * "issues found" to what is open, past its SLA, how fast risk is cleared, and
 * whether every serious finding has a path (close-loop rate, spec AC-2).
 */
export function riskSummary(risks) {
  const critical = risks.filter((r) => r.criticality === 'Critical')
  const criticalOpen = critical.filter((r) => !r._resolved).length
  const criticalPastSla = critical.filter((r) => r._pastSla).length

  const resolved = risks.filter((r) => r._resolved && r.resolveHours != null)
  const mttrHours = resolved.length
    ? Math.round((resolved.reduce((s, r) => s + r.resolveHours, 0) / resolved.length) * 10) / 10
    : null

  const escalationCount = risks.filter((r) => r._pastSla).length

  // Auditor close-loop rate: of every Critical/High finding, the share that now
  // has a linked work order or a recorded resolution. Target 100%, zero orphans.
  const serious = risks.filter((r) => r._highOrCrit)
  const withPath = serious.filter((r) => r.workOrderId || r._resolved).length
  const closeLoopRate = serious.length ? Math.round((withPath / serious.length) * 100) : 100
  const orphans = serious.filter((r) => r._orphan).length

  return {
    criticalOpen,
    criticalPastSla,
    mttrHours,
    escalationCount,
    closeLoopRate,
    orphans,
    openCount: risks.filter((r) => !r._resolved).length,
    resolvedCount: resolved.length,
    total: risks.length,
  }
}

/**
 * Mean time to resolve per asset class, for trend analysis — the spec asks that
 * historical resolution times be stored per class (§6.1). Slowest first.
 */
export function mttrByClass(risks) {
  const m = new Map()
  for (const r of risks) {
    if (!r._resolved || r.resolveHours == null) continue
    const cls = r.assetClass || 'Unclassified'
    const row = m.get(cls) || { assetClass: cls, count: 0, hours: 0 }
    row.count += 1
    row.hours += r.resolveHours
    m.set(cls, row)
  }
  return [...m.values()]
    .map((r) => ({ ...r, mttrHours: Math.round((r.hours / r.count) * 10) / 10 }))
    .sort((a, b) => b.mttrHours - a.mttrHours)
}

/** How the SLA clock reads on a row: time left, or how far past. */
export function slaClock(risk, now) {
  if (risk._resolved) return { label: risk.resolveHours != null ? `Restored in ${fmtDur(risk.resolveHours)}` : 'Resolved', tone: 'green' }
  if (!risk.sla_deadline) return { label: '—', tone: 'grey' }
  const ms = new Date(risk.sla_deadline) - now
  if (ms <= 0) return { label: `${fmtDur(Math.abs(ms) / HOUR)} past SLA`, tone: 'red' }
  return { label: `${fmtDur(ms / HOUR)} to SLA`, tone: ms / HOUR < risk.slaHours * 0.25 ? 'amber' : 'blue' }
}

function fmtDur(hours) {
  if (hours == null) return '—'
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`
  if (hours < 48) return `${Math.round(hours)} h`
  return `${Math.round(hours / 24)} d`
}
