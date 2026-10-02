// DHL CVG GSE — the five-year dataset, shaped for the portal.
//
// The generated modules beside this file are the workbook's own rows. This file
// turns them into the records every screen already reads — an asset, a work
// order, a part — and is the only place that knows both vocabularies.
//
// DHL'S WORDS STAY ON THE RECORD. The portal's logic runs on its own values
// (Critical, On Hold, Completed); the evaluator reads their own ("P1-AOG / Gate
// Hold", "Parts Hold", "A-Aircraft Contact"). Both are kept: the portal field
// drives behaviour, and `dhl_*` carries what the sheet said, so nothing on
// screen is a translation a DHL reader has to translate back.
//
// DATES ARE SHIFTED, ONCE, HERE. The workbook ends on its as-of date. A demo given
// a month later would open on a register where nothing has happened for a month,
// so every date moves forward by the gap between that date and today — the
// same arrangement the DNA portal makes, for the same reason. The generated files
// are never shifted, so they stay comparable to the workbook line for line.
//
// A factory rather than module-level constants, because it needs the portal's
// clock and helpers from data.js, and data.js imports this file. Taking them as
// arguments is what keeps that from being a circular import.

import { META } from './meta'
import { ASSETS as RAW_ASSETS } from './assets'
import { USERS } from './users'
import { PARTS as RAW_PARTS } from './parts'
import { PM_STANDARDS } from './pmStandards'
import { MANUALS } from './manuals'
import { WORK_ORDERS as RAW_WORK_ORDERS } from './workOrders'
import { PURCHASE_ORDERS as RAW_PURCHASE_ORDERS } from './purchaseOrders'
import { STOCK_LEDGER } from './stockLedger'
import { generateVoiceVolumeWorkOrders, VOICE_VOLUME, HONESTY, DEMO_TECH } from './voiceVolume'
import { computeVoiceInsights } from './voiceInsights'
import { applyWaterfallSignals, computeWaterfall } from './voiceWaterfall'
import { pmHierarchyOf } from './pmHierarchy'

const DAY = 86400000
const HOUR = 3600000

const SITE = {
  site_id: 'site_01', site_name: 'CVG Americas Superhub', code: 'CVG',
  city: 'Erlanger KY', country: 'United States', is_default: true,
}

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// ── vocabularies ─────────────────────────────────────────────────────────
const PRIORITY = { P1: 'Critical', P2: 'High', P3: 'Medium', P4: 'Low' }
const priorityOf = (p) => PRIORITY[String(p).slice(0, 2)] || 'Medium'

// QA Review is work done and waiting for sign-off — not closed, so it stays in
// the backlog as in progress until it passes. Parts Hold is a hold.
const STATUS = { Closed: 'Completed', 'QA Review': 'In Progress', 'In Progress': 'In Progress', 'Parts Hold': 'On Hold', Assigned: 'Open' }

const CRITICALITY = { A: 'High', B: 'Medium', C: 'Low' }

// The portal's role words are what its approval and planning lists filter on;
// the job title is kept as the trade, which is what a person reads.
const ROLE = {
  'Maintenance Manager': 'Supervisor', 'GSE Supervisor': 'Supervisor',
  'Lead Technician': 'Technician', 'GSE Technician': 'Technician', 'Apprentice Technician': 'Technician',
  'Parts Clerk': 'Planner', 'Warranty / Reliability Analyst': 'Planner',
}
const roleOf = (title) => ROLE[title] || (/operator/i.test(title) ? 'Operator' : 'Technician')

const DOC_CATEGORY = {
  'OEM Service Manual': 'Manual', 'Operator Guide': 'Manual',
  'Wiring / Hydraulic Schema': 'Drawing', 'Parts Catalog': 'Spares',
}

// Calendar templates as a schedule reads them.
const CALENDAR = { 'PM-30D': [1, 'Months', 30], 'PM-60D': [2, 'Months', 60], 'PM-90D': [3, 'Months', 91], 'PM-ANN': [12, 'Months', 365] }

export function buildDataset(EPOCH, { between }) {
  // ── the clock ──────────────────────────────────────────────────────────
  const asOf = Date.UTC(+META.asOf.slice(0, 4), +META.asOf.slice(5, 7) - 1, +META.asOf.slice(8, 10), 6)
  const shiftDays = Math.max(0, Math.round((EPOCH - asOf) / DAY))
  const shift = (v) => {
    if (!v) return null
    const [d, t] = String(v).split(' ')
    const [y, m, dd] = d.split('-').map(Number)
    const [hh, mm] = t ? t.split(':').map(Number) : [6, 0]
    return new Date(Date.UTC(y, m - 1, dd, hh, mm) + shiftDays * DAY).toISOString()
  }
  const plus = (iso, days) => (iso ? new Date(new Date(iso).getTime() + days * DAY).toISOString() : null)

  // ── people ─────────────────────────────────────────────────────────────
  const userById = new Map(USERS.map((u) => [u.UserID, u]))
  const nameOf = (id) => userById.get(id)?.Name || ''
  const technicians = USERS.map((u) => ({
    user_id: u.UserID,
    name: u.Name,
    role: roleOf(u.Role),
    trade: u.Role,
    job_title: u.Role,
    shift: u.ShiftDefault,
    hourly_rate: Number(u.HourlyRate) || null,
    hire_date: shift(u.HireDate),
    certifications: u.Certifications,
    status: u.Status,
  }))

  // One crew per shift, led by that shift's lead technician, and the stores.
  const teams = ['Days', 'Swing', 'Nights'].map((s, i) => {
    const crew = USERS.filter((u) => u.ShiftDefault === s && /Technician/.test(u.Role))
    const lead = crew.find((u) => u.Role === 'Lead Technician') || crew[0]
    return { team_id: `tm_0${i + 1}`, team_name: `${s} shift crew`, lead_name: lead?.Name || '', members: crew.length, site_id: SITE.site_id }
  })
  const clerks = USERS.filter((u) => u.Role === 'Parts Clerk')
  teams.push({ team_id: 'tm_04', team_name: 'Parts & Stores', lead_name: clerks[0]?.Name || '', members: clerks.length, site_id: SITE.site_id })

  // ── locations ──────────────────────────────────────────────────────────
  const zones = [...new Set(RAW_ASSETS.map((a) => a.LocationZone).filter(Boolean))].sort()
  const locations = zones.map((z) => ({
    functional_location_id: `zone-${slug(z)}`, name: z, site_id: SITE.site_id, parent_id: null, level: 1,
  }))
  const zoneId = (z) => `zone-${slug(z)}`

  // ── assets ─────────────────────────────────────────────────────────────
  const hoursPerYear = new Map((META.fleet || []).map((f) => [f.EquipmentType, Number(f.TypicalHoursPerYear) || 0]))
  const assets = RAW_ASSETS.map((a) => {
    const h = a._history || {}
    const hoursMeter = a.MeterType === 'Hours'
    const oos = a.Status === 'Out of Service'
    // Derived from the unit's own record, never drawn: breakdowns in the last
    // year and come-backs pull it down, a unit already out of service or due
    // its PM starts lower.
    const health = Math.max(45, Math.min(99, 98
      - (h.unscheduled12m || 0) * 6 - (h.comebacks5y || 0) * 4
      - (a.Status === 'PM Due' ? 8 : 0) - (oos ? 20 : 0)))
    return {
      asset_id: a.AssetID,
      asset_code: a.AssetID,
      asset_name: `${a.EquipmentType} ${a.AssetID.slice(-4)}`,
      asset_type: a.EquipmentType,
      manufacturer: a.Manufacturer,
      model: a.Model,
      serial_number: a.SerialNumber,
      site_id: SITE.site_id,
      site_name: SITE.site_name,
      functional_location_id: zoneId(a.LocationZone),
      functional_location_name: a.LocationZone,
      criticality: CRITICALITY[String(a.Criticality).charAt(0)] || 'Low',
      status: oos ? 'Down' : 'Operational',
      health_score: health,
      purchase_date: shift(a.InServiceDate),
      warranty_expiry: shift(a.WarrantyEndDate),
      last_maintenance_date: shift(h.lastClosed) || null,
      next_maintenance_date: null,
      running_hours: hoursMeter ? Number(a.CurrentMeter) || 0 : null,
      iot_enabled: h.lastReading?.source === 'Telematics',

      dhl_class: a.Class,
      dhl_status: a.Status,
      dhl_criticality: a.Criticality,
      power_source: a.PowerSource,
      acquisition_cost: Number(a.AcquisitionCostUSD) || null,
      meter_type: a.MeterType,
      current_meter: Number(a.CurrentMeter) || 0,
      pm_hours_interval: Number(a.PMHoursInterval) || null,
      assigned_shop: a.AssignedShop,
      sap_equipment: a.SAPEquipment,
      sap_functional_location: a.FunctLocation,
      sap_planning_plant: a.PlanningPlant,
      sap_work_center: a.WorkCenter,
      sap_cost_center: a.CostCenter,
      sap_company_code: a.CompanyCode,
      sap_object_type: 'GSE',
      pm_hierarchy: pmHierarchyOf(a),
      manual_doc_id: a.ManualDocID,
      represents_fleet_count: Number(a.RepresentsFleetCount) || null,
      hours_per_year: hoursPerYear.get(a.EquipmentType) || null,
      last_reading_date: shift(h.lastReading?.date),
      last_reading_source: h.lastReading?.source || '',
      history: {
        work_orders_5y: h.workOrders5y || 0,
        cost_5y: h.cost5y || 0,
        downtime_hours_5y: h.downtime5y || 0,
        comebacks_5y: h.comebacks5y || 0,
        unscheduled_12m: h.unscheduled12m || 0,
        oos_events_12m: h.oosEvents12m || 0,
        oos_hours_12m: h.oosHours12m || 0,
      },
    }
  })
  const assetById = new Map(assets.map((a) => [a.asset_id, a]))
  const rawById = new Map(RAW_ASSETS.map((a) => [a.AssetID, a]))

  // ── work orders ────────────────────────────────────────────────────────
  const templateById = new Map(PM_STANDARDS.map((t) => [t.TemplateID, t]))
  const DUE_HOURS = { Critical: 4, High: 8, Medium: 7 * 24, Low: 30 * 24 }
  const mapProcurement = (p, shiftFn) => {
    if (!p) return null
    const stamp = (doc) => (doc ? { ...doc, created_at: shiftFn(doc.created_at) || doc.created_at, posted_at: shiftFn(doc.posted_at) || doc.posted_at || null } : null)
    return {
      reservation: p.reservation || null,
      notification: p.notification || null,
      pr: stamp(p.pr),
      po: stamp(p.po),
      gr: stamp(p.gr),
      chain_status: p.chain_status || null,
    }
  }
  const mapWorkOrder = (w) => {
    const asset = assetById.get(w.AssetID)
    const tpl = w.TemplateID ? templateById.get(w.TemplateID) : null
    const title = w.FailureDesc || tpl?.Description || 'Preventive maintenance'
    const priority = priorityOf(w.Priority)
    const created = shift(w.CreatedAt)
    const closed = w.Status === 'Closed'
    return {
      workorder_id: w.WorkOrderID,
      work_order_number: w.WorkOrderID,
      title,
      description: `${title} — ${w.EquipmentType} ${w.AssetID} (${w.Manufacturer}) at ${w.LocationZone}, ${w.Shift} shift.`,
      status: STATUS[w.Status] || 'Open',
      priority,
      work_order_type: w.Type === 'Preventive' ? 'Preventive' : 'Corrective',
      asset_id: w.AssetID,
      asset_name: asset?.asset_name || w.AssetID,
      asset_code: w.AssetID,
      site_id: SITE.site_id,
      site_name: SITE.site_name,
      location_name: w.LocationZone,
      assigned_to_id: w.AssignedTo || '',
      assigned_to_name: nameOf(w.AssignedTo) || (w.AssignedTo === DEMO_TECH.tech_id ? DEMO_TECH.name : ''),
      lead_tech_name: nameOf(w.LeadTech) || (w.LeadTech === DEMO_TECH.tech_id ? DEMO_TECH.name : ''),
      requested_by_name: nameOf(w.RequestedBy),
      created_by_name: nameOf(w.RequestedBy),
      created_date: created,
      due_date: new Date(new Date(created).getTime() + DUE_HOURS[priority] * HOUR).toISOString(),
      // The sheet has no separate start stamp; its labour lines open when the job
      // is raised, so anything past Assigned started then.
      started_date: w.Status === 'Assigned' ? null : created,
      completed_date: closed ? shift(w.ClosedAt) : null,
      estimated_hours: Number(w.EstHours) || null,
      actual_hours: Number(w.LaborHours) || null,
      labour_cost: Number(w.LaborCostUSD) || 0,
      parts_cost: Number(w.PartsCostUSD) || 0,
      total_cost: Number(w.TotalCostUSD) || 0,
      downtime_hours: Number(w.DowntimeHours) || 0,

      dhl_status: w.Status,
      dhl_priority: w.Priority,
      dhl_type: w.Type,
      template_id: w.TemplateID,
      failure_code: w.FailureCode,
      system: w.System,
      shift: w.Shift,
      meter_at_open: Number(w.MeterAtOpen) || null,
      out_of_service: w.OutOfService === 'Yes',
      comeback: w.Comeback === 'Yes',
      parent_wo: w.ParentWO,
      warranty_warning: w.WarrantyWarning === 'Yes',
      quality_flag: w.QualityFlag,
      quality: w.Quality ? { ...w.Quality } : null,
      airline_audit_pack: w.AirlineAuditPack === 'Yes',
      sap_order: w.SAPOrder,
      sap_notification: w.SAPNotif,
      sap_reservation: w.SAPReserv,
      sap_order_type: w.OrderType,
      sap_equipment: w.SAPEquip,
      sap_functional_location: w.FunctLocation,
      sap_work_center: w.WorkCenter,
      sap_cost_center: w.CostCenter,
      sap_plant: w.Plant,
      synthetic: Boolean(w._synthetic),
      voice_volume: Boolean(w._voiceVolume),
      voice_week: Boolean(w._voiceWeek),
      demo_tech: Boolean(w._demoTech),
      parts_needed: Array.isArray(w.PartsNeeded) ? w.PartsNeeded.map((p) => ({ ...p })) : [],
      procurement: mapProcurement(w.Procurement, shift),
      pm_hierarchy: asset?.pm_hierarchy || null,
      waterfall: w.Waterfall || null,
      origin: w.Origin || (w.Type === 'Preventive' ? 'plan' : 'notification'),
      planned_start: w.PlannedStart ? shift(w.PlannedStart) : null,
      planned_finish: w.PlannedFinish ? shift(w.PlannedFinish) : null,
      scope_variation: w.ScopeVariation === 'Yes',
      variation_note: w.VariationNote || '',
      archived: w.Archived === 'Yes',
      archived_at: w.ArchivedAt ? shift(w.ArchivedAt) : null,
      planning: w.Planning || null,
    }
  }
  const historicWorkOrders = RAW_WORK_ORDERS.map(mapWorkOrder)

  // Current month at Superhub throughput (~1,600 / month, ~400 / week). The
  // workbook year is too light for the voice stage questions; this overlay is
  // the live/current register those answers come from. Dates are in workbook
  // time so the same shift as the extract keeps them on "today".
  const voiceRaw = generateVoiceVolumeWorkOrders({ asOf: META.asOf, assets: RAW_ASSETS })
  applyWaterfallSignals(voiceRaw)
  const voiceProjection = voiceRaw.map(mapWorkOrder)
  const historicIds = new Set(historicWorkOrders.map((w) => w.workorder_id))
  const voiceNew = voiceProjection.filter((w) => !historicIds.has(w.workorder_id))
  const voiceThisWeek = voiceNew.filter((w) => w.voice_week)
  // Portal list: workbook live register plus this week's projection, so the
  // Work Orders screen feels like a 400-job week without shipping the full
  // 1,600-row month to every client screen.
  const workOrders = [...voiceThisWeek, ...historicWorkOrders]

  // ── vendors, parts, purchase orders ────────────────────────────────────
  const vendorNames = [...new Set([
    ...RAW_PARTS.flatMap((p) => [p.PreferredVendor, p.AltVendor]),
    ...RAW_PURCHASE_ORDERS.map((p) => p.Vendor),
  ].filter(Boolean))].sort()
  const leadTimes = new Map()
  for (const p of RAW_PURCHASE_ORDERS) {
    if (!p.ReceivedDate || !p.CreatedDate) continue
    const d = Math.round((Date.parse(p.ReceivedDate) - Date.parse(p.CreatedDate)) / DAY)
    const list = leadTimes.get(p.Vendor) || []
    list.push(d)
    leadTimes.set(p.Vendor, list)
  }
  const vendors = vendorNames.map((name, i) => {
    const lt = leadTimes.get(name)
    return {
      vendor_id: `VEN-${String(i + 1).padStart(3, '0')}`,
      vendor_name: name,
      contact_name: 'Order desk',
      email: `orders@${slug(name).split('-').slice(0, 2).join('')}.example`,
      phone: `+1 859 ${between(`dhl-ven-${name}`, 200, 999)} ${between(`dhl-ven2-${name}`, 1000, 9999)}`,
      payment_terms: 'Net 30',
      lead_time_days: lt ? Math.round(lt.reduce((n, x) => n + x, 0) / lt.length) : 7,
      status: 'Active',
    }
  })
  const vendorId = new Map(vendors.map((v) => [v.vendor_name, v.vendor_id]))

  const parts = RAW_PARTS.map((p) => {
    const qoh = Number(p.QtyOnHand) || 0
    const reorder = Number(p.ReorderPoint) || 0
    const cost = Number(p.StdCostUSD) || Number(p.OEMUnitCostUSD) || 0
    return {
      part_id: p.PartID,
      part_number: p.SKU,
      part_name: p.Description,
      category: p.Category,
      unit: p.UOM,
      quantity_on_hand: qoh,
      minimum_quantity: Number(p.MinQty) || 0,
      reorder_point: reorder,
      maximum_quantity: Number(p.MaxQty) || null,
      quantity_on_order: Number(p.QtyOnOrder) || 0,
      unit_cost: cost,
      oem_unit_cost: Number(p.OEMUnitCostUSD) || null,
      alt_unit_cost: Number(p.AltVendorUnitCostUSD) || null,
      total_value: Math.round(qoh * cost * 100) / 100,
      storage_location: p.BinLocation,
      site_id: SITE.site_id,
      vendor_id: vendorId.get(p.PreferredVendor) || '',
      vendor_name: p.PreferredVendor,
      alt_vendor_name: p.AltVendor,
      applicable_types: p.ApplicableTypes,
      warranty_months: Number(p.WarrantyMonths) || null,
      typical_life_days: Number(p.TypicalLifeDays) || null,
      last_count_date: shift(p.LastCountDate),
      status: qoh === 0 ? 'Out of Stock' : qoh <= reorder ? 'Low Stock' : 'In Stock',

      sap_material: p.SAPMaterial,
      sap_plant: p.Plant,
      storage_location: p.StorageLoc,
      valuation_class: p.ValuationClass,
      moving_avg_price: Number(p.MovingAvgPrice) || null,
      abc_class: p.ABC,
      mrp_type: p.MRPType,
      material_type: p.MaterialType,
      // What is actually available, what is held for inspection, what is
      // blocked. A single on-hand figure hides the third of these, and a part
      // in blocked stock is not a part a technician can fit tonight.
      unrestricted_qty: Number(p.UnrestrictedQty) || 0,
      quality_insp_qty: Number(p.QualityInspQty) || 0,
      blocked_qty: Number(p.BlockedQty) || 0,
    }
  })
  const partById = new Map(parts.map((p) => [p.part_id, p]))

  const purchaseOrders = RAW_PURCHASE_ORDERS.map((p) => {
    const lines = (p.Lines || []).map((l) => ({
      part_id: l.PartID,
      part_name: l.Description,
      part_number: l.SKU,
      unit: partById.get(l.PartID)?.unit || 'EA',
      quantity: Number(l.QtyOrdered) || 0,
      quantity_received: Number(l.QtyReceived) || 0,
      unit_cost: Number(l.UnitCostUSD) || 0,
      line_value: Number(l.ExtCostUSD) || 0,
      need_by: shift(l.NeedBy),
    }))
    const needBy = lines.map((l) => l.need_by).filter(Boolean).sort().pop() || null
    return {
      purchase_order_id: p.PurchaseOrderID,
      po_number: p.PurchaseOrderID,
      vendor_id: vendorId.get(p.Vendor) || '',
      vendor_name: p.Vendor,
      // An open PO here has been placed and is waiting on delivery.
      status: p.Status === 'Received' ? 'Received' : 'Approved',
      dhl_status: p.Status,
      line_items: Number(p.LineCount) || lines.length,
      total_amount: Number(p.TotalUSD) || 0,
      created_date: shift(p.CreatedDate),
      expected_date: needBy,
      received_date: shift(p.ReceivedDate),
      raised_by_name: nameOf(p.RequestedBy),
      site_id: SITE.site_id,
      receiving_location: p.ReceivingLocation,
      notes: p.Notes,
      lines,
      sap_po: p.SAPPO,
      sap_company_code: p.CompCode,
      sap_purch_org: p.PurchOrg,
      sap_purch_group: p.PurchGroup,
      sap_plant: p.Plant,
      sap_vendor: p.VendorSAP,
      sap_doc_type: p.DocType,
    }
  }).sort((x, y) => String(y.created_date).localeCompare(String(x.created_date)))

  // ── PM schedules: one per unit, from its own service history ───────────
  //
  // A unit with an hour interval runs on its meter, at that interval, measured
  // from the meter reading on its last service of that kind. Everything else
  // runs on the calendar template it has actually been serviced under most.
  const pmSchedules = RAW_ASSETS.map((raw) => {
    const a = assetById.get(raw.AssetID)
    const h = raw._history || {}
    const assignee = nameOf(h.topPreventiveAssignee) || technicians.find((t) => t.role === 'Technician')?.name || ''
    const interval = Number(raw.PMHoursInterval) || 0
    if (raw.MeterType === 'Hours' && interval) {
      const tplId = interval >= 500 ? 'PM-500H' : 'PM-250H'
      const tpl = templateById.get(tplId)
      const last = h.pmLast?.[tplId]
      const current = Number(raw.CurrentMeter) || 0
      const meterAtLast = last?.meter ?? Math.max(0, current - Math.round(interval / 2))
      const perDay = (a.hours_per_year || 365) / 365
      const remaining = interval - (current - meterAtLast)
      const lastGenerated = shift(last?.at) || plus(new Date(EPOCH).toISOString(), -60)
      return {
        schedule_id: `PMS-${raw.AssetID}`,
        schedule_name: `${interval}-hour service — ${tpl?.Description?.replace(/^\d+-hour\s*/i, '') || 'engine / drivetrain'}`,
        template_id: tplId,
        asset_id: a.asset_id, asset_name: a.asset_name, asset_code: a.asset_code,
        site_id: SITE.site_id, site_name: SITE.site_name,
        frequency_type: 'Meter', frequency_value: 12, frequency_unit: 'Months',
        meter_interval: interval,
        meter_at_last: meterAtLast,
        last_generated: lastGenerated,
        next_due: new Date(EPOCH + Math.round(remaining / Math.max(0.1, perDay)) * DAY).toISOString(),
        assigned_to_name: assignee,
        estimated_hours: Number(tpl?.StdHours) || 3.5,
        status: raw.Status === 'Seasonal Storage' ? 'Paused' : 'Active',
      }
    }
    const counts = Object.entries(h.pmCount || {}).filter(([t]) => CALENDAR[t]).sort((x, y) => y[1] - x[1])
    const tplId = counts[0]?.[0] || 'PM-ANN'
    const [value, unit, days] = CALENDAR[tplId]
    const tpl = templateById.get(tplId)
    const lastGenerated = shift(h.pmLast?.[tplId]?.at) || plus(new Date(EPOCH).toISOString(), -Math.round(days / 2))
    return {
      schedule_id: `PMS-${raw.AssetID}`,
      schedule_name: tpl?.Description || 'Calendar inspection',
      template_id: tplId,
      asset_id: a.asset_id, asset_name: a.asset_name, asset_code: a.asset_code,
      site_id: SITE.site_id, site_name: SITE.site_name,
      frequency_type: 'Time', frequency_value: value, frequency_unit: unit,
      meter_interval: null, meter_at_last: null,
      last_generated: lastGenerated,
      next_due: plus(lastGenerated, days),
      assigned_to_name: assignee,
      estimated_hours: Number(tpl?.StdHours) || 1,
      status: raw.Status === 'Seasonal Storage' ? 'Paused' : 'Active',
    }
  })
  // Each asset's next service, from the schedule that now exists for it.
  for (const s of pmSchedules) {
    const a = assetById.get(s.asset_id)
    if (a) a.next_maintenance_date = s.next_due
  }

  // ── manuals, as the document register ──────────────────────────────────
  const documents = MANUALS.map((m) => {
    const filed = RAW_ASSETS.find((a) => a.ManualDocID === m.ManualDocID)
      || RAW_ASSETS.find((a) => a.EquipmentType === m.EquipmentType && a.Manufacturer === m.Manufacturer)
    const asset = filed ? assetById.get(filed.AssetID) : null
    return {
      document_id: m.ManualDocID,
      document_name: `${m.DocType} — ${m.Manufacturer} ${m.Model}`,
      document_type: 'PDF',
      category: DOC_CATEGORY[m.DocType] || 'Manual',
      asset_id: asset?.asset_id || '',
      asset_name: asset?.asset_name || '',
      asset_type: m.EquipmentType,
      manufacturer: m.Manufacturer,
      model: m.Model,
      revision: m.Revision,
      file_ref: m.FileRef,
      available_to_techs: m.AvailableToTechs === 'Yes',
      size_kb: between(`dhl-man-${m.ManualDocID}`, 800, 14000),
      uploaded_by_name: 'Technical library',
      created_date: plus(new Date(EPOCH).toISOString(), -between(`dhl-man-age-${m.ManualDocID}`, 60, 1400)),
      site_id: SITE.site_id,
    }
  })

  // ── the detail behind one work order, loaded when it is opened ─────────
  //
  // Its own chunk. Labour lines, parts, notes and out-of-service entries for 631
  // jobs is more than any list screen needs, so the work order page asks for it
  // and every other page never downloads it. Loaded once, then shaped per job.
  let detailModule = null
  const loadWorkOrderDetail = async (id) => {
    if (!detailModule) detailModule = await import('./workOrderDetail')
    const d = detailModule.WORK_ORDER_DETAIL[String(id)]
    if (!d) return null
    const brief = (w) => (w ? {
      id: w.WorkOrderID,
      created: shift(w.CreatedAt),
      title: w.FailureDesc || templateById.get(w.TemplateID)?.Description || 'Preventive maintenance',
      dhl_status: w.Status,
      type: w.Type,
      in_register: RAW_WORK_ORDERS.some((x) => x.WorkOrderID === w.WorkOrderID),
    } : null)
    return {
      labour: d.Labor.map((l) => ({
        id: l.LaborID, user_id: l.UserID, name: l.Name || nameOf(l.UserID), role: l.Role, shift: l.Shift,
        hours: Number(l.Hours) || 0, rate: Number(l.HourlyRate) || 0, cost: Number(l.LaborCostUSD) || 0,
        start: shift(l.TimeStart), stop: shift(l.TimeStop),
        scheduled_hours: Number(l.ScheduledHoursThatDay) || null,
      })),
      parts: d.Parts.map((p) => ({
        id: p.WOPartID, part_id: p.PartID, part_number: p.SKU, part_name: p.Description,
        quantity: Number(p.Qty) || 0, unit_cost: Number(p.UnitCostUSD) || 0, ext_cost: Number(p.ExtCostUSD) || 0,
        vendor: p.Vendor, kit_id: p.KitID, installed: shift(p.InstallDate),
        warranty_months: Number(p.WarrantyMonths) || null, repeat_install: p.RepeatInstallFlag === 'Yes',
      })),
      notes: d.Notes.map((n) => ({
        id: n.NoteID, at: shift(n.NoteTime), author: nameOf(n.UserID) || n.UserID, type: n.NoteType, text: n.NoteText,
      })).sort((x, y) => String(x.at).localeCompare(String(y.at))),
      oos: d.OOS.map((o) => ({
        id: o.OOSID, start: shift(o.OOSStart), end: shift(o.OOSEnd), reason: o.Reason,
        shown_in_system: o.ShownInSystem === 'Yes', ramp_control_notified: o.RampControlNotified === 'Yes',
        hours: o.OOSStart && o.OOSEnd
          ? Math.round((Date.parse(`${o.OOSEnd.replace(' ', 'T')}:00Z`) - Date.parse(`${o.OOSStart.replace(' ', 'T')}:00Z`)) / 360000) / 10
          : null,
      })),
      parent: brief(d.Parent),
      parent_after_child: Boolean(d.ParentAfterChild),
      children: (d.Children || []).map((c) => ({ ...brief(c), parent_after_child: Boolean(c.ParentAfterChild) })),
    }
  }

  // ── parts, warranty, stores and people, loaded by those four screens ───
  //
  // Its own chunk, like the work order detail: kits, claims, recovery
  // candidates, five years of cycle counts and the labour KPI table are read by
  // four screens and nothing else. Shaped here into the portal's vocabulary, with
  // dates on the demo's calendar and people by name.
  let analytics = null
  const liveIds = new Set(RAW_WORK_ORDERS.map((w) => w.WorkOrderID))
  const assetNameOf = (id) => assets.find((a) => a.asset_id === id)?.asset_name || id
  const loadGseAnalytics = async () => {
    if (analytics) return analytics
    const { ANALYTICS: A } = await import('./analytics')
    const part = (id) => partById.get(id) || null
    // Months move with the portal's calendar by whole months; years are summed
    // from the moved months, so a partial first and last year say so.
    const monthShift = Math.round(shiftDays / 30.4375)
    const moveMonth = (key) => {
      const [y, m] = key.split('-').map(Number)
      return new Date(Date.UTC(y, m - 1 + monthShift, 1)).toISOString().slice(0, 7)
    }
    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const fyMonths = A.fiveYear.months.map((m) => {
      const key = moveMonth(m.m)
      return { ...m, m: key, year: Number(key.slice(0, 4)), label: `${MONTH_NAMES[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}` }
    })
    const fyYears = []
    for (const m of fyMonths) {
      let y = fyYears.find((x) => x.year === m.year)
      if (!y) { y = { year: m.year, months: 0 }; fyYears.push(y) }
      y.months += 1
      for (const [k, v] of Object.entries(m)) if (typeof v === 'number' && k !== 'year') y[k] = Math.round(((y[k] || 0) + v) * 100) / 100
    }

    // The five-year findings, and the 2027-2031 plan. The plan rows are targets
    // the workbook states as targets; they are passed through as written so the
    // screen can label them that way and never as a second history.
    const insights = A.insights
    const plan = A.plan
    analytics = {
      insights: {
        technicians: insights.technicians,
        technicianYears: insights.technicianYears,
        oemType: insights.oemType,
        oemNightBank: insights.oemNightBank,
        pmBands: insights.pmBands,
        stableOwner: insights.stableOwner,
        assetYears: insights.assetYears,
        abc: insights.abc,
        stockPath: insights.stockPath.map((m) => ({ ...m, Month: moveMonth(String(m.Month).slice(0, 7)) })),
      },
      plan: {
        ...plan,
        techVoice: plan.techVoice.map((v) => ({ ...v, NoteTime: shift(v.NoteTime) })),
      },
      fiveYear: {
        ...A.fiveYear,
        months: fyMonths,
        years: fyYears,
        fleet: {
          ...A.fiveYear.fleet,
          topUnits: A.fiveYear.fleet.topUnits.map((u) => ({ ...u, asset_name: assetNameOf(u.AssetID) })),
        },
      },
      targets: A.targets,
      stats: A.stats,
      quarters: A.quarters,
      kits: A.kits.map((k) => ({
        id: k.KitID, name: k.KitName, type: k.KitType, issued5y: k.Issued5y, issued12m: k.Issued12m,
        lines: k.Lines.map((l) => {
          const x = part(l.PartID)
          return {
            part_id: l.PartID, part_number: l.SKU, part_name: x?.part_name || l.SKU, unit: x?.unit || 'EA', qty: l.Qty,
            oem_unit_cost: x?.oem_unit_cost || 0, alt_unit_cost: x?.alt_unit_cost || x?.oem_unit_cost || 0,
            on_hand: x?.quantity_on_hand ?? 0, vendor_name: x?.vendor_name || '', alt_vendor_name: x?.alt_vendor_name || '',
          }
        }),
      })),
      claims: A.claims.map((c) => ({
        claim_id: c.ClaimID, work_order_id: c.WorkOrderID, in_register: liveIds.has(c.WorkOrderID),
        asset_id: c.AssetID, asset_name: assetNameOf(c.AssetID),
        part_id: c.PartID, part_number: c.SKU, part_name: part(c.PartID)?.part_name || c.SKU,
        claim_date: shift(c.ClaimDate), vendor: c.Vendor, reason: c.Reason, status: c.Status,
        amount: Number(c.ClaimAmountUSD) || 0, credit: Number(c.CreditReceivedUSD) || 0,
        analyst: nameOf(c.AnalystUserID) || c.AnalystUserID, oem_ref: c.OEMRef,
      })),
      candidates: A.candidates.map((c) => ({
        id: `${c.WorkOrderID}|${c.PartID || 'unit'}`,
        kind: c.Kind, work_order_id: c.WorkOrderID, in_register: liveIds.has(c.WorkOrderID),
        asset_id: c.AssetID, asset_name: assetNameOf(c.AssetID),
        part_id: c.PartID, part_number: c.SKU, description: c.Description,
        vendor: c.Vendor, channel: c.Channel,
        installed: shift(c.InstallDate), previous_installed: shift(c.PrevInstallDate),
        previous_work_order_id: c.PrevWorkOrderID, days_in_service: c.DaysInService,
        warranty_months: c.WarrantyMonths, warranty_end: shift(c.WarrantyEndDate), typical_life_days: c.TypicalLifeDays,
        qty: c.Qty, amount: c.AmountUSD, failure: c.FailureDesc,
      })),
      counts: A.counts.map((c) => ({
        count_id: c.CountID, count_date: shift(c.CountDate), part_id: c.PartID, part_number: c.SKU,
        part_name: part(c.PartID)?.part_name || c.SKU, bin: c.BinLocation,
        system_qty: Number(c.SystemQty) || 0, physical_qty: Number(c.PhysicalQty) || 0,
        variance_qty: Number(c.VarianceQty) || 0, unit_cost: Number(c.UnitCostUSD) || 0,
        variance_value: Number(c.VarianceUSD) || 0,
        counted_by: nameOf(c.CountedBy) || c.CountedBy, approved_by: nameOf(c.ApprovedBy) || c.ApprovedBy,
        reason: c.ReasonCode,
      })),
      partUsage: A.partUsage.map((u) => {
        const x = part(u.PartID)
        return {
          part_id: u.PartID, part_number: x?.part_number || u.PartID, part_name: x?.part_name || u.PartID,
          category: x?.category || '', unit: x?.unit || 'EA',
          oem_unit_cost: x?.oem_unit_cost || 0, alt_unit_cost: x?.alt_unit_cost || 0,
          vendor_name: x?.vendor_name || '', alt_vendor_name: x?.alt_vendor_name || '',
          typical_life_days: x?.typical_life_days || null, warranty_months: x?.warranty_months || null,
          oem: u.oem, alt: u.alt,
        }
      }),
      labourKpi: A.labourKpi.map((u) => ({
        user_id: u.UserID, name: u.Name, role: u.Role, shift: u.Shift, y5: u.y5, m12: u.m12, quarters: u.quarters,
      })),
    }
    return analytics
  }

  // ── the stock ledger the stores screen shows ──────────────────────────
  //
  // Ninety days of SAP movement, shaped as this portal's own ledger lines.
  // They are history, not a correction: the quantity on each part already
  // includes them, so they are marked seeded and never summed into the live
  // position — exactly as a contractor visit is on the labour screen.
  const MOVE_REASON = {
    101: 'Goods received', 261: 'Issued to work order',
    701: 'Stock count correction', 702: 'Stock count correction',
  }
  const stockMovements = STOCK_LEDGER.map((m) => ({
    recordId: `sap-${m.MatDoc}`,
    part_id: m.PartID,
    part_name: partById.get(m.PartID)?.part_name || m.SKU,
    // Out of the store on an issue or a count loss, in on a receipt or a gain.
    qty: m.MoveType === '261' || m.MoveType === '702' ? -Math.abs(m.Qty) : Math.abs(m.Qty),
    reason: MOVE_REASON[m.MoveType] || 'Movement',
    reference: `${m.RefDoc}${m.SAPOrder ? ` · order ${m.SAPOrder}` : m.SAPPO ? ` · PO ${m.SAPPO}` : ''}`,
    site_id: SITE.site_id,
    at: shift(m.PostingDate),
    by_name: nameOf(m.UserID) || 'SAP posting',
    sap_document: String(m.MatDoc),
    move_type: String(m.MoveType),
    _seeded: true,
  }))

  // ── SAP: the organisation, the material documents, the P2P threads ─────
  //
  // Its own chunk, and a large one: five years of goods movements is the
  // evidence an auditor follows from a part on a job back to the purchase order
  // it arrived on, and only the SAP screens ask for it.
  let sapModule = null
  const loadSapData = async () => {
    if (sapModule) return sapModule
    const { SAP: S } = await import('./sap')
    const partName = (id) => partById.get(id)?.part_name || ''
    sapModule = {
      plant: S.plant,
      org: S.org.map((o) => ({ object: o.Object, value: o.Value, name: o.Name, used_on: o.UsedOn })),
      moveTypes: S.moveTypes,
      movements: S.goodsMovements.map((m) => ({
        id: String(m.MatDoc),
        move_type: String(m.MoveType),
        move_text: S.moveTypes[m.MoveType] || '',
        part_id: m.PartID,
        part_number: m.SKU,
        part_name: partName(m.PartID),
        quantity: m.Qty,
        unit_cost: m.UnitCostUSD,
        value: m.ExtUSD,
        storage_location: m.StorageLoc,
        posted: shift(m.PostingDate),
        sap_po: m.SAPPO,
        sap_order: m.SAPOrder,
        sap_reservation: m.SAPReserv,
        sap_vendor: m.VendorSAP,
        by_name: nameOf(m.UserID) || m.UserID,
        reference: m.RefDoc,
      })),
      p2p: S.p2p.map((t) => ({
        id: t.ThreadID,
        trigger: t.Trigger,
        pr: t.PR_BANFN,
        pr_date: shift(t.PR_Date),
        released: shift(t.Release_Date),
        release_strategy: t.Release_Strategy,
        purchase_order: t.PO_Demo,
        sap_po: t.SAPPO,
        po_date: shift(t.PO_Date),
        vendor: t.Vendor,
        doc_type: t.DocType,
        inbound_delivery: t.Inbound_Delivery,
        inbound_date: shift(t.Inbound_Date),
        goods_receipt: t.GR_MatDoc,
        gr_date: shift(t.GR_Date),
        move_type: String(t.MoveType || ''),
        storage_location: t.Sloc,
        status: t.Status,
        days_pr_to_gr: Number(t.PR_to_GR_days) || null,
        sample_sku: t.SampleSKU,
        cmms_source: t.CMMS_source,
      })),
      // The volume and speed the plan assumes, year by year. A target, kept
      // under its own name so no screen can draw it as five more years of
      // documents.
      volumePlan: S.p2pVolumePlan.map((y) => ({
        year: Number(y.Year),
        prs: Number(y.PRs_from_CMMS) || 0,
        pos: Number(y.POs) || 0,
        receipts: Number(y.GR_101) || 0,
        median_days: Number(y.Median_PR_to_GR_days) || 0,
        a_stockouts: Number(y.A_stockouts) || 0,
        stores_value: Number(y.Stores_USD) || 0,
      })),
    }
    return sapModule
  }

  // ── twelve months, labelled on the portal's own calendar ───────────────
  const trend = (META.monthly || []).map((m) => {
    const [y, mo] = m.month.split('-').map(Number)
    const d = new Date(Date.UTC(y, mo - 1, 15) + shiftDays * DAY)
    return {
      month: d.toLocaleString('en-GB', { month: 'short' }),
      raised: m.raised, completed: m.completed, downtime_hours: m.downtime_hours, cost: m.cost,
      preventive: m.preventive, unscheduled: m.unscheduled, comebacks: m.comebacks,
    }
  })

  return {
    site: SITE,
    sites: [SITE],
    locations,
    assets,
    technicians,
    teams,
    workOrders,
    vendors,
    parts,
    purchaseOrders,
    pmSchedules,
    documents,
    trend,
    meta: {
      ...META,
      shiftDays,
      voiceVolume: {
        ...VOICE_VOLUME,
        honesty: HONESTY,
        historicLive: historicWorkOrders.length,
        projectionMonth: voiceProjection.length,
        projectionWeek: voiceThisWeek.length,
        portalLive: workOrders.length,
      },
    },
    voiceWorkOrders: voiceProjection,
    voiceInsights: computeVoiceInsights(voiceProjection),
    voiceWaterfall: computeWaterfall(voiceProjection),
    voiceHonesty: HONESTY,
    loadWorkOrderDetail,
    loadGseAnalytics,
    loadSapData,
    stockMovements,
    rawAsset: (id) => rawById.get(id) || null,
  }
}
