'use client'

// Asset Master — the register, rebuilt on the product's screen.
//
// The list used to open an asset in a 500px drawer. The product opens it on its
// own page, and the history is the reason anybody opens an asset at all: what
// has been done to it, what it has cost, whether a PM covers it. None of that
// fits a panel, so a row here now routes to /portal/oxmaint/assets/<id>.
//
// The card-versus-list toggle is the product's and is not decoration. A card
// carries the health bar and the location, which is what somebody browsing a
// plant wants; a row fits twice as many assets on a screen, which is what
// somebody hunting a specific one wants. Two different jobs, one switch.
//
// The tabs are the three states plant availability is read from. Everything is
// the register; Down is what is costing production right now, and it leads
// because it is the only one somebody has to act on today.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  RefreshCw, Download, Plus, Boxes, CheckCircle2, Wrench, AlertTriangle,
  Radio, LayoutGrid, List,
} from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Input } from '../ui/input'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../ui/select'
import PagerBar, { usePaged } from '../components/ListPager'
import { Tabs as ShadTabs, TabsList, TabsTrigger } from '../ui/tabs'
import StatTiles from '../components/StatTiles'
import { AssetCard, AssetListItem } from '../components/AssetCard'
import { useRecords, useStore } from '../lib/store'
import { useSite } from '../lib/siteStore'
import { ASSETS, fmtDate } from '../lib/data'

const idOf = (a) => a.asset_id || a.recordId

const TABS = [
  { key: 'all', label: 'All assets', Icon: Boxes },
  { key: 'Operational', label: 'Operational', Icon: CheckCircle2 },
  { key: 'Under Maintenance', label: 'Under maintenance', Icon: Wrench },
  { key: 'Down', label: 'Down', Icon: AlertTriangle },
]

const CARDS = [
  { id: 'total', title: 'Total assets', icon: Boxes, color: 'bg-indigo-500', description: 'In this scope', total: true },
  { id: 'operational', title: 'Operational', icon: CheckCircle2, color: 'bg-green-500', description: 'Running normally' },
  { id: 'maintenance', title: 'Under maintenance', icon: Wrench, color: 'bg-amber-500', description: 'Off line, being worked' },
  { id: 'down', title: 'Down', icon: AlertTriangle, color: 'bg-red-500', description: 'Costing production now' },
  { id: 'critical', title: 'High criticality', icon: AlertTriangle, color: 'bg-orange-500', description: 'Failure stops the line' },
  { id: 'iot', title: 'IoT connected', icon: Radio, color: 'bg-blue-500', description: 'Reporting telemetry' },
]

export default function AssetMaster() {
  const router = useRouter()
  const { scope, siteName } = useSite()
  const { notify } = useStore()

  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [crit, setCrit] = useState('all')
  const [type, setType] = useState('all')
  const [view, setView] = useState('grid')

  const merged = useRecords('asset', ASSETS, idOf)
  const all = useMemo(() => scope(merged), [scope, merged])
  const types = useMemo(() => [...new Set(ASSETS.map((a) => a.asset_type))].sort(), [])

  const counts = {
    total: all.length,
    operational: all.filter((a) => a.status === 'Operational').length,
    maintenance: all.filter((a) => a.status === 'Under Maintenance').length,
    down: all.filter((a) => a.status === 'Down').length,
    critical: all.filter((a) => a.criticality === 'High').length,
    iot: all.filter((a) => a.iot_enabled).length,
  }

  const byTab = useMemo(() => ({
    all,
    Operational: all.filter((a) => a.status === 'Operational'),
    'Under Maintenance': all.filter((a) => a.status === 'Under Maintenance'),
    Down: all.filter((a) => a.status === 'Down'),
  }), [all])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (byTab[tab] || all).filter((a) => (
      (crit === 'all' || a.criticality === crit) &&
      (type === 'all' || a.asset_type === type) &&
      (!q || [a.asset_name, a.asset_code, a.manufacturer, a.serial_number, a.functional_location_name]
        .join(' ').toLowerCase().includes(q))
    ))
  }, [byTab, tab, all, search, crit, type])

  // A page at a time. Every card at once was a 726 KB page on DHL's 150-unit
  // fleet, and a grid of that many health bars is not something anyone scans.
  const paged = usePaged(rows, 24, `${tab}|${search}|${crit}|${type}`)

  const openAsset = (a) => router.push(`/portal/oxmaint/assets/${idOf(a)}`)

  const exportCsv = () => {
    const cols = ['Code', 'Asset', 'Type', 'Manufacturer', 'Serial', 'Site', 'Location',
      'Criticality', 'Status', 'Health', 'Running hours', 'Next due']
    const cell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
    const body = rows.map((a) => [
      a.asset_code, a.asset_name, a.asset_type, a.manufacturer, a.serial_number,
      a.site_name, a.functional_location_name, a.criticality, a.status,
      a.health_score, a.running_hours, fmtDate(a.next_maintenance_date),
    ].map(cell).join(','))
    const url = URL.createObjectURL(new Blob([`﻿${[cols.join(','), ...body].join('\r\n')}`], { type: 'text/csv;charset=utf-8' }))
    const el = document.createElement('a')
    el.href = url
    el.download = 'assets.csv'
    document.body.appendChild(el)
    el.click()
    el.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    notify(`${rows.length} asset${rows.length === 1 ? '' : 's'} exported.`)
  }

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Asset Master</h1>
          <p className="text-slate-600 mt-1 text-sm md:text-base">
            {all.length} assets · {siteName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <Button
            variant="outline" className="h-10 px-4 gap-2"
            onClick={() => { setSearch(''); setCrit('all'); setType('all'); setTab('all') }}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button variant="outline" className="h-10 px-4 gap-2" onClick={exportCsv} disabled={!rows.length}>
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button className="h-10 px-4 gap-2" onClick={() => router.push('/portal/oxmaint/assets/new')}>
            <Plus className="w-4 h-4" />
            Add asset
          </Button>
        </div>
      </motion.div>

      <StatTiles
        rows={all}
        storageKey="oxAssetSummaryCards"
        cards={CARDS.map((c) => ({ ...c, value: counts[c.id] }))}
      />

      <ShadTabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-4 h-12">
          {TABS.map(({ key, label, Icon }) => (
            <TabsTrigger key={key} value={key} className="flex items-center gap-2">
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
              {byTab[key].length > 0 && <Badge variant="secondary">{byTab[key].length}</Badge>}
            </TabsTrigger>
          ))}
        </TabsList>
      </ShadTabs>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, code, manufacturer or serial…"
          className="h-10 sm:max-w-sm"
        />
        <Select value={crit} onValueChange={setCrit}>
          <SelectTrigger className="h-10 sm:w-44"><SelectValue placeholder="All criticality" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All criticality</SelectItem>
            {['High', 'Medium', 'Low'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-10 sm:w-52"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 sm:ml-auto">
          <span className="text-sm text-slate-500">{rows.length} shown</span>
          <div className="flex rounded-lg border border-slate-200 p-0.5">
            <Button
              size="sm" variant={view === 'grid' ? 'secondary' : 'ghost'}
              className="h-8 w-8 p-0" onClick={() => setView('grid')} title="Cards"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              size="sm" variant={view === 'list' ? 'secondary' : 'ghost'}
              className="h-8 w-8 p-0" onClick={() => setView('list')} title="List"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16">
          <Boxes className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No assets here</p>
          <p className="text-slate-400 text-sm mt-1">Nothing in the register matches these filters.</p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {paged.pageItems.map((a, i) => <AssetCard key={idOf(a)} asset={a} index={i} onOpen={openAsset} />)}
        </div>
      ) : (
        <div className="space-y-2">
          {paged.pageItems.map((a) => <AssetListItem key={idOf(a)} asset={a} onOpen={openAsset} />)}
        </div>
      )}
      {rows.length > 0 && <PagerBar {...paged} noun="assets" />}

    </div>
  )
}
