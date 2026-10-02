'use client'

// Current-period OEM vs aftermarket variants on the voice register.
// Complements the five-year Parts Kits screen — this page is the live month.

import { Boxes, Scale, AlertTriangle, Package } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { GSE_ACTIVE } from '../lib/gse'
import { VOICE_INSIGHTS, ORG } from '../lib/data'
import ModuleOff from '../components/ModuleOff'

const VERDICT = {
  'Best fit': 'bg-emerald-100 text-emerald-800',
  'Higher value': 'bg-blue-100 text-blue-800',
  'Stay with OEM': 'bg-amber-100 text-amber-800',
  'Drives holds': 'bg-red-100 text-red-800',
  Trial: 'bg-slate-100 text-slate-700',
}

const price = (n) => (Number.isFinite(Number(n))
  ? `${ORG.currency_symbol}${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  : '—')

function Stat({ label, value, sub, Icon }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function VariantTable({ rows }) {
  if (!rows?.length) return <p className="text-sm text-slate-500">No variants in this slice.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="pb-2 pr-3">SKU / variant</th>
            <th className="pb-2 pr-3">Vendor</th>
            <th className="pb-2 pr-3">Channel</th>
            <th className="pb-2 pr-3 text-right">Installs</th>
            <th className="pb-2 pr-3 text-right">Reliability</th>
            <th className="pb-2 pr-3 text-right">Unit cost</th>
            <th className="pb-2">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.sku}|${r.channel}`} className="border-t border-slate-100">
              <td className="py-2 pr-3">
                <div className="font-medium text-slate-900">{r.sku_variant || r.sku}</div>
                <div className="text-xs text-slate-500">{r.name} · {r.sap_material}</div>
              </td>
              <td className="py-2 pr-3 text-slate-700">{r.vendor}</td>
              <td className="py-2 pr-3 capitalize text-slate-700">{r.channel}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{r.installs}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{r.reliability}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{price(r.unit_cost)}</td>
              <td className="py-2">
                <Badge className={`${VERDICT[r.verdict] || VERDICT.Trial} hover:${VERDICT[r.verdict] || VERDICT.Trial}`}>
                  {r.verdict}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function GseSpareInsights() {
  if (!GSE_ACTIVE) return <ModuleOff module="Spare variant insights" />
  const spares = VOICE_INSIGHTS?.spares
  if (!spares) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-slate-900">Spare variant insights</h1>
        <p className="text-slate-600 mt-2">Current-period OEM / aftermarket outcomes are only on the DHL GSE voice register.</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Oxmaint AI · current period</p>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">Spare variant insights</h1>
        <p className="text-slate-600 mt-2 max-w-3xl">
          OEM versus aftermarket variants used on the voice GSE register — reliability against unit cost,
          and which lines drive parts-hold or rework. {spares.honesty}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat Icon={Package} label="Variants scored" value={spares.variants?.length || 0} sub="SKU × channel with two or more installs" />
        <Stat Icon={Scale} label="Best fit" value={spares.best_fit?.[0]?.sku || '—'} sub={spares.best_fit?.[0]?.verdict} />
        <Stat Icon={AlertTriangle} label="Watch" value={spares.watch?.[0]?.sku || '—'} sub={spares.watch?.[0]?.verdict} />
        <Stat Icon={Boxes} label="Hold drivers" value={spares.hold_drivers?.[0]?.sku || '—'} sub={`${spares.hold_drivers?.[0]?.parts_hold || 0} holds`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Best fit / higher value</CardTitle>
          <p className="text-sm text-slate-500">{spares.how_to_read}</p>
        </CardHeader>
        <CardContent><VariantTable rows={spares.best_fit} /></CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Watch and hold drivers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <VariantTable rows={spares.watch} />
          <VariantTable rows={spares.hold_drivers} />
        </CardContent>
      </Card>
    </div>
  )
}
