'use client'

// People and documents for the data-center portal.
//
// The general CMMS has a Teams module and a Document Intelligence module; this
// brings both to this portal, on this estate's own data. The crews are the ones
// the work orders already assign to — Site Engineering at each hall, and the OEM
// and vendor partners that carry the specialist work — so a team's load is real:
// it is counted from the work orders assigned to that crew, not stored and left
// to drift. The rosters are this demo's people. The documents are the estate's
// own — O&M manuals, wiring diagrams, calibration certificates and commissioning
// reports, each tied to a real asset and its manufacturer, because on a data
// center the document library is primarily an asset library.

import { SITES } from './data'
import { FASM_ASSETS } from './data/fasm'

const siteName = (id) => SITES.find((s) => s.siteId === id)?.siteName || id

// ── Teams ────────────────────────────────────────────────────────────────────
// `crew` is the string the work orders assign to (matched as a substring, since
// a job can read "Site Engineering + Electrical Vendor"); `siteId` narrows a
// site crew to its own hall, and is null for a partner that works across the
// estate.
export const DC_TEAMS = [
  { team_id: 'DCT-01', team_name: 'Site Engineering — Ashburn', crew: 'Site Engineering', site_id: 'IAD35', discipline: 'Mechanical & Electrical', lead_name: 'Marcus Hale' },
  { team_id: 'DCT-02', team_name: 'Site Engineering — Franklin Park', crew: 'Site Engineering', site_id: 'ORD12', discipline: 'Mechanical & Electrical', lead_name: 'Priya Nair' },
  { team_id: 'DCT-03', team_name: 'Site Engineering — London', crew: 'Site Engineering', site_id: 'LHR10', discipline: 'Mechanical & Electrical', lead_name: 'Daniel Osei' },
  { team_id: 'DCT-04', team_name: 'Chiller & Mechanical OEM', crew: 'Chiller OEM', site_id: null, discipline: 'Cooling plant', lead_name: 'Ana Ribeiro' },
  { team_id: 'DCT-05', team_name: 'Electrical & Power Vendor', crew: 'Electrical Vendor', site_id: null, discipline: 'Power path', lead_name: 'Tom Whitfield' },
  { team_id: 'DCT-06', team_name: 'Battery & UPS Vendor', crew: 'Battery Vendor', site_id: null, discipline: 'DC power & storage', lead_name: 'Sofia Marchetti' },
  { team_id: 'DCT-07', team_name: 'Switchgear OEM', crew: 'Switchgear OEM', site_id: null, discipline: 'Switchgear & distribution', lead_name: 'Kenji Watanabe' },
  { team_id: 'DCT-08', team_name: 'Controls & BMS', crew: 'Controls', site_id: null, discipline: 'BMS / EPMS / DCIM', lead_name: 'Grace Adeyemi' },
]

// ── People ───────────────────────────────────────────────────────────────────
export const DC_PEOPLE = [
  { user_id: 'DCU-01', name: 'Marcus Hale', role: 'Lead Engineer', team_id: 'DCT-01', site_id: 'IAD35' },
  { user_id: 'DCU-02', name: 'Elena Vargas', role: 'Mechanical Technician', team_id: 'DCT-01', site_id: 'IAD35' },
  { user_id: 'DCU-03', name: 'Ryan Cole', role: 'Electrical Technician', team_id: 'DCT-01', site_id: 'IAD35' },
  { user_id: 'DCU-04', name: 'Priya Nair', role: 'Lead Engineer', team_id: 'DCT-02', site_id: 'ORD12' },
  { user_id: 'DCU-05', name: 'Jamal Brooks', role: 'Critical Facilities Technician', team_id: 'DCT-02', site_id: 'ORD12' },
  { user_id: 'DCU-06', name: 'Wei Chen', role: 'Controls Technician', team_id: 'DCT-02', site_id: 'ORD12' },
  { user_id: 'DCU-07', name: 'Daniel Osei', role: 'Lead Engineer', team_id: 'DCT-03', site_id: 'LHR10' },
  { user_id: 'DCU-08', name: 'Hannah Fischer', role: 'Mechanical Technician', team_id: 'DCT-03', site_id: 'LHR10' },
  { user_id: 'DCU-09', name: 'Ana Ribeiro', role: 'OEM Field Service Lead', team_id: 'DCT-04', site_id: null },
  { user_id: 'DCU-10', name: 'Luis Mendes', role: 'Chiller Specialist', team_id: 'DCT-04', site_id: null },
  { user_id: 'DCU-11', name: 'Tom Whitfield', role: 'Power Systems Engineer', team_id: 'DCT-05', site_id: null },
  { user_id: 'DCU-12', name: 'Nadia Haddad', role: 'HV Electrical Technician', team_id: 'DCT-05', site_id: null },
  { user_id: 'DCU-13', name: 'Sofia Marchetti', role: 'Battery Systems Engineer', team_id: 'DCT-06', site_id: null },
  { user_id: 'DCU-14', name: 'Arjun Rao', role: 'UPS Field Technician', team_id: 'DCT-06', site_id: null },
  { user_id: 'DCU-15', name: 'Kenji Watanabe', role: 'Switchgear Engineer', team_id: 'DCT-07', site_id: null },
  { user_id: 'DCU-16', name: 'Grace Adeyemi', role: 'BMS / Controls Lead', team_id: 'DCT-08', site_id: null },
  { user_id: 'DCU-17', name: 'Oliver Grant', role: 'DCIM Integration Analyst', team_id: 'DCT-08', site_id: null },
]

// ── Documents ────────────────────────────────────────────────────────────────
// A curated set tied to real assets on the register, plus per-asset O&M manuals
// generated across the estate so the library is not just the hand-picked few.
const DOC_TEMPLATES = [
  { suffix: 'O&M Manual', type: 'PDF', category: 'Manual', kb: 4820 },
  { suffix: 'Wiring / P&ID Diagram', type: 'DWG', category: 'Drawing', kb: 1360 },
  { suffix: 'Commissioning Report', type: 'PDF', category: 'Report', kb: 2140 },
  { suffix: 'Calibration Certificate', type: 'PDF', category: 'Certificate', kb: 380 },
  { suffix: 'Spare Parts List', type: 'XLSX', category: 'Spares', kb: 96 },
]

// Deterministic — no clock, no random — so the seed is identical on the server
// and the client. Dates walk back from a fixed anchor by the row index.
const anchor = new Date('2026-08-20')
const dateFor = (i) => new Date(anchor.getTime() - i * 6 * 86400e3).toISOString().slice(0, 10)

// One O&M manual per registered, in-scope asset from the scope matrix — the
// backbone of the library, spread across the four sites.
const perAsset = FASM_ASSETS.filter((a) => a._included).filter((_, i) => i % 3 === 0).map((a, i) => ({
  document_id: `DCDOC-M${String(i + 1).padStart(3, '0')}`,
  document_name: `${a.assetName} — O&M Manual`,
  document_type: 'PDF',
  category: 'Manual',
  asset_id: a.assetId,
  asset_name: a.assetName,
  manufacturer: a.manufacturer || '—',
  size_kb: 3200 + (i % 5) * 640,
  uploaded_by_name: DC_PEOPLE[i % DC_PEOPLE.length].name,
  created_date: dateFor(i),
  site_id: a.siteId,
}))

// A fuller document set on the estate's most critical assets.
const KEY_ASSETS = FASM_ASSETS.filter((a) => a._included && a.criticality === 'Critical').slice(0, 6)
const perKey = KEY_ASSETS.flatMap((a, ai) =>
  DOC_TEMPLATES.slice(1).map((t, ti) => ({
    document_id: `DCDOC-K${ai + 1}${ti + 1}`,
    document_name: `${a.assetName} — ${t.suffix}`,
    document_type: t.type,
    category: t.category,
    asset_id: a.assetId,
    asset_name: a.assetName,
    manufacturer: a.manufacturer || '—',
    size_kb: t.kb + ai * 40,
    uploaded_by_name: DC_PEOPLE[(ai + ti) % DC_PEOPLE.length].name,
    created_date: dateFor(perAsset.length + ai * 4 + ti),
    site_id: a.siteId,
  })))

export const DC_DOCUMENTS = [...perAsset, ...perKey]

export const DOC_TYPES = [...new Set(DC_DOCUMENTS.map((d) => d.document_type))]
export const DOC_CATEGORIES = [...new Set(DC_DOCUMENTS.map((d) => d.category))]

export { siteName }
