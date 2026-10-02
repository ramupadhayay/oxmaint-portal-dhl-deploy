// Volume + MCP slice check for the DHL CVG voice projection.
//
//   NEXT_PUBLIC_OXMAINT_PACK=dhl-gse node scripts/verify-dhl-voice.mjs
//
// Fails the process if this week is not ~400 or this month is not ~1,600, or
// if a named stage slice is empty.

import { createRequire, register } from 'node:module'
import { pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

process.env.NEXT_PUBLIC_OXMAINT_PACK = process.env.NEXT_PUBLIC_OXMAINT_PACK || 'dhl-gse'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
register(pathToFileURL(join(root, 'scripts/esm-resolve-hook.mjs')))
const require = createRequire(import.meta.url)

function fail(msg) {
  console.error(`FAIL  ${msg}`)
  process.exitCode = 1
}

function ok(msg) {
  console.log(`ok    ${msg}`)
}

const { generateVoiceVolumeWorkOrders, VOICE_VOLUME, matchesStage } = require(
  join(root, 'components/industries/oxmaint/lib/packs/dhl-gse-data/voiceVolume.js'),
)
const { ASSETS } = require(join(root, 'components/industries/oxmaint/lib/packs/dhl-gse-data/assets.js'))
const { META } = require(join(root, 'components/industries/oxmaint/lib/packs/dhl-gse-data/meta.js'))

const raw = generateVoiceVolumeWorkOrders({ asOf: META.asOf, assets: ASSETS })
const week = raw.filter((_, i) => i < VOICE_VOLUME.weeklyTarget)
const month = raw

if (month.length !== VOICE_VOLUME.monthlyTarget) {
  fail(`month count ${month.length} !== ${VOICE_VOLUME.monthlyTarget}`)
} else ok(`month projection ${month.length}`)

if (week.length !== VOICE_VOLUME.weeklyTarget) {
  fail(`week count ${week.length} !== ${VOICE_VOLUME.weeklyTarget}`)
} else ok(`week projection ${week.length}`)

const stages = ['parts_hold', 'deferred', 'in_progress', 'completed', 'p1_aog', 'open']
for (const stage of stages) {
  const n = week.filter((w) => matchesStage(w, stage)).length
  if (!n) fail(`week slice ${stage} is empty`)
  else ok(`week ${stage} = ${n}`)
}

if (!/Oxmaint/.test(VOICE_VOLUME.honesty) && !/synthetic/i.test(VOICE_VOLUME.honesty)) {
  fail('honesty banner missing')
} else ok('honesty banner present')

if (/Oxment/.test(VOICE_VOLUME.honesty)) fail('user-facing copy says Oxment')

const ids = new Set(raw.map((w) => w.WorkOrderID))
if (ids.size !== raw.length) fail('duplicate synthetic WO ids')
else ok(`${ids.size} unique WO-V ids`)

const { buildDataset } = await import(
  pathToFileURL(join(root, 'components/industries/oxmaint/lib/packs/dhl-gse-data/index.js')).href
)
const EPOCH = Date.UTC(2026, 8, 22, 6, 0, 0) // pinned so the shift is stable in CI
const ds = buildDataset(EPOCH, {
  pick: (k, from) => from[0],
  between: (_k, lo) => lo,
})
const portalWeek = (ds.workOrders || []).filter((w) => w.voice_week).length
if (portalWeek < 300) fail(`portal live register only gained ${portalWeek} week jobs`)
else ok(`portal live register includes ${portalWeek} current-week projection jobs (total ${ds.workOrders.length})`)

if ((ds.voiceWorkOrders || []).length !== VOICE_VOLUME.monthlyTarget) {
  fail(`mapped voice month ${ds.voiceWorkOrders?.length}`)
} else ok(`mapped voice month ${ds.voiceWorkOrders.length}`)

const { DEMO_TECH, DEMO_TECH_INDICES, DEMO_TECH_CLOSED } = require(
  join(root, 'components/industries/oxmaint/lib/packs/dhl-gse-data/voiceVolume.js'),
)
const alex = (ds.voiceWorkOrders || []).filter((w) => w.assigned_to_id === DEMO_TECH.tech_id || w.demo_tech)
const alexOpen = alex.filter((w) => w.dhl_status !== 'Closed' && w.status !== 'Completed')
const alexClosed = alex.filter((w) => w.dhl_status === 'Closed' || w.status === 'Completed')
if (alexOpen.length !== DEMO_TECH_INDICES.length) {
  fail(`demo tech open board ${alexOpen.length} !== ${DEMO_TECH_INDICES.length}`)
} else ok(`${alexOpen.length} open jobs assigned to ${DEMO_TECH.name} (${DEMO_TECH.tech_id})`)
if (alexClosed.length < DEMO_TECH_CLOSED.length) {
  fail(`demo tech closed history ${alexClosed.length} < ${DEMO_TECH_CLOSED.length}`)
} else ok(`${alexClosed.length} closed jobs for ${DEMO_TECH.name} workmanship history`)
if (!alex.some((w) => (w.parts_needed || []).length)) fail('demo tech board has no parts lines')
else ok(`tech board parts lines present`)

const insights = ds.voiceInsights
if (!insights?.workmanship?.technicians?.length) fail('voiceInsights.workmanship missing')
else {
  const byId = new Map(insights.workmanship.technicians.map((t) => [t.tech_id, t]))
  const alexScore = byId.get(DEMO_TECH.tech_id)
  const rework = byId.get('EMP-018')
  const bounce = byId.get('EMP-020')
  if (!alexScore || alexScore.closed < DEMO_TECH_CLOSED.length) fail(`Alex workmanship ${alexScore?.closed}`)
  else ok(`Alex workmanship ${alexScore.workmanship_score} ${alexScore.band} (${alexScore.closed} closed)`)
  if (!rework || rework.rework < 3 || rework.workmanship_score >= (alexScore.workmanship_score - 5)) {
    fail(`rework peer not distinct ${rework?.workmanship_score} rework=${rework?.rework}`)
  } else ok(`Taylor rework ${rework.workmanship_score} ${rework.band} rework=${rework.rework}`)
  if (!bounce || bounce.bounce_back < 3) fail(`bounce peer weak ${bounce?.bounce_back}`)
  else ok(`Sam bounce ${bounce.workmanship_score} ${bounce.band} bounce=${bounce.bounce_back}`)
  if (/Oxment/.test(insights.workmanship.honesty || '')) fail('workmanship honesty says Oxment')
  else if (!/synthetic/i.test(insights.workmanship.honesty || '')) fail('workmanship honesty missing')
  else ok('workmanship honesty present')
}

if (!insights?.spares?.variants?.length) fail('spare insights missing')
else {
  const best = insights.spares.best_fit || []
  const watch = insights.spares.watch || []
  if (!best.length || !watch.length) fail(`spare lists best=${best.length} watch=${watch.length}`)
  else ok(`spare variants ${insights.spares.variants.length} best=${best[0].sku} watch=${watch[0].sku}`)
  if (!insights.spares.variants.some((v) => v.channel === 'oem') || !insights.spares.variants.some((v) => v.channel === 'aftermarket')) {
    fail('spare insights missing oem/aftermarket channels')
  } else ok('spare insights cover OEM and aftermarket')
}

const holdWithParts = (ds.voiceWorkOrders || []).filter((w) => w.dhl_status === 'Parts Hold' && (w.parts_needed || []).length)
if (holdWithParts.length < 10) fail(`parts-hold jobs with lines: ${holdWithParts.length}`)
else ok(`parts-hold jobs with part lines = ${holdWithParts.length}`)

const weekMapped = (ds.voiceWorkOrders || []).filter((w) => w.voice_week)
const weekWithRes = weekMapped.filter((w) => (w.parts_needed || []).some((p) => p.reservation && p.plant && p.storage_location))
if (weekWithRes.length < 80) fail(`week jobs with reservation/plant/sloc: ${weekWithRes.length}`)
else ok(`week jobs with reservation lines = ${weekWithRes.length}`)

const holdPr = weekMapped.filter((w) => w.dhl_status === 'Parts Hold' && w.procurement?.pr)
const holdPo = holdPr.filter((w) => w.procurement?.po)
const holdGr = holdPr.filter((w) => w.procurement?.gr)
if (holdPr.length < 20) fail(`parts-hold with PR: ${holdPr.length}`)
else ok(`parts-hold with PR = ${holdPr.length}`)
if (holdPo.length < 10 || holdPo.length >= holdPr.length) fail(`parts-hold PO minority/majority ${holdPo.length}/${holdPr.length}`)
else ok(`parts-hold with PO = ${holdPo.length} (PR without PO = ${holdPr.length - holdPo.length})`)
if (holdGr.length) fail(`seeded GR on Parts Hold: ${holdGr.length}`)
else ok('no seeded GR on Parts Hold')

const closedChain = weekMapped.filter((w) => w.dhl_status === 'Closed' && w.procurement?.gr)
if (!closedChain.length) fail('no closed week jobs with full PR→PO→GR chain')
else ok(`closed week jobs with GR chain = ${closedChain.length}`)

const asset35 = (ds.assets || []).find((a) => a.asset_id === 'CVG-PWR-0035')
if (!asset35?.pm_hierarchy?.path_text) fail('CVG-PWR-0035 missing pm_hierarchy')
else if (!/Superhub/i.test(asset35.pm_hierarchy.path_text) || !/yard/i.test(asset35.pm_hierarchy.path_text) || !/belt/i.test(asset35.pm_hierarchy.path_text)) {
  fail(`hierarchy path weak: ${asset35.pm_hierarchy.path_text}`)
} else ok(`CVG-PWR-0035 hierarchy: ${asset35.pm_hierarchy.path_text}`)
if (!asset35.sap_equipment || !asset35.sap_functional_location) fail('0035 missing SAP PM keys')
else ok(`0035 equipment ${asset35.sap_equipment} FunctLoc ${asset35.sap_functional_location}`)

const rolesUrl = pathToFileURL(join(root, 'lib/dhl-gse/roles.js')).href
const sessionUrl = pathToFileURL(join(root, 'lib/dhl-gse/session.js')).href
const toolsUrl = pathToFileURL(join(root, 'lib/dhl-gse/tools.js')).href
const sapUrl = pathToFileURL(join(root, 'lib/dhl-gse/sapMirror.js')).href
const roles = await import(rolesUrl)
const session = await import(sessionUrl)
const tools = await import(toolsUrl)
const sap = await import(sapUrl)

const spokenCases = [
  ['triple zero one', '0001'],
  ['zero zero zero one', '0001'],
  ['0001', '0001'],
  ['oh oh oh two', '0002'],
  ['triple zero three', '0003'],
  ['3', '0003'],
]
for (const [said, expect] of spokenCases) {
  if (roles.normalizeSpokenCode(said) !== expect) fail(`normalize "${said}" → ${roles.normalizeSpokenCode(said)}`)
  else ok(`normalize "${said}" → ${expect}`)
}

roles.resetVoiceRole()
session.resetVoiceOverlays()
sap.resetSapMirror()
const blocked = await tools.getWeeklyWoProjection()
if (blocked.ok) fail('weekly projection should require a role')
else ok('ungated weekly projection blocked')

const asTech = await tools.verifyVoiceRole({ spoken_code: 'triple zero one' })
if (!asTech.ok || asTech.role !== 'technician') fail(`verify 0001 ${asTech.error || asTech.role}`)
else ok(`verified 0001 ${asTech.you_are}`)

const mine = await tools.listMyWorkOrders()
if (!mine.ok || !mine.total) fail(`list_my_work_orders ${mine.error || mine.total}`)
else ok(`list_my_work_orders ${mine.total} (open ${mine.open})`)
if (!mine.items.some((w) => (w.parts_needed || []).length)) fail('my WOs missing parts_needed')
else ok('technician parts_needed present')

const techStockWo = mine.items.find((w) => (w.parts_needed || []).length)
const techStock = await tools.checkGseMaterialStock({ work_order: techStockWo.work_order })
if (!techStock.ok || !techStock.items?.length) fail(`tech stock ${techStock.error || 'empty'}`)
else ok(`technician stock lines = ${techStock.items.length} (${techStock.items[0].availability})`)

const hier = await tools.getGseAssetHierarchy({ asset_id: 'CVG-PWR-0035' })
if (!hier.ok || !/0035/.test(hier.path_text || '')) fail(`hierarchy ${hier.error || hier.path_text}`)
else ok(`technician hierarchy: ${hier.path_text}`)

const techWeek = await tools.getWeeklyWoProjection()
if (techWeek.ok) fail('technician should not get the week plan')
else ok('technician blocked from week plan')

const created = await tools.createGseMaintenanceRequest({
  asset_id: 'CVG-PWR-0035',
  description: 'Belt loader conveyor slipping under load — verify script',
})
if (!created.ok || !/^REQ-V/.test(created.request?.request_id)) {
  fail(`create_maintenance_request ${created.error || 'bad id'}`)
} else ok(`create_maintenance_request ${created.request.request_id}`)

roles.resetVoiceRole()
const asSup = await tools.verifyVoiceRole({ spoken_code: '0002' })
if (!asSup.ok || asSup.role !== 'supervisor') fail(`verify 0002 ${asSup.error}`)
else ok('verified 0002 supervisor')

const weekly = await tools.getWeeklyWoProjection()
if (!weekly.ok) fail(`get_weekly_wo_projection: ${weekly.error}`)
else {
  ok(`tool week raised ${weekly.weekly.raised} (target ${weekly.weekly.target})`)
  ok(`tool month raised ${weekly.monthly.raised} (target ${weekly.monthly.target})`)
  if (weekly.weekly.raised < 350) fail('tool week raised too low')
  if (weekly.monthly.raised < 1500) fail('tool month raised too low')
  if (weekly.weekly.mix.assigned == null) fail('stage mix missing assigned')
  else ok(`stage mix assigned=${weekly.weekly.mix.assigned} parts_hold=${weekly.weekly.mix.parts_hold}`)
}

const parts = await tools.getDhlWoStatusSlice({ stage: 'parts_hold', period: 'week' })
if (!parts.ok || !parts.count) fail(`parts hold slice ${parts.count} ${parts.error || ''}`)
else ok(`tool parts_hold this week = ${parts.count}`)

const blockers = await tools.getGseMaterialBlockers()
if (!blockers.ok || !blockers.blocked_on_material) fail(`blockers ${blockers.error || blockers.blocked_on_material}`)
else ok(`supervisor blockers: ${blockers.blocked_on_material} WOs, ${blockers.open_prs} open PRs`)

const supCreate = await tools.createGseMaintenanceRequest({
  asset_id: 'CVG-PWR-0035',
  description: 'supervisor should not log this',
})
if (supCreate.ok) fail('supervisor should not create a request')
else ok('supervisor blocked from create_maintenance_request')

const supStock = await tools.checkGseMaterialStock({ sku: 'HOSE-HYD-12' })
if (supStock.ok) fail('supervisor should not check stock')
else ok('supervisor blocked from check_material_stock')

roles.resetVoiceRole()
const asStore = await tools.verifyVoiceRole({ spoken_code: 'zero zero zero three' })
if (!asStore.ok || asStore.role !== 'store') fail(`verify 0003 ${asStore.error}`)
else ok('verified 0003 store')

const storeMine = await tools.listMyWorkOrders()
if (storeMine.ok) fail('store should not see the technician board')
else ok('store blocked from list_my_work_orders')

const queue = await tools.getPartsHoldQueue()
if (!queue.ok || !queue.count) fail(`parts hold queue ${queue.error || queue.count}`)
else ok(`store parts hold queue = ${queue.count}`)
if (!queue.items.some((w) => (w.parts_needed || []).length)) fail('store queue missing part lines')
else ok('store queue has part hints')

const sampleHold = queue.items[0]
const stockBefore = await tools.checkGseMaterialStock({ work_order: sampleHold.work_order })
if (!stockBefore.ok || !stockBefore.items?.length) fail(`store stock ${stockBefore.error}`)
else ok(`store stock ${stockBefore.items[0].sku} on_hand=${stockBefore.items[0].on_hand} plant=${stockBefore.items[0].plant}`)

const statusBefore = await tools.getGsePrPoGrStatus({ work_order: sampleHold.work_order })
if (!statusBefore.ok) fail(`PR/PO/GR status ${statusBefore.error}`)
else ok(`PR/PO/GR ${statusBefore.chain_status} pr=${statusBefore.pr?.id || 'none'} po=${statusBefore.po?.id || 'none'}`)

const cleared = await tools.applyStoreUpdate({
  work_order: sampleHold.work_order,
  action: 'parts_received',
})
if (!cleared.ok || cleared.after !== 'In Progress') fail(`store update ${cleared.error || cleared.after}`)
else ok(`store update ${cleared.work_order} ${cleared.before} → ${cleared.after}`)
if (!cleared.gr?.id) fail('store update did not post a demo GR')
else ok(`demo GR ${cleared.gr.id} matdoc ${cleared.gr.sap_matdoc}`)

const after = await tools.getWorkOrderDetail({ work_order: sampleHold.work_order })
if (!after.ok || after.work_order.dhl_status !== 'In Progress') {
  fail(`overlay did not stick ${after.work_order?.dhl_status}`)
} else ok('session overlay cleared Parts Hold')
if (after.work_order.procurement?.chain_status !== 'GR_POSTED') {
  fail(`procurement after GR ${after.work_order.procurement?.chain_status}`)
} else ok('procurement chain GR_POSTED')

const stockAfter = await tools.checkGseMaterialStock({ sku: stockBefore.items[0].sku })
const beforeQty = stockBefore.items[0].on_hand
const afterRow = (stockAfter.items || []).find((r) => r.sku === stockBefore.items[0].sku)
if (!afterRow || afterRow.on_hand <= beforeQty) fail(`stock did not rise after GR (${beforeQty} → ${afterRow?.on_hand})`)
else ok(`stock after GR ${stockBefore.items[0].sku} ${beforeQty} → ${afterRow.on_hand}`)

const sync = await tools.getGseSapSyncStatus()
if (!sync.ok || sync.live_production_sap !== false) fail('sync status missing honesty')
else if (!/SAP MM demo mirror/.test(sync.mm?.source || '')) fail(`sync source ${sync.mm?.source}`)
else ok(`sync ${sync.mm.source} last ${sync.mm.last_synced_at}`)
if (/Oxment/.test(JSON.stringify(sync))) fail('sync copy says Oxment')
if (!/Oxmaint AI/.test(sync.honesty || '')) fail('sync honesty missing Oxmaint AI')
else ok('sync honesty names Oxmaint AI, not live SAP')

const inbound = await tools.applyDemoSapInbound({
  idoc_type: 'FUNCLOC_CHANGE',
  asset_id: 'CVG-PWR-0035',
  tplnr: 'CVG-GSE-BL-0035-DEMO',
})
if (!inbound.ok || !/DEMO/.test(inbound.hierarchy?.path_text || inbound.hierarchy?.functional_locations?.slice(-1)[0]?.tplnr || '')) {
  fail(`inbound FL ${inbound.error || JSON.stringify(inbound.hierarchy)}`)
} else ok(`inbound FuncLoc applied (${inbound.idoc?.idoc})`)

const createPrOnClosed = weekMapped.find((w) => w.dhl_status === 'Assigned' && w.procurement && !w.procurement.pr)
if (createPrOnClosed) {
  const raised = await tools.createGsePurchaseRequisition({ work_order: createPrOnClosed.work_order_number })
  if (!raised.ok || !raised.pr?.id) fail(`create PR ${raised.error}`)
  else ok(`create PR ${raised.pr.id} on ${createPrOnClosed.work_order_number}`)
} else ok('create PR skipped (no reservation-only assigned job)')

roles.resetVoiceRole()
const asSup2 = await tools.verifyVoiceRole({ spoken_code: '0002' })
if (!asSup2.ok) fail('re-verify 0002')
const wm = await tools.getGseWorkmanshipScore()
if (!wm.ok || !wm.technicians?.some((t) => t.tech_id === DEMO_TECH.tech_id)) {
  fail(`supervisor workmanship ${wm.error || 'no Alex'}`)
} else ok(`supervisor workmanship ${wm.technicians.length} techs`)

const audit = await tools.generateGseAuditReport({ period: 'quarter' })
if (!audit.ok || !/audit-report\.pdf/.test(audit.url || '')) fail(`audit tool ${audit.error || audit.url}`)
else ok(`audit URL ${audit.url} (${audit.work_orders} WOs)`)

roles.resetVoiceRole()
await tools.verifyVoiceRole({ spoken_code: '0001' })
const own = await tools.getGseWorkmanshipScore()
if (!own.ok || own.technician?.tech_id !== DEMO_TECH.tech_id) fail(`tech own score ${own.error}`)
else ok(`technician own score ${own.technician.workmanship_score}`)
const techAudit = await tools.generateGseAuditReport({ period: 'quarter' })
if (techAudit.ok) fail('technician should not generate the audit PDF')
else ok('technician blocked from generate_audit_report')

roles.resetVoiceRole()
await tools.verifyVoiceRole({ spoken_code: '0003' })
const spare = await tools.getGseSpareVariantInsights()
if (!spare.ok || !spare.best_fit?.length) fail(`store spare insights ${spare.error}`)
else ok(`store spare insights best=${spare.best_fit[0].sku} watch=${spare.watch?.[0]?.sku || 'n/a'}`)
const storeWm = await tools.getGseWorkmanshipScore()
if (storeWm.ok) fail('store should not read workmanship scores')
else ok('store blocked from get_workmanship_score')

const { generateAuditReport, AUDIT_HONESTY } = await import(
  pathToFileURL(join(root, 'lib/dhl-gse/auditReport.js')).href
)
const rendered = await generateAuditReport({ period: 'quarter' })
if (!rendered.bytes || rendered.bytes.byteLength < 2000) fail(`audit pdf bytes ${rendered.bytes?.byteLength}`)
else ok(`audit pdf ${rendered.bytes.byteLength} bytes`)
if (!/Oxmaint AI/.test(AUDIT_HONESTY) || /Oxment/.test(AUDIT_HONESTY)) fail('audit honesty')
else ok('audit honesty names Oxmaint AI')

const { mkdirSync, writeFileSync } = await import('node:fs')
const artifactDirs = [
  join(root, 'artifacts'),
  '/opt/cursor/artifacts',
]
for (const dir of artifactDirs) {
  try {
    mkdirSync(dir, { recursive: true })
    const dest = join(dir, 'dhl-gse-airline-audit-quarter.pdf')
    writeFileSync(dest, Buffer.from(rendered.bytes))
    ok(`wrote ${dest}`)
  } catch (err) {
    ok(`skip artifact dir ${dir}: ${err.message}`)
  }
}

if (!ds.voiceWaterfall?.stages?.length) fail('voiceWaterfall missing')
else {
  const by = Object.fromEntries(ds.voiceWaterfall.stages.map((s) => [s.key, s.count]))
  const weekWf = (ds.voiceWorkOrders || []).filter((w) => w.voice_week)
  const weekBy = {}
  for (const w of weekWf) {
    const k = w.waterfall || 'unknown'
    weekBy[k] = (weekBy[k] || 0) + 1
  }
  if ((weekBy.planning || 0) < 8) fail(`week planning ${weekBy.planning}`)
  else ok(`week planning ${weekBy.planning} (plan/unplanned mix on Assigned)`)
  if ((weekBy.parts_short || 0) !== 32) fail(`week parts_short ${weekBy.parts_short}`)
  else ok(`week parts_short ${weekBy.parts_short} (Parts Hold)`)
  if ((weekBy.manpower || 0) < 8) fail(`week manpower ${weekBy.manpower}`)
  else ok(`week manpower ${weekBy.manpower}`)
  if ((weekBy.in_flow || 0) < 30) fail(`week in_flow ${weekBy.in_flow}`)
  else ok(`week in_flow ${weekBy.in_flow}`)
  if ((weekBy.review || 0) !== 18) fail(`week review ${weekBy.review}`)
  else ok(`week review ${weekBy.review} (QA Review)`)
  const weekVar = weekWf.filter((w) => w.scope_variation).length
  if (weekVar < 5) fail(`week variation ${weekVar}`)
  else ok(`week scope variation ${weekVar}`)
  const archived = (ds.voiceWorkOrders || []).filter((w) => w.archived).length
  if (archived < 200) fail(`archived ${archived}`)
  else ok(`archived ${archived} of month ${ds.voiceWorkOrders.length}`)
  ok(`month waterfall planning=${by.planning || 0} completed=${by.completed || 0} archived=${by.archived || 0}`)
}

roles.resetVoiceRole()
await tools.verifyVoiceRole({ spoken_code: '0002' })
const pipe = await tools.getGseWaterfallPipeline({ period: 'week' })
if (!pipe.ok || !pipe.highlights) fail(`waterfall pipeline ${pipe.error}`)
else ok(`waterfall need_pr=${pipe.highlights.need_pr} review=${pipe.highlights.review} variation=${pipe.highlights.variation}`)

const planningList = await tools.listGseWaterfallStage({ stage: 'planning', period: 'week' })
if (!planningList.ok || !planningList.count) fail(`list planning ${planningList.error || planningList.count}`)
else ok(`list_waterfall_stage planning ${planningList.count}`)

const thursday = await tools.getGseManpowerPlan({ day: 'Thursday' })
if (!thursday.ok) fail(`manpower ${thursday.error}`)
else ok(`manpower Thursday ${thursday.by_day?.[0]?.jobs ?? 0} jobs`)

const reviewList = await tools.listGseWaterfallStage({ stage: 'review', limit: 3 })
const reviewWo = reviewList.items?.[0]?.work_order
if (!reviewWo) fail('no review WO to close')
else {
  const closed = await tools.closeGseTechnicalReview({ work_order: reviewWo })
  if (!closed.ok || closed.to !== 'completed') fail(`technical close ${closed.error || closed.to}`)
  else ok(`close_technical_review ${reviewWo} → ${closed.to}`)
}

const planWo = planningList.items?.[0]?.work_order
if (planWo) {
  const assigned = await tools.assignGseWorkOrder({ work_order: planWo, tech_id: 'EMP-010', tech_name: 'Lena Keller' })
  if (!assigned.ok || assigned.waterfall !== 'manpower') fail(`assign ${assigned.error}`)
  else ok(`assign_work_order ${planWo} → manpower`)
}

roles.resetVoiceRole()
await tools.verifyVoiceRole({ spoken_code: '0003' })
const storePipe = await tools.getGseWaterfallPipeline()
if (storePipe.ok) fail('store should not get the full waterfall')
else ok('store blocked from get_waterfall_pipeline')
const storeShort = await tools.listGseWaterfallStage({ stage: 'parts_short' })
if (!storeShort.ok || storeShort.count < 30) fail(`store parts_short ${storeShort.error || storeShort.count}`)
else ok(`store list parts_short ${storeShort.count}`)

roles.resetVoiceRole()
await tools.verifyVoiceRole({ spoken_code: '0001' })
const techPipe = await tools.getGseWaterfallPipeline()
if (techPipe.ok) fail('technician should not get the waterfall')
else ok('technician blocked from get_waterfall_pipeline')

if (!process.exitCode) console.log('\nDHL CVG voice volume + role + SAP-mirror + insights/audit + waterfall check passed.')
else console.error('\nDHL CVG voice volume + role + SAP-mirror + insights/audit + waterfall check failed.')
