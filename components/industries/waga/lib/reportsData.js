'use client'

// The report set, as data.
//
// One builder per cut, each returning the same object: a title, a note saying
// what the rows are and where they came from, the columns, the rows, and the
// headline figures. The screen table, the PDF and the CSV all read that one
// object, so a column added here appears in all three and none of them can drift
// from the other two — which is the failure mode that makes exported reports
// stop being trusted.
//
// Nothing is invented. Every figure is either a workbook value, a count of
// workbook values, or something the portal derived and says it derived. Where a
// permit has no expiry the cell says which kind of blank it is, because the
// dataset distinguishes three and so must a report a regulator might read.
//
// No builder reads the clock at module scope, and none reads it at all except
// through `daysUntil`, which the rest of the portal already uses — a report
// generated twice on the same day must be the same report.

import {
  permits as workbookPermits, requirements as workbookRequirements,
  parameters as workbookParameters, deviations as workbookDeviations, SITES, ORG,
  permitHealth, isNonExpiring, expiryLabel, daysUntil, fmtDate, NOT_STATED,
} from './data'
import { generateOccurrences, kindOf, KIND, KIND_LABEL } from './schedule'

const dash = '—'
const val = (v, blank = NOT_STATED) => (v === 0 ? '0' : (v || blank))
const count = (arr, fn) => arr.filter(fn).length

/** How a permit's expiry should read: a date, or which kind of blank it is. */
const expiryOf = (p) => (p.expirationDate ? fmtDate(p.expirationDate) : expiryLabel(p))

/** Group rows into a Map, preserving first-seen order. */
function groupBy(rows, keyOf) {
  const m = new Map()
  for (const r of rows) {
    const k = keyOf(r)
    const list = m.get(k) || []
    list.push(r)
    m.set(k, list)
  }
  return m
}

/**
 * Every report, built against one scope.
 *
 * The registers are passed in rather than imported, because the workbook is no
 * longer the whole of what the portal holds: a permit added here, an obligation
 * written under it and a site typed on the Sites screen are records like any
 * other, and a report that reads only the import says a site has nothing when
 * the screen next to it lists what it has. The workbook remains the default so
 * a caller with nothing to add still gets the imported picture.
 *
 * @param scope     the site filter from useSite() — country, state or site
 * @param scopeName what that filter is called, for the report's own heading
 * @param filings   waga_filing rows (what has actually been recorded)
 * @param attachments  waga_attachment rows, for the evidence counts
 * @param permits/requirements/parameters/deviations/sites  the registers as the
 *        screens show them: workbook rows with portal changes merged, plus
 *        anything added in the portal
 */
export function buildReports({
  scope, scopeName, filings = [], attachments = [],
  permits = workbookPermits,
  requirements = workbookRequirements,
  parameters = workbookParameters,
  deviations = workbookDeviations,
  sites = SITES,
}) {
  const codeOf = (siteId) => sites.find((s) => s.siteId === siteId)?.code || ''
  const reqsPerPermit = groupBy(requirements.filter((r) => r.permitId), (r) => r.permitId)

  // Records made in the portal arrive without the columns the import derives
  // for its own rows, so they are derived here instead — a permit added on the
  // Permits screen showed a blank site column and no obligation count in the
  // report even after obligations had been written under it.
  const decorate = (row) => ({
    ...row,
    _siteCode: row._siteCode || codeOf(row.siteId),
    _requirementCount: (reqsPerPermit.get(row.permitId) || []).length || row._requirementCount || 0,
  })

  const myPermits = scope(permits).map(decorate)
  const myReqs = scope(requirements).map((r) => ({ ...r, _siteCode: r._siteCode || codeOf(r.siteId) }))
  const myParams = scope(parameters).map((x) => ({ ...x, _siteCode: x._siteCode || codeOf(x.siteId) }))
  const myDevs = scope(deviations).map((d) => ({ ...d, _siteCode: d._siteCode || codeOf(d.siteId) }))
  const mySites = sites.filter((s) => scope([{ siteId: s.siteId }]).length > 0)

  // Filings follow the scope like everything else. They did not, so a site
  // with nothing filed against it reported another site's filings as its own —
  // and "Filings recorded: 1" on an otherwise empty site report is exactly the
  // figure somebody would quote.
  const myFilings = scope(filings)
  const filedByRequirement = groupBy(myFilings.filter((f) => f.requirementId), (f) => f.requirementId)
  const filedOccurrences = new Set(myFilings.map((f) => f.occurrenceId).filter(Boolean))
  const attachmentsPerFiling = groupBy(attachments.filter((a) => a.filingRecordId), (a) => a.filingRecordId)

  const occurrences = generateOccurrences(myReqs, permits)
  const outstanding = occurrences.filter((o) => !filedOccurrences.has(o.occurrenceId))

  const filable = myReqs.filter((r) => {
    const k = kindOf(r)
    return k === KIND.RECURRING || k === KIND.MILESTONE
  })

  const reqCounts = (rs) => ({
    obligations: rs.length,
    standing: count(rs, (r) => kindOf(r) === KIND.CONTINUOUS),
    evented: count(rs, (r) => kindOf(r) === KIND.EVENT),
    evidenced: count(rs, (r) => (filedByRequirement.get(r.requirementId) || []).length > 0),
  })

  // ── by permit ──────────────────────────────────────────────────────────
  const byPermit = {
    key: 'permits',
    title: 'Permits and licenses',
    tab: 'Permits',
    note: 'Every authorization in scope, its agency and programme, when it expires or when its renewal '
      + 'application is due, and how many obligations it imposes. Expiry blanks say which kind of blank '
      + 'they are: a non-expiring permit is not the same as one whose tracker never carried the date.',
    stats: [
      { label: 'Permits', value: myPermits.length },
      { label: 'Agencies', value: new Set(myPermits.map((p) => p.agency).filter(Boolean)).size },
      { label: 'Expiring within 180 days', value: count(myPermits, (p) => { const d = daysUntil(p.renewalDeadline || p.expirationDate); return d !== null && d >= 0 && d <= 180 }), tone: 'warn' },
      { label: 'Non-expiring', value: count(myPermits, isNonExpiring) },
      { label: 'Obligations imposed', value: myPermits.reduce((n, p) => n + (p._requirementCount || 0), 0) },
    ],
    columns: [
      { header: 'Permit no.', width: 1.4, value: (p) => p.permitNumber },
      { header: 'Type', width: 1.7, value: (p) => p.permitType },
      { header: 'Site', width: 0.75, value: (p) => p._siteCode },
      { header: 'Agency', width: 0.9, value: (p) => val(p.agency) },
      { header: 'Programme', width: 1.2, value: (p) => val(p.program) },
      { header: 'Issued', width: 0.95, value: (p) => (p.issueDate ? fmtDate(p.issueDate) : NOT_STATED) },
      { header: 'Expires', width: 1.2, value: expiryOf },
      { header: 'Renewal', width: 0.95, value: (p) => (p.renewalDeadline ? fmtDate(p.renewalDeadline) : dash) },
      { header: 'State', width: 1, value: (p) => permitHealth(p).label },
      { header: 'Reqs', width: 0.55, align: 'right', value: (p) => String(p._requirementCount ?? 0) },
    ],
    rows: [...myPermits].sort((a, b) => String(a.permitNumber).localeCompare(String(b.permitNumber))),
  }

  // ── by site ────────────────────────────────────────────────────────────
  const bySite = {
    key: 'sites',
    title: 'Sites',
    tab: 'Sites',
    note: 'One row per site in scope, with everything that hangs off it counted from the register rather '
      + 'than from a stored total — so the numbers here and the numbers on each screen cannot disagree.',
    stats: [
      { label: 'Sites', value: mySites.length },
      { label: 'Countries', value: new Set(mySites.map((s) => s.country).filter(Boolean)).size },
      { label: 'States / regions', value: new Set(mySites.map((s) => s.state).filter(Boolean)).size },
      { label: 'Legal entities', value: new Set(mySites.map((s) => s.legalEntity).filter(Boolean)).size },
    ],
    columns: [
      { header: 'Code', width: 0.7, value: (s) => s.code },
      { header: 'Site', width: 1.8, value: (s) => s.siteName },
      { header: 'Legal entity', width: 1.6, value: (s) => val(s.legalEntity) },
      { header: 'City', width: 1, value: (s) => val(s.city) },
      { header: 'State', width: 0.6, value: (s) => val(s.state) },
      { header: 'Country', width: 0.8, value: (s) => val(s.country) },
      { header: 'Permits', width: 0.7, align: 'right', value: (s) => String(count(myPermits, (p) => p.siteId === s.siteId)) },
      { header: 'Obligations', width: 0.9, align: 'right', value: (s) => String(count(myReqs, (r) => r.siteId === s.siteId)) },
      { header: 'Limits', width: 0.7, align: 'right', value: (s) => String(count(myParams, (x) => x.siteId === s.siteId)) },
      { header: 'Deviations', width: 0.9, align: 'right', value: (s) => String(count(myDevs, (d) => d.siteId === s.siteId)) },
      { header: 'Open deviations', width: 1, align: 'right', value: (s) => String(count(myDevs, (d) => d.siteId === s.siteId && d.status !== 'Closed')) },
    ],
    rows: mySites,
  }

  // ── by country ─────────────────────────────────────────────────────────
  //
  // The level the client asked for. It rolls the same figures up one step, and
  // where the trial holds a single country it says so in the note rather than
  // presenting one row as a comparison.
  const countryGroups = [...groupBy(mySites, (s) => s.country || '').entries()]
  const byCountry = {
    key: 'countries',
    title: 'Countries',
    tab: 'Countries',
    note: countryGroups.length > 1
      ? 'The estate rolled up by country. Each figure is the sum of the sites beneath it.'
      : `The estate rolled up by country. The trial dataset holds one country — ${countryGroups[0]?.[0] || NOT_STATED} — `
        + 'so this is a single row today; it grows a row per country as sites in other countries are imported.',
    stats: [
      { label: 'Countries', value: countryGroups.length },
      { label: 'Sites', value: mySites.length },
      { label: 'Permits', value: myPermits.length },
      { label: 'Obligations', value: myReqs.length },
    ],
    columns: [
      { header: 'Country', width: 1, value: (g) => val(g.country) },
      { header: 'States / regions', width: 1.4, value: (g) => (g.states.join(', ') || NOT_STATED) },
      { header: 'Sites', width: 0.7, align: 'right', value: (g) => String(g.sites) },
      { header: 'Permits', width: 0.7, align: 'right', value: (g) => String(g.permits) },
      { header: 'Agencies', width: 1.4, value: (g) => (g.agencies.join(', ') || NOT_STATED) },
      { header: 'Obligations', width: 0.9, align: 'right', value: (g) => String(g.obligations) },
      { header: 'Limits', width: 0.7, align: 'right', value: (g) => String(g.limits) },
      { header: 'Open deviations', width: 1, align: 'right', value: (g) => String(g.openDeviations) },
    ],
    rows: countryGroups.map(([country, sites]) => {
      const ids = new Set(sites.map((s) => s.siteId))
      return {
        country,
        states: [...new Set(sites.map((s) => s.state).filter(Boolean))].sort(),
        sites: sites.length,
        permits: count(myPermits, (p) => ids.has(p.siteId)),
        agencies: [...new Set(myPermits.filter((p) => ids.has(p.siteId)).map((p) => p.agency).filter(Boolean))].sort(),
        obligations: count(myReqs, (r) => ids.has(r.siteId)),
        limits: count(myParams, (x) => ids.has(x.siteId)),
        openDeviations: count(myDevs, (d) => ids.has(d.siteId) && d.status !== 'Closed'),
      }
    }),
  }

  // ── by agency ──────────────────────────────────────────────────────────
  const agencyGroups = [...groupBy(myPermits, (p) => p.agency || '').entries()]
  const byAgency = {
    key: 'agencies',
    title: 'Regulators',
    tab: 'Regulators',
    note: 'What each agency has issued and what it obliges. The renewal column is the earliest '
      + 'application date across that agency’s permits, which is the next time somebody has to act.',
    stats: [
      { label: 'Agencies', value: agencyGroups.length },
      { label: 'Permits', value: myPermits.length },
      { label: 'Obligations', value: myReqs.length },
      { label: 'Submission routes', value: new Set(myReqs.map((r) => r.submissionMethod).filter(Boolean)).size },
    ],
    columns: [
      { header: 'Agency', width: 1.2, value: (g) => val(g.agency) },
      { header: 'Sites', width: 1.4, value: (g) => g.sites.join(', ') },
      { header: 'Permits', width: 0.7, align: 'right', value: (g) => String(g.permits) },
      { header: 'Obligations', width: 0.9, align: 'right', value: (g) => String(g.obligations) },
      { header: 'Next renewal due', width: 1.2, value: (g) => (g.nextRenewal ? fmtDate(g.nextRenewal) : 'None dated') },
      { header: 'Deviations', width: 0.9, align: 'right', value: (g) => String(g.deviations) },
    ],
    rows: agencyGroups.map(([agency, ps]) => {
      const permitIds = new Set(ps.map((p) => p.permitId))
      const renewals = ps.map((p) => p.renewalDeadline).filter(Boolean).sort()
      return {
        agency,
        sites: [...new Set(ps.map((p) => p._siteCode).filter(Boolean))].sort(),
        permits: ps.length,
        obligations: count(myReqs, (r) => permitIds.has(r.permitId)),
        nextRenewal: renewals[0] || '',
        deviations: count(myDevs, (d) => permitIds.has(d.permitId)),
      }
    }).sort((a, b) => String(a.agency).localeCompare(String(b.agency))),
  }

  // ── obligations by category ────────────────────────────────────────────
  const categoryGroups = [...groupBy(myReqs, (r) => r.category || '').entries()]
  const byCategory = {
    key: 'obligations',
    title: 'Obligations by category',
    tab: 'Obligations',
    note: 'The register grouped by what the obligation is for. "Evidenced" counts only obligations that '
      + 'can be filed against — a standing duty such as recording flow every fifteen minutes is never '
      + 'filed, so counting it as unevidenced would make the figure read worse than the truth.',
    stats: [
      { label: 'Obligations', value: myReqs.length },
      { label: 'Categories', value: categoryGroups.length },
      { label: 'Filable', value: filable.length },
      { label: 'Evidenced', value: count(filable, (r) => (filedByRequirement.get(r.requirementId) || []).length > 0), tone: 'ok' },
      { label: 'Standing or event-driven', value: myReqs.length - filable.length },
    ],
    columns: [
      { header: 'Category', width: 1.6, value: (g) => val(g.category) },
      { header: 'Obligations', width: 0.9, align: 'right', value: (g) => String(g.total) },
      { header: 'Scheduled', width: 0.9, align: 'right', value: (g) => String(g.scheduled) },
      { header: 'Standing', width: 0.8, align: 'right', value: (g) => String(g.standing) },
      { header: 'Event-driven', width: 1, align: 'right', value: (g) => String(g.evented) },
      { header: 'Milestones', width: 0.9, align: 'right', value: (g) => String(g.milestones) },
      { header: 'Evidenced', width: 1, align: 'right', value: (g) => `${g.evidenced} / ${g.filable}` },
      { header: 'Filings recorded', width: 1.1, align: 'right', value: (g) => String(g.filings) },
    ],
    rows: categoryGroups.map(([category, rs]) => {
      const f = rs.filter((r) => [KIND.RECURRING, KIND.MILESTONE].includes(kindOf(r)))
      return {
        category,
        total: rs.length,
        scheduled: count(rs, (r) => kindOf(r) === KIND.RECURRING),
        standing: count(rs, (r) => kindOf(r) === KIND.CONTINUOUS),
        evented: count(rs, (r) => kindOf(r) === KIND.EVENT),
        milestones: count(rs, (r) => kindOf(r) === KIND.MILESTONE),
        filable: f.length,
        evidenced: count(f, (r) => (filedByRequirement.get(r.requirementId) || []).length > 0),
        filings: rs.reduce((n, r) => n + (filedByRequirement.get(r.requirementId) || []).length, 0),
      }
    }).sort((a, b) => b.total - a.total),
  }

  // ── the filing calendar ────────────────────────────────────────────────
  const byDue = {
    key: 'calendar',
    title: 'Filing calendar',
    tab: 'Calendar',
    derived: true,
    note: 'Every dated occurrence the recurrence rules imply within the next year, with anything already '
      + 'filed removed. These dates are the portal’s arithmetic over the rule on each requirement, not '
      + 'records WAGA entered.',
    stats: [
      { label: 'Outstanding', value: outstanding.filter((o) => o.daysUntil <= 365).length },
      { label: 'Past due', value: count(outstanding, (o) => o.daysUntil < 0), tone: 'bad' },
      { label: 'Due within 30 days', value: count(outstanding, (o) => o.daysUntil >= 0 && o.daysUntil <= 30), tone: 'warn' },
      { label: 'Filed in the portal', value: filedOccurrences.size, tone: 'ok' },
      { label: 'Rules projected', value: new Set(occurrences.map((o) => o.requirementId)).size },
    ],
    columns: [
      { header: 'Due', width: 1, value: (o) => fmtDate(o.dueDate) },
      { header: 'Obligation', width: 3, value: (o) => o.title },
      { header: 'Site', width: 0.6, value: (o) => String(o.siteId).replace('SITE-', '') },
      { header: 'Category', width: 1.2, value: (o) => val(o.category) },
      { header: 'Frequency', width: 1, value: (o) => val(o.frequency) },
      { header: 'Submitted to', width: 1.4, value: (o) => val(o.submissionMethod) },
      { header: 'State', width: 1, value: (o) => (o.daysUntil < 0 ? `${Math.abs(o.daysUntil)} days past due` : `in ${o.daysUntil} days`) },
    ],
    rows: outstanding.filter((o) => o.daysUntil <= 365).sort((a, b) => a.daysUntil - b.daysUntil),
  }

  // ── what has been filed ────────────────────────────────────────────────
  const byFiling = {
    key: 'filings',
    title: 'Compliance record',
    tab: 'Compliance',
    note: 'Every filing recorded in the portal: what was answered, when, by whom, and what evidence is '
      + 'held for it. A filing recorded against an obligation with no projected date has nothing to be '
      + 'measured against and says so rather than reporting as on time.',
    stats: [
      { label: 'Filings', value: myFilings.length },
      { label: 'With files attached', value: count(myFilings, (f) => (attachmentsPerFiling.get(f.recordId) || []).length > 0), tone: 'ok' },
      { label: 'Filed late', value: count(myFilings, (f) => f.dueDate && f.filedDate && f.filedDate > f.dueDate), tone: 'warn' },
      { label: 'Files held', value: attachments.length },
      { label: 'Obligations answered', value: new Set(myFilings.map((f) => f.requirementId).filter(Boolean)).size },
    ],
    columns: [
      { header: 'Filed', width: 1, value: (f) => fmtDate(f.filedDate) },
      { header: 'Obligation', width: 2.6, value: (f) => f.title },
      { header: 'Reference', width: 1.4, value: (f) => val(f.requirementId, dash) },
      { header: 'Site', width: 0.6, value: (f) => val(f.siteCode, dash) },
      { header: 'Due', width: 1, value: (f) => (f.dueDate ? fmtDate(f.dueDate) : 'No projected date') },
      {
        header: 'Against due',
        width: 1.2,
        value: (f) => {
          if (!f.dueDate || !f.filedDate) return 'Not dated'
          const days = Math.round((new Date(f.filedDate) - new Date(f.dueDate)) / 86400000)
          if (days === 0) return 'On the day'
          return days > 0 ? `${days} days late` : `${Math.abs(days)} days early`
        },
      },
      { header: 'Filed by', width: 1.2, value: (f) => val(f.filedBy, dash) },
      { header: 'Evidence reference', width: 1.6, value: (f) => val(f.evidenceRef, 'None recorded') },
      { header: 'Files attached', width: 1, align: 'right', value: (f) => String((attachmentsPerFiling.get(f.recordId) || []).length) },
    ],
    rows: [...myFilings].sort((a, b) => String(b.filedDate || '').localeCompare(String(a.filedDate || ''))),
  }

  // ── limits ─────────────────────────────────────────────────────────────
  const byLimit = {
    key: 'limits',
    title: 'Permit limits',
    tab: 'Limits',
    note: 'Every numeric limit the permits set, the equipment it applies to and how it is monitored. '
      + 'These are read from the permit documents; where a threshold was not stated the cell says so.',
    stats: [
      { label: 'Limits', value: myParams.length },
      { label: 'Permits with limits', value: new Set(myParams.map((x) => x.permitId).filter(Boolean)).size },
      { label: 'Continuously monitored', value: count(myParams, (x) => /continuous|cems/i.test(x.dataMode || '')) },
    ],
    columns: [
      { header: 'Reference', width: 1.2, value: (x) => x.parameterId },
      { header: 'Equipment', width: 1.8, value: (x) => val(x.scope) },
      { header: 'Parameter', width: 1.4, value: (x) => val(x.parameter) },
      { header: 'Limit', width: 1.6, value: (x) => val(x.limitText) },
      { header: 'Monitored by', width: 1.4, value: (x) => val(x.dataMode) },
      { header: 'Site', width: 0.6, value: (x) => val(x._siteCode, dash) },
    ],
    rows: myParams,
  }

  // ── deviations ─────────────────────────────────────────────────────────
  const byDeviation = {
    key: 'deviations',
    title: 'Deviations and corrective action',
    tab: 'Deviations',
    note: 'Operational history from WAGA’s own deviance tracker, plus anything raised in the portal. '
      + 'These are records, not projections.',
    stats: [
      { label: 'Deviations', value: myDevs.length },
      { label: 'Open', value: count(myDevs, (d) => d.status !== 'Closed'), tone: 'warn' },
      { label: 'Closed', value: count(myDevs, (d) => d.status === 'Closed'), tone: 'ok' },
      { label: 'Permits affected', value: new Set(myDevs.map((d) => d.permitId).filter(Boolean)).size },
    ],
    columns: [
      { header: 'Reference', width: 1.1, value: (d) => d.deviationId || d.recordId },
      { header: 'Event date', width: 1, value: (d) => (d.eventDate ? fmtDate(d.eventDate) : NOT_STATED) },
      { header: 'Site', width: 0.6, value: (d) => val(d._siteCode, dash) },
      { header: 'Description', width: 3.4, value: (d) => val(d.description) },
      { header: 'Status', width: 1, value: (d) => val(d.status) },
      { header: 'Source', width: 1.4, value: (d) => val(d.source, 'Raised in the portal') },
    ],
    rows: myDevs,
  }

  return {
    scopeName,
    overview: {
      sites: mySites.length,
      countries: new Set(mySites.map((s) => s.country).filter(Boolean)).size,
      permits: myPermits.length,
      ...reqCounts(myReqs),
      limits: myParams.length,
      openDeviations: count(myDevs, (d) => d.status !== 'Closed'),
      pastDue: count(outstanding, (o) => o.daysUntil < 0),
      filings: myFilings.length,
      filesHeld: attachments.length,
    },
    reports: [byPermit, bySite, byCountry, byAgency, byCategory, byDue, byFiling, byLimit, byDeviation],
  }
}

export const ORG_NAME = ORG.name
