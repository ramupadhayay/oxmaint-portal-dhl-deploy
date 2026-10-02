'use client'

// The notification feed behind the header bell.
//
// A notification here is something that already happened in this portal that
// someone may need to act on: a detection the AI Auditor is tracking as an SLA
// risk, or an anomaly the condition monitoring raised on the register. Both
// already exist as their own records — this assembles them into one stream so
// the header can surface the few that need attention without an operator opening
// two registers to find them.
//
// Ranked attention-first: what is escalated or unresolved floats above what is
// already closed, then by severity, then by most recent. The bell shows the top
// of this list; the Notifications screen shows all of it. Nothing here is
// invented — every row points back at the alert or the auditor risk it came from.

import { ALERT_ROWS } from './data'
import { MON_REC_ROWS } from './monitoring'
import { buildRisks } from './riskEngine'

// The same fixed clock the AI Auditor anchors to (Recommendations §ANCHOR), so
// the header renders identically on the server and the first client paint. A
// notification's time is when it was raised, not a live countdown, so a frozen
// now is exactly right here.
const NOW = new Date('2026-08-31T09:00:00').getTime()

const SEV_RANK = { Critical: 0, High: 1, Warning: 1, Medium: 2, Low: 3, Info: 4 }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Compact absolute date. The portal's data spans dates on both sides of the
// anchor, so a relative "in 3 days" would read oddly against a future-dated row;
// an absolute stamp never does. `new Date("string")` is allowed in render.
function whenText(d) {
  if (!d) return '—'
  const s = String(d)
  const dt = new Date(`${s.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(dt.getTime())) return s
  const t = s.length > 10 ? s.slice(11, 16) : ''
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]}${t ? `, ${t}` : ''}`
}

// A detection the auditor is tracking as a risk → a notification. Attention is
// the same bar the AI Auditor uses: unresolved and either past its SLA, an
// orphan with no work order, warned, or on a Tier-1 asset.
function fromRisk(r) {
  const attention = !r._resolved && (r._pastSla || r._orphan || r.escalation_state === 'warned' || r.criticality === 'Critical')
  const badge = r._escalated ? 'Paged on-call'
    : r.escalation_state === 'breached' ? 'SLA breached'
      : r._orphan ? 'No work order yet'
        : r.escalation_state === 'warned' ? 'SLA at risk'
          : r._resolved ? 'Resolved' : 'Open risk'
  const tone = (r._pastSla || r._orphan) ? 'red' : r.escalation_state === 'warned' ? 'amber' : r._resolved ? 'green' : 'blue'
  // Urgency drives the order within "needs attention": paged on-call leads, then
  // breached SLAs, then orphans with no work order, then warned, then the rest.
  const urgency = r._resolved ? 90
    : r._escalated ? 0
      : r.escalation_state === 'breached' ? 1
        : r._orphan ? 2
          : r.escalation_state === 'warned' ? 3
            : r.criticality === 'Critical' ? 4
              : r.criticality === 'High' ? 5 : 6
  return {
    id: `risk:${r.risk_id}`,
    _urgency: urgency,
    kind: 'risk',
    channel: 'AI Auditor',
    severity: r.criticality,
    priority: r.priority,
    siteId: r._register?.siteId || null,
    asset: r._asset,
    site: r._register?._site || null,
    headline: r._asset,
    detail: r.action || 'SLA risk on a monitored asset',
    badge,
    tone,
    when: r.dateIssued,
    whenText: whenText(r.dateIssued),
    href: r.workOrderId
      ? `/portal/datacenter/work-orders/${encodeURIComponent(r.workOrderId)}`
      : '/portal/datacenter/recommendations',
    cta: r.workOrderId ? 'View work order' : 'Open in AI Auditor',
    resolved: Boolean(r._resolved),
    attention,
    _rank: SEV_RANK[r.criticality] ?? 5,
  }
}

const alertOpen = (a) => !/^closed/i.test(a.status || '')

// An anomaly the condition monitoring raised → a notification. Open alerts are
// the ones still awaiting or in engineering review; closed ones are history.
function fromAlert(a) {
  const attention = alertOpen(a)
  const urgency = !attention ? 95 : a.severity === 'Critical' ? 4 : a.severity === 'High' ? 5 : 6
  return {
    id: `alert:${a.alertId}`,
    _urgency: urgency,
    kind: 'alert',
    channel: 'Condition Monitoring',
    severity: a.severity,
    priority: null,
    siteId: a.siteId || null,
    asset: a._asset,
    site: a._site || null,
    headline: a._asset,
    detail: a.description || `${a.severity} anomaly detected`,
    badge: attention ? (a.status || 'Open') : (a.classification || 'Closed'),
    tone: a.severity === 'Critical' ? 'red' : a.severity === 'High' ? 'amber' : attention ? 'blue' : 'green',
    when: a.timestamp,
    whenText: whenText(a.timestamp),
    href: `/portal/datacenter/alerts/${encodeURIComponent(a.alertId)}`,
    cta: 'View alert',
    resolved: !attention,
    attention,
    _rank: SEV_RANK[a.severity] ?? 5,
  }
}

/**
 * The whole feed, ranked attention-first then severity then most recent.
 * `scope` is the site filter (rows with no site stay in scope); `overlays` is
 * what the portal has recorded against each auditor finding, so a risk that has
 * been resolved in the AI Auditor drops out of "needs attention" here too.
 */
export function buildNotifications({ scope = (x) => x, overlays = {} } = {}) {
  const risks = buildRisks(MON_REC_ROWS, NOW, overlays).map(fromRisk)
  const alerts = ALERT_ROWS.map(fromAlert)
  const items = scope([...risks, ...alerts]).sort((a, b) => (
    (Number(b.attention) - Number(a.attention))
    || (a._urgency - b._urgency)
    || (a._rank - b._rank)
    || String(b.when || '').localeCompare(String(a.when || ''))
  ))
  return {
    items,
    unread: items.filter((n) => n.attention).length,
    escalated: items.filter((n) => n.kind === 'risk' && n.attention && (n.badge === 'SLA breached' || n.badge === 'Paged on-call')).length,
    openAlerts: items.filter((n) => n.kind === 'alert' && n.attention).length,
  }
}
