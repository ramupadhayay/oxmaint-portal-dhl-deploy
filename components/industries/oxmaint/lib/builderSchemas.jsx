'use client'

// What the three builder screens are made of.
//
// Kept apart from the builder itself because they answer different questions:
// builder.jsx knows how a section navigator behaves, and this file knows that a
// work order needs a permit type once a permit is requested and that a
// meter-based PM is counted in running hours. Mixing the two is what makes a
// form component impossible to reuse.
//
// The `derive` on each schema is the same idea the modal forms carry: the extra
// fields the list screens read but nobody should be asked to type. Nothing here
// is random — a demo that produces a different work order number on every run
// cannot be rehearsed — so the numbers come from the seeded hash instead.

import {
  ASSETS, LOCATIONS, PARTS, SITES, TEAMS, TECHNICIANS, WORK_ORDERS,
  OPEN_STATUS, ORG, USER, DOMAIN, daysFrom, seed,
} from './data'

// Example values in the empty fields, which a pack can make its own.
const HINT = DOMAIN?.placeholders || {}

const inDays = (n) => daysFrom(n).slice(0, 10)
const today = () => inDays(0)

// ── option lists ─────────────────────────────────────────────────────────
const assetOptions = () => ASSETS.map((a) => ({ value: a.asset_id, label: `${a.asset_name} — ${a.asset_code}` }))
const techOptions = () => TECHNICIANS.map((t) => ({ value: t.name, label: `${t.name} (${t.role})` }))
const teamOptions = () => TEAMS.map((t) => ({ value: t.team_name, label: `${t.team_name} — ${t.lead_name}` }))
const partOptions = () => PARTS.map((p) => ({ value: p.part_id, label: `${p.part_name} — ${p.part_number}` }))
const locationOptions = () => LOCATIONS.map((l) => ({
  value: l.functional_location_id,
  label: `${l.name} — ${SITES.find((s) => s.site_id === l.site_id)?.site_name || ''}`,
}))
const openWorkOrderOptions = () => WORK_ORDERS
  .filter((w) => OPEN_STATUS.includes(w.status))
  .slice(0, 40)
  .map((w) => ({ value: w.work_order_number, label: `${w.work_order_number} — ${w.title}` }))

const TRADES = ['Mechanical', 'Electrical', 'Instrumentation', 'General']
const PERMIT_TYPES = ['Hot Work', 'Confined Space', 'Working at Height', 'Electrical Isolation']
const PPE = ['Gloves', 'Eye protection', 'Ear defenders', 'Safety harness', 'Face shield', 'Respirator']
const DOC_TYPES = ['PDF', 'DWG', 'XLSX', 'Photo']
const LABOUR_CODES = [
  { value: 'LC-MECH', label: 'LC-MECH — Mechanical fitter' },
  { value: 'LC-ELEC', label: 'LC-ELEC — Electrician' },
  { value: 'LC-INST', label: 'LC-INST — Instrument technician' },
  { value: 'LC-SUPV', label: 'LC-SUPV — Supervisor' },
  { value: 'LC-CONT', label: 'LC-CONT — Contractor' },
]
const COST_CENTRES = [
  'CC-1000 — Maintenance', 'CC-1100 — Utilities', 'CC-1200 — Production', 'CC-1300 — Capital projects',
]

// ── the rules behind Ask Synapse ─────────────────────────────────────────
//
// Keyword tables and lookups against the plant's own records. First match wins,
// so the same words always produce the same proposal and each one can be
// justified out loud — which is the only kind of suggestion worth putting in
// front of a planner.

const WO_SIGNALS = [
  { match: /break ?down|stopped|will not start|won.t start|failed|tripping|out of service|no output/i, type: 'Breakdown', priority: 'Critical' },
  { match: /leak|weep|spill|smok|burn|overheat|running hot/i, type: 'Corrective', priority: 'High' },
  { match: /vibrat|noise|alarm|above threshold|excessive/i, type: 'Corrective', priority: 'High' },
  { match: /inspect|survey|walk-?round|examin|audit/i, type: 'Inspection', priority: 'Medium' },
  { match: /service|routine|weekly|monthly|quarterly|annual|greas|lubricat|calibrat|filter change/i, type: 'Preventive', priority: 'Medium' },
  { match: /replace|repair|refit|renew|adjust|tighten|clean|top up/i, type: 'Corrective', priority: 'Medium' },
]
const signalFor = (text) => WO_SIGNALS.find((s) => s.match.test(String(text || ''))) || { type: 'Corrective', priority: 'Medium' }

const TRADE_SIGNALS = [
  { trade: 'Electrical', match: /motor|contactor|panel|wiring|electric|overload|trip|starter|inverter|vfd/i },
  { trade: 'Instrumentation', match: /calibrat|transmitter|sensor|gauge|instrument|probe|plc|signal/i },
  { trade: 'Mechanical', match: /bearing|belt|pump|seal|gearbox|coupling|hydraulic|valve|chain|align|leak/i },
]
const tradeFor = (text) => TRADE_SIGNALS.find((t) => t.match.test(String(text || '')))?.trade || 'Mechanical'

const ASSET_TYPES = [...new Set(ASSETS.map((a) => a.asset_type))]

// Both the whole type and its head noun, because nobody writing a work order
// types "hydraulic press" — they type "press". Longest word first so "cooling
// tower" is not beaten to the match by a shorter, vaguer one.
const ASSET_WORDS = ASSET_TYPES
  .flatMap((type) => {
    const words = type.split(' ')
    return words.length > 1 ? [{ word: type, type }, { word: words[words.length - 1], type }] : [{ word: type, type }]
  })
  .sort((a, b) => b.word.length - a.word.length)

// "The compressor" means the one in the worst condition far more often than it
// means any other, and the health score is already in the data — so the pick is
// derived rather than guessed, and the chip can say why.
const assetFromText = (text) => {
  const t = String(text || '').toLowerCase()
  const hit = ASSET_WORDS.find(({ word }) => new RegExp(`\\b${word.toLowerCase()}s?\\b`).test(t))
  if (!hit) return null
  return [...ASSETS.filter((a) => a.asset_type === hit.type)]
    .sort((a, b) => a.health_score - b.health_score || a.asset_name.localeCompare(b.asset_name))[0] || null
}

const assetOf = (v) => ASSETS.find((a) => a.asset_id === v.asset_id) || null

const OPEN_LOAD = TECHNICIANS
  .filter((t) => t.role !== 'Administrator')
  .map((t) => ({
    name: t.name,
    trade: t.trade,
    open: WORK_ORDERS.filter((w) => w.assigned_to_name === t.name && OPEN_STATUS.includes(w.status)).length,
  }))

const leastLoaded = (trade) => {
  const pool = OPEN_LOAD.filter((t) => t.trade === trade)
  const from = pool.length ? pool : OPEN_LOAD
  return [...from].sort((a, b) => a.open - b.open || a.name.localeCompare(b.name))[0]?.name || ''
}

const DUE_DAYS = { Critical: 1, High: 3, Medium: 7, Low: 14 }
const HOURS_BY_TYPE = { Breakdown: 4, Corrective: 3, Preventive: 2, Inspection: 1 }

const WO_TASKS = {
  Breakdown: [
    'Isolate the asset and apply locks', 'Fault-find and confirm the failure',
    'Replace the failed component', 'Function test and return to service',
  ],
  Corrective: [
    'Isolate the asset and apply locks', 'Carry out the repair',
    'Function test after the repair', 'Update the asset history',
  ],
  Preventive: [
    'Isolate and lock off', 'Work through the manufacturer service schedule',
    'Replace filters and consumables', 'Record readings and close out',
  ],
  Inspection: [
    'Complete the inspection checklist', 'Photograph any defect found',
    'Raise follow-up work for defects',
  ],
}

const DEFAULT_PART_SIGNALS = [
  { match: /belt/i, name: 'V-Belt A-section' },
  { match: /bearing/i, name: 'Deep Groove Bearing 6205' },
  { match: /filter/i, name: 'Air Filter Element' },
  { match: /seal|gland|weep/i, name: 'Mechanical Seal 35mm' },
  { match: /hydraulic|oil leak/i, name: 'Hydraulic Oil ISO 46' },
  { match: /gearbox/i, name: 'Gearbox Oil 220' },
  { match: /contactor|overload|starter/i, name: 'Contactor 40A' },
  { match: /transmitter|calibrat|pressure/i, name: 'Pressure Transmitter 0-16 bar' },
  { match: /coupling/i, name: 'Coupling Element' },
  { match: /proximity|sensor/i, name: 'Proximity Sensor M18' },
  { match: /chain/i, name: 'Drive Chain 12B-1' },
  { match: /motor|rewind/i, name: 'Motor 5.5kW 4-pole' },
]

// A pack whose parts master names different stock brings its own table. The
// generic names would find nothing in it, and a proposal of no parts is worse
// than none because it looks like the rule ran and decided.
const PART_SIGNALS = DOMAIN?.partSignals?.length ? DOMAIN.partSignals : DEFAULT_PART_SIGNALS

const partsFromText = (text) => PART_SIGNALS
  .filter((s) => s.match.test(String(text || '')))
  .map((s) => PARTS.find((p) => p.part_name === s.name))
  .filter(Boolean)
  .slice(0, 3)
  .map((p) => ({ part_id: p.part_id, quantity: 1, note: '' }))

// ── optional sections shared by the work order and the PM schedule ───────
// Both records carry the same safety, parts, labour and cost detail, and the two
// screens must ask for it identically or the data behind them diverges.

const advancedSection = (textOf, extra = []) => ({
  key: 'advanced',
  title: 'Advanced Details',
  description: 'Safety requirements and compliance settings',
  icon: 'shield',
  required: false,
  fields: [
    { key: 'permit_required', label: 'Work permit required', type: 'toggle', toggleLabel: 'Permit to work' },
    {
      key: 'permit_type', label: 'Permit type', type: 'select', options: PERMIT_TYPES,
      suggest: (v) => (v.permit_required ? (/hot work|weld|grind|cut/i.test(textOf(v)) ? 'Hot Work' : /electric|panel|motor|isolat/i.test(textOf(v)) ? 'Electrical Isolation' : /height|roof|platform|ladder/i.test(textOf(v)) ? 'Working at Height' : 'Confined Space') : ''),
      suggestWhy: 'from the description',
    },
    { key: 'isolation_required', label: 'Isolation required', type: 'toggle', toggleLabel: 'Lock off and tag' },
    { key: 'risk_level', label: 'Risk level', type: 'select', options: ['High', 'Medium', 'Low'] },
    {
      key: 'ppe', label: 'PPE required', type: 'multiselect', options: PPE,
      suggest: (v) => {
        const t = textOf(v)
        const out = ['Gloves', 'Eye protection']
        if (/height|roof|platform|ladder/i.test(t)) out.push('Safety harness')
        if (/weld|grind|cut/i.test(t)) out.push('Face shield')
        if (/dust|paint|chemical|solvent/i.test(t)) out.push('Respirator')
        if (/compressor|noise|press/i.test(t)) out.push('Ear defenders')
        return out
      },
      suggestWhy: 'from the work described',
    },
    { key: 'shutdown_required', label: 'Needs a shutdown', type: 'toggle', toggleLabel: 'Plant stop needed' },
    { key: 'compliance_ref', label: 'Compliance reference', type: 'text', maxLength: 60, placeholder: 'Risk assessment or standard' },
    ...extra,
  ],
})

const partsSection = (textOf) => ({
  key: 'parts',
  title: 'Parts & Materials',
  description: 'Required parts and materials',
  icon: 'parts',
  required: false,
  fields: [
    {
      key: 'parts', label: 'Parts required', type: 'rows', addLabel: 'Add part',
      rowNoun: 'part', emptyNote: 'No parts booked against this record yet.',
      rowFields: [
        { key: 'part_id', label: 'Part', type: 'select', options: partOptions, flex: 3 },
        { key: 'quantity', label: 'Qty', type: 'number', min: 1, flex: 0.7 },
        { key: 'note', label: 'Note', type: 'text', placeholder: 'Optional', flex: 1.4 },
      ],
      suggest: (v) => partsFromText(textOf(v)),
      suggestWhy: 'from the words used',
    },
    { key: 'reserve_stock', label: 'Reserve from stores', type: 'toggle', toggleLabel: 'Hold the stock' },
  ],
})

const labourSection = (textOf) => ({
  key: 'labour',
  title: 'Labour & Resources',
  description: 'Labour codes and resource assignments',
  icon: 'people',
  required: false,
  fields: [
    {
      key: 'labour', label: 'Labour booked', type: 'rows', addLabel: 'Add labour line',
      rowNoun: 'line', emptyNote: 'No labour booked yet.',
      rowFields: [
        { key: 'name', label: 'Person', type: 'select', options: techOptions, flex: 2 },
        { key: 'labour_code', label: 'Labour code', type: 'select', options: LABOUR_CODES, flex: 2 },
        { key: 'hours', label: 'Hours', type: 'number', min: 0, step: '0.5', flex: 0.8 },
      ],
      suggest: (v) => {
        const trade = tradeFor(textOf(v))
        const code = { Mechanical: 'LC-MECH', Electrical: 'LC-ELEC', Instrumentation: 'LC-INST' }[trade] || 'LC-MECH'
        return [{ name: v.assigned_to_name || leastLoaded(trade), labour_code: code, hours: Number(v.estimated_hours) || 2 }]
      },
      suggestWhy: 'from the trade and hours',
    },
    { key: 'team', label: 'Team', type: 'select', options: teamOptions },
    { key: 'crew_size', label: 'Crew size', type: 'number', min: 1, placeholder: '1' },
  ],
})

const attachmentsSection = () => ({
  key: 'attachments',
  title: 'Attachments',
  description: 'Supporting documents and files',
  icon: 'attachment',
  required: false,
  fields: [
    {
      key: 'attachments', label: 'Documents', type: 'rows', addLabel: 'Add document',
      rowNoun: 'document', emptyNote: 'Nothing attached yet.',
      rowFields: [
        { key: 'name', label: 'Document name', type: 'text', placeholder: 'Method statement', flex: 3 },
        { key: 'document_type', label: 'Type', type: 'select', options: DOC_TYPES, flex: 1 },
      ],
    },
    { key: 'drawing_ref', label: 'Drawing reference', type: 'text', maxLength: 40, placeholder: 'DRG-00123' },
  ],
})

const costsSection = (extra = []) => ({
  key: 'costs',
  title: 'Costs & Budget',
  description: 'Cost tracking and budget information',
  icon: 'money',
  required: false,
  fields: [
    { key: 'labour_cost', label: `Labour cost (${ORG.currency})`, type: 'number', min: 0, step: '0.01' },
    { key: 'parts_cost', label: `Parts cost (${ORG.currency})`, type: 'number', min: 0, step: '0.01' },
    { key: 'contractor_cost', label: `Contractor cost (${ORG.currency})`, type: 'number', min: 0, step: '0.01' },
    { key: 'cost_centre', label: 'Cost centre', type: 'select', options: COST_CENTRES },
    { key: 'budget_code', label: 'Budget code', type: 'text', maxLength: 20, placeholder: 'BUD-2026-04' },
    ...extra,
  ],
})

const reviewSection = (description) => ({
  key: 'review',
  title: 'Review & Submit',
  description,
  icon: 'review',
  required: true,
  type: 'review',
  fields: [],
})

// ── work order ───────────────────────────────────────────────────────────
const woText = (v) => `${v.title || ''} ${v.description || ''}`

export const WORK_ORDER_SCHEMA = {
  key: 'work_order',
  navKey: 'work-orders',
  title: 'Create work order',
  subtitle: 'Raise a job against an asset or a functional location',
  submitLabel: 'Create work order',
  readyNote: 'Parts, labour and costs can still be added before you submit.',

  sections: [
    {
      key: 'basic',
      title: 'Basic Information',
      description: 'Essential work order details and scheduling',
      icon: 'info',
      required: true,
      fields: [
        {
          key: 'title', label: 'Work order title', type: 'text', required: true, maxLength: 200,
          placeholder: 'What needs doing?', missingMessage: 'Work order title is required',
        },
        // Type, priority and due date are not held back for: the planner who
        // leaves them alone gets corrective, medium and a week from now out of
        // `derive`, which is what the product does today. Marking them required
        // would put three more chips in the validation panel for answers the
        // system can work out on its own.
        {
          key: 'work_order_type', label: 'Work order type', type: 'select',
          options: ['Corrective', 'Preventive', 'Inspection', 'Breakdown'],
          suggest: (v) => (v.title ? signalFor(v.title).type : ''),
          suggestWhy: 'from the title',
        },
        {
          key: 'priority', label: 'Priority', type: 'select',
          options: ['Critical', 'High', 'Medium', 'Low'],
          suggest: (v) => (v.title ? signalFor(v.title).priority : ''),
          suggestWhy: 'from the title',
        },
        {
          key: 'asset_id', label: 'Related asset', type: 'select', options: assetOptions,
          // Either identifier will do, so neither is required on its own — but
          // a job against nothing at all cannot be planned, scheduled or costed.
          requiredIf: (v) => !v.functional_location_id,
          missingMessage: 'Either a related asset or functional location is required',
          suggest: (v) => assetFromText(v.title)?.asset_id || '',
          suggestWhy: 'lowest health of that type',
        },
        {
          key: 'functional_location_id', label: 'Functional location', type: 'select', options: locationOptions,
          suggest: (v) => assetOf(v)?.functional_location_id || '',
          suggestWhy: 'where the asset sits',
        },
        {
          key: 'assigned_to_name', label: 'Assign to', type: 'select', required: true, options: techOptions,
          missingMessage: 'Assignment is required',
          suggest: (v) => leastLoaded(tradeFor(woText(v))),
          suggestWhy: 'fewest open jobs in that trade',
        },
        {
          key: 'due_date', label: 'Due date', type: 'date',
          suggest: (v) => (v.priority ? inDays(DUE_DAYS[v.priority] ?? 7) : ''),
          suggestWhy: 'from the priority',
        },
        {
          key: 'estimated_hours', label: 'Estimated hours', type: 'number', min: 0, step: '0.5', placeholder: '2',
          suggest: (v) => (v.work_order_type ? HOURS_BY_TYPE[v.work_order_type] ?? 2 : ''),
          suggestWhy: 'typical for this type',
        },
        {
          key: 'description', label: 'Description', type: 'textarea', maxLength: 600, rows: 4,
          placeholder: 'Detail for whoever picks this up',
          suggest: (v) => {
            if (!v.title) return ''
            const asset = assetOf(v)
            const loc = LOCATIONS.find((l) => l.functional_location_id === v.functional_location_id)
            const where = asset ? `${asset.asset_name} (${asset.asset_code}) at ${asset.site_name}` : loc ? loc.name : 'the asset'
            const type = v.work_order_type || signalFor(v.title).type
            const priority = v.priority || signalFor(v.title).priority
            return `${v.title} on ${where}. Raised as ${type.toLowerCase()} work at ${priority.toLowerCase()} priority.`
              + (type === 'Breakdown' ? ' The asset is out of service until this is closed.' : '')
          },
          suggestWhy: 'from the title and asset',
        },
      ],
    },

    {
      key: 'tasks',
      title: 'Task List',
      description: 'Define tasks and work breakdown',
      icon: 'tasks',
      required: true,
      fields: [
        {
          key: 'tasks', label: 'Tasks', type: 'rows', addLabel: 'Add task', startRows: 1,
          rowNoun: 'task', emptyNote: 'No tasks yet — the job will be issued as a single line.',
          rowFields: [
            { key: 'description', label: 'Task', type: 'text', placeholder: 'What is to be done?', flex: 3 },
            { key: 'trade', label: 'Trade', type: 'select', options: TRADES, flex: 1.2 },
            { key: 'hours', label: 'Hours', type: 'number', min: 0, step: '0.5', flex: 0.7 },
          ],
          suggest: (v) => {
            const type = v.work_order_type || (v.title ? signalFor(v.title).type : '')
            if (!type) return []
            const list = WO_TASKS[type] || WO_TASKS.Corrective
            const trade = tradeFor(woText(v))
            const total = Number(v.estimated_hours) || HOURS_BY_TYPE[type] || 2
            const each = Math.max(0.5, Math.round((total / list.length) * 2) / 2)
            return list.map((description) => ({ description, trade, hours: each }))
          },
          suggestWhy: 'standard breakdown for this type',
        },
      ],
    },

    reviewSection('Review all information before submitting'),

    advancedSection(woText),
    partsSection(woText),
    attachmentsSection(),
    labourSection(woText),

    {
      key: 'remarks',
      title: 'Remarks & Notes',
      description: 'Additional notes and observations',
      icon: 'note',
      required: false,
      fields: [
        { key: 'remarks', label: 'Remarks', type: 'textarea', maxLength: 500, rows: 3, placeholder: 'Anything the technician should know' },
        { key: 'handover_note', label: 'Handover note', type: 'textarea', maxLength: 300, rows: 2, placeholder: 'For the next shift' },
        { key: 'notify_requester', label: 'Notify the requester', type: 'toggle', toggleLabel: 'Send an update' },
      ],
    },

    {
      key: 'linked',
      title: 'Linked Work Orders',
      description: 'Link related & parent WOs',
      icon: 'link',
      required: false,
      fields: [
        { key: 'parent_work_order', label: 'Parent work order', type: 'select', options: openWorkOrderOptions },
        {
          key: 'linked_work_orders', label: 'Related work orders', type: 'rows', addLabel: 'Link a work order',
          rowNoun: 'link', emptyNote: 'Nothing linked yet.',
          rowFields: [
            { key: 'work_order_number', label: 'Work order', type: 'select', options: openWorkOrderOptions, flex: 3 },
            { key: 'relationship', label: 'Relationship', type: 'select', options: ['Follows on from', 'Blocks', 'Duplicates', 'Same shutdown'], flex: 1.6 },
          ],
        },
      ],
    },

    costsSection([{ key: 'capex', label: 'Capital work', type: 'toggle', toggleLabel: 'Charge to capital' }]),
  ],

  crossRules: [
    {
      section: 'basic',
      label: 'Due date',
      message: 'The due date cannot be earlier than today',
      ok: (v) => !v.due_date || v.due_date >= today(),
    },
    {
      section: 'advanced',
      label: 'Permit type',
      message: 'A permit type is required once a work permit is requested',
      ok: (v) => !v.permit_required || Boolean(v.permit_type),
    },
    {
      section: 'costs',
      label: 'Budget code',
      message: 'Capital work needs a budget code',
      ok: (v) => !v.capex || Boolean(v.budget_code),
    },
  ],

  derive: (v) => {
    const asset = ASSETS.find((a) => a.asset_id === v.asset_id)
    const loc = LOCATIONS.find((l) => l.functional_location_id === v.functional_location_id)
    const site = SITES.find((s) => s.site_id === (asset?.site_id || loc?.site_id)) || SITES[0]
    const cost = (Number(v.labour_cost) || 0) + (Number(v.parts_cost) || 0) + (Number(v.contractor_cost) || 0)
    const priority = v.priority || 'Medium'
    return {
      work_order_number: `WO-${9000 + Math.floor(seed(`${v.title}${v.due_date}`) * 900)}`,
      status: 'Open',
      work_order_type: v.work_order_type || signalFor(v.title).type,
      priority,
      due_date: v.due_date || daysFrom(DUE_DAYS[priority] ?? 7),
      asset_name: asset?.asset_name || '',
      asset_code: asset?.asset_code || '',
      site_id: site.site_id,
      site_name: site.site_name,
      location_name: loc?.name || asset?.functional_location_name || '',
      created_by_name: USER.name,
      created_date: daysFrom(0),
      completed_date: null,
      actual_hours: null,
      downtime_hours: 0,
      total_cost: cost,
      description: v.description || `${v.title} on ${asset?.asset_name || loc?.name || 'the asset'}.`,
      tasks_count: (v.tasks || []).length,
      parts_count: (v.parts || []).length,
    }
  },
}

// ── checklist ────────────────────────────────────────────────────────────
const CHECKLIST_CATEGORY = [
  { match: /safety|ppe|fire|lockout|hazard|guard|permit/i, category: 'Safety' },
  { match: /statutory|complian|certificat|audit|regulat|insurance/i, category: 'Compliance' },
  { match: /service|maintenance|condition|lubricat|bearing|vibration/i, category: 'Maintenance' },
]

const DEFAULT_CHECKLIST_ITEMS = {
  Operations: [
    'Guards in place and secure', 'No abnormal noise or vibration', 'Oil level within the sight glass',
    'No visible leaks', 'Emergency stop tested', 'Work area clear and clean',
  ],
  Safety: [
    'Fire extinguisher present and in date', 'Escape routes unobstructed', 'PPE available at the station',
    'Lockout points identified and labelled', 'Interlocks functional', 'First aid kit stocked',
  ],
  Maintenance: [
    'Bearing temperature within range', 'Vibration reading logged', 'Lubrication points greased',
    'Fasteners torqued to specification', 'Belt alignment checked', 'Runtime hours recorded',
  ],
  Compliance: [
    'Statutory examination certificate in date', 'Lifting equipment marked with its safe working load',
    'Calibration certificates filed', 'Operator training records current',
    'Risk assessment reviewed', 'Register updated',
  ],
}

// A pack's checklist bank, cut to the same six a composed draft starts with.
const CHECKLIST_ITEMS = DOMAIN?.checklistItems
  ? Object.fromEntries(Object.entries(DOMAIN.checklistItems).map(([c, items]) => [c, items.slice(0, 6)]))
  : DEFAULT_CHECKLIST_ITEMS

const categoryFor = (name) => CHECKLIST_CATEGORY.find((c) => c.match.test(String(name || '')))?.category || 'Operations'

export const CHECKLIST_SCHEMA = {
  key: 'checklist',
  navKey: 'checklists',
  title: 'Create checklist',
  subtitle: 'Build an inspection template technicians complete on a device',
  submitLabel: 'Create checklist',
  readyNote: 'Capture options and scheduling can still be set before you submit.',

  sections: [
    {
      key: 'basic',
      title: 'Basic Information',
      description: 'Essential checklist details and scoring',
      icon: 'info',
      required: true,
      fields: [
        {
          key: 'checklist_name', label: 'Checklist name', type: 'text', required: true, maxLength: 120,
          placeholder: HINT.checklist || 'Daily walk-round', missingMessage: 'Checklist name is required',
        },
        {
          key: 'code', label: 'Checklist code', type: 'text', required: true, maxLength: 20,
          placeholder: 'CHK10000001', missingMessage: 'A checklist code is required',
          suggest: (v) => (v.checklist_name ? `CHK${Math.floor(seed(v.checklist_name) * 90000000) + 10000000}` : ''),
          suggestWhy: 'next free code',
        },
        {
          key: 'category', label: 'Category', type: 'select', required: true,
          options: ['Operations', 'Safety', 'Maintenance', 'Compliance'],
          missingMessage: 'Category is required',
          suggest: (v) => (v.checklist_name ? categoryFor(v.checklist_name) : ''),
          suggestWhy: 'from the name',
        },
        {
          key: 'asset_level', label: 'Asset level', type: 'select', required: true,
          options: ['Any', 'Asset', 'Location'],
          missingMessage: 'An asset level is required',
          suggest: (v) => {
            if (!v.checklist_name) return ''
            if (assetFromText(v.checklist_name)) return 'Asset'
            return /line|area|room|shop|bay|store/i.test(v.checklist_name) ? 'Location' : 'Any'
          },
          suggestWhy: 'from the name',
        },
        {
          key: 'scoring', label: 'Scoring mode', type: 'select', required: true,
          options: ['Pass/Fail', 'Weighted score'],
          missingMessage: 'A scoring mode is required',
          suggest: (v) => (v.category ? (v.category === 'Compliance' ? 'Weighted score' : 'Pass/Fail') : ''),
          suggestWhy: 'usual for this category',
        },
        {
          key: 'description', label: 'Description', type: 'textarea', maxLength: 400, rows: 3,
          placeholder: 'What this checklist covers and when it is completed',
          suggest: (v) => {
            const category = v.category || (v.checklist_name ? categoryFor(v.checklist_name) : '')
            if (!category) return ''
            const level = v.asset_level === 'Asset' ? 'against a named asset'
              : v.asset_level === 'Location' ? 'against a functional location' : 'against any asset'
            return `${category} checks for ${ORG.organization_name}, completed ${level} and scored as ${(v.scoring || 'Pass/Fail').toLowerCase()}.`
          },
          suggestWhy: 'from the category and level',
        },
      ],
    },

    {
      key: 'items',
      title: 'Checklist Items',
      description: 'The checks a technician answers',
      icon: 'tasks',
      required: true,
      fields: [
        {
          key: 'items', label: 'Items', type: 'rows', required: true, addLabel: 'Add item', startRows: 1,
          rowNoun: 'item', emptyNote: 'A checklist with no items cannot be completed.',
          missingMessage: 'At least one checklist item is required',
          rowFields: [
            { key: 'text', label: 'Item', type: 'text', placeholder: 'What is being checked?', flex: 3 },
            { key: 'response_type', label: 'Response', type: 'select', options: ['Pass/Fail', 'Yes/No', 'Numeric', 'Text', 'Multiple choice'], flex: 1.3 },
            { key: 'photo_required', label: 'Photo', type: 'toggle', toggleLabel: 'Photo', flex: 0.9 },
            { key: 'note_required', label: 'Note', type: 'toggle', toggleLabel: 'Note', flex: 0.9 },
          ],
          suggest: (v) => {
            const category = v.category || (v.checklist_name ? categoryFor(v.checklist_name) : '')
            if (!category) return []
            const response = v.scoring === 'Weighted score' ? 'Numeric' : 'Pass/Fail'
            return (CHECKLIST_ITEMS[category] || CHECKLIST_ITEMS.Operations).map((text) => ({
              text,
              response_type: response,
              // A failed check is worth nothing without evidence, and the
              // category that most often ends up in front of an auditor is the
              // one that should carry it by default.
              photo_required: category === 'Compliance' || category === 'Safety',
              note_required: false,
            }))
          },
          suggestWhy: 'standard checks for this category',
        },
      ],
    },

    reviewSection('Review all information before submitting'),

    {
      key: 'grouping',
      title: 'Sections & Grouping',
      description: 'Group items into sections',
      icon: 'layers',
      required: false,
      fields: [
        {
          key: 'sections', label: 'Sections', type: 'rows', addLabel: 'Add section',
          rowNoun: 'section', emptyNote: 'All items sit in one list.',
          rowFields: [
            { key: 'name', label: 'Section name', type: 'text', placeholder: 'Before start-up', flex: 2 },
            { key: 'description', label: 'Covers', type: 'text', placeholder: 'What this section covers', flex: 3 },
          ],
        },
        { key: 'ordered_sections', label: 'Complete in order', type: 'toggle', toggleLabel: 'Enforce the order' },
      ],
    },

    {
      key: 'capture',
      title: 'Capture Options',
      description: 'Photos, signature and custom items',
      icon: 'camera',
      required: false,
      fields: [
        // On by default because every checklist in the plant already carries it,
        // and because the items suggested for a safety or compliance checklist
        // ask for photographs — a template that ships with those two at odds
        // would fail its own validation the moment it was created.
        { key: 'photos_enabled', label: 'Photo capture', type: 'toggle', toggleLabel: 'Allow photos', default: true },
        { key: 'signature_required', label: 'Signature', type: 'toggle', toggleLabel: 'Sign on completion' },
        { key: 'custom_items_allowed', label: 'Custom items', type: 'toggle', toggleLabel: 'Technician may add items' },
        { key: 'offline_capture', label: 'Offline capture', type: 'toggle', toggleLabel: 'Works without signal' },
        { key: 'location_stamp', label: 'Location stamp', type: 'toggle', toggleLabel: 'Record where it was done' },
      ],
    },

    {
      key: 'assignment',
      title: 'Assignment & Schedule',
      description: 'Who completes this and how often',
      icon: 'calendar',
      required: false,
      fields: [
        { key: 'assigned_to', label: 'Assigned to', type: 'select', options: () => ['All technicians', 'Line operators', ...TECHNICIANS.map((t) => t.name)] },
        { key: 'team', label: 'Team', type: 'select', options: teamOptions },
        { key: 'frequency', label: 'Frequency', type: 'select', options: ['Per shift', 'Daily', 'Weekly', 'Monthly', 'On demand'] },
        { key: 'start_date', label: 'Starts', type: 'date', suggest: () => today(), suggestWhy: 'today' },
        { key: 'reminder', label: 'Reminder', type: 'toggle', toggleLabel: 'Remind when due' },
      ],
    },

    attachmentsSection(),
  ],

  crossRules: [
    {
      section: 'capture',
      label: 'Photo capture',
      message: 'Photo capture must be switched on while an item asks for a photo',
      ok: (v) => !(v.items || []).some((i) => i.photo_required) || Boolean(v.photos_enabled),
    },
  ],

  derive: (v) => {
    const items = v.items || []
    return {
      status: 'Active',
      items_count: items.length,
      sections: (v.sections || []).length || Math.max(1, Math.ceil(items.length / 5)),
      assigned_to: v.assigned_to || 'All technicians',
      completions_today: 0,
      due_today: 0,
      author: USER.name,
      created: daysFrom(0),
      archived: false,
      features: [
        v.photos_enabled ? 'Photos' : null,
        v.signature_required ? 'Signature' : null,
        v.custom_items_allowed ? 'Custom Items' : null,
      ].filter(Boolean),
    }
  },
}

// ── PM schedule ──────────────────────────────────────────────────────────
const pmText = (v) => `${v.schedule_name || ''} ${assetOf(v)?.asset_type || ''}`

const FREQ_WORD = { '1 Weeks': 'weekly', '2 Weeks': 'fortnightly', '1 Months': 'monthly', '3 Months': 'quarterly', '6 Months': 'six-monthly', '12 Months': 'annual' }

const PM_TASKS = {
  'Air Compressor': ['Record discharge pressure and temperature', 'Replace the air and oil filters', 'Drain condensate and check the separator', 'Check belt tension and condition'],
  Pump: ['Check the seal for weeping', 'Record suction and discharge pressures', 'Grease the bearings', 'Check coupling alignment'],
  Conveyor: ['Check belt tracking and tension', 'Inspect rollers and bearings', 'Lubricate the drive chain', 'Test the pull-cord stops'],
  Boiler: ['Test the safety valve', 'Check water treatment readings', 'Clean the burner and check combustion', 'Record efficiency figures'],
  Chiller: ['Clean the condenser coils', 'Record suction and head pressures', 'Check refrigerant charge and log it', 'Inspect the pump and fan motors'],
}

const pmTasksFor = (assetType) => PM_TASKS[assetType] || [
  'Isolate the asset and apply locks',
  'Work through the manufacturer service schedule',
  'Replace filters and consumables',
  'Record readings and close out',
]

export const PM_SCHEDULE_SCHEMA = {
  key: 'pm_schedule',
  navKey: 'pm-schedules',
  title: 'Create PM schedule',
  subtitle: 'Plan recurring maintenance that raises its own work orders',
  submitLabel: 'Create PM schedule',
  readyNote: 'Parts, labour and costs can still be added before you submit.',

  sections: [
    {
      key: 'basic',
      title: 'Basic Information',
      description: 'Essential schedule details and frequency',
      icon: 'info',
      required: true,
      fields: [
        {
          key: 'schedule_name', label: 'Schedule name', type: 'text', required: true, maxLength: 120,
          placeholder: HINT.pmSchedule || 'Compressor — quarterly service', missingMessage: 'Schedule name is required',
          suggest: (v) => {
            const asset = assetOf(v)
            if (!asset) return ''
            const word = FREQ_WORD[`${v.frequency_value} ${v.frequency_unit}`]
            return `${asset.asset_type} — ${word ? `${word} service` : 'service'}`
          },
          suggestWhy: 'from the asset and frequency',
        },
        {
          key: 'asset_id', label: 'Asset', type: 'select', required: true, options: assetOptions,
          missingMessage: 'An asset is required',
          suggest: (v) => assetFromText(v.schedule_name)?.asset_id || '',
          suggestWhy: 'lowest health of that type',
        },
        {
          key: 'frequency_type', label: 'Basis', type: 'select', required: true, options: ['Time', 'Meter'],
          missingMessage: 'A basis is required',
          suggest: (v) => (/hour|runtime|meter|cycle/i.test(v.schedule_name || '') ? 'Meter' : 'Time'),
          suggestWhy: 'from the name',
        },
        {
          key: 'frequency_value', label: 'Every', type: 'number', required: true, min: 1, placeholder: '3',
          missingMessage: 'A frequency is required',
          suggest: (v) => {
            if (v.frequency_type === 'Meter') return 500
            const crit = assetOf(v)?.criticality
            return crit === 'High' ? 1 : crit === 'Medium' ? 3 : crit === 'Low' ? 6 : ''
          },
          suggestWhy: 'from the asset criticality',
        },
        {
          key: 'frequency_unit', label: 'Unit', type: 'select', required: true,
          options: ['Weeks', 'Months', 'Running hours'],
          missingMessage: 'A frequency unit is required',
          suggest: (v) => (v.frequency_type === 'Meter' ? 'Running hours' : v.frequency_type === 'Time' ? 'Months' : ''),
          suggestWhy: 'from the basis',
        },
        {
          key: 'next_due', label: 'Next due', type: 'date', required: true,
          missingMessage: 'A next due date is required',
          // The asset already carries its next service date; proposing anything
          // else quietly puts the schedule out of step with the asset record.
          suggest: (v) => assetOf(v)?.next_maintenance_date?.slice(0, 10) || '',
          suggestWhy: "the asset's next service",
        },
        {
          key: 'assigned_to_name', label: 'Assign to', type: 'select', required: true, options: techOptions,
          missingMessage: 'Assignment is required',
          suggest: (v) => leastLoaded(tradeFor(pmText(v))),
          suggestWhy: 'fewest open jobs in that trade',
        },
        {
          key: 'estimated_hours', label: 'Estimated hours', type: 'number', required: true, min: 0, step: '0.5', placeholder: '2',
          missingMessage: 'Estimated hours are required',
          suggest: (v) => {
            const crit = assetOf(v)?.criticality
            return crit === 'High' ? 4 : crit === 'Medium' ? 2 : crit === 'Low' ? 1 : ''
          },
          suggestWhy: 'from the asset criticality',
        },
      ],
    },

    {
      key: 'tasks',
      title: 'Task List',
      description: 'Define tasks and work breakdown',
      icon: 'tasks',
      required: true,
      fields: [
        {
          key: 'tasks', label: 'Tasks', type: 'rows', addLabel: 'Add task', startRows: 1,
          rowNoun: 'task', emptyNote: 'No tasks yet — each generated work order will carry a single line.',
          rowFields: [
            { key: 'description', label: 'Task', type: 'text', placeholder: 'What is to be done?', flex: 3 },
            { key: 'trade', label: 'Trade', type: 'select', options: TRADES, flex: 1.2 },
            { key: 'hours', label: 'Hours', type: 'number', min: 0, step: '0.5', flex: 0.7 },
          ],
          suggest: (v) => {
            const asset = assetOf(v)
            if (!asset) return []
            const list = pmTasksFor(asset.asset_type)
            const trade = tradeFor(pmText(v))
            const total = Number(v.estimated_hours) || 2
            const each = Math.max(0.5, Math.round((total / list.length) * 2) / 2)
            return list.map((description) => ({ description, trade, hours: each }))
          },
          suggestWhy: 'standard service for this asset type',
        },
      ],
    },

    reviewSection('Review all information before submitting'),

    partsSection(pmText),
    labourSection(pmText),
    advancedSection(pmText, [
      {
        key: 'lead_days', label: 'Raise the work order ahead (days)', type: 'number', min: 0, placeholder: '7',
        help: 'How far before the due date the schedule creates its work order.',
      },
    ]),
    costsSection(),
  ],

  crossRules: [
    {
      section: 'basic',
      label: 'Frequency unit',
      message: 'A meter-based schedule is counted in running hours',
      ok: (v) => v.frequency_type !== 'Meter' || v.frequency_unit === 'Running hours',
    },
    {
      section: 'basic',
      label: 'Frequency unit',
      message: 'A time-based schedule is counted in weeks or months',
      ok: (v) => v.frequency_type !== 'Time' || v.frequency_unit !== 'Running hours',
    },
    {
      section: 'advanced',
      label: 'Permit type',
      message: 'A permit type is required once a work permit is requested',
      ok: (v) => !v.permit_required || Boolean(v.permit_type),
    },
  ],

  derive: (v) => {
    const asset = ASSETS.find((a) => a.asset_id === v.asset_id)
    return {
      status: 'Active',
      asset_name: asset?.asset_name || '',
      asset_code: asset?.asset_code || '',
      site_id: asset?.site_id || SITES[0].site_id,
      site_name: asset?.site_name || SITES[0].site_name,
      last_generated: daysFrom(0),
      created_by_name: USER.name,
      tasks_count: (v.tasks || []).length,
      parts_count: (v.parts || []).length,
    }
  },
}
