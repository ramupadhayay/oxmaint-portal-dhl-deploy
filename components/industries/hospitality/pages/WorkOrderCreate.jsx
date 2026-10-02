'use client'

// Raising a work order by hand.
//
// Most of this property's work orders are not typed: they come off the suite
// rotation, or out of the triage on Requests, which already knows the suite,
// the source and the urgency. What is left for this screen is the job somebody
// decided on while standing in front of it — a pool pump sounding wrong, a
// dryer vent that needs doing before the laundry backs up — and that person is
// holding a radio, so the form has to be short.
//
// Three things it does rather than leave to the person filling it in:
//
// The estate is split before it is picked. Ninety-eight suites of kitchen
// appliances and eighteen pieces of plant are one register on Assets, but they
// are never the same job: one is a room out of service, the other is the whole
// property. A single 606-entry dropdown is how a tech picks the wrong PTAC.
//
// The due date follows the priority, and is filled in rather than suggested.
// Critical means tomorrow at this property — there is no shift after the one
// that finds it. A blank due date, or one defaulted to a week out on every job,
// is what turns the overdue count into a number nobody reads.
//
// The suite's rotation state is shown once a suite is named, because a fault in
// a suite whose PM is three weeks late is usually the PM's fault, and the
// person raising this is the one who can say so in the description.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, Section, Card, Fields,
  StatusBadge, Priority, ActionButton, PALETTE,
} from '../lib/kit'
import { useStore } from '../lib/store'
import {
  USER, CREW, SUITES, SUITE_ASSETS, PLANT_ASSETS, fmtDate, money,
} from '../lib/data'

const { ACCENT, INK, SUB, MUTE, LINE, RED } = PALETTE

// The same four the seeded register uses. Written out rather than derived from
// the work orders, because a type nobody has raised yet would vanish from the
// list exactly when someone needs it.
const TYPES = [
  { value: 'Corrective', note: 'Something is broken or going that way' },
  { value: 'Preventive', note: 'Off the rotation, or ahead of it' },
  { value: 'Inspection', note: 'Look at it and log what you find' },
  { value: 'Guest request', note: 'Raised because a guest asked' },
]

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low']

// Days a job of each priority gets. Critical is tomorrow, not today: a job
// raised at four in the afternoon and due the same day is overdue before the
// tech has read it, and an overdue count that is wrong by design is worse than
// no due date at all.
const DUE_DAYS = { Critical: 1, High: 2, Medium: 7, Low: 14 }

const pad = (n) => String(n).padStart(2, '0')
const dayString = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const dueFor = (priority) => {
  const d = new Date()
  d.setDate(d.getDate() + (DUE_DAYS[priority] ?? 7))
  return dayString(d)
}

// `new Date('2026-08-25')` is parsed as UTC midnight, which in the property's
// own timezone is the evening of the 24th — and fmtDate reads local parts, so
// every due date typed here would render a day early on every list that shows
// it. Naming a time of day forces local parsing. 17:00 rather than midnight
// because the job is due by the end of that day's shift, not at the start of it.
const dueIso = (day) => (day ? new Date(`${day}T17:00:00`).toISOString() : null)

// See the note in RequestCreate: not a sequence, because a count-based next
// number races two people raising at once. This is the same band the triage on
// Requests writes into, so hand-raised and converted jobs number alike.
const nextNumber = () => `WO-${9000 + Math.floor(Math.random() * 900)}`

export default function WorkOrderCreate({ section = 'work-orders' }) {
  const router = useRouter()
  const store = useStore()
  const create = store?.create
  // The store's first fetch has to land before a write, or the record is lost
  // without an error anywhere — the optimistic row goes in and the load that
  // arrives after it replaces the whole map. DailySchedule.jsx carries the full
  // account; every submit control here waits on it.
  const ready = Boolean(store?.ready)

  const [scope, setScope] = useState('suite')
  const [suiteNo, setSuiteNo] = useState('')
  const [suiteAssetId, setSuiteAssetId] = useState('')
  const [plantAssetId, setPlantAssetId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('Corrective')
  const [priority, setPriority] = useState('Medium')
  const [assignee, setAssignee] = useState(CREW[0]?.name || USER.name)
  // Empty until mounted, then filled by the effect below. Both dates on this
  // form are read from the clock, and this page is server-rendered before it is
  // hydrated — a server in UTC and a browser in America/New_York disagree about
  // what "tomorrow" is for five hours every evening, and React reconciles that
  // as a hydration mismatch on the input's value. Computing them on the client
  // only is what makes the property's own timezone the one that counts.
  const [due, setDue] = useState('')
  const [today, setToday] = useState('')
  // Once a date has been typed the priority buttons stop moving it. Somebody
  // who set a date against a vendor visit does not want it rewritten because
  // they then bumped the priority.
  const [dueTouched, setDueTouched] = useState(false)
  const [hours, setHours] = useState('1')
  const [showProblems, setShowProblems] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setToday(dayString(new Date())) }, [])

  // Runs on mount as well as on every priority change, which is what fills the
  // field in the first place.
  useEffect(() => {
    if (!dueTouched) setDue(dueFor(priority))
  }, [priority, dueTouched])

  const suite = useMemo(() => SUITES.find((s) => s.suite_number === suiteNo) || null, [suiteNo])

  // Six per suite, and only ever the ones in the suite that is selected. This
  // is the reason the estate is split at the top of the form.
  const suiteAssets = useMemo(
    () => (suiteNo ? SUITE_ASSETS.filter((a) => a.suite_number === suiteNo) : []),
    [suiteNo]
  )

  const asset = useMemo(() => {
    if (scope === 'plant') return PLANT_ASSETS.find((a) => a.asset_id === plantAssetId) || null
    return suiteAssets.find((a) => a.asset_id === suiteAssetId) || null
  }, [scope, plantAssetId, suiteAssets, suiteAssetId])

  // A suite job with no appliance named is against the suite itself, which is
  // how the triage on Requests files a converted guest complaint. Plant has no
  // equivalent — there is nothing to raise a pool job against but the pump.
  const assetName = scope === 'suite'
    ? (asset?.asset_name || (suiteNo ? `Suite ${suiteNo}` : ''))
    : (asset?.asset_name || '')

  const locationName = scope === 'suite'
    ? (suite ? `Floor ${suite.floor}` : '')
    : (asset?.location_name || '')

  const hoursNumber = Number(hours)

  const problems = useMemo(() => {
    const out = []
    if (scope === 'suite' && !suiteNo) out.push('which suite')
    if (scope === 'plant' && !plantAssetId) out.push('which piece of plant')
    if (!title.trim()) out.push('what the job is')
    if (!assignee) out.push('who it goes to')
    if (!due) out.push('a due date')
    if (!Number.isFinite(hoursNumber) || hoursNumber <= 0) out.push('an estimate above zero')
    return out
  }, [scope, suiteNo, plantAssetId, title, assignee, due, hoursNumber])

  const submit = async () => {
    if (problems.length) { setShowProblems(true); return }
    if (!ready || !create || saving) return
    setSaving(true)

    // The list shows the title on its own, and the seeded rows carry the suite
    // inside it — so a suite job titled "Dishwasher leaking" reads as plant
    // work sitting next to "Suite 214 — PTAC filter". Prefixed here rather than
    // asked for, and only when the person has not already typed it.
    const clean = title.trim()
    const finalTitle = scope === 'suite' && suiteNo && !/^suite\b/i.test(clean)
      ? `Suite ${suiteNo} — ${clean}`
      : clean

    const record = await create('hosp_work_order', {
      work_order_number: nextNumber(),
      title: finalTitle,
      description: description.trim() || `${finalTitle} on ${assetName}.`,
      status: 'Open',
      priority,
      work_order_type: type,
      asset_id: asset?.asset_id || null,
      asset_name: assetName,
      suite_number: scope === 'suite' ? suiteNo : null,
      location_name: locationName,
      assigned_to_name: assignee,
      created_by_name: USER.name,
      created_date: new Date().toISOString(),
      due_date: dueIso(due),
      estimated_hours: hoursNumber,
      // Zero, not blank. Cost is what the job ends up having spent, and the
      // list totals the column — one null in it turns the maintenance spend on
      // Reports into NaN.
      total_cost: 0,
    })

    if (!record) { setSaving(false); return }
    router.push(`/portal/hospitality/${section}`)
  }

  return (
    <div>
      <PageHeading
        title="Raise a work order"
        subtitle="A job somebody decided on standing in front of it — the rotation and the request queue raise the rest"
        back={{ label: 'Work Orders', onClick: () => router.push(`/portal/hospitality/${section}`) }}
      />

      <Section
        title="What it is on"
        right={<span style={{ fontSize: 11.5, color: MUTE }}>
          {SUITES.length} suites · {PLANT_ASSETS.length} pieces of plant
        </span>}
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 15, flexWrap: 'wrap' }}>
          {[['suite', 'A guest suite'], ['plant', 'Plant and back of house']].map(([v, label]) => (
            <button
              key={v}
              onClick={() => setScope(v)}
              style={{
                padding: '7px 13px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
                cursor: 'pointer', borderRadius: 999,
                background: scope === v ? ACCENT : '#fff',
                color: scope === v ? '#fff' : SUB,
                border: `1px solid ${scope === v ? ACCENT : LINE}`,
              }}
            >{label}</button>
          ))}
        </div>

        {scope === 'suite' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14 }}>
            <div>
              <label style={styles.label} htmlFor="wo-suite">Suite</label>
              <select
                id="wo-suite"
                value={suiteNo}
                onChange={(e) => { setSuiteNo(e.target.value); setSuiteAssetId('') }}
                style={{ ...styles.input, cursor: 'pointer' }}
              >
                <option value="">Choose a suite…</option>
                {SUITES.map((s) => (
                  <option key={s.suite_id} value={s.suite_number}>
                    Suite {s.suite_number} — floor {s.floor}, {s.suite_type}
                    {s.state === 'Overdue' ? ' (PM overdue)' : s.state === 'Due today' ? ' (PM due today)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={styles.label} htmlFor="wo-suite-asset">Which appliance, if it is one</label>
              <select
                id="wo-suite-asset"
                value={suiteAssetId}
                onChange={(e) => setSuiteAssetId(e.target.value)}
                disabled={!suiteNo}
                style={{ ...styles.input, cursor: suiteNo ? 'pointer' : 'default', opacity: suiteNo ? 1 : 0.55 }}
              >
                <option value="">
                  {suiteNo ? `The suite itself — Suite ${suiteNo}` : 'Choose a suite first'}
                </option>
                {suiteAssets.map((a) => (
                  <option key={a.asset_id} value={a.asset_id}>
                    {a.asset_type} — {a.asset_code}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 420 }}>
            <label style={styles.label} htmlFor="wo-plant">Plant asset</label>
            <select
              id="wo-plant"
              value={plantAssetId}
              onChange={(e) => setPlantAssetId(e.target.value)}
              style={{ ...styles.input, cursor: 'pointer' }}
            >
              <option value="">Choose a plant asset…</option>
              {PLANT_ASSETS.map((a) => (
                <option key={a.asset_id} value={a.asset_id}>
                  {a.asset_name} — {a.location_name}
                </option>
              ))}
            </select>
            {asset && (
              <p style={{ margin: '9px 0 0', fontSize: 11.5, color: SUB, lineHeight: 1.5 }}>
                {asset.manufacturer} {asset.model} · criticality {asset.criticality} · currently{' '}
                <StatusBadge>{asset.status}</StatusBadge> · last done {fmtDate(asset.last_maintenance_date)}
              </p>
            )}
          </div>
        )}
      </Section>

      {/* Only once a suite is named. A fault in a suite three weeks past its
          rotation is usually the rotation's fault, and the person raising this
          is the one who can say so before it is a second work order. */}
      {suite && (
        <StatCards items={[
          {
            label: 'Suite',
            value: suite.suite_number,
            note: `${suite.suite_type}, floor ${suite.floor}`,
          },
          {
            label: 'Occupied tonight',
            value: suite.occupied ? 'Yes' : 'No',
            tone: suite.occupied ? 'amber' : 'green',
            note: suite.occupied ? 'access has to be arranged' : 'vacant — a job can run long',
          },
          {
            label: 'PM state',
            value: suite.state === 'Done this cycle' ? 'Done' : suite.state,
            tone: suite.state === 'Overdue' ? 'red' : suite.state === 'Due today' ? 'amber' : undefined,
            note: `last walked ${fmtDate(suite.last_pm_date)}`,
          },
          {
            label: 'Assets in suite',
            value: suiteAssets.length,
            note: 'every one has a full kitchen',
          },
        ]} />
      )}

      <Section title="The job">
        <label style={styles.label} htmlFor="wo-title">What needs doing</label>
        <input
          id="wo-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={scope === 'suite'
            ? 'PTAC not cooling — clean coil and check charge'
            : 'Pool pump seal weeping — replace and re-prime'}
          style={styles.input}
        />
        {scope === 'suite' && suiteNo && !/^suite\b/i.test(title.trim()) && title.trim() && (
          <p style={{ margin: '7px 0 0', fontSize: 11.5, color: MUTE }}>
            Will be filed as <strong style={{ color: SUB }}>Suite {suiteNo} — {title.trim()}</strong>,
            so it reads right in the list.
          </p>
        )}

        <label style={{ ...styles.label, marginTop: 15 }} htmlFor="wo-desc">Detail for whoever picks it up</label>
        <textarea
          id="wo-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="What it is doing, what has been tried, what the tech will need to bring."
          style={{ ...styles.input, resize: 'vertical', lineHeight: 1.55 }}
        />

        <label style={{ ...styles.label, marginTop: 15 }}>Type</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
          {TYPES.map((t) => {
            const on = type === t.value
            return (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                style={{
                  textAlign: 'left', padding: '10px 12px', fontFamily: 'inherit', cursor: 'pointer',
                  borderRadius: 11, background: on ? '#f5f7ff' : '#fff',
                  border: `1.5px solid ${on ? ACCENT : LINE}`,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: on ? ACCENT : INK }}>{t.value}</div>
                <div style={{ fontSize: 11.5, color: SUB, marginTop: 3, lineHeight: 1.45 }}>{t.note}</div>
              </button>
            )
          })}
        </div>
      </Section>

      <Section
        title="Priority, and when it is due"
        right={<span style={{ fontSize: 11.5, color: MUTE }}>
          {dueTouched ? 'Date set by hand' : `${DUE_DAYS[priority]} day${DUE_DAYS[priority] === 1 ? '' : 's'} from today`}
        </span>}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {PRIORITIES.map((p) => {
            const on = priority === p
            return (
              <button
                key={p}
                onClick={() => setPriority(p)}
                style={{
                  padding: '8px 14px', fontFamily: 'inherit', cursor: 'pointer', borderRadius: 9,
                  background: on ? '#f5f7ff' : '#fff',
                  border: `1.5px solid ${on ? ACCENT : LINE}`,
                }}
              ><Priority value={p} /></button>
            )
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
          <div>
            <label style={styles.label} htmlFor="wo-due">Due</label>
            <input
              id="wo-due"
              type="date"
              value={due}
              min={today || undefined}
              onChange={(e) => { setDue(e.target.value); setDueTouched(true) }}
              style={styles.input}
            />
          </div>
          <div>
            <label style={styles.label} htmlFor="wo-hours">Estimated hours</label>
            <input
              id="wo-hours"
              type="number"
              min="0.5"
              max="8"
              step="0.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              style={styles.input}
            />
            {/* Half an hour to three is what this property's jobs run to — a
                cartridge, a filter, a disposal reset. Six hours on a guest room
                is the suite out of service for a night, which is a conversation
                with the front office rather than a work order. */}
            {hoursNumber > 3 && (
              <p style={{ margin: '7px 0 0', fontSize: 11.5, color: '#b45309', lineHeight: 1.5 }}>
                Over three hours in a suite takes the room out for the night. Worth telling
                the front office before this is raised.
              </p>
            )}
          </div>
          <div>
            <label style={styles.label} htmlFor="wo-assignee">Assign to</label>
            <select
              id="wo-assignee"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              style={{ ...styles.input, cursor: 'pointer' }}
            >
              {CREW.map((t) => (
                <option key={t.user_id} value={t.name}>{t.name} — {t.trade}</option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      <Card>
        <h3 style={{ margin: '0 0 13px', fontSize: 13.5, fontWeight: 700, color: INK }}>
          What gets raised
        </h3>
        <Fields rows={[
          ['Asset', assetName || '—'],
          ['Suite', scope === 'suite' ? (suiteNo || '—') : '—'],
          ['Location', locationName || '—'],
          ['Type', <StatusBadge key="t" tone="grey">{type}</StatusBadge>],
          ['Priority', <Priority key="p" value={priority} />],
          ['Assigned to', assignee || '—'],
          ['Due', due ? fmtDate(dueIso(due)) : '—'],
          ['Estimate', Number.isFinite(hoursNumber) && hoursNumber > 0 ? `${hoursNumber} h` : '—'],
          ['Status', <StatusBadge key="s">Open</StatusBadge>],
          ['Cost so far', money(0)],
        ]} />

        {showProblems && problems.length > 0 && (
          <p style={{
            margin: '16px 0 0', padding: '10px 12px', borderRadius: 9,
            background: '#fef2f2', border: '1px solid #fecaca',
            fontSize: 12.5, color: RED, lineHeight: 1.55,
          }}>
            Still missing: {problems.join(', ')}.
          </p>
        )}

        <div style={{ display: 'flex', gap: 9, marginTop: 18, flexWrap: 'wrap' }}>
          <ActionButton onClick={submit} disabled={!ready || saving}>
            {saving ? 'Raising…' : 'Raise work order'}
          </ActionButton>
          <ActionButton
            variant="ghost"
            onClick={() => router.push(`/portal/hospitality/${section}`)}
            disabled={saving}
          >Cancel</ActionButton>
          {!ready && (
            <span style={{ alignSelf: 'center', fontSize: 11.5, color: MUTE }}>
              Loading the register…
            </span>
          )}
        </div>
      </Card>
    </div>
  )
}

const styles = {
  label: {
    display: 'block', fontSize: 10.5, fontWeight: 700, color: MUTE,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5,
  },
  input: {
    width: '100%', padding: '9px 11px', fontSize: 13, fontFamily: 'inherit',
    color: INK, background: '#fff', border: `1px solid ${LINE}`,
    borderRadius: 9, outline: 'none',
  },
}
