// The EHS module behind the Oxmaint CMMS portal.
//
// Everything here hangs off the plant in data.js — the same assets, the same
// people, the same work orders. An EHS module that invents its own machines is
// the one thing a safety manager checks first: they open a certificate, look up
// the asset it names, and expect to find it on the register.
//
// Derived, never random, for the reason data.js gives: a demo that shows
// different numbers on each load cannot be rehearsed. The hash behind pick() and
// between() is private to that module, so every weighted draw here is expressed
// the way it expresses its own — repetition inside the array pick() reads from.

import {
  pick, between, daysFrom, isPast, daysUntil,
  ASSETS, TECHNICIANS, WORK_ORDERS, INCIDENTS, TREND, OPEN_STATUS, EPOCH, DOMAIN,
} from './data'

// The administrator account signs nothing on this module. Isolating plant and
// accepting a clearance are competent-person duties, and an approval trail that
// leads back to the system administrator is the first thing an auditor pulls on.
const AUTHORISED = TECHNICIANS.filter((t) => t.role !== 'Administrator')

// ── certificates ─────────────────────────────────────────────────────────
// Which certificate a machine carries follows from what the machine is: a
// forklift is lifting equipment and falls under LOLER, an air receiver falls
// under a written scheme, a motor control centre gets an EICR. Drawing the type
// at random would put a pressure-vessel certificate on a conveyor, which reads
// as a broken import rather than as demo data.
//
// The pressure systems repeat their written scheme, weighted the way data.js
// weights its statuses: a receiver or a boiler is examined under PSSR first and
// anything else second, so an even draw left the register with two written
// schemes across nine pressure assets — a gap an auditor would open with.
const CERT_BY_ASSET_TYPE = {
  'Air Compressor': ['Pressure vessel (PSSR)', 'Pressure vessel (PSSR)', 'Calibration certificate'],
  Boiler: ['Pressure vessel (PSSR)', 'Pressure vessel (PSSR)', 'Thorough examination'],
  Chiller: ['Pressure vessel (PSSR)', 'Calibration certificate'],
  'Cooling Tower': ['Thorough examination', 'Electrical installation (EICR)'],
  'Hydraulic Press': ['Thorough examination', 'Electrical installation (EICR)'],
  Conveyor: ['Electrical installation (EICR)', 'Thorough examination'],
  Pump: ['Calibration certificate', 'Electrical installation (EICR)'],
  Gearbox: ['Thorough examination', 'Electrical installation (EICR)'],
  Extruder: ['Electrical installation (EICR)', 'Calibration certificate'],
  // A fork-lift truck carries one statutory document and it is the LOLER
  // examination — the twelve-monthly report is that examination, not a second
  // one alongside it.
  Forklift: ['Statutory examination (LOLER)'],
}

// The statutory interval for each type, so the issued date and the expiry date
// can never contradict the certificate a reader recognises: LOLER runs to
// twelve months, a written scheme for a compressed-air receiver commonly to
// twenty-six, an industrial installation report to three years.
const CERT_VALIDITY_DAYS = {
  'Statutory examination (LOLER)': 365,
  'Thorough examination': 365,
  'Calibration certificate': 365,
  'Pressure vessel (PSSR)': 790,
  'Electrical installation (EICR)': 1095,
}

// In-house appears against calibration only. A statutory examination signed by
// the duty holder is not a statutory examination — the whole point of the
// document is that somebody independent put their name on it.
const CERT_ISSUERS = {
  'Statutory examination (LOLER)': ['Zurich Engineering', 'Bureau Veritas', 'SGS'],
  'Thorough examination': ['Zurich Engineering', 'Bureau Veritas'],
  'Pressure vessel (PSSR)': ['Zurich Engineering', 'TÜV', 'Bureau Veritas'],
  'Electrical installation (EICR)': ['Bureau Veritas', 'SGS'],
  'Calibration certificate': ['In-house', 'In-house', 'SGS', 'TÜV'],
}

const CERT_CODE = {
  'Statutory examination (LOLER)': 'LOL',
  'Thorough examination': 'THE',
  'Calibration certificate': 'CAL',
  'Pressure vessel (PSSR)': 'PSS',
  'Electrical installation (EICR)': 'EIC',
}

const ISSUER_CODE = {
  'Bureau Veritas': 'BV', SGS: 'SGS', 'Zurich Engineering': 'ZE', TÜV: 'TUV', 'In-house': 'OXM',
}

// A pack names its own certificates, and one that does replaces every table
// above together — a US ramp is not examined under LOLER or PSSR, and mixing
// one pack's types with another's validity periods is how an expiry date ends
// up contradicting the document it belongs to. `fallback` is the type for a
// unit its table does not name.
const PACK_CERTS = DOMAIN?.certificates?.byKind ? DOMAIN.certificates : null
const CERTS_FOR = PACK_CERTS ? PACK_CERTS.byKind : CERT_BY_ASSET_TYPE
const CERT_FALLBACK = PACK_CERTS?.fallback ? [PACK_CERTS.fallback] : ['Thorough examination']
const VALIDITY = PACK_CERTS ? PACK_CERTS.validityDays : CERT_VALIDITY_DAYS
const ISSUERS = PACK_CERTS ? PACK_CERTS.issuers : CERT_ISSUERS
const TYPE_CODE = PACK_CERTS ? PACK_CERTS.codes : CERT_CODE
const ISSUER_CODES = PACK_CERTS ? PACK_CERTS.issuerCodes : ISSUER_CODE

// The types the register can hold, in the order a filter should offer them.
export const CERT_TYPES = PACK_CERTS
  ? Object.keys(VALIDITY)
  : ['Statutory examination (LOLER)', 'Pressure vessel (PSSR)', 'Calibration certificate', 'Electrical installation (EICR)', 'Thorough examination']

// Every fifth asset rather than the first twenty-six. The register is ordered by
// creation, so the head of it clusters on one site and one site's renewals would
// carry the whole expiry chart.
export const CERTIFICATES = ASSETS.filter((_, i) => i % 5 === 0).map((asset, i) => {
  const k = `cert-${i}`
  const type = pick(k + 'ty', CERTS_FOR[asset.asset_type] || CERT_FALLBACK)
  // Renewals land across the coming year with a short tail already behind us.
  // A register where nothing has lapsed gives the expiry column nothing to say,
  // and one where a fifth of it has lapsed describes a site that would be shut.
  const expiry = between(k + 'exp', -34, 340)
  const expiryDate = daysFrom(expiry)
  const issuer = pick(k + 'iss', ISSUERS[type])
  return {
    certificate_id: `cert_${String(i + 1).padStart(4, '0')}`,
    certificate_type: type,
    asset_id: asset.asset_id,
    asset_name: asset.asset_name,
    asset_code: asset.asset_code,
    site_id: asset.site_id,
    site_name: asset.site_name,
    issued_by: issuer,
    issued_date: daysFrom(expiry - VALIDITY[type]),
    expiry_date: expiryDate,
    reference: `${ISSUER_CODES[issuer]}/${TYPE_CODE[type]}/${between(k + 'ref', 10000, 99999)}`,
    // Thirty days is the window the renewal is booked in, so it is the window
    // this screen has to shout about — a certificate that expires the week
    // after next and one that expires next spring are not the same problem.
    status: isPast(expiryDate) ? 'Expired' : daysUntil(expiryDate) < 30 ? 'Expiring Soon' : 'Valid',
  }
})

// ── lockout / tagout / tryout ────────────────────────────────────────────
// Ordered by what must be isolated first, so a shorter procedure is the head of
// the list rather than an arbitrary subset of it. Every powered machine starts
// at the electrical isolation; the secondary and stored energies are what
// separate a two-lock job from a five-lock one.
const ENERGY_BY_ASSET_TYPE = {
  'Air Compressor': ['Electrical — MCC panel', 'Pneumatic — air receiver', 'Thermal — aftercooler'],
  'Hydraulic Press': ['Electrical — MCC panel', 'Hydraulic — pump isolation', 'Gravity — platen support'],
  Conveyor: ['Electrical — MCC panel', 'Pneumatic — air supply', 'Gravity — inclined section'],
  Chiller: ['Electrical — MCC panel', 'Chemical — refrigerant circuit', 'Hydraulic — glycol pump'],
  Boiler: ['Electrical — MCC panel', 'Thermal — steam line', 'Chemical — dosing line'],
  Pump: ['Electrical — MCC panel', 'Hydraulic — pump isolation', 'Stored energy — accumulator'],
  Gearbox: ['Electrical — MCC panel', 'Stored energy — rotating mass', 'Hydraulic — lube circuit'],
  Extruder: ['Electrical — MCC panel', 'Thermal — barrel heaters', 'Hydraulic — screen changer'],
  Forklift: ['Electrical — battery isolator', 'Hydraulic — mast circuit', 'Gravity — raised forks'],
  'Cooling Tower': ['Electrical — MCC panel', 'Hydraulic — circulating pump', 'Chemical — biocide dosing'],
}

// A pack's own energy table replaces this one outright. There is no MCC panel
// on a ramp, so the generic fallback would be wrong for every unit it caught.
const ENERGY_FOR = DOMAIN?.energySources?.byKind || ENERGY_BY_ASSET_TYPE
const ENERGY_FALLBACK = DOMAIN?.energySources?.fallback || ['Electrical — MCC panel']

// Low-criticality plant is deliberately absent. Writing a formal isolation
// procedure for every hand tool on site is how a LOTOTO programme dies, and a
// register padded with them tells a supervisor nothing about which machines
// actually need a permit and a padlock.
export const LOTOTO = ASSETS
  .filter((a) => a.criticality !== 'Low')
  .filter((_, i) => i % 4 === 0)
  .slice(0, 18)
  .map((asset, i) => {
    const k = `loto-${i}`
    const pool = ENERGY_FOR[asset.asset_type] || ENERGY_FALLBACK
    const sources = pool.slice(0, pick(k + 'n', [1, 2, 2, 2, 3, 3]))
    // At least one lock per energy source, and usually more — a single hydraulic
    // isolation is a valve, a drain and a gauge. Fewer points than sources would
    // describe a procedure that leaves something live.
    const points = sources.length + between(k + 'ip', 1, 4)
    const verified = -between(k + 'lv', 15, 430)
    return {
      procedure_id: `loto_${String(i + 1).padStart(4, '0')}`,
      asset_id: asset.asset_id,
      asset_name: asset.asset_name,
      asset_code: asset.asset_code,
      site_id: asset.site_id,
      site_name: asset.site_name,
      energy_sources: sources,
      isolation_points: points,
      steps: points * 2 + between(k + 'st', 2, 6),
      last_verified: daysFrom(verified),
      verified_by_name: pick(k + 'vb', AUTHORISED).name,
      // Derived from the verification date rather than drawn, so the list can
      // never show a procedure signed off last week sitting under review — the
      // annual re-verification falling due is the only thing that puts it there.
      status: verified < -365 ? 'Under Review' : 'Approved',
    }
  })

// ── safety clearances ────────────────────────────────────────────────────
// Against live work only. A clearance is the document that hands isolated plant
// to the people working on it, so one that points at a finished job is either a
// clerical error or an isolation nobody removed.
export const CLEARANCES = WORK_ORDERS
  .filter((w) => OPEN_STATUS.includes(w.status))
  .filter((_, i) => i % 3 === 0)
  .slice(0, 12)
  .map((wo, i) => {
    const k = `clr-${i}`
    const isolated = pick(k + 'iso', AUTHORISED)
    // The person accepting a clearance may not be the person who isolated the
    // plant — that separation is the control, and two identical names in those
    // columns is the single most obvious thing wrong a safety officer could
    // find on this screen. Stepping along the register rather than redrawing
    // makes the collision impossible instead of merely unlikely.
    const accepted = AUTHORISED[(AUTHORISED.indexOf(isolated) + 1 + between(k + 'acc', 0, 3)) % AUTHORISED.length]
    const raised = daysUntil(wo.created_date)
    return {
      clearance_id: `clr_${String(i + 1).padStart(4, '0')}`,
      clearance_number: `SC-${600 + i}`,
      work_order_number: wo.work_order_number,
      asset_id: wo.asset_id,
      asset_name: wo.asset_name,
      site_id: wo.site_id,
      site_name: wo.site_name,
      isolated_by_name: isolated.name,
      accepted_by_name: accepted.name,
      // Clamped at both ends: a clearance cannot predate the work order that
      // justifies it, and it cannot be dated in the future.
      issued: daysFrom(Math.min(0, raised + between(k + 'is', 0, 3))),
      // Read off the work order rather than drawn, because on a plant the two
      // move together: work in hand means the isolation is still standing, and
      // a job on hold means the plant went back to production while it waits
      // for parts.
      status: wo.status === 'In Progress' ? 'Work in Progress'
        : wo.status === 'On Hold' ? 'Returned to Service' : 'Issued',
    }
  })

// ── the safety pyramid ───────────────────────────────────────────────────
// Twelve months of leading and lagging indicators. The shape is the point:
// observations outnumber near misses, near misses outnumber incidents, and
// lost-time is rare. A chart where those invert describes a site that only
// reports things after somebody is hurt, and that is the first thing a safety
// manager would notice about this screen.
export const EHS_TREND = TREND.map((t, i) => {
  const k = `ehs-tr-${i}`
  // The day is normalised before the month is shifted: on the 31st, setMonth()
  // rolls into the following month and a month's incidents get counted against
  // the wrong bar.
  const d = new Date(EPOCH)
  d.setDate(1)
  d.setMonth(d.getMonth() - (11 - i))
  const own = INCIDENTS.filter((n) => {
    const r = new Date(n.reported_date)
    return r.getFullYear() === d.getFullYear() && r.getMonth() === d.getMonth()
  })
  // The incident register only reaches back a few weeks, so the recent months
  // are counted from it and the older ones are drawn. Drawing all twelve would
  // let the last bar disagree with the list a manager clicks into, and that
  // disagreement is exactly what a demo cannot survive being asked about.
  const incidents = own.length || between(k + 'i', 0, 4)
  return {
    month: t.month,
    near_misses: Math.max(incidents + 3, between(k + 'n', 7, 19)),
    incidents,
    // Lost time is a subset of incidents and can never outrun them. The draw is
    // deliberately tight: a plant losing time most months is not a plant with a
    // safety programme, it is one waiting for an improvement notice.
    lost_time: own.length
      ? own.filter((n) => n.lost_time).length
      : Math.min(incidents, between(k + 'l', 0, 9) > 8 ? 1 : 0),
    observations: between(k + 'o', 34, 96),
  }
})
