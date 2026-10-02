/**
 * Airline audit pack for a selectable quarter or six months.
 *
 * Chronological evidence drawn from the Oxmaint AI voice projection plus the
 * workbook historic register. Not live airline or production SAP data.
 */

import { newDoc, TONE } from '../../components/industries/oxmaint/lib/pdf.js'
import { VOICE_VOLUME } from '../../components/industries/oxmaint/lib/packs/dhl-gse-data/voiceVolume'
import { QUALITY_HONESTY, computeSpareInsights, computeWorkmanship } from '../../components/industries/oxmaint/lib/packs/dhl-gse-data/voiceInsights'
import { getVoiceRegister, loadDhlDataset } from './register.js'
import { stageMix } from './slices.js'

const DAY = 86400000

export const AUDIT_HONESTY =
  'Synthetic Oxmaint AI projection mirrored to SAP MM/PM shapes — not live airline or production SAP data.'

export function normalizeAuditPeriod(raw) {
  const key = String(raw || 'quarter').toLowerCase()
  if (key === '6m' || key === '6mo' || key === 'six' || key === 'half' || key === '180') return '6m'
  return 'quarter'
}

function parseStamp(s) {
  const t = Date.parse(s)
  return Number.isFinite(t) ? t : 0
}

export function selectAuditOrders({ period = 'quarter', voiceWorkOrders = [], historic = [], now } = {}) {
  const key = normalizeAuditPeriod(period)
  const end = now || Date.now()
  const days = key === '6m' ? 180 : 90
  const start = end - days * DAY
  const historicIn = (historic || []).filter((w) => {
    const t = parseStamp(w.created_date)
    return t >= start && t <= end
  })
  const voice = key === '6m'
    ? (voiceWorkOrders || []).filter((w) => w.voice_volume || w.voice_week)
    : (voiceWorkOrders || []).filter((w) => w.voice_week)
  const seen = new Set()
  const items = []
  for (const w of [...voice, ...historicIn]) {
    const id = w.work_order_number || w.workorder_id
    if (!id || seen.has(id)) continue
    seen.add(id)
    items.push(w)
  }
  items.sort((a, b) => String(a.created_date).localeCompare(String(b.created_date)))
  return {
    key,
    label: key === '6m' ? 'Last 6 months' : 'Last quarter',
    days,
    start: new Date(start).toISOString().slice(0, 10),
    end: new Date(end).toISOString().slice(0, 10),
    items,
    voice: voice.length,
    historic: historicIn.length,
  }
}

function pct(n, d) {
  if (!d) return '—'
  return `${Math.round((n / d) * 100)}%`
}

function pmCompliance(items, schedules, now) {
  const preventive = items.filter((w) => w.dhl_type === 'Preventive' || w.work_order_type === 'Preventive')
  const closed = preventive.filter((w) => w.dhl_status === 'Closed' || w.status === 'Completed')
  const onTime = closed.filter((w) => {
    if (!w.due_date || !w.completed_date) return true
    return parseStamp(w.completed_date) <= parseStamp(w.due_date) + DAY
  })
  const overdue = (schedules || []).filter((s) => {
    if (s.status !== 'Active') return false
    return parseStamp(s.next_due) < now
  })
  return {
    preventive: preventive.length,
    closed: closed.length,
    on_time: onTime.length,
    on_time_pct: preventive.length ? Math.round((onTime.length / Math.max(1, closed.length)) * 100) : 0,
    overdue: overdue.length,
    overdue_sample: overdue.slice(0, 8).map((s) => ({
      asset_id: s.asset_id,
      name: s.schedule_name,
      next_due: String(s.next_due || '').slice(0, 10),
    })),
  }
}

function assetHealth(assets = []) {
  const rows = assets || []
  const down = rows.filter((a) => a.out_of_service || /down|oos|hold/i.test(a.dhl_status || a.status || ''))
  const ready = rows.length - down.length
  const byType = new Map()
  for (const a of rows) {
    const t = a.asset_type || a.dhl_class || 'GSE'
    if (!byType.has(t)) byType.set(t, { type: t, n: 0, down: 0 })
    const row = byType.get(t)
    row.n += 1
    if (a.out_of_service || /down|oos/i.test(a.dhl_status || a.status || '')) row.down += 1
  }
  return {
    fleet: rows.length,
    ready,
    down: down.length,
    ready_pct: rows.length ? Math.round((ready / rows.length) * 100) : 0,
    by_type: [...byType.values()].sort((a, b) => b.n - a.n).slice(0, 8),
  }
}

function procurementHighlights(items) {
  const withChain = items.filter((w) => w.procurement)
  const pr = withChain.filter((w) => w.procurement.pr)
  const po = pr.filter((w) => w.procurement.po)
  const gr = po.filter((w) => w.procurement.gr)
  const hold = items.filter((w) => w.dhl_status === 'Parts Hold')
  return {
    reservations: withChain.length,
    pr: pr.length,
    po: po.length,
    gr: gr.length,
    parts_hold: hold.length,
    sample: pr.slice(0, 8).map((w) => ({
      work_order: w.work_order_number,
      chain: w.procurement.chain_status,
      pr: w.procurement.pr?.id,
      po: w.procurement.po?.id || '—',
      gr: w.procurement.gr?.id || '—',
    })),
  }
}

function hierarchySnapshot(assets = []) {
  const sample = assets.find((a) => a.asset_id === 'CVG-PWR-0035') || assets[0]
  const roots = new Map()
  for (const a of assets) {
    const top = a.pm_hierarchy?.functional_locations?.[0]?.label || 'CVG Superhub'
    roots.set(top, (roots.get(top) || 0) + 1)
  }
  return {
    example: sample
      ? {
        asset_id: sample.asset_id,
        path: sample.pm_hierarchy?.path_text || sample.sap_functional_location,
        equipment: sample.sap_equipment,
      }
      : null,
    locations: [...roots.entries()].map(([label, n]) => ({ label, n })),
  }
}

export function buildAuditModel({ period = 'quarter' } = {}) {
  const ds = loadDhlDataset()
  const reg = getVoiceRegister()
  const now = Date.now()
  const pack = selectAuditOrders({
    period,
    voiceWorkOrders: ds?.voiceWorkOrders || reg.workOrders || [],
    historic: ds?.workOrders || [],
    now,
  })
  const insights = {
    workmanship: ds?.voiceInsights?.workmanship || computeWorkmanship(ds?.voiceWorkOrders || pack.items),
    spares: ds?.voiceInsights?.spares || computeSpareInsights(ds?.voiceWorkOrders || pack.items),
  }
  const mix = stageMix(pack.items)
  return {
    honesty: AUDIT_HONESTY,
    quality_honesty: QUALITY_HONESTY,
    volume_honesty: VOICE_VOLUME.honesty,
    period: pack,
    mix,
    pm: pmCompliance(pack.items, ds?.pmSchedules || reg.pmSchedules || [], now),
    health: assetHealth(reg.assets || ds?.assets || []),
    procurement: procurementHighlights(pack.items),
    workmanship: insights.workmanship,
    spares: insights.spares,
    hierarchy: hierarchySnapshot(reg.assets || ds?.assets || []),
    chronology: pack.items.slice(0, 18).map((w) => ({
      when: String(w.created_date || '').slice(0, 10),
      work_order: w.work_order_number,
      asset_id: w.asset_id,
      title: w.title,
      status: w.dhl_status || w.status,
      type: w.dhl_type || w.work_order_type,
    })),
  }
}

export async function renderAuditPdf(model) {
  const m = model || buildAuditModel({ period: 'quarter' })
  const pdf = await newDoc({
    title: 'Airline GSE Audit Pack',
    subtitle: `DHL Express CVG Superhub — ${m.period.label}`,
    brand: 'Oxmaint AI',
    meta: [
      ['Prepared for', 'Airline / station audit'],
      ['Station', 'CVG Americas Superhub — GSE Maintenance'],
      ['Period', `${m.period.label} (${m.period.start} to ${m.period.end})`],
      ['Work orders in pack', String(m.period.items.length)],
      ['Voice projection', String(m.period.voice)],
      ['Historic register', String(m.period.historic)],
    ],
  })

  pdf.heading('Table of contents')
  pdf.para('1. Honesty and scope')
  pdf.para('2. PM compliance and overdue work')
  pdf.para('3. Asset health summary')
  pdf.para('4. Work-order chronology')
  pdf.para('5. Parts and PR - PO - GR highlights')
  pdf.para('6. Workmanship and rework')
  pdf.para('7. Spare-variant notes')
  pdf.para('8. Functional location / hierarchy snapshot')
  pdf.gap(6)

  pdf.heading('1. Honesty and scope')
  pdf.para(m.honesty)
  pdf.para(m.volume_honesty)
  pdf.para('This pack is an Oxmaint AI projection for a voice and portal demo. Counts, names, and SAP document numbers are synthetic and mirrored to SAP MM/PM shapes. They are not DHL actuals and not a live ECC or S/4 extract.')

  pdf.heading('2. PM compliance and overdue work')
  pdf.stats([
    { label: 'Preventive WOs', value: String(m.pm.preventive) },
    { label: 'Closed on time', value: pct(m.pm.on_time, m.pm.closed) },
    { label: 'Overdue PMs', value: String(m.pm.overdue) },
    { label: 'Period WOs', value: String(m.period.items.length) },
  ])
  pdf.para(`On-time is closed preventive work completed on or before the due stamp. Overdue PMs are active schedules whose next due is before today. ${m.quality_honesty}`)
  if (m.pm.overdue_sample.length) {
    pdf.table(
      [
        { header: 'Asset', key: 'asset_id', width: 1.2 },
        { header: 'Schedule', key: 'name', width: 2.4 },
        { header: 'Next due', key: 'next_due', width: 1 },
      ],
      m.pm.overdue_sample,
    )
  }

  pdf.heading('3. Asset health summary')
  pdf.stats([
    { label: 'Fleet in pack', value: String(m.health.fleet) },
    { label: 'Ready', value: `${m.health.ready} (${m.health.ready_pct}%)` },
    { label: 'Down / OOS', value: String(m.health.down), tone: m.health.down ? TONE.warn : TONE.ink },
  ])
  pdf.table(
    [
      { header: 'Equipment type', key: 'type', width: 2.2 },
      { header: 'Units', key: 'n', width: 0.8, align: 'right' },
      { header: 'Down', key: 'down', width: 0.8, align: 'right' },
    ],
    m.health.by_type,
  )

  pdf.heading('4. Work-order chronology')
  pdf.para(`Stage mix in this pack: assigned ${m.mix.assigned}, in progress ${m.mix.in_progress}, parts hold ${m.mix.parts_hold}, deferred ${m.mix.deferred}, completed ${m.mix.completed}, P1-AOG ${m.mix.p1_aog}. First ${m.chronology.length} jobs by created date:`)
  pdf.table(
    [
      { header: 'Date', key: 'when', width: 0.9 },
      { header: 'WO', key: 'work_order', width: 1.2 },
      { header: 'Asset', key: 'asset_id', width: 1.1 },
      { header: 'Type', key: 'type', width: 0.9 },
      { header: 'Status', key: 'status', width: 0.9 },
      { header: 'Title', key: 'title', width: 2 },
    ],
    m.chronology,
  )

  pdf.heading('5. Parts and PR - PO - GR highlights')
  pdf.stats([
    { label: 'Reservations', value: String(m.procurement.reservations) },
    { label: 'PRs', value: String(m.procurement.pr) },
    { label: 'POs', value: String(m.procurement.po) },
    { label: 'GRs posted', value: String(m.procurement.gr) },
  ])
  pdf.para('Reservation to PR to PO to GR is the SAP MM demo mirror on the voice register — not live production SAP.')
  if (m.procurement.sample.length) {
    pdf.table(
      [
        { header: 'WO', key: 'work_order', width: 1.2 },
        { header: 'Chain', key: 'chain', width: 1.2 },
        { header: 'PR', key: 'pr', width: 1.1 },
        { header: 'PO', key: 'po', width: 1.1 },
        { header: 'GR', key: 'gr', width: 1.1 },
      ],
      m.procurement.sample,
    )
  }

  pdf.heading('6. Workmanship and rework')
  pdf.para(m.workmanship.how_to_read)
  pdf.table(
    [
      { header: 'Technician', key: 'name', width: 1.4 },
      { header: 'Closed', key: 'closed', width: 0.7, align: 'right' },
      { header: 'Score', key: 'workmanship_score', width: 0.7, align: 'right' },
      { header: 'Band', key: 'band', width: 0.8 },
      { header: 'Rework', key: 'rework', width: 0.7, align: 'right' },
      { header: 'Bounce', key: 'bounce_back', width: 0.7, align: 'right' },
      { header: 'Reopen 14d', key: 'reopen_14', width: 0.8, align: 'right' },
    ],
    m.workmanship.technicians || [],
  )

  pdf.heading('7. Spare-variant notes')
  pdf.para(m.spares.how_to_read)
  const spareRows = [...(m.spares.best_fit || []).slice(0, 4), ...(m.spares.watch || []).slice(0, 4)]
  if (spareRows.length) {
    pdf.table(
      [
        { header: 'SKU', key: 'sku', width: 1.1 },
        { header: 'Channel', key: 'channel', width: 0.9 },
        { header: 'Vendor', key: 'vendor', width: 1.4 },
        { header: 'Rel.', key: 'reliability', width: 0.6, align: 'right' },
        { header: 'Verdict', key: 'verdict', width: 1 },
      ],
      spareRows,
    )
  }

  pdf.heading('8. Functional location / hierarchy snapshot')
  if (m.hierarchy.example) {
    pdf.fields([
      ['Example asset', m.hierarchy.example.asset_id],
      ['Equipment', m.hierarchy.example.equipment || '—'],
      ['Path', m.hierarchy.example.path || '—'],
      ['Locations counted', String(m.hierarchy.locations.length)],
    ])
  }
  pdf.para(`Footer and page numbers are Oxmaint AI. ${m.honesty}`)
  pdf.signature('Oxmaint AI — CVG GSE demo', 'Synthetic audit pack')
  const doc = pdf.end()
  const bytes = doc.output('arraybuffer')
  const filename = `oxmaint-ai-cvg-gse-audit-${m.period.key}.pdf`
  return { bytes, filename, model: m }
}

export async function generateAuditReport({ period = 'quarter' } = {}) {
  const model = buildAuditModel({ period })
  const rendered = await renderAuditPdf(model)
  return {
    ok: true,
    honesty: AUDIT_HONESTY,
    period: model.period.key,
    label: model.period.label,
    url: `/api/oxmaint/audit-report.pdf?period=${model.period.key}`,
    portal: `/portal/oxmaint/gse-audit-report?period=${model.period.key}`,
    work_orders: model.period.items.length,
    filename: rendered.filename,
    how_to_read:
      'Read back the download URL. The PDF is an Oxmaint AI airline audit pack — synthetic, dated, with a table of contents. Not live airline or SAP data.',
    bytes: rendered.bytes,
  }
}
