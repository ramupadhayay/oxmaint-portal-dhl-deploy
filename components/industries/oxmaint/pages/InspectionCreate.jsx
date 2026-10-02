'use client'

// Start New Inspection.
//
// The dialog this replaces asked four questions in a box — type, asset,
// inspector, date — and the product asks them as three steps on a page of its
// own: what is being inspected, which checklist to walk, and the details of the
// round. The order is the point. You cannot sensibly choose a checklist before
// you have said what it is for, and the product dims step three until a
// checklist is chosen rather than letting somebody fill in a duration for a
// round that does not exist yet.
//
// Setup and conduct share this route, as they do in the product: pressing
// Start files the inspection and opens the runner over it. Closing the runner
// leaves a scheduled round on the register rather than nothing, which is what
// somebody who got interrupted would expect to find.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PALETTE } from '../lib/kit'
import { Action, Glyph, Pill, SearchBar } from '../lib/productKit'
import PageHeading from '../../datacenter/components/PageHeading'
import { useRecords, useStore } from '../lib/store'
import { useSite } from '../lib/siteStore'
import { InspectionRunner, itemCount, nextInspectionNumber } from '../lib/inspectionItems'
import {
  ASSETS, SITES, CHECKLISTS, TECHNICIANS, USER, daysFrom,
  INSPECTION_TYPES, INSPECTION_TYPE_DEFS,
} from '../lib/data'

const { INK, SUB, MUTE, LINE } = PALETTE

// Which round a checklist belongs to, written down rather than guessed at the
// call site. The register stores the type, the runner builds its items from the
// type, and a checklist that silently mapped to a different one every render
// would give two rounds of the same name different questions.
//
// A pack that names its own types says which categories open onto each.
const TYPE_FOR_CATEGORY = INSPECTION_TYPE_DEFS
  ? Object.fromEntries(INSPECTION_TYPE_DEFS.flatMap((t) => (t.categories || []).map((c) => [c, t.type])))
  : {
    Operations: 'Daily walk-round',
    Safety: 'Safety inspection',
    Maintenance: 'Condition survey',
    Compliance: 'Safety inspection',
  }

const typeFor = (c) => (
  INSPECTION_TYPES.find((t) => c.checklist_name.toLowerCase().includes(t.toLowerCase().split(' ')[0]))
  || TYPE_FOR_CATEGORY[c.category]
  || INSPECTION_TYPES[0]
)

const idOf = (c) => c.checklist_id || c.recordId

export default function InspectionCreate() {
  const router = useRouter()
  const { create, update, records } = useStore()
  const { siteId } = useSite()

  const runs = useRecords('checklist_run', [], (r) => r.run_id || r.recordId)

  const [site, setSite] = useState(siteId === 'all' ? (SITES[0]?.site_id || '') : siteId)
  const [assetId, setAssetId] = useState('')
  const [library, setLibrary] = useState('specified')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({
    checklistId: '',
    type: '',
    inspector: USER.name,
    date: daysFrom(0),
    durationMinutes: 30,
    temperature: '',
    humidity: '',
    weather: '',
    notes: '',
  })
  const [busy, setBusy] = useState(false)
  const [running, setRunning] = useState(null)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const siteAssets = useMemo(
    () => ASSETS.filter((a) => !site || a.site_id === site),
    [site],
  )
  const asset = ASSETS.find((a) => a.asset_id === assetId) || null
  const theSite = SITES.find((s) => s.site_id === site) || null

  // Which checklists this asset has actually been walked with. A real
  // relationship in the register rather than a rule about categories — if
  // nothing has been run against it, the tab says so and points at the others
  // instead of quietly showing everything and calling it "specified".
  const specifiedIds = useMemo(() => new Set(
    runs.filter((r) => r.asset_id && r.asset_id === assetId).map((r) => r.checklist_id),
  ), [runs, assetId])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    const pool = library === 'specified'
      ? CHECKLISTS.filter((c) => specifiedIds.has(idOf(c)))
      : library === 'org'
        ? CHECKLISTS.filter((c) => c.status !== 'Template')
        : CHECKLISTS.filter((c) => c.status === 'Template')
    return pool.filter((c) => !q
      || [c.checklist_name, c.category, c.assigned_to].join(' ').toLowerCase().includes(q))
  }, [library, search, specifiedIds])

  const chosen = CHECKLISTS.find((c) => idOf(c) === form.checklistId) || null
  const ready = Boolean(form.checklistId && form.inspector && form.date)

  const pickChecklist = (c) => {
    set('checklistId', idOf(c))
    set('type', typeFor(c))
  }

  const start = async () => {
    setBusy(true)
    const reference = nextInspectionNumber(records?.inspection || [])
    const saved = await create('inspection', {
      inspection_number: reference,
      inspection_type: form.type || typeFor(chosen),
      checklist_id: form.checklistId,
      checklist_name: chosen?.checklist_name || '',
      asset_id: asset?.asset_id || '',
      asset_name: asset?.asset_name || (theSite ? `${theSite.site_name} — site-wide` : ''),
      site_id: site,
      site_name: theSite?.site_name || '',
      inspector_name: form.inspector,
      scheduled_date: form.date,
      status: 'Scheduled',
      // Nothing has been answered, scored or found, because nobody has walked
      // it yet. Written as empty rather than left off: the register's screens
      // read these fields, and an absent value is a different bug from a zero.
      result: null,
      score: null,
      findings_count: 0,
      findings: [],
      duration_minutes: Number(form.durationMinutes) || null,
      // Conditions are recorded by whoever walks the round. They stay unset
      // unless somebody typed one here — a temperature nobody measured is
      // worse than a blank one.
      temperature: form.temperature === '' ? null : Number(form.temperature),
      humidity: form.humidity === '' ? null : Number(form.humidity),
      weather: form.weather || null,
      note: form.notes || null,
    })
    setBusy(false)
    if (saved) setRunning({ ...saved, inspection_number: reference })
  }

  const completeRun = async (summary) => {
    await update('inspection', running.recordId || running.inspection_id, {
      ...summary,
      inspection_number: running.inspection_number,
      inspection_type: running.inspection_type,
      status: 'Completed',
      completed_date: daysFrom(0),
    })
    return running.inspection_number
  }

  return (
    <div>
      <PageHeading
        title="Start New Inspection"
        subtitle="First select what is being inspected, then choose a checklist, and configure inspection details to begin"
        back={{ label: 'Back', onClick: () => router.push('/portal/oxmaint/inspections') }}
      />

      <Step n={1} title="Select Asset">
        <div style={styles.grid}>
          <Field label="Location">
            <select value={site}
              onChange={(e) => { setSite(e.target.value); setAssetId(''); set('checklistId', '') }}
              style={styles.input}>
              {SITES.map((s) => <option key={s.site_id} value={s.site_id}>{s.site_name}</option>)}
            </select>
          </Field>

          <Field label="Asset">
            <select value={assetId}
              onChange={(e) => { setAssetId(e.target.value); set('checklistId', ''); setLibrary('specified') }}
              style={styles.input}>
              <option value="">The whole site</option>
              {siteAssets.map((a) => (
                <option key={a.asset_id} value={a.asset_id}>
                  {a.asset_name} — {a.asset_code}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {asset ? (
          <div style={{ ...styles.picked, background: '#ecfdf5', borderColor: '#a7f3d0' }}>
            <Glyph name="check" size={16} color="#059669" />
            <span style={{ minWidth: 0 }}>
              <strong style={styles.pickedName}>{asset.asset_name}</strong>
              <span style={styles.pickedSub}>
                {asset.asset_code} · {asset.site_name} · {asset.criticality} criticality
              </span>
            </span>
          </div>
        ) : theSite ? (
          <div style={{ ...styles.picked, background: '#eff6ff', borderColor: '#bfdbfe' }}>
            <Glyph name="pin" size={16} color="#2563eb" />
            <span style={{ minWidth: 0 }}>
              <strong style={styles.pickedName}>{theSite.site_name}</strong>
              <span style={styles.pickedSub}>
                {siteAssets.length} asset{siteAssets.length === 1 ? '' : 's'} · the whole site
              </span>
            </span>
          </div>
        ) : null}

        <p style={styles.hint}>
          Pick an asset where the round is carried out at a machine, or leave it on the
          whole site where the round walks the floor.
        </p>
      </Step>

      <Step n={2} title="Select Inspection Checklist">
        <div style={styles.tabs}>
          {[
            ['specified', 'Specified Checklists', 'box'],
            ['org', 'Organization Checklists', 'doc'],
            ['system', 'Library Checklists', 'list'],
          ].map(([key, label, icon]) => (
            <button key={key} onClick={() => { setLibrary(key); setSearch('') }}
              style={{
                ...styles.tab,
                background: library === key ? '#15227a' : '#fff',
                color: library === key ? '#fff' : SUB,
                borderColor: library === key ? '#15227a' : LINE,
              }}>
              <Glyph name={icon} size={13} color={library === key ? '#fff' : SUB} />
              {label}
            </button>
          ))}
        </div>

        <p style={styles.tabNote}>
          {library === 'specified'
            ? asset
              ? `Checklists already walked against ${asset.asset_name}.`
              : 'Pick an asset above to see the checklists it has been walked with.'
            : library === 'org'
              ? 'Checklists this organisation wrote or edited.'
              : 'The standard checklists that ship with the product.'}
        </p>

        <SearchBar value={search} onChange={setSearch} placeholder="Search by name or code..." />

        <div style={styles.pickList}>
          {shown.length === 0 ? (
            <p style={styles.hint}>
              {library === 'specified'
                ? 'Nothing has been walked against this asset yet — the other two tabs carry the checklists you can start with.'
                : 'No checklists match your search.'}
            </p>
          ) : shown.map((c) => {
            const on = form.checklistId === idOf(c)
            return (
              <button key={idOf(c)} onClick={() => pickChecklist(c)}
                style={{
                  ...styles.pickRow,
                  borderColor: on ? '#15227a' : '#dbeafe',
                  background: on ? '#eef1ff' : '#f8fafc',
                }}>
                <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                  <strong style={styles.pickedName}>{c.checklist_name}</strong>
                  <span style={styles.pickedSub}>
                    {c.category} · {c.items_count} items · assigned to {c.assigned_to}
                  </span>
                </span>
                <Pill tone="slate">{c.status}</Pill>
                {on && <Glyph name="check" size={17} color="#15227a" />}
              </button>
            )
          })}
        </div>

        {chosen && (
          <div style={{ ...styles.picked, background: '#eff6ff', borderColor: '#bfdbfe' }}>
            <Glyph name="check" size={16} color="#2563eb" />
            <span style={{ minWidth: 0 }}>
              <strong style={styles.pickedName}>{chosen.checklist_name}</strong>
              <span style={styles.pickedSub}>
                {chosen.category} · {chosen.items_count} items · walked as a {form.type || typeFor(chosen)}
                {' '}· {itemCount(form.type || typeFor(chosen))} questions in the runner
              </span>
            </span>
          </div>
        )}
      </Step>

      <Step n={3} title="Inspection Details" dim={!form.checklistId}>
        <div style={styles.grid}>
          <Field label="Inspection Type">
            <select value={form.type} onChange={(e) => set('type', e.target.value)} style={styles.input}>
              {INSPECTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Inspector">
            <select value={form.inspector} onChange={(e) => set('inspector', e.target.value)} style={styles.input}>
              <option value={USER.name}>{USER.name} — you</option>
              {TECHNICIANS.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Scheduled Date">
            <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} style={styles.input} />
          </Field>
        </div>

        <div style={styles.subHead}>Conditions on the day</div>
        <div style={styles.grid}>
          <Field label="Duration (minutes)">
            <input type="number" min="5" step="5" value={form.durationMinutes}
              onChange={(e) => set('durationMinutes', e.target.value)} style={styles.input} />
          </Field>
          <Field label="Temperature (°C)">
            <input type="number" value={form.temperature} placeholder="Not measured"
              onChange={(e) => set('temperature', e.target.value)} style={styles.input} />
          </Field>
          <Field label="Humidity (%)">
            <input type="number" min="0" max="100" value={form.humidity} placeholder="Not measured"
              onChange={(e) => set('humidity', e.target.value)} style={styles.input} />
          </Field>
          <Field label="Weather">
            <select value={form.weather} onChange={(e) => set('weather', e.target.value)} style={styles.input}>
              <option value="">Not recorded</option>
              {['Clear', 'Cloudy', 'Rain', 'Snow', 'Windy', 'Hot', 'Cold'].map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Inspection Notes">
          <textarea rows={4} value={form.notes} onChange={(e) => set('notes', e.target.value)}
            placeholder="Any initial notes or special instructions for this round."
            style={{ ...styles.input, resize: 'vertical' }} />
        </Field>
      </Step>

      <div style={styles.warn}>
        <Glyph name="warning" size={17} color="#b45309" />
        <span>
          A checklist, an inspector and a date are required. Everything else can be
          filled in as the round is walked.
        </span>
      </div>

      <div style={styles.footer}>
        <Action onClick={() => router.push('/portal/oxmaint/inspections')}>Cancel</Action>
        <button onClick={start} disabled={!ready || busy}
          style={{ ...styles.primary, opacity: ready && !busy ? 1 : 0.5, cursor: ready && !busy ? 'pointer' : 'default' }}>
          <Glyph name="play" size={13} color="#fff" />
          {busy ? 'Starting…' : 'Start Inspection'}
        </button>
      </div>

      <InspectionRunner
        open={Boolean(running)}
        onClose={() => { setRunning(null); router.push('/portal/oxmaint/inspections') }}
        subject={running && {
          key: running.recordId || running.inspection_id,
          reference: running.inspection_number,
          inspection_type: running.inspection_type,
          asset_id: running.asset_id,
          asset_name: running.asset_name,
          inspector_name: running.inspector_name,
        }}
        onSubmit={completeRun}
      />
    </div>
  )
}

function Step({ n, title, dim, children }) {
  return (
    <div style={{ ...styles.step, opacity: dim ? 0.55 : 1 }}>
      <div style={styles.stepHead}>
        <span style={styles.stepNo}>{n}</span>
        <h2 style={styles.stepTitle}>{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', minWidth: 0, marginBottom: 12 }}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  )
}

const styles = {
  step: {
    background: '#fff', borderRadius: 12, padding: '18px 20px', marginBottom: 14,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  stepHead: { display: 'flex', alignItems: 'center', gap: 11, marginBottom: 15 },
  stepNo: {
    width: 28, height: 28, borderRadius: 999, display: 'grid', placeItems: 'center',
    background: '#eef1ff', color: '#15227a', fontSize: 13, fontWeight: 800, flexShrink: 0,
  },
  stepTitle: { margin: 0, fontSize: 16, fontWeight: 700, color: INK },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: SUB, marginBottom: 6 },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
    fontFamily: 'inherit', lineHeight: 1.5, color: INK, background: '#fff',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, borderRadius: 9, outline: 'none',
  },
  hint: { margin: '9px 0 0', fontSize: 11.5, color: MUTE, lineHeight: 1.55 },
  tabs: { display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 10 },
  tab: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', borderRadius: 9,
    borderStyle: 'solid', borderWidth: 1, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  tabNote: {
    margin: '0 0 11px', padding: '9px 12px', fontSize: 11.5, color: SUB,
    background: '#f8fafc', borderRadius: 9, lineHeight: 1.5,
  },
  pickList: {
    display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 340, overflowY: 'auto',
    padding: 3,
  },
  pickRow: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px',
    borderRadius: 10, borderStyle: 'solid', borderWidth: 1,
    cursor: 'pointer', fontFamily: 'inherit', width: '100%',
  },
  picked: {
    display: 'flex', alignItems: 'flex-start', gap: 11, padding: '13px 15px',
    borderRadius: 10, borderStyle: 'solid', borderWidth: 1, marginTop: 12,
  },
  pickedName: { display: 'block', fontSize: 13.5, fontWeight: 700, color: INK },
  pickedSub: { display: 'block', fontSize: 11.5, color: SUB, marginTop: 3, lineHeight: 1.5 },
  subHead: { fontSize: 13.5, fontWeight: 700, color: INK, margin: '6px 0 10px' },
  warn: {
    display: 'flex', alignItems: 'flex-start', gap: 11, padding: '13px 15px',
    borderRadius: 11, background: '#fffbeb', color: '#92400e', fontSize: 12.5, lineHeight: 1.55,
    borderStyle: 'solid', borderWidth: 1, borderColor: '#fde68a', marginBottom: 14,
  },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' },
  primary: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 17px',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', borderRadius: 9,
    background: '#15227a', color: '#fff', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
  },
}
