'use client'

// Every "New …" button in the portal, driven from one place.
//
// Seventeen create screens hand-written would be seventeen slightly different
// forms — a different label style here, a required field marked differently
// there — and in a product demo that inconsistency is the thing people notice
// even when they cannot name it. So the form is one component and each record
// type contributes only a field list.
//
// The fields themselves are not decoration. What a work order needs — an asset,
// a priority, a due date, someone to do it — is what the list screen then shows,
// so a record created here is complete enough to behave like a seeded one
// rather than appearing as a row full of dashes.

import { useMemo, useState } from 'react'
import { Modal, ActionButton, PALETTE } from './kit'
import {
  ASSETS, SITES, TECHNICIANS, VENDORS, PARTS, LOCATIONS, USER, ORG, daysFrom,
  DOMAIN, INSPECTION_TYPES, SUPERVISOR_NAME,
} from './data'

// Example values in the empty fields. A pack can put its own equipment in them;
// "Air Compressor 10" as the hint on a GSE register tells the reader the form
// was written for somebody else.
const HINT = DOMAIN?.placeholders || {}

const { INK, SUB, MUTE, LINE, RED } = PALETTE

const assetOptions = () => ASSETS.map((a) => ({ value: a.asset_id, label: `${a.asset_name} — ${a.asset_code}` }))
const techOptions = () => TECHNICIANS.map((t) => ({ value: t.name, label: `${t.name} (${t.role})` }))
const siteOptions = () => SITES.map((s) => ({ value: s.site_id, label: s.site_name }))

const today = () => new Date().toISOString().slice(0, 10)
const inDays = (n) => daysFrom(n).slice(0, 10)

// ── field definitions per record type ────────────────────────────────────
export const FORMS = {
  work_order: {
    title: 'New work order',
    subtitle: 'Raise a job against an asset',
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'What needs doing?' },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Detail for whoever picks this up' },
      { key: 'asset_id', label: 'Asset', type: 'select', required: true, options: assetOptions },
      { key: 'work_order_type', label: 'Type', type: 'select', required: true, options: ['Corrective', 'Preventive', 'Inspection', 'Breakdown'] },
      { key: 'priority', label: 'Priority', type: 'select', required: true, options: ['Critical', 'High', 'Medium', 'Low'], default: 'Medium' },
      { key: 'assigned_to_name', label: 'Assign to', type: 'select', options: techOptions },
      { key: 'due_date', label: 'Due date', type: 'date', required: true, default: () => inDays(7) },
      { key: 'estimated_hours', label: 'Estimated hours', type: 'number', default: 2, min: 0 },
    ],
    // Fields the list needs that the form should not ask for.
    derive: (v) => {
      const asset = ASSETS.find((a) => a.asset_id === v.asset_id)
      return {
        work_order_number: `WO-${9000 + Math.floor(Math.random() * 900)}`,
        status: 'Open',
        asset_name: asset?.asset_name || '',
        asset_code: asset?.asset_code || '',
        site_id: asset?.site_id || SITES[0].site_id,
        site_name: asset?.site_name || SITES[0].site_name,
        location_name: asset?.functional_location_name || '',
        created_by_name: USER.name,
        created_date: daysFrom(0),
        completed_date: null,
        actual_hours: null,
        downtime_hours: 0,
        total_cost: 0,
        description: v.description || `${v.title} on ${asset?.asset_name || 'the asset'}.`,
      }
    },
    idKey: 'workorder_id',
  },

  request: {
    title: 'Raise maintenance request',
    subtitle: 'Ask for work without raising the order yourself',
    fields: [
      { key: 'title', label: 'What is wrong?', type: 'text', required: true },
      { key: 'description', label: 'Detail', type: 'textarea' },
      { key: 'asset_id', label: 'Asset', type: 'select', required: true, options: assetOptions },
      { key: 'priority', label: 'Priority', type: 'select', required: true, options: ['Critical', 'High', 'Medium', 'Low'], default: 'Medium' },
      { key: 'requested_by_name', label: 'Requested by', type: 'select', options: techOptions, default: () => USER.name },
    ],
    derive: (v) => {
      const asset = ASSETS.find((a) => a.asset_id === v.asset_id)
      return {
        request_number: `MR-${5000 + Math.floor(Math.random() * 900)}`,
        status: 'Pending',
        asset_name: asset?.asset_name || '',
        site_id: asset?.site_id || '',
        site_name: asset?.site_name || '',
        created_date: daysFrom(0),
        work_order_number: null,
      }
    },
    idKey: 'request_id',
  },

  asset: {
    title: 'Add asset',
    subtitle: 'Register a machine on the plant',
    fields: [
      { key: 'asset_name', label: 'Asset name', type: 'text', required: true, placeholder: HINT.asset || 'Air Compressor 10' },
      { key: 'asset_type', label: 'Type', type: 'select', required: true, options: () => [...new Set(ASSETS.map((a) => a.asset_type))].sort() },
      { key: 'manufacturer', label: 'Manufacturer', type: 'select', options: () => [...new Set(ASSETS.map((a) => a.manufacturer))].sort() },
      { key: 'model', label: 'Model', type: 'text' },
      { key: 'serial_number', label: 'Serial number', type: 'text' },
      { key: 'site_id', label: 'Site', type: 'select', required: true, options: siteOptions },
      { key: 'functional_location_id', label: 'Location', type: 'select', options: () => LOCATIONS.map((l) => ({ value: l.functional_location_id, label: l.name })) },
      { key: 'criticality', label: 'Criticality', type: 'select', required: true, options: ['High', 'Medium', 'Low'], default: 'Medium' },
      { key: 'status', label: 'Status', type: 'select', required: true, options: ['Operational', 'Under Maintenance', 'Down'], default: 'Operational' },
      { key: 'purchase_date', label: 'Purchased', type: 'date', default: () => today() },
    ],
    derive: (v) => {
      const site = SITES.find((s) => s.site_id === v.site_id)
      const loc = LOCATIONS.find((l) => l.functional_location_id === v.functional_location_id)
      const initials = String(v.asset_type || '').split(' ').map((w) => w[0]).join('')
      return {
        asset_code: `${site?.code || 'NEW'}-${initials}-${String(Math.floor(Math.random() * 900) + 100)}`,
        site_name: site?.site_name || '',
        functional_location_name: loc?.name || '',
        health_score: 100,
        running_hours: 0,
        iot_enabled: false,
        warranty_expiry: daysFrom(365),
        last_maintenance_date: daysFrom(0),
        next_maintenance_date: daysFrom(90),
      }
    },
    idKey: 'asset_id',
  },

  pm_schedule: {
    title: 'New PM schedule',
    subtitle: 'Plan recurring maintenance for an asset',
    fields: [
      { key: 'schedule_name', label: 'Schedule name', type: 'text', required: true, placeholder: HINT.pmSchedule || 'Compressor — quarterly service' },
      { key: 'asset_id', label: 'Asset', type: 'select', required: true, options: assetOptions },
      { key: 'frequency_type', label: 'Basis', type: 'select', required: true, options: ['Time', 'Meter'], default: 'Time' },
      { key: 'frequency_value', label: 'Every', type: 'number', required: true, default: 3, min: 1 },
      { key: 'frequency_unit', label: 'Unit', type: 'select', required: true, options: ['Weeks', 'Months'], default: 'Months' },
      { key: 'next_due', label: 'Next due', type: 'date', required: true, default: () => inDays(30) },
      { key: 'assigned_to_name', label: 'Assign to', type: 'select', options: techOptions },
      { key: 'estimated_hours', label: 'Estimated hours', type: 'number', default: 2, min: 0 },
    ],
    derive: (v) => {
      const asset = ASSETS.find((a) => a.asset_id === v.asset_id)
      return {
        status: 'Active',
        asset_name: asset?.asset_name || '',
        asset_code: asset?.asset_code || '',
        site_id: asset?.site_id || '',
        site_name: asset?.site_name || '',
        last_generated: daysFrom(0),
      }
    },
    idKey: 'schedule_id',
  },

  inspection: {
    title: 'New inspection',
    subtitle: 'Schedule an inspection against an asset',
    fields: [
      { key: 'inspection_type', label: 'Type', type: 'select', required: true, options: INSPECTION_TYPES },
      { key: 'asset_id', label: 'Asset', type: 'select', required: true, options: assetOptions },
      { key: 'inspector_name', label: 'Inspector', type: 'select', required: true, options: techOptions },
      { key: 'scheduled_date', label: 'Scheduled', type: 'date', required: true, default: () => today() },
    ],
    derive: (v) => {
      const asset = ASSETS.find((a) => a.asset_id === v.asset_id)
      return {
        inspection_number: `INS-${1900 + Math.floor(Math.random() * 90)}`,
        status: 'Scheduled',
        result: 'Pass',
        score: 0,
        findings_count: 0,
        duration_minutes: 0,
        asset_name: asset?.asset_name || '',
        site_id: asset?.site_id || '',
        site_name: asset?.site_name || '',
      }
    },
    idKey: 'inspection_id',
  },

  part: {
    title: 'Add part',
    subtitle: 'Put a spare in the catalogue',
    fields: [
      { key: 'part_name', label: 'Description', type: 'text', required: true, placeholder: 'Deep Groove Bearing 6206' },
      { key: 'part_number', label: 'Part number', type: 'text', required: true, placeholder: 'P-40118' },
      { key: 'category', label: 'Category', type: 'select', required: true, options: ['Mechanical', 'Electrical', 'Consumable', 'Lubricant'] },
      { key: 'unit', label: 'Unit', type: 'select', required: true, options: ['ea', 'L', 'm', 'kg'], default: 'ea' },
      { key: 'quantity_on_hand', label: 'On hand', type: 'number', required: true, default: 0, min: 0 },
      { key: 'minimum_quantity', label: 'Reorder at', type: 'number', required: true, default: 10, min: 0 },
      { key: 'unit_cost', label: 'Unit cost', type: 'number', required: true, default: 0, min: 0, step: '0.01' },
      { key: 'storage_location', label: 'Storage bin', type: 'text', placeholder: 'A-12' },
      { key: 'site_id', label: 'Site', type: 'select', required: true, options: siteOptions },
      { key: 'vendor_id', label: 'Preferred vendor', type: 'select', options: () => VENDORS.map((v) => ({ value: v.vendor_id, label: v.vendor_name })) },
    ],
    derive: (v) => {
      const qty = Number(v.quantity_on_hand) || 0
      const min = Number(v.minimum_quantity) || 0
      return {
        reorder_point: min,
        total_value: Number((qty * (Number(v.unit_cost) || 0)).toFixed(2)),
        vendor_name: VENDORS.find((x) => x.vendor_id === v.vendor_id)?.vendor_name || '',
        status: qty === 0 ? 'Out of Stock' : qty < min ? 'Low Stock' : 'In Stock',
      }
    },
    idKey: 'part_id',
  },

  vendor: {
    title: 'Add vendor',
    subtitle: 'Register a supplier',
    fields: [
      { key: 'vendor_name', label: 'Vendor name', type: 'text', required: true },
      { key: 'contact_name', label: 'Contact', type: 'text' },
      { key: 'email', label: 'Email', type: 'text', placeholder: 'orders@supplier.example' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'payment_terms', label: 'Payment terms', type: 'select', required: true, options: ['Net 30', 'Net 45', 'Net 60'], default: 'Net 30' },
      { key: 'lead_time_days', label: 'Lead time (days)', type: 'number', default: 7, min: 0 },
    ],
    derive: () => ({ status: 'Active' }),
    idKey: 'vendor_id',
  },

  purchase_order: {
    title: 'Raise purchase order',
    subtitle: 'Order parts from a supplier',
    fields: [
      { key: 'vendor_id', label: 'Vendor', type: 'select', required: true, options: () => VENDORS.map((v) => ({ value: v.vendor_id, label: v.vendor_name })) },
      { key: 'line_items', label: 'Line items', type: 'number', required: true, default: 1, min: 1 },
      { key: 'total_amount', label: 'Value', type: 'number', required: true, default: 0, min: 0, step: '0.01' },
      { key: 'expected_date', label: 'Expected', type: 'date', required: true, default: () => inDays(10) },
      { key: 'site_id', label: 'Deliver to', type: 'select', required: true, options: siteOptions },
    ],
    derive: (v) => ({
      po_number: `PO-${4900 + Math.floor(Math.random() * 90)}`,
      status: 'Pending Approval',
      vendor_name: VENDORS.find((x) => x.vendor_id === v.vendor_id)?.vendor_name || '',
      raised_by_name: USER.name,
      created_date: daysFrom(0),
    }),
    idKey: 'purchase_order_id',
  },

  scrap: {
    title: 'Record scrap',
    subtitle: 'Write off a part',
    fields: [
      { key: 'part_id', label: 'Part', type: 'select', required: true, options: () => PARTS.map((p) => ({ value: p.part_id, label: `${p.part_name} — ${p.part_number}` })) },
      { key: 'quantity', label: 'Quantity', type: 'number', required: true, default: 1, min: 1 },
      { key: 'reason', label: 'Reason', type: 'select', required: true, options: ['Damaged in handling', 'Past shelf life', 'Obsolete — asset retired', 'Wrong part received'] },
      { key: 'raised_by_name', label: 'Raised by', type: 'select', options: techOptions, default: () => USER.name },
    ],
    derive: (v) => {
      const part = PARTS.find((p) => p.part_id === v.part_id)
      return {
        part_name: part?.part_name || '',
        value: Number(((part?.unit_cost || 0) * (Number(v.quantity) || 0)).toFixed(2)),
        site_id: part?.site_id || '',
        status: 'Pending Approval',
        created_date: daysFrom(0),
      }
    },
    idKey: 'scrap_id',
  },

  incident: {
    title: 'Report incident',
    subtitle: 'Record a safety event',
    fields: [
      { key: 'title', label: 'What happened?', type: 'text', required: true },
      { key: 'asset_id', label: 'Asset involved', type: 'select', options: assetOptions },
      { key: 'severity', label: 'Severity', type: 'select', required: true, options: ['High', 'Medium', 'Low'], default: 'Medium' },
      { key: 'lost_time', label: 'Lost time?', type: 'select', required: true, options: ['No', 'Yes'], default: 'No' },
      { key: 'reported_by_name', label: 'Reported by', type: 'select', options: techOptions, default: () => USER.name },
    ],
    derive: (v) => {
      const asset = ASSETS.find((a) => a.asset_id === v.asset_id)
      return {
        incident_number: `INC-${400 + Math.floor(Math.random() * 90)}`,
        status: 'Open',
        asset_name: asset?.asset_name || '—',
        site_id: asset?.site_id || SITES[0].site_id,
        site_name: asset?.site_name || SITES[0].site_name,
        lost_time: v.lost_time === 'Yes',
        reported_date: daysFrom(0),
      }
    },
    idKey: 'incident_id',
  },

  permit: {
    title: 'Request work permit',
    subtitle: 'Permit to work on a live asset',
    fields: [
      { key: 'permit_type', label: 'Permit type', type: 'select', required: true, options: ['Hot Work', 'Confined Space', 'Working at Height', 'Electrical Isolation'] },
      { key: 'asset_id', label: 'Asset', type: 'select', required: true, options: assetOptions },
      { key: 'requested_by_name', label: 'Requested by', type: 'select', required: true, options: techOptions, default: () => USER.name },
      { key: 'approver_name', label: 'Approver', type: 'select', required: true, options: techOptions, default: () => SUPERVISOR_NAME },
      { key: 'valid_from', label: 'Valid from', type: 'date', required: true, default: () => today() },
      { key: 'valid_to', label: 'Valid to', type: 'date', required: true, default: () => inDays(2) },
    ],
    derive: (v) => {
      const asset = ASSETS.find((a) => a.asset_id === v.asset_id)
      return {
        permit_number: `PTW-${800 + Math.floor(Math.random() * 90)}`,
        status: 'Pending Approval',
        asset_name: asset?.asset_name || '',
        site_id: asset?.site_id || '',
        work_order_number: '—',
      }
    },
    idKey: 'permit_id',
  },

  shutdown: {
    title: 'New shutdown',
    subtitle: 'Plan an outage or turnaround',
    fields: [
      { key: 'name', label: 'Shutdown name', type: 'text', required: true, placeholder: HINT.shutdown || 'Line 2 annual shutdown' },
      { key: 'site_id', label: 'Site', type: 'select', required: true, options: siteOptions },
      { key: 'start_date', label: 'Starts', type: 'date', required: true, default: () => inDays(30) },
      { key: 'end_date', label: 'Ends', type: 'date', required: true, default: () => inDays(35) },
      { key: 'tasks', label: 'Tasks planned', type: 'number', required: true, default: 10, min: 1 },
      { key: 'budget', label: 'Budget', type: 'number', required: true, default: 0, min: 0 },
      { key: 'manager', label: 'Manager', type: 'select', required: true, options: techOptions },
    ],
    derive: (v) => ({
      status: 'Planned',
      site_name: SITES.find((s) => s.site_id === v.site_id)?.site_name || '',
      tasks_done: 0,
      progress: 0,
    }),
    idKey: 'shutdown_id',
  },

  document: {
    title: 'Upload document',
    subtitle: 'Attach a manual, drawing or certificate',
    fields: [
      { key: 'document_name', label: 'Document name', type: 'text', required: true },
      { key: 'document_type', label: 'Type', type: 'select', required: true, options: ['PDF', 'DWG', 'XLSX'], default: 'PDF' },
      { key: 'asset_id', label: 'Asset', type: 'select', options: assetOptions },
      { key: 'size_kb', label: 'Size (KB)', type: 'number', default: 500, min: 1 },
    ],
    derive: (v) => {
      const asset = ASSETS.find((a) => a.asset_id === v.asset_id)
      return {
        asset_name: asset?.asset_name || '—',
        site_id: asset?.site_id || '',
        uploaded_by_name: USER.name,
        created_date: daysFrom(0),
      }
    },
    idKey: 'document_id',
  },

  member: {
    title: 'Invite member',
    subtitle: `Add a person to ${ORG.organization_name}`,
    fields: [
      { key: 'name', label: 'Full name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'text', required: true },
      { key: 'role', label: 'Role', type: 'select', required: true, options: ['Technician', 'Supervisor', 'Planner', 'Administrator'], default: 'Technician' },
      { key: 'trade', label: 'Trade', type: 'select', required: true, options: ['Mechanical', 'Electrical', 'Instrumentation', 'Planning'], default: 'Mechanical' },
    ],
    derive: () => ({ status: 'Invited' }),
    idKey: 'user_id',
  },

  team: {
    title: 'New team',
    subtitle: 'Group people into a crew',
    fields: [
      { key: 'team_name', label: 'Team name', type: 'text', required: true },
      { key: 'lead_name', label: 'Team lead', type: 'select', required: true, options: techOptions },
      { key: 'site_id', label: 'Site', type: 'select', required: true, options: siteOptions },
      { key: 'members', label: 'Members', type: 'number', default: 1, min: 1 },
    ],
    derive: () => ({}),
    idKey: 'team_id',
  },

  rca: {
    title: 'Create RCA',
    subtitle: 'Record why a failure happened',
    fields: [
      { key: 'root_cause_category', label: 'Root cause category', type: 'select', required: true, options: [
        'Environment Impact', 'Parts Damaged', 'Run to Failure',
        'Lack of maintenance', 'Operator/Employee Negligence', 'Other',
      ] },
      { key: 'method', label: 'Analysis method', type: 'select', required: true, options: ['5 Whys', 'Fishbone'], default: '5 Whys' },
      { key: 'asset_id', label: 'Asset', type: 'select', required: true, options: assetOptions },
      { key: 'owner', label: 'Analysis owner', type: 'select', options: techOptions, default: () => USER.name },
      { key: 'problem', label: 'What failed?', type: 'text', required: true, placeholder: 'The failure this analysis is about' },
      { key: 'root_cause_description', label: 'Root cause', type: 'textarea', required: true, placeholder: 'The systemic cause the analysis reached' },
      { key: 'contributing_factors', label: 'Contributing factors', type: 'textarea' },
      { key: 'estimated_cost_impact', label: 'Estimated cost impact', type: 'number', default: 0, min: 0 },
      { key: 'is_recurring', label: 'Recurring issue?', type: 'select', required: true, options: ['No', 'Yes'], default: 'No' },
      { key: 'condition', label: 'Asset condition', type: 'select', required: true, options: ['Satisfactory', 'Unsatisfactory'], default: 'Unsatisfactory' },
    ],
    derive: (v) => {
      const asset = ASSETS.find((a) => a.asset_id === v.asset_id)
      return {
        // Raised here rather than from a source record, so the reference says so:
        // the seeded ones are RCA-1xxx from inspections and RCA-2xxx from
        // breakdowns, and a hand-raised analysis belongs in neither range.
        reference: `RCA-${3000 + Math.floor(Math.random() * 900)}`,
        status: 'Open',
        theme: v.root_cause_category,
        asset_name: asset?.asset_name || '—',
        site_id: asset?.site_id || SITES[0].site_id,
        site_name: asset?.site_name || SITES[0].site_name,
        is_recurring_issue: v.is_recurring === 'Yes',
        asset_condition_satisfactory: v.condition === 'Satisfactory',
        source: 'Raised in this portal',
        raised: daysFrom(0),
        // No chain and no actions yet. Both screens read these as lists, so they
        // are empty arrays rather than absent — an analysis with no whys behind
        // it renders as one without them, not as one that crashes.
        levels: [],
        actions: [],
      }
    },
    idKey: 'rca_id',
  },

  checklist: {
    title: 'New checklist',
    subtitle: 'Build an inspection template',
    fields: [
      { key: 'checklist_name', label: 'Checklist name', type: 'text', required: true },
      { key: 'category', label: 'Category', type: 'select', required: true, options: ['Operations', 'Safety', 'Maintenance', 'Compliance'] },
      { key: 'items_count', label: 'Number of items', type: 'number', required: true, default: 10, min: 1 },
      { key: 'assigned_to', label: 'Assigned to', type: 'text', default: 'All technicians' },
    ],
    derive: () => ({ status: 'Active', completions_today: 0, due_today: 0 }),
    idKey: 'checklist_id',
  },
}

// ── the form ─────────────────────────────────────────────────────────────
const resolve = (o) => (typeof o === 'function' ? o() : o)

const normalise = (options) => resolve(options).map((o) => (typeof o === 'string' ? { value: o, label: o } : o))

function initial(spec) {
  const v = {}
  spec.fields.forEach((f) => { v[f.key] = f.default !== undefined ? resolve(f.default) : '' })
  return v
}

export function CreateModal({ kind, open, onClose, onSubmit }) {
  const spec = FORMS[kind]
  const [values, setValues] = useState(() => (spec ? initial(spec) : {}))
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  // A fresh form each time it opens — a modal that remembers the last thing
  // typed is a modal that quietly creates duplicates.
  const formKey = useMemo(() => `${kind}-${open}`, [kind, open])
  const [seenKey, setSeenKey] = useState(formKey)
  if (formKey !== seenKey) {
    setSeenKey(formKey)
    setValues(spec ? initial(spec) : {})
    setTouched(false)
  }

  if (!spec) return null

  const missing = spec.fields.filter((f) => f.required && !String(values[f.key] ?? '').trim()).map((f) => f.key)

  const set = (key, val) => setValues((p) => ({ ...p, [key]: val }))

  const submit = async () => {
    setTouched(true)
    if (missing.length) return
    setSaving(true)
    const numeric = {}
    spec.fields.filter((f) => f.type === 'number').forEach((f) => { numeric[f.key] = Number(values[f.key]) || 0 })
    const dates = {}
    spec.fields.filter((f) => f.type === 'date').forEach((f) => {
      if (values[f.key]) dates[f.key] = new Date(values[f.key]).toISOString()
    })
    const payload = { ...values, ...numeric, ...dates }
    await onSubmit({ ...payload, ...spec.derive(payload) })
    setSaving(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={spec.title} subtitle={spec.subtitle} width={560}
      footer={
        <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end' }}>
          <ActionButton variant="ghost" onClick={onClose}>Cancel</ActionButton>
          <ActionButton onClick={submit} disabled={saving || (touched && missing.length > 0)}>
            {saving ? 'Saving…' : spec.title}
          </ActionButton>
        </div>
      }>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '13px 14px' }}>
        {spec.fields.map((f) => (
          <div key={f.key} style={{ gridColumn: f.type === 'textarea' ? '1 / -1' : 'auto', minWidth: 0 }}>
            <label style={label}>
              {f.label}
              {f.required && <span style={{ color: RED, marginLeft: 3 }}>*</span>}
            </label>

            {f.type === 'textarea' ? (
              <textarea rows={3} value={values[f.key]} placeholder={f.placeholder}
                onChange={(e) => set(f.key, e.target.value)} style={{ ...input, resize: 'vertical' }} />
            ) : f.type === 'select' ? (
              <select value={values[f.key]} onChange={(e) => set(f.key, e.target.value)} style={input}>
                <option value="">Select…</option>
                {normalise(f.options).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input
                type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                value={values[f.key]} placeholder={f.placeholder} min={f.min} step={f.step}
                onChange={(e) => set(f.key, e.target.value)} style={input} />
            )}

            {touched && missing.includes(f.key) && (
              <span style={{ display: 'block', fontSize: 11, color: RED, marginTop: 3 }}>Required</span>
            )}
          </div>
        ))}
      </div>
    </Modal>
  )
}

const label = {
  display: 'block', fontSize: 10.5, fontWeight: 700, color: MUTE,
  textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4,
}

const input = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12.5,
  border: `1px solid ${LINE}`, borderRadius: 9, outline: 'none',
  fontFamily: 'inherit', color: INK, background: '#fff',
}
