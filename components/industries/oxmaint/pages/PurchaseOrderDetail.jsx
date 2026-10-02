'use client'

// A purchase order on its own page — the product's view, not a drawer.
//
// The product gives an order five cards: the order itself, where it is going,
// what is on it, the paperwork, and its history. The drawer this replaces could
// hold the first and a squeezed version of the third, so the two questions
// anybody actually asks a purchase order — is it late, and what happened to it
// — had nowhere to be answered.
//
// Editing follows the rule the other record pages use: the fields that can
// change become controls where they already sit, `?edit=1` carries the state.
// What is different here is that receiving closes the door. An order whose
// lines are already in stock cannot have its vendor or its value edited
// afterwards, because the stock movement was booked against what it said then.

import { useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, ShoppingCart, MapPin, Package, History, Truck, AlertTriangle,
  Pencil, Trash2, Share2, CheckCircle, XCircle, Clock,
} from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Input } from '../ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select'
import { useRecords, useStore } from '../lib/store'
import {
  idOf, canReceive, linesFor, vendorOf, unitsOn, historyOf, useReceiveOrder,
} from '../lib/purchaseOrder'
import RecordHistory from '../components/RecordHistory'
import { PURCHASE_ORDERS, VENDORS, SITES, money, fmtDate, isPast } from '../lib/data'

const STATUS_LOOK = {
  Draft: { cls: 'bg-slate-100 text-slate-800', Icon: Pencil },
  'Pending Approval': { cls: 'bg-amber-100 text-amber-800', Icon: Clock },
  Approved: { cls: 'bg-blue-100 text-blue-800', Icon: CheckCircle },
  Received: { cls: 'bg-green-100 text-green-800', Icon: Package },
  Cancelled: { cls: 'bg-red-100 text-red-800', Icon: XCircle },
}

// What each status is allowed to become. Received is terminal here on purpose:
// stock has moved, and walking the order back would leave the movement behind.
const FLOW = {
  Draft: ['Pending Approval', 'Cancelled'],
  'Pending Approval': ['Approved', 'Draft', 'Cancelled'],
  Approved: ['Cancelled'],
  Received: [],
  Cancelled: [],
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">{label}</p>
      <div className="text-slate-900 text-sm font-medium">{children ?? '—'}</div>
    </div>
  )
}

function Empty({ icon: Icon, title, body }) {
  return (
    <div className="bg-white border border-slate-200/60 rounded-lg shadow-sm p-12 text-center">
      <Icon className="w-9 h-9 text-slate-300 mx-auto mb-3" />
      <h3 className="font-semibold text-slate-800 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-md mx-auto">{body}</p>
    </div>
  )
}

export default function PurchaseOrderDetail() {
  const { id } = useParams()
  const router = useRouter()
  const { update, remove, notify } = useStore()
  const params = useSearchParams()
  const receiveOrder = useReceiveOrder()

  const [editing, setEditing] = useState(params?.get('edit') === '1')
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const setField = (k, v) => setDraft((d) => ({ ...d, [k]: v }))

  const merged = useRecords('purchase_order', PURCHASE_ORDERS, idOf)
  const po = useMemo(
    () => merged.find((p) => String(idOf(p)) === String(id)) || null,
    [merged, id],
  )
  const lines = useMemo(() => (po ? linesFor(po) : []), [po])
  const vendor = useMemo(() => vendorOf(po), [po])
  const trail = useMemo(() => historyOf(po), [po])

  const back = () => router.push('/portal/oxmaint/purchase-orders')

  if (!po) {
    return (
      <div className="max-w-8xl mx-auto p-6 space-y-6">
        <Button variant="ghost" onClick={back} className="gap-2 -ml-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Purchase Orders
        </Button>
        <Empty
          icon={AlertTriangle}
          title="No purchase order with that reference"
          body="It may have been deleted, or the address may be wrong. The register lists every order this portal holds."
        />
      </div>
    )
  }

  const status = po.status || 'Draft'
  const look = STATUS_LOOK[status] || STATUS_LOOK.Draft
  const StatusIcon = look.Icon
  const received = status === 'Received'
  const late = !received && status !== 'Cancelled' && po.expected_date && isPast(po.expected_date)
  const site = SITES.find((s) => s.site_id === po.site_id) || null
  // Once stock has moved, the commercial terms are history rather than a
  // setting. Editing them here would leave the movement describing an order
  // that no longer exists.
  const locked = received || status === 'Cancelled'

  const startEdit = () => {
    setDraft({
      vendor_id: po.vendor_id || '',
      line_items: po.line_items ?? lines.length,
      total_amount: po.total_amount ?? '',
      expected_date: (po.expected_date || '').slice(0, 10),
      site_id: po.site_id || '',
    })
    setEditing(true)
  }

  const closeEdit = () => {
    setEditing(false)
    setDraft(null)
    router.replace(`/portal/oxmaint/purchase-orders/${encodeURIComponent(String(id))}`)
  }

  const saveEdit = async () => {
    if (!draft) return
    const value = Number(draft.total_amount)
    const count = Number(draft.line_items)
    const v = VENDORS.find((x) => x.vendor_id === draft.vendor_id) || vendor
    setBusy(true)
    const saved = await update('purchase_order', idOf(po), {
      ...po,
      ...draft,
      // The vendor's name travels with its id. Left behind, the register shows
      // one supplier and the order shows another.
      vendor_name: v?.vendor_name || po.vendor_name,
      line_items: Number.isFinite(count) && count > 0 ? count : po.line_items,
      // An order with no value is not zero-value — it is unpriced, and a zero
      // would quietly join every spend total as though it were free.
      total_amount: draft.total_amount === '' || !Number.isFinite(value) || value < 0
        ? null
        : value,
    })
    setBusy(false)
    if (!saved) return
    notify(`${po.po_number} updated.`)
    closeEdit()
  }

  const applyStatus = async (next) => {
    if (!next || next === status || busy) return
    setBusy(true)
    const patch = { ...po, status: next }
    if (next === 'Approved') patch.approved_date = new Date().toISOString()
    if (next === 'Cancelled') patch.cancelled_date = new Date().toISOString()
    const saved = await update('purchase_order', idOf(po), patch)
    setBusy(false)
    if (saved) notify(`${po.po_number} — ${next.toLowerCase()}.`)
  }

  const doReceive = async () => {
    setBusy(true)
    await receiveOrder(po)
    setBusy(false)
  }

  const del = async () => {
    if (!po._created) return
    if (typeof window !== 'undefined'
      && !window.confirm(`Delete ${po.po_number}? This cannot be undone.`)) return
    const ok = await remove('purchase_order', idOf(po))
    if (ok) back()
  }

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      notify('Link copied.')
    } catch { notify('The link could not be copied.', 'error') }
  }

  const moves = FLOW[status] || []

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      {/* Action bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={back} className="gap-2 -ml-2 w-fit">
          <ArrowLeft className="w-4 h-4" />
          Back to Purchase Orders
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <Button size="sm" variant="outline" onClick={closeEdit} disabled={busy}>Cancel</Button>
              <Button size="sm" className="gap-2" onClick={saveEdit} disabled={busy}>
                <Pencil className="h-4 w-4" />
                {busy ? 'Saving…' : 'Save changes'}
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" className="gap-2" onClick={share}>
                <Share2 className="h-4 w-4" />
                Share
              </Button>
              {moves.length > 0 && (
                <Select value="" onValueChange={applyStatus} disabled={busy}>
                  <SelectTrigger className="h-9 w-[170px] bg-white">
                    <SelectValue placeholder="Move to…" />
                  </SelectTrigger>
                  <SelectContent>
                    {moves.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Button
                size="sm" className="gap-2" onClick={doReceive}
                disabled={busy || !canReceive(po)}
                title={
                  received ? 'Already booked into stock.'
                    : canReceive(po) ? 'Books every line on this order into stock.'
                      : 'A draft has not been placed with anyone, so there is nothing to receive.'
                }
              >
                <Truck className="h-4 w-4" />
                {received ? 'Received' : 'Receive into stock'}
              </Button>
              <Button size="sm" variant="outline" className="gap-2" onClick={startEdit} disabled={locked}
                title={locked ? 'A received or cancelled order is a record of what happened, not a setting.' : 'Edit this order'}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              {po._created && (
                <Button size="sm" variant="destructive" className="gap-2" onClick={del}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Heading */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-slate-900 break-words">{po.po_number}</h1>
          <p className="text-slate-600 mt-1">
            {po.vendor_name} · {lines.length} line{lines.length === 1 ? '' : 's'} · {unitsOn(lines)} units
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={`gap-1 ${look.cls}`}>
            <StatusIcon className="w-3.5 h-3.5" />
            {status}
          </Badge>
          {late && (
            <Badge className="bg-red-100 text-red-800 gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Overdue
            </Badge>
          )}
        </div>
      </div>

      {editing && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-900">
          Editing <strong>{po.po_number}</strong>. The vendor, the line count, the value, the
          expected date and where it is delivered can be changed here. The status moves through its
          own control above, and what has been received is history — a delivery that arrived cannot
          be edited into one that did not.
        </div>
      )}

      {late && !editing && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          Expected {fmtDate(po.expected_date)} and not yet received — this order is{' '}
          {Math.abs(Math.round((Date.now() - new Date(po.expected_date)) / 86400000))} days late.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Order
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Vendor">
                  {editing ? (
                    <Select value={draft?.vendor_id || ''} onValueChange={(v) => setField('vendor_id', v)}>
                      <SelectTrigger className="h-9 bg-white"><SelectValue placeholder="Select a vendor" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {VENDORS.map((v) => (
                          <SelectItem key={v.vendor_id} value={v.vendor_id}>{v.vendor_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <button
                      onClick={() => router.push('/portal/oxmaint/vendors')}
                      className="text-sm font-medium text-primary hover:underline text-left"
                    >
                      {po.vendor_name}
                    </button>
                  )}
                </Field>

                <Field label="Value">
                  {editing ? (
                    <Input
                      type="number" min="0" step="0.01"
                      value={draft?.total_amount ?? ''}
                      onChange={(e) => setField('total_amount', e.target.value)}
                      placeholder="Unpriced"
                      className="h-9 bg-white"
                    />
                  ) : (po.total_amount == null ? 'Unpriced' : money(po.total_amount))}
                </Field>

                <Field label="Line items">
                  {editing ? (
                    <Input
                      type="number" min="1" step="1"
                      value={draft?.line_items ?? ''}
                      onChange={(e) => setField('line_items', e.target.value)}
                      className="h-9 bg-white"
                    />
                  ) : lines.length}
                </Field>

                {po.sap_po && (
                  <Field label="SAP purchase order">
                    <span className="font-mono">{po.sap_po}</span>
                    <span className="block text-xs text-slate-500">
                      {po.sap_doc_type} · {po.sap_purch_org}/{po.sap_purch_group} · plant {po.sap_plant}
                    </span>
                  </Field>
                )}
                <Field label="Raised by">{po.raised_by_name}</Field>
                <Field label="Raised on">{fmtDate(po.created_date)}</Field>
                <Field label="Expected">
                  {editing ? (
                    <Input
                      type="date"
                      value={draft?.expected_date ?? ''}
                      onChange={(e) => setField('expected_date', e.target.value)}
                      className="h-9 bg-white"
                    />
                  ) : (
                    <span className={late ? 'text-red-600 font-semibold' : ''}>{fmtDate(po.expected_date)}</span>
                  )}
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Order lines
                <span className="ml-auto text-sm font-normal text-slate-500">
                  {unitsOn(lines)} units
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-slate-100">
                {lines.map((l, i) => (
                  <button
                    key={`${l.part_id}-${i}`}
                    onClick={() => router.push('/portal/oxmaint/parts')}
                    className="w-full flex flex-wrap items-center gap-3 py-3 text-left hover:bg-slate-50 -mx-2 px-2 rounded"
                  >
                    <span className="shrink-0 min-w-[64px] text-sm font-bold text-slate-900">
                      {l.quantity} {l.unit}
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-slate-700 truncate">
                      {l.part_name}
                      <span className="text-slate-400 ml-2 font-mono text-xs">{l.part_number}</span>
                    </span>
                    {l.line_value != null && (
                      <span className="shrink-0 text-sm font-semibold text-slate-900">{money(l.line_value)}</span>
                    )}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {received
                  ? 'These lines were booked into stock when the order was received.'
                  : 'Receiving this order books every line above into stock.'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {trail.map((e) => (
                  <div key={e.key} className="flex items-baseline gap-3">
                    <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0 translate-y-1" />
                    <span className="text-sm font-medium text-slate-900 min-w-[150px]">{e.label}</span>
                    <span className={`text-sm ${e.key === 'expected' && late ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                      {e.date ? fmtDate(e.date) : 'not recorded'}
                    </span>
                    {e.by && <span className="text-xs text-slate-400">by {e.by}</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <RecordHistory kind="purchase_order" recordId={String(idOf(po))} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Delivery
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Deliver to">
                {editing ? (
                  <Select value={draft?.site_id || ''} onValueChange={(v) => setField('site_id', v)}>
                    <SelectTrigger className="h-9 bg-white"><SelectValue placeholder="Select a site" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {SITES.map((s) => (
                        <SelectItem key={s.site_id} value={s.site_id}>{s.site_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (site?.site_name || '—')}
              </Field>
              <Field label="Received">{po.received_date ? fmtDate(po.received_date) : 'Not yet'}</Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Supplier
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Payment terms">{vendor?.payment_terms}</Field>
              <Field label="Lead time">
                {vendor?.lead_time_days != null ? `${vendor.lead_time_days} days` : null}
              </Field>
              <Field label="Contact">{vendor?.contact_name}</Field>
              <Field label="Email">{vendor?.email}</Field>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
