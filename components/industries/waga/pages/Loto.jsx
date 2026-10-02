'use client'

// LOTO and Permit to Work.
//
// The lock record is the part of the paper checklist that most needs a system:
// it is a grid repeated per lock, and on paper it is where a missed try-out or
// an unremoved lock hides. The workbook gives its exact columns — Lock ID,
// Area/Cabinet, Tag/Equipment, Valve position, Placed By, Tried Out, Removed,
// By — from pages 4 and 5, so the record below is those columns and no others.
//
// No executed WAGA isolation was invented — a fabricated lock record is the
// single worst thing to seed in this dataset. Instead an isolation can be opened
// here, its locks placed, and then closed out only when every lock has been
// tried out and removed. That close-out gate is the whole point: an isolation
// the system will not let you close with a lock still on is an isolation that
// cannot hide the failure paper LOTO hides.

import { useMemo, useState } from 'react'
import { Section, StatusBadge, Modal, ActionButton } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Note, SiteChip, Ref } from '../components/cells'
import { useSite } from '../lib/siteStore'
import { useStore, useCreated, USER } from '../lib/store'
import ModuleActivity from '../components/ModuleActivity'
import { SAFETY_FIELDS, optionList, SITES, siteCode, fmtDate, TODAY } from '../lib/data'

const PERMIT_TYPES = ['Hot Work Permit', 'Confined Space Permit', 'Critical Lift Permit', 'Energized Electrical Permit']
const LOCK_COLUMNS = ['Lock ID', 'Area / Cabinet', 'Tag / Equipment', 'Valve position', 'Placed By', 'Tried Out', 'Removed', 'By']
const idOf = (l) => l.lotoId || l.recordId

export default function Loto() {
  const { scope, siteName, codeOf } = useSite()
  const store = useStore()
  const records = useCreated('waga_loto')

  const lotoType = SAFETY_FIELDS.find((f) => f.fieldId === 'SAFE-014')
  const isolationTypes = lotoType ? optionList(lotoType) : []

  const [opening, setOpening] = useState(false)
  const [closing, setClosing] = useState(null)

  const all = useMemo(() => scope(records.map((l) => ({ ...l, _siteCode: codeOf(l.siteId) || siteCode(l.siteId) }))), [scope, records])
  const active = all.filter((l) => l.status === 'Active')

  const closeOut = async (l, locks, close) => {
    if (l._pending) { store.notify('Still saving — try again in a moment.'); return }
    const saved = await store.update('waga_loto', l.recordId || idOf(l), {
      ...pluck(l), locks, status: 'Closed', closedDate: TODAY(), closedBy: USER.name,
      closedNote: close.note || '',
      reInertDone: Boolean(close.reInertDone), leakTestDone: Boolean(close.leakTestDone),
      changeoverManager: close.changeoverManager || '', changeoverNote: close.changeoverNote || '',
      closeoutSignature: close.closeoutSignature || '',
    })
    if (saved) {
      await store.log('LOTO closed out', `${l.lotoId} · ${l.description}`.slice(0, 120),
        `${locks.length} lock${locks.length === 1 ? '' : 's'} tried out and removed`, l.siteId)
      store.notify(`${l.lotoId} closed out — all locks removed.`)
      setClosing(null)
    }
  }

  return (
    <div>
      <PageHeading
        title="LOTO / Permit to Work"
        subtitle={`Isolation records, lock verification and the permit types the checklist issues — ${siteName}.`}
        right={<ActionButton onClick={() => setOpening(true)}>Open isolation</ActionButton>}
      />

      <Note tone={all.length ? 'info' : 'warn'}>
        {all.length
          ? 'Isolations below were opened in the portal. An isolation can only be closed when every lock on it has been tried out and removed — the grid columns are the Safety Checklist’s own.'
          : 'No executed WAGA isolation records were supplied. The structure is taken from pages 4–5 of the Safety Checklist. Open one to place locks — a demonstration isolation entered here is a real record, not seeded history.'}
      </Note>

      <StatCards items={[
        { label: 'Isolations', value: all.length, icon: 'list' },
        { label: 'Active (locks on)', value: active.length, tone: active.length ? 'amber' : 'green', icon: 'clock' },
        { label: 'Locks placed now', value: active.reduce((n, l) => n + (l.locks || []).length, 0), tone: active.length ? 'amber' : undefined },
        { label: 'Closed out', value: all.filter((l) => l.status === 'Closed').length, tone: 'green', icon: 'tick' },
      ]} />

      <Section title="Types of isolation" right={<span style={{ fontSize: 11.5, color: '#94a3b8' }}>{lotoType?.fieldId} · checklist p{lotoType?.sourcePage}</span>}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {isolationTypes.map((t) => <span key={t} style={pill}>{t}</span>)}
        </div>
      </Section>

      {all.length === 0 ? (
        <Section title="Lock record" right={<span style={{ fontSize: 11.5, color: '#94a3b8' }}>SAFE-015 · repeatable grid</span>}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 780 }}>
              <thead><tr style={{ background: '#f8fafc' }}>{LOCK_COLUMNS.map((c) => <th key={c} style={th}>{c}</th>)}</tr></thead>
              <tbody><tr><td colSpan={LOCK_COLUMNS.length} style={emptyCell}>
                No isolation open. Use <b>Open isolation</b> to place locks — the grid uses the exact structure from Safety Checklist pages 4&ndash;5.
              </td></tr></tbody>
            </table>
          </div>
        </Section>
      ) : all.map((l) => (
        <Section
          key={idOf(l)}
          title={l.description}
          right={<StatusBadge tone={l.status === 'Active' ? 'amber' : 'green'}>{l.status === 'Active' ? 'Locks on' : 'Closed out'}</StatusBadge>}
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
            <Ref>{l.lotoId}</Ref>
            <SiteChip code={l._siteCode} />
            <span style={{ fontSize: 11.5, color: '#64748b' }}>Opened <b style={{ color: '#0f172a' }}>{fmtDate(l.lotoDate || l.openedDate)}</b> by {l.openedBy}</span>
            {l.lotoManager && <span style={{ fontSize: 11.5, color: '#64748b' }}>· Manager <b style={{ color: '#0f172a' }}>{l.lotoManager}</b></span>}
            {l.locationDetail && <span style={{ fontSize: 11.5, color: '#64748b' }}>· {l.locationDetail}</span>}
            {(l.isolationTypes || []).map((t) => <span key={t} style={miniPill}>{t}</span>)}
            {(l.permitTypes || []).map((t) => <span key={t} style={{ ...miniPill, background: '#fffbeb', borderColor: '#fde68a', color: '#b45309' }}>{t}</span>)}
            {l.devicesVerified && <span style={{ ...miniPill, background: '#ecfdf5', borderColor: '#a7f3d0', color: '#047857' }}>Devices verified</span>}
            {l.tryOutVerified && <span style={{ ...miniPill, background: '#ecfdf5', borderColor: '#a7f3d0', color: '#047857' }}>Tried out</span>}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 780 }}>
              <thead><tr style={{ background: '#f8fafc' }}>{LOCK_COLUMNS.map((c) => <th key={c} style={th}>{c}</th>)}</tr></thead>
              <tbody>
                {(l.locks || []).map((k, n) => (
                  <tr key={n} style={{ borderBottom: '1px solid #eef1f6' }}>
                    <td style={td}><b>{k.lockId || '—'}</b></td>
                    <td style={td}>{k.area || '—'}</td>
                    <td style={td}>{k.equipment || '—'}</td>
                    <td style={td}>{k.valvePosition || '—'}</td>
                    <td style={td}>{k.placedBy || '—'}</td>
                    <td style={td}>{k.triedOut ? <StatusBadge tone="green">Yes</StatusBadge> : <StatusBadge tone="grey">—</StatusBadge>}</td>
                    <td style={td}>{k.removed ? <StatusBadge tone="green">Yes</StatusBadge> : <StatusBadge tone="amber">On</StatusBadge>}</td>
                    <td style={td}>{k.removedBy || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {l.status === 'Closed' ? (
            <div style={{ marginTop: 12, padding: '10px 13px', borderRadius: 9, background: '#ecfdf5', border: '1px solid #a7f3d0', fontSize: 12.5, color: '#0f172a', lineHeight: 1.55 }}>
              <b style={{ color: '#047857' }}>Closed out {fmtDate(l.closedDate)} · {l.closedBy}.</b>{l.closedNote ? ` ${l.closedNote}` : ''}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 8 }}>
                {l.reInertDone && <span style={{ ...miniPill, background: '#fff', borderColor: '#a7f3d0', color: '#047857' }}>Re-inert / purge done</span>}
                {l.leakTestDone && <span style={{ ...miniPill, background: '#fff', borderColor: '#a7f3d0', color: '#047857' }}>Leak test passed</span>}
                {l.changeoverManager && <span style={{ ...miniPill, background: '#fff', borderColor: '#c7d2fe', color: '#15227a' }}>Changeover → {l.changeoverManager}</span>}
              </div>
              {l.changeoverNote && <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 6 }}>{l.changeoverNote}</div>}
              {l.closeoutSignature && <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 6, fontStyle: 'italic' }}>Signed: {l.closeoutSignature}</div>}
            </div>
          ) : null}

          {l.status === 'Active' && !l._pending && (
            <div style={{ marginTop: 14 }}>
              <ActionButton size="sm" variant="success" onClick={() => setClosing(l)}>Close out — verify locks removed</ActionButton>
            </div>
          )}
        </Section>
      ))}

      <Section title="Permits to work">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
          {PERMIT_TYPES.map((p) => {
            const count = all.filter((l) => (l.permitTypes || []).includes(p)).length
            return (
              <div key={p} style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{p}</div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 6, lineHeight: 1.5 }}>
                  Attached to an isolation on the risk and training selections made in the pre-task assessment.
                </div>
                <div style={{ marginTop: 9 }}>
                  <StatusBadge tone={count ? 'blue' : 'grey'}>{count ? `${count} issued` : 'No records'}</StatusBadge>
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      <ModuleActivity
        module="loto"
        empty="No isolation has been opened or closed out in the portal yet."
      />

      <OpenModal open={opening} existing={all} isolationTypes={isolationTypes}
        onClose={() => setOpening(false)}
        onSave={async (payload) => {
          const saved = await store.create('waga_loto', payload)
          if (saved) {
            await store.log('LOTO opened', `${payload.lotoId} · ${payload.description}`.slice(0, 120),
              `${payload.locks.length} lock${payload.locks.length === 1 ? '' : 's'} placed`, payload.siteId)
            store.notify(`Isolation ${payload.lotoId} opened — ${payload.locks.length} lock(s) on.`, 'error')
            setOpening(false)
          }
        }} />

      <CloseModal loto={closing} onClose={() => setClosing(null)} onCloseOut={closeOut} />
    </div>
  )
}

function pluck(l) {
  return {
    lotoId: l.lotoId, siteId: l.siteId, description: l.description, locationDetail: l.locationDetail || '',
    isolationTypes: l.isolationTypes || [], permitTypes: l.permitTypes || [],
    lotoManager: l.lotoManager || '', lotoDate: l.lotoDate || '', managerSignature: l.managerSignature || '',
    devicesVerified: Boolean(l.devicesVerified), tryOutVerified: Boolean(l.tryOutVerified),
    openedDate: l.openedDate, openedBy: l.openedBy, locks: l.locks || [],
  }
}

/** Open an isolation and place its locks. */
function OpenModal({ open, existing, isolationTypes, onClose, onSave }) {
  // Every site the portal knows, the workbook's and any added in the portal —
  // the picker below offered the workbook's two only, so an isolation at a site
  // added here could not be opened at all.
  const { sites: siteList, newRecordSiteId } = useSite()
  const [siteId, setSiteId] = useState(newRecordSiteId)
  const [description, setDescription] = useState('')
  const [locationDetail, setLocationDetail] = useState('')
  const [isoTypes, setIsoTypes] = useState([])
  const [permitTypes, setPermitTypes] = useState([])
  const [lotoManager, setLotoManager] = useState(USER.name)
  const [lotoDate, setLotoDate] = useState(TODAY())
  const [managerSignature, setManagerSignature] = useState('')
  const [devicesVerified, setDevicesVerified] = useState(false)
  const [tryOutVerified, setTryOutVerified] = useState(false)
  const [locks, setLocks] = useState([{ lockId: '', area: '', equipment: '', valvePosition: '', placedBy: USER.name }])

  const [seen, setSeen] = useState(open)
  if (open !== seen) {
    setSeen(open)
    if (open) {
      setSiteId(newRecordSiteId); setDescription(''); setLocationDetail(''); setIsoTypes([]); setPermitTypes([])
      setLotoManager(USER.name); setLotoDate(TODAY()); setManagerSignature(''); setDevicesVerified(false); setTryOutVerified(false)
      setLocks([{ lockId: '', area: '', equipment: '', valvePosition: '', placedBy: USER.name }])
    }
  }

  const toggle = (list, set, v) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const editLock = (i, patch) => setLocks(locks.map((k, n) => (n === i ? { ...k, ...patch } : k)))
  const valid = description.trim() && isoTypes.length && locks.some((k) => k.lockId.trim()) && devicesVerified && tryOutVerified
  const nextId = () => `LOTO-${siteCode(siteId)}-${String(existing.filter((l) => l.siteId === siteId).length + 1).padStart(3, '0')}`

  return (
    <Modal open={open} onClose={onClose} title="Open isolation (LOTO)" subtitle="Place locks before work starts" width={720}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <ActionButton variant="ghost" onClick={onClose}>Cancel</ActionButton>
          <ActionButton variant="primary" disabled={!valid}
            onClick={() => onSave({
              lotoId: nextId(), siteId, description: description.trim(), locationDetail: locationDetail.trim(),
              isolationTypes: isoTypes, permitTypes,
              lotoManager: lotoManager.trim() || USER.name, lotoDate,
              managerSignature: managerSignature.trim(), devicesVerified, tryOutVerified,
              openedDate: TODAY(), openedBy: USER.name,
              locks: locks.filter((k) => k.lockId.trim()).map((k) => ({
                lockId: k.lockId.trim(), area: k.area.trim(), equipment: k.equipment.trim(),
                valvePosition: k.valvePosition.trim(), placedBy: k.placedBy.trim() || USER.name,
                triedOut: false, removed: false, removedBy: '',
              })),
              status: 'Active',
            })}>
            Open isolation
          </ActionButton>
        </div>
      )}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
        <Field label="Work requiring isolation" required>
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Thermal oxidiser burner maintenance" style={{ ...input, resize: 'vertical' }} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
          <Field label="Site" required>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)} style={input}>
              {siteList.map((s) => <option key={s.siteId} value={s.siteId}>{s.code} — {s.siteName}</option>)}
            </select>
          </Field>
          <Chips label="Type of isolation" required options={isolationTypes} selected={isoTypes} onToggle={(v) => toggle(isoTypes, setIsoTypes, v)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="LOTO manager" required>
            <input value={lotoManager} onChange={(e) => setLotoManager(e.target.value)} placeholder="Who authorises the isolation" style={input} />
          </Field>
          <Field label="LOTO date">
            <input type="date" value={lotoDate} onChange={(e) => setLotoDate(e.target.value)} style={input} />
          </Field>
          <Field label="Specific location">
            <input value={locationDetail} onChange={(e) => setLocationDetail(e.target.value)} placeholder="e.g. Thermal oxidiser skid, valve gallery" style={input} />
          </Field>
          <Field label="Manager signature" hint="Type full name to sign.">
            <input value={managerSignature} onChange={(e) => setManagerSignature(e.target.value)} placeholder="Signed" style={{ ...input, fontStyle: managerSignature ? 'italic' : 'normal' }} />
          </Field>
        </div>

        <Chips label="Permits to work (if any)" options={PERMIT_TYPES} selected={permitTypes} onToggle={(v) => toggle(permitTypes, setPermitTypes, v)} />

        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#15227a', marginBottom: 4 }}>Lock record</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>One row per lock placed. Try-out and removal are recorded at close-out.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {locks.map((k, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: 7, alignItems: 'center' }}>
                <input value={k.lockId} onChange={(e) => editLock(i, { lockId: e.target.value })} placeholder="Lock ID" style={input} />
                <input value={k.area} onChange={(e) => editLock(i, { area: e.target.value })} placeholder="Area / cabinet" style={input} />
                <input value={k.equipment} onChange={(e) => editLock(i, { equipment: e.target.value })} placeholder="Tag / equipment" style={input} />
                <input value={k.valvePosition} onChange={(e) => editLock(i, { valvePosition: e.target.value })} placeholder="Valve position" style={input} />
                <input value={k.placedBy} onChange={(e) => editLock(i, { placedBy: e.target.value })} placeholder="Placed by" style={input} />
                <button type="button" onClick={() => setLocks(locks.length > 1 ? locks.filter((_, n) => n !== i) : locks)} style={rm} aria-label="Remove lock">×</button>
              </div>
            ))}
            <button type="button" onClick={() => setLocks([...locks, { lockId: '', area: '', equipment: '', valvePosition: '', placedBy: USER.name }])} style={addBtn}>+ Add lock</button>
          </div>
        </div>

        <div style={{ padding: '12px 14px', border: '1px solid #e4e9f0', borderRadius: 10, background: '#f8fafc' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#15227a', marginBottom: 9 }}>Isolation verification</div>
          <label style={chk}><input type="checkbox" checked={devicesVerified} onChange={(e) => setDevicesVerified(e.target.checked)} /> Lockout devices verified in place</label>
          <label style={{ ...chk, marginTop: 9 }}><input type="checkbox" checked={tryOutVerified} onChange={(e) => setTryOutVerified(e.target.checked)} /> Try-out performed — zero energy confirmed</label>
          {(!devicesVerified || !tryOutVerified) && <div style={{ fontSize: 11, color: '#b45309', marginTop: 9 }}>Both must be confirmed before the isolation can be opened.</div>}
        </div>
      </div>
    </Modal>
  )
}

/** Close out — every lock must be tried out and removed before the isolation can close. */
function CloseModal({ loto, onClose, onCloseOut }) {
  const [locks, setLocks] = useState([])
  const [note, setNote] = useState('')
  const [reInertDone, setReInertDone] = useState(false)
  const [leakTestDone, setLeakTestDone] = useState(false)
  const [changeoverManager, setChangeoverManager] = useState('')
  const [changeoverNote, setChangeoverNote] = useState('')
  const [closeoutSignature, setCloseoutSignature] = useState('')

  const key = loto ? idOf(loto) : ''
  const [seen, setSeen] = useState(key)
  if (key !== seen) {
    setSeen(key)
    setLocks((loto?.locks || []).map((k) => ({ ...k, triedOut: false, removed: false, removedBy: k.placedBy || USER.name })))
    setNote(''); setReInertDone(false); setLeakTestDone(false)
    setChangeoverManager(''); setChangeoverNote(''); setCloseoutSignature('')
  }
  if (!loto) return null

  // Re-inert / leak-test closeout applies to a process or purging-and-inerting
  // isolation — a burner or gas line put back in service has to be made safe
  // and proven leak-tight, not just unlocked.
  const needsReInert = (loto.isolationTypes || []).some((t) => /process|purg|inert/i.test(t))

  const setLock = (i, patch) => setLocks(locks.map((k, n) => (n === i ? { ...k, ...patch } : k)))
  const allDone = locks.length > 0 && locks.every((k) => k.triedOut && k.removed && (k.removedBy || '').trim())
  const reInertOk = !needsReInert || (reInertDone && leakTestDone)
  const canClose = allDone && reInertOk

  return (
    <Modal open={Boolean(loto)} onClose={onClose} title="Close out isolation" subtitle={`${loto.lotoId} · ${loto.description}`} width={680}
      footer={(
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {!allDone && <span style={{ fontSize: 11.5, color: '#b45309' }}>Every lock must be tried out and removed to close.</span>}
          {allDone && !reInertOk && <span style={{ fontSize: 11.5, color: '#b45309' }}>Confirm re-inert and leak-test to close this process isolation.</span>}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <ActionButton variant="ghost" onClick={onClose}>Cancel</ActionButton>
            <ActionButton variant="success" disabled={!canClose}
              onClick={() => onCloseOut(loto, locks.map((k) => ({ ...k, removedDate: TODAY() })), {
                note: note.trim(), reInertDone, leakTestDone,
                changeoverManager: changeoverManager.trim(), changeoverNote: changeoverNote.trim(),
                closeoutSignature: closeoutSignature.trim(),
              })}>
              Close out isolation
            </ActionButton>
          </div>
        </div>
      )}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.55 }}>
          Confirm each lock has been tried out and physically removed, and who removed it. The isolation
          cannot close while any lock is still on — that gate is the point of the record.
        </div>
        {locks.map((k, i) => (
          <div key={i} style={{ padding: '11px 13px', border: `1px solid ${k.triedOut && k.removed ? '#a7f3d0' : '#e4e9f0'}`, borderRadius: 10, background: k.triedOut && k.removed ? '#f6fefb' : '#fff' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
              {k.lockId} <span style={{ fontWeight: 400, color: '#64748b' }}>· {k.equipment || k.area || 'lock'} · placed by {k.placedBy}</span>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={chk}><input type="checkbox" checked={k.triedOut} onChange={(e) => setLock(i, { triedOut: e.target.checked })} /> Tried out</label>
              <label style={chk}><input type="checkbox" checked={k.removed} onChange={(e) => setLock(i, { removed: e.target.checked })} /> Removed</label>
              <label style={{ ...chk, flex: '1 1 180px' }}>
                <span style={{ color: '#64748b' }}>By</span>
                <input value={k.removedBy} onChange={(e) => setLock(i, { removedBy: e.target.value })} placeholder="Who removed it" style={{ ...input, padding: '6px 9px' }} />
              </label>
            </div>
          </div>
        ))}
        <div style={{ padding: '12px 14px', border: `1px solid ${needsReInert ? '#fde68a' : '#e4e9f0'}`, borderRadius: 10, background: needsReInert ? '#fffbeb' : '#f8fafc' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#15227a', marginBottom: 4 }}>Re-inert / leak-test closeout</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 9 }}>
            {needsReInert ? 'Required for this process / purging isolation before it can close.' : 'Confirm if the isolation involved process gas.'}
          </div>
          <label style={chk}><input type="checkbox" checked={reInertDone} onChange={(e) => setReInertDone(e.target.checked)} /> Re-inert / purge completed</label>
          <label style={{ ...chk, marginTop: 9 }}><input type="checkbox" checked={leakTestDone} onChange={(e) => setLeakTestDone(e.target.checked)} /> Leak test passed</label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Manager changeover (if any)">
            <input value={changeoverManager} onChange={(e) => setChangeoverManager(e.target.value)} placeholder="Incoming LOTO manager" style={input} />
          </Field>
          <Field label="Changeover note">
            <input value={changeoverNote} onChange={(e) => setChangeoverNote(e.target.value)} placeholder="e.g. Handed over at shift change 18:00" style={input} />
          </Field>
        </div>

        <Field label="Close-out note (optional)">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Verified zero energy, area released" style={input} />
        </Field>
        <Field label="Manager closeout signature">
          <input value={closeoutSignature} onChange={(e) => setCloseoutSignature(e.target.value)} placeholder="Type full name to sign" style={{ ...input, fontStyle: closeoutSignature ? 'italic' : 'normal' }} />
        </Field>
      </div>
    </Modal>
  )
}

function Chips({ label, required, options, selected, onToggle }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 7 }}>
        {label}{required && <span style={{ color: '#dc2626' }}> *</span>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {options.map((o) => {
          const on = selected.includes(o)
          return (
            <button key={o} type="button" onClick={() => onToggle(o)}
              style={{ ...chipBtn, background: on ? '#eef1ff' : '#f1f5f9', color: on ? '#3640d8' : '#475569', borderColor: on ? '#c7d2fe' : '#e2e8f0', fontWeight: on ? 700 : 600 }}>
              {o}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <label style={{ display: 'block', minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
        {label}{required && <span style={{ color: '#dc2626' }}> *</span>}
      </span>
      {children}
    </label>
  )
}

const pill = { padding: '7px 13px', borderRadius: 9, background: '#eef2ff', border: '1px solid #c7d2fe', color: '#15227a', fontSize: 12.5, fontWeight: 700 }
const miniPill = { padding: '2px 9px', borderRadius: 999, background: '#eef2ff', border: '1px solid #c7d2fe', color: '#15227a', fontSize: 10.5, fontWeight: 700 }
const card = { padding: '14px 16px', border: '1px solid #e4e9f0', borderLeft: '3px solid #15227a', borderRadius: 11, background: '#fff' }
const chipBtn = { padding: '5px 11px', borderRadius: 999, fontSize: 11.5, fontFamily: 'inherit', cursor: 'pointer', borderStyle: 'solid', borderWidth: 1 }
const chk = { display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: '#334155', fontWeight: 600 }
const th = { textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: '1px solid #e4e9f0', whiteSpace: 'nowrap' }
const td = { padding: '9px 12px', verticalAlign: 'middle' }
const emptyCell = { padding: '34px 14px', textAlign: 'center', color: '#94a3b8', fontSize: 12.5, lineHeight: 1.6 }
const input = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
  fontFamily: 'inherit', color: '#0f172a', background: '#fff', borderRadius: 9, outline: 'none',
  borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0',
}
const addBtn = {
  alignSelf: 'flex-start', padding: '7px 13px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
  color: '#3640d8', background: '#eef1ff', border: '1px solid #dbe2ff', borderRadius: 9, cursor: 'pointer',
}
const rm = {
  width: 30, height: 30, borderRadius: 8, border: '1px solid #fecaca', background: '#fff',
  color: '#b91c1c', fontSize: 16, cursor: 'pointer', lineHeight: 1,
}
