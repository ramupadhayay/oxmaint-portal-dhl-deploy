'use client'

// Reading the audit trail.
//
// The trail is written in exactly one place — app/api/oxmaint/records/route.js,
// beside the write it describes — and read here. Nothing in the portal creates
// an audit line itself, which is what makes it worth showing to an auditor: a
// screen that could write one could also skip one.

import { useMemo } from 'react'
import { useStore } from './store'
import { fmtDate } from './data'

export const AUDIT_KIND = 'audit_event'

const newestFirst = (a, b) => String(b.at || '').localeCompare(String(a.at || ''))

/** Every line recorded in this portal, newest first. */
export function useAuditTrail() {
  const store = useStore()
  const rows = store?.records?.[AUDIT_KIND]
  return useMemo(() => [...(rows || [])].sort(newestFirst), [rows])
}

/**
 * The lines about one record — or, given an asset, about everything filed
 * against it: its own edits, and the jobs, inspections and documents that name
 * it. An asset's history is mostly other records happening to it.
 */
export function useRecordHistory({ kind, recordId, assetId } = {}) {
  const all = useAuditTrail()
  return useMemo(() => all.filter((e) => {
    if (assetId && e.asset_id && String(e.asset_id) === String(assetId)) return true
    return Boolean(kind && recordId)
      && e.entity_kind === kind && String(e.record_id) === String(recordId)
  }), [all, kind, recordId, assetId])
}

// Field names as a person reads them. Anything not listed is de-snaked, which
// is right more often than not and never wrong enough to mislead.
const FIELD_LABEL = {
  assigned_to_name: 'Assigned to', due_date: 'Due date', asset_id: 'Asset',
  asset_name: 'Asset name', asset_code: 'Asset code', site_id: 'Site', site_name: 'Site name',
  work_order_type: 'Type', estimated_hours: 'Estimated hours', actual_hours: 'Actual hours',
  labour_cost: 'Labour cost', next_due: 'Next due', frequency_value: 'Interval',
  frequency_unit: 'Interval unit', frequency_type: 'Basis', meter_interval: 'Hours interval',
  total_amount: 'Value', vendor_name: 'Vendor', vendor_id: 'Vendor id',
  schedule_name: 'Schedule name', health_score: 'Health score', findings_count: 'Findings',
  inspector_name: 'Inspector', completed_date: 'Completed', started_date: 'Started',
  expected_date: 'Expected', received_date: 'Received', running_hours: 'Running hours',
  document_name: 'Document name', document_type: 'Type', location_name: 'Location',
}

export const fieldLabel = (f) => FIELD_LABEL[f]
  || String(f || '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

const ISO = /^\d{4}-\d{2}-\d{2}/

/** A stored value as a reader would want to see it. */
export const showValue = (v) => {
  if (v === '' || v === null || v === undefined) return '—'
  const t = String(v)
  if (ISO.test(t)) return fmtDate(t)
  return t
}

/** When, to the minute. An audit line is read against other lines, not a calendar. */
export const fmtWhen = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  const day = `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleString('en-GB', { month: 'short' })} ${d.getFullYear()}`
  return `${day} · ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

export const ACTION_STYLE = {
  created: 'bg-emerald-100 text-emerald-800',
  updated: 'bg-blue-100 text-blue-800',
  'status changed': 'bg-amber-100 text-amber-800',
  deleted: 'bg-red-100 text-red-800',
}
