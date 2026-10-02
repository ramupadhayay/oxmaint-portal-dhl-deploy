'use client'

// Inspection Checklists — laid out the way the live product lays them out.
//
// This screen is cards, not a table, and that is not a style preference: a
// checklist is described by six things at once (code, item count, section
// count, asset level, scoring mode, and which capture features it uses) and a
// row of columns turns all six into noise. The card gives the name top billing
// and lets the rest sit underneath as metadata.
//
// The runner — the part that actually completes a checklist — is kept from the
// earlier version, because a checklist you cannot fill in is a catalogue entry
// rather than a feature.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  RefreshCw, Download, Plus, Building, Library, Archive, ClipboardCheck,
} from 'lucide-react'
import {
  Card, Drawer, StatusBadge, ActionButton, Section, PALETTE,
} from '../lib/kit'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs'
import ChecklistCard from '../components/ChecklistCard'
import {
  Action, Glyph as Mark, ListHeader, ViewToggle, SearchBar, InfoBlock,
} from '../lib/productKit'
import { LocalIcon } from '../lib/reminderKit'
import PageHeading from '../../datacenter/components/PageHeading'
import { itemsFor } from '../lib/checklistBank'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { useRecords, useStore } from '../lib/store'
import { CreateModal } from '../lib/forms'
import { checklistRunPdf, managementReportPdf } from '../lib/pdfReports'
import { TONE } from '../lib/pdf'
import { CHECKLISTS, ASSETS, USER, TECHNICIANS, fmtDate, seed, pick, between, daysFrom } from '../lib/data'

const { MUTE, SUB, INK, LINE, ACCENT, GREEN, AMBER, RED } = PALETTE

const idOf = (c) => c.checklist_id || c.recordId
const runIdOf = (r) => r.run_id || r.recordId

// The items behind a checklist, and the library a generated draft is composed
// from, both live in one place now that the create screen needs them too.

// The metadata the card shows. Derived from the checklist rather than stored, so
// a checklist created through the form gets the same treatment as a seeded one
// without the form having to ask for six fields nobody would fill in.
function enrich(c) {
  const k = idOf(c)
  const items = itemsFor(c)
  return {
    ...c,
    code: `CHK${String(Math.floor(seed(k + 'code') * 90000000) + 10000000)}`,
    items: items.length,
    sections: Math.max(1, Math.ceil(items.length / 5)),
    asset_level: pick(k + 'lvl', ['Any', 'Any', 'Asset', 'Location']),
    scoring: pick(k + 'sc', ['Pass/Fail', 'Pass/Fail', 'Weighted score']),
    features: [
      'Photos',
      seed(k + 'sig') > 0.45 ? 'Signature' : null,
      seed(k + 'cust') > 0.35 ? 'Custom Items' : null,
    ].filter(Boolean),
    author: c.author || pick(k + 'a', TECHNICIANS).name,
    // Off the register's own calendar helper, not off the clock. `Date.now()`
    // runs once on the server and again in the browser, so the two renders
    // disagreed by whatever the round trip took and React reported a hydration
    // mismatch it then silently recovered from — the worst way to have a bug.
    created: c.created || daysFrom(-between(k + 'd', 5, 200)),
    archived: Boolean(c.archived),
  }
}

const FEATURE_TONE = { Photos: 'blue', Signature: 'green', 'Custom Items': 'violet' }

export default function Checklists() {
  const { scope, siteName } = useSite()
  const router = useRouter()
  const { create, notify } = useStore()

  const [source, setSource] = useState('org')       // org | system
  const [archived, setArchived] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('created')
  const [view, setView] = useState('list')
  const [selected, setSelected] = useState([])
  const [creating, setCreating] = useState(false)

  const [running, setRunning] = useState(null)
  const [answers, setAnswers] = useState({})
  const [note, setNote] = useState('')
  const [assetId, setAssetId] = useState('')

  const stored = useRecords('checklist', CHECKLISTS, idOf)
  const runs = useRecords('checklist_run', [], runIdOf)

  const all = useMemo(() => stored.map(enrich), [stored])

  // Completions are counted from the runs actually recorded, so ticking a
  // checklist off moves the figure at the top of the page.
  const withRuns = useMemo(() => all.map((c) => ({
    ...c, runs: runs.filter((r) => r.checklist_id === idOf(c)).length,
  })), [all, runs])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const out = withRuns.filter((c) => (
      c.archived === archived &&
      (source === 'org' ? c.status !== 'Template' : c.status === 'Template') &&
      (!q || [c.checklist_name, c.code, c.category, c.assigned_to].join(' ').toLowerCase().includes(q))
    ))
    if (sort === 'name') return [...out].sort((a, b) => a.checklist_name.localeCompare(b.checklist_name))
    if (sort === 'items') return [...out].sort((a, b) => b.items - a.items)
    return [...out].sort((a, b) => String(b.created).localeCompare(String(a.created)))
  }, [withRuns, search, source, archived, sort])

  const dueToday = withRuns.reduce((n, c) => n + (c.due_today || 0), 0)
  const doneToday = withRuns.reduce((n, c) => n + (c.completions_today || 0) + c.runs, 0)

  const items = running ? itemsFor(running) : []
  const answered = items.filter((i) => answers[i.id]).length
  const failed = items.filter((i) => answers[i.id] === 'fail').length
  const progress = items.length ? Math.round((answered / items.length) * 100) : 0

  const startRun = (c) => { setRunning(c); setAnswers({}); setNote(''); setAssetId('') }

  const toggleSelect = (id) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const submitRun = async () => {
    const scored = items.filter((i) => answers[i.id] !== 'na')
    const passed = scored.filter((i) => answers[i.id] === 'pass').length
    const asset = ASSETS.find((a) => a.asset_id === assetId)

    await create('checklist_run', {
      checklist_id: idOf(running),
      checklist_name: running.checklist_name,
      category: running.category,
      asset_id: assetId,
      asset_name: asset?.asset_name || '—',
      site_id: asset?.site_id || '',
      completed_by_name: USER.name,
      completed_date: new Date().toISOString(),
      items_total: items.length,
      items_passed: passed,
      items_failed: failed,
      items_na: items.length - scored.length,
      score: scored.length ? Math.round((passed / scored.length) * 100) : 100,
      result: failed ? 'Fail' : 'Pass',
      note,
      status: 'Completed',
      // The failed lines in full: "3 failed" is not actionable, and the whole
      // reason to run a checklist is to know which three.
      failures: items.filter((i) => answers[i.id] === 'fail').map((i) => i.text),
    })
    setRunning(null)
  }

  const recent = useMemo(() => scope(runs).slice(0, 8), [scope, runs])

  const exportList = () => managementReportPdf({
    title: 'Inspection Checklists',
    subtitle: siteName,
    stats: [
      { label: 'Checklists', value: String(withRuns.filter((c) => !c.archived).length) },
      { label: 'Active', value: String(withRuns.filter((c) => c.status === 'Active').length), tone: TONE.ok },
      { label: 'Due today', value: String(dueToday) },
      { label: 'Completed today', value: String(doneToday), tone: TONE.ok },
    ],
    sections: [{
      title: 'Checklists',
      columns: [
        { header: 'Code', width: 1.8, value: (c) => c.code },
        { header: 'Checklist', width: 4, value: (c) => c.checklist_name },
        { header: 'Category', width: 1.8, value: (c) => c.category },
        { header: 'Items', width: 0.9, align: 'right', value: (c) => String(c.items) },
        { header: 'Assigned to', width: 2.2, value: (c) => c.assigned_to },
        { header: 'Status', width: 1.3, value: (c) => c.status },
      ],
      rows: rows,
    }],
  })

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Inspection Checklists</h1>
          <p className="text-slate-600 mt-1 text-sm md:text-base">
            Create and manage inspection checklists for your assets
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
          <Button variant="outline" className="h-10 px-4 gap-2"
            onClick={() => { setSearch(''); setSort('created'); setSelected([]); notify('Filters cleared.') }}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button variant="outline" className="h-10 px-4 gap-2" onClick={exportList}>
            <Download className="w-4 h-4" />
            Export
          </Button>
          {/* Create is hidden on the Archived view — a new checklist belongs to
              Active, and offering it here makes a button that files into a list
              the user is not looking at. */}
          {!archived && (
            <Button className="h-10 px-4 gap-2" onClick={() => router.push('/portal/oxmaint/checklists-create')}>
              <Plus className="w-4 h-4" />
              Create Checklist
            </Button>
          )}
        </div>
      </motion.div>

      {/* The product's screen carries no counters, and this register has three
          worth keeping — a checklist list that cannot say what is outstanding
          today is a catalogue. They sit in one band rather than a strip of
          tiles, because none of them is a cut of the list below. */}
      <div style={{ marginBottom: 14 }}>
        <InfoBlock
          tone={dueToday - doneToday > 0 ? 'amber' : 'green'}
          icon="clock"
          label={dueToday - doneToday > 0
            ? `${dueToday - doneToday} checklist${dueToday - doneToday === 1 ? '' : 's'} outstanding today`
            : 'Everything due today has been walked'}
        >
          {doneToday} of {dueToday} completed · {withRuns.filter((c) => !c.archived).length} checklists on the
          register, {withRuns.filter((c) => c.status === 'Active').length} active.
        </InfoBlock>
      </div>

      {/* Two rows of choice, not one. The first says whose checklists these are;
          the second says whether the ones on screen are still in use. Flattened
          into a single row of four pills, "System · Archived" reads as a state
          that exists, and it does not — archiving is an organisation's act, the
          system library has none, and that is why the toggle disappears there
          and the flag is cleared on the way in. */}
      <div className="flex items-center gap-4 flex-wrap">
        <Tabs value={source} onValueChange={(v) => { setSource(v); setArchived(false); setSelected([]) }}>
          <TabsList className="grid w-fit grid-cols-2">
            <TabsTrigger value="org" className="gap-2">
              <Building className="w-4 h-4" />
              My Organization
            </TabsTrigger>
            <TabsTrigger value="system" className="gap-2">
              <Library className="w-4 h-4" />
              From System
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {source === 'org' && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center rounded-lg bg-slate-100 p-1">
              {[
                { on: false, label: 'Active', Icon: Building, count: withRuns.filter((c) => !c.archived && c.status !== 'Template').length },
                { on: true, label: 'Archived', Icon: Archive, count: withRuns.filter((c) => c.archived && c.status !== 'Template').length },
              ].map(({ on, label, Icon, count }) => (
                <Button
                  key={label}
                  variant={archived === on ? 'default' : 'ghost'}
                  size="sm" className="gap-2"
                  onClick={() => { setArchived(on); setSelected([]) }}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  <Badge variant="secondary" className="ml-1">{count}</Badge>
                </Button>
              ))}
            </div>
            {archived && (
              <span className="text-sm text-slate-500">
                Viewing archived checklists — switch to Active to create a new one.
              </span>
            )}
          </div>
        )}
      </div>

      <Card style={{ padding: '11px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          type="checkbox"
          checked={rows.length > 0 && selected.length === rows.length}
          onChange={() => setSelected(selected.length === rows.length ? [] : rows.map(idOf))}
          style={{ width: 15, height: 15, accentColor: ACCENT, cursor: 'pointer' }}
        />
        <span style={{ fontSize: 12.5, color: SUB, fontWeight: 600 }}>Select all on this page</span>
        <button
          disabled={!selected.length}
          onClick={() => setSelected([])}
          style={{
            marginLeft: 'auto', padding: '7px 13px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
            borderRadius: 8, cursor: selected.length ? 'pointer' : 'default',
            border: `1px solid ${selected.length ? '#fdba74' : LINE}`,
            background: selected.length ? '#fff7ed' : '#fff',
            color: selected.length ? '#c2410c' : '#cbd5e1',
          }}>
          {archived ? 'Restore Selected' : 'Archive Selected'}{selected.length ? ` (${selected.length})` : ''}
        </button>
      </Card>

      <ListHeader
        icon="clipboard"
        title={source === 'system' ? 'System Checklists' : archived ? 'Archived Checklists' : 'Checklists'}
        count={rows.length}
        right={(
          <>
            <select value={sort} onChange={(e) => setSort(e.target.value)} style={selectStyle}>
              <option value="created">Sort by Created</option>
              <option value="name">Sort by Name</option>
              <option value="items">Sort by Items</option>
            </select>
            <ViewToggle value={view} onChange={setView} />
          </>
        )}
      />

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <SearchBar value={search} onChange={setSearch}
            placeholder="Search checklists by name, code, or description…" />
        </div>
      </div>

      {/* One card in both views — three across or one. The product draws
          checklists as a grid of cards, and a second visual language for the
          same record is what made this portal read as a different product. */}
      <div className={view === 'grid'
        ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'
        : 'grid grid-cols-1 gap-4'}>
        {rows.map((c, n) => (
          <ChecklistCard
            key={idOf(c)} checklist={c} index={n}
            selected={selected.includes(idOf(c))}
            onToggleSelect={() => toggleSelect(idOf(c))}
            onOpen={() => startRun(c)}
            onRun={() => startRun(c)}
          />
        ))}

        {!rows.length && (
          <div className="sm:col-span-2 xl:col-span-3 bg-white border border-slate-200/60 rounded-lg shadow-sm p-12 text-center">
            <ClipboardCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-800 mb-1">
              {archived ? 'Nothing archived' : 'No checklists found'}
            </h3>
            <p className="text-sm text-slate-500">
              {archived ? 'Nothing has been archived here yet.' : 'No checklists match these filters.'}
            </p>
          </div>
        )}
      </div>

      {recent.length > 0 && (
        <Section title="Recent completions" style={{ marginTop: 14 }}>
          {recent.map((r) => (
            <div key={runIdOf(r)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${LINE}` }}>
              <StatusBadge>{r.result}</StatusBadge>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.checklist_name}</span>
              <span style={{ fontSize: 11.5, color: SUB }}>{r.asset_name}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: r.result === 'Fail' ? RED : GREEN, minWidth: 40, textAlign: 'right' }}>{r.score}%</span>
              <span style={{ fontSize: 11.5, color: MUTE, minWidth: 108, textAlign: 'right' }}>{r.completed_by_name}</span>
              <ActionButton size="sm" variant="ghost" onClick={() => checklistRunPdf(r)}>PDF</ActionButton>
            </div>
          ))}
        </Section>
      )}

      <CreateModal kind="checklist" open={creating} onClose={() => setCreating(false)}
        onSubmit={(values) => create('checklist', values)} />

      <Drawer
        open={Boolean(running)} onClose={() => setRunning(null)}
        title={running?.checklist_name}
        subtitle={`${items.length} items · ${running?.category}`}
        icon={sectionIcon('checklists', ACCENT)}
        width={530}
        footer={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11.5, color: answered === items.length ? GREEN : MUTE, fontWeight: 700 }}>
              {answered} of {items.length} answered{failed ? ` · ${failed} failed` : ''}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <ActionButton variant="ghost" onClick={() => setRunning(null)}>Cancel</ActionButton>
              <ActionButton variant={failed ? 'danger' : 'success'} disabled={answered < items.length} onClick={submitRun}>
                {answered < items.length ? `${items.length - answered} left` : failed ? `Submit — ${failed} failed` : 'Submit — all pass'}
              </ActionButton>
            </div>
          </div>
        }
      >
        {running && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 5 }}>
                <span style={{ color: SUB, fontWeight: 600 }}>Progress</span>
                <span style={{ fontWeight: 800, color: progress === 100 ? GREEN : AMBER }}>{progress}%</span>
              </div>
              <div style={{ height: 6, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? GREEN : AMBER, transition: 'width .2s' }} />
              </div>
            </div>

            <div>
              <label style={miniLabel}>Asset being checked</label>
              <select value={assetId} onChange={(e) => setAssetId(e.target.value)} style={miniSelect}>
                <option value="">Not asset-specific</option>
                {ASSETS.slice(0, 60).map((a) => <option key={a.asset_id} value={a.asset_id}>{a.asset_name} — {a.asset_code}</option>)}
              </select>
            </div>

            <div>
              {items.map((item, i) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${LINE}` }}>
                  <span style={{ fontSize: 10.5, color: MUTE, fontWeight: 700, minWidth: 18 }}>{i + 1}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: INK, lineHeight: 1.45 }}>{item.text}</span>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {[['pass', 'Pass', GREEN], ['fail', 'Fail', RED], ['na', 'N/A', '#94a3b8']].map(([val, text, color]) => (
                      <button key={val} onClick={() => setAnswers((p) => ({ ...p, [item.id]: val }))}
                        style={{
                          padding: '4px 9px', fontSize: 10.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                          borderRadius: 7, border: `1px solid ${answers[item.id] === val ? color : LINE}`,
                          background: answers[item.id] === val ? color : '#fff',
                          color: answers[item.id] === val ? '#fff' : SUB,
                        }}>{text}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label style={miniLabel}>Notes</label>
              <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)}
                placeholder={failed ? 'What failed, and what did you do about it?' : 'Anything worth recording'}
                style={{ ...miniSelect, resize: 'vertical', fontWeight: 400, color: INK, cursor: 'text' }} />
            </div>

            {failed > 0 && (
              <p style={{ margin: 0, padding: '9px 12px', fontSize: 12.5, lineHeight: 1.5, borderRadius: 9, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
                {failed} item{failed > 1 ? 's' : ''} failed. Submitting records this as a failed check against
                {assetId ? ` ${ASSETS.find((a) => a.asset_id === assetId)?.asset_name}` : ' the site'}.
              </p>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}

const Glyph = ({ d }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
)

function Meta({ icon, children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: MUTE, whiteSpace: 'nowrap' }}>
      {icon}{children}
    </span>
  )
}

// The product's source tabs, and the Active/Archived toggle under them.
//
// Two rows rather than one, because they are not the same kind of choice: the
// first says whose checklists these are, the second says whether the ones you
// are looking at are still in use. Flattening them into one row of four pills
// made "System · Archived" look like a state that exists, and it does not.
const tabStyles = {
  tabRow: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 },
  tabs: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  tab: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', borderRadius: 9,
    cursor: 'pointer', borderStyle: 'solid', borderWidth: 1, whiteSpace: 'nowrap',
  },
  subToggle: {
    display: 'inline-flex', gap: 3, padding: 3, borderRadius: 10, background: '#f1f5f9',
  },
  subBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px',
    fontSize: 12, fontWeight: 700, fontFamily: 'inherit', border: 'none',
    borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  subCount: {
    padding: '1px 7px', borderRadius: 999, fontSize: 10.5, fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
  archivedHint: { fontSize: 11.5, color: MUTE },
}

const nameBtn = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 14.5, fontWeight: 700, color: INK, textAlign: 'left',
}
const selectStyle = {
  padding: '9px 10px', fontSize: 12.5, fontWeight: 600, color: SUB, background: '#fff',
  border: `1px solid ${LINE}`, borderRadius: 9, fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
}
const miniLabel = { display: 'block', fontSize: 10, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }
const miniSelect = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12.5, fontWeight: 600,
  border: `1px solid ${LINE}`, borderRadius: 9, background: '#fff', color: ACCENT,
  fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
}
