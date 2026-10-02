'use client'

// The permit inventory — what WAGA is authorised to do at each trial site, and
// where a renewal is worked.
//
// Eight permits across two agencies, and four of them carry no expiration date.
// That is not missing data: two are Iowa construction permits that are
// genuinely non-expiring, and the Chapter 105 water obstruction permit is
// tracked without issue or expiry because WAGA's own tracker never populated
// those columns — the Verification_Log says in as many words, "Do not invent
// issue date/expiration date".
//
// What makes it a vault rather than a list: a renewal can be worked here.
// Marking an application submitted moves the permit's status and records the
// confirmation reference; marking the renewal received updates the expiry to
// the new term and files the new document reference. The seeded permit is not
// rewritten in the workbook — the change is stored over it and the two are
// merged, the same overlay the filing calendar and CAPA screens use — and each
// step is written to the audit trail.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Section, DataTable, Toolbar, StatusBadge, Modal, ActionButton,
} from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Ref, SiteChip, TwoLine, DateVal, Blank, Note } from '../components/cells'
import { useSite } from '../lib/siteStore'
import { useStore, useRecords, USER } from '../lib/store'
import ModuleActivity from '../components/ModuleActivity'
import { permits, permitHealth, isNonExpiring, daysUntil, fmtDate, TODAY, SITES, siteCode } from '../lib/data'

const idOf = (p) => p.permitId

export default function Permits() {
  const router = useRouter()
  const { scope, siteName, codeOf, emptyFor } = useSite()
  const store = useStore()

  const [search, setSearch] = useState('')
  const [agency, setAgency] = useState('all')
  const [status, setStatus] = useState('all')
  const [renewing, setRenewing] = useState(null)   // the permit whose renewal is being worked
  const [adding, setAdding] = useState(false)      // adding a brand-new permit

  const merged = useRecords('waga_permit_event', permits, idOf)
  // A permit added here is a whole new record, not an overlay on a seeded one,
  // so it arrives without the derived context the seeded ones carry. Give it the
  // same `_siteCode` and obligation count so a raised permit reads like the eight
  // beside it rather than announcing itself with blanks.
  const all = useMemo(() => scope(merged.map((p) => ({
    ...p,
    _siteCode: p._siteCode || codeOf(p.siteId) || siteCode(p.siteId),
    _requirementCount: p._requirementCount ?? 0,
  }))), [scope, merged])
  const agencies = [...new Set(all.map((p) => p.agency))].filter(Boolean)
  const statuses = [...new Set(all.map((p) => p.status))].filter(Boolean)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((p) => (
      (agency === 'all' || p.agency === agency) &&
      (status === 'all' || p.status === status) &&
      (!q || [p.permitNumber, p.permitType, p.permitTitle, p.agency, p.program].join(' ').toLowerCase().includes(q))
    ))
  }, [all, search, agency, status])

  const noExpiry = all.filter((p) => !p.expirationDate).length
  const watch = all.filter((p) => {
    const d = daysUntil(p.renewalDeadline || p.expirationDate)
    return d !== null && d >= 0 && d <= 400
  }).length
  const inRenewal = all.filter((p) => p.status === 'Renewal Submitted').length

  const submitRenewal = async (p, { submittedDate, ref, note }) => {
    if (p._pending) { store.notify('Still saving — try again in a moment.'); return }
    // A permit added here is stored under a generated recordId, not its
    // PERMIT-… number; patch by that so a renewal does not file a second row.
    const saved = await store.update('waga_permit_event', p.recordId || idOf(p), {
      permitId: p.permitId, status: 'Renewal Submitted',
      renewalStage: 'Submitted', renewalSubmittedDate: submittedDate,
      renewalRef: ref, renewalNote: note,
      // A new cycle starts clean. The permit row is patched, not replaced, so
      // without this the previous cycle's received date and renewed expiry stayed
      // on a permit that now says its renewal is only submitted.
      renewalReceivedDate: '', renewedExpiry: '',
    })
    if (saved) {
      // Everything the person entered goes on the trail, remark included. The
      // note used to be saved on the permit and left out of this line, so the
      // history showed that a renewal was submitted but not what was said about
      // it — and the next cycle's note overwrote it for good.
      await store.log('Renewal submitted', `${p.permitNumber} · ${p.permitType}`, [
        `Confirmation: ${ref || 'none recorded'}`,
        submittedDate && `submitted ${fmtDate(submittedDate)}`,
        note && `Note: ${note}`,
      ].filter(Boolean).join(' · '), p.siteId)
      store.notify(`${p.permitNumber} — renewal submitted.`)
      setRenewing(null)
    }
  }

  const receiveRenewal = async (p, { receivedDate, newExpiry, newNumber, ref, note }) => {
    if (p._pending) { store.notify('Still saving — try again in a moment.'); return }
    const saved = await store.update('waga_permit_event', p.recordId || idOf(p), {
      permitId: p.permitId, status: 'Active',
      renewalStage: 'Received', renewalReceivedDate: receivedDate,
      renewedExpiry: newExpiry, expirationDate: newExpiry,
      renewalDeadline: '', renewalRef: ref, renewalNote: note,
      ...(newNumber ? { permitNumber: newNumber, renewedFromNumber: p.permitNumber } : {}),
    })
    if (saved) {
      await store.log('Renewal received', `${newNumber || p.permitNumber} · ${p.permitType}`, [
        `New expiry ${fmtDate(newExpiry)}`,
        receivedDate && `received ${fmtDate(receivedDate)}`,
        newNumber && `new number ${newNumber}`,
        ref && `document: ${ref}`,
        note && `Note: ${note}`,
      ].filter(Boolean).join(' · '), p.siteId)
      store.notify(`${p.permitNumber} — renewal received, valid to ${fmtDate(newExpiry)}.`)
      setRenewing(null)
    }
  }

  const addPermit = async (payload) => {
    const saved = await store.create('waga_permit_event', payload)
    if (saved) {
      await store.log('Permit added', `${payload.permitNumber} · ${payload.permitType}`, `${payload.agency}${payload.expirationDate ? ` · expires ${fmtDate(payload.expirationDate)}` : ''}`, payload.siteId)
      store.notify(`Permit ${payload.permitNumber} added.`)
      setAdding(false)
    }
  }

  return (
    <div>
      <PageHeading
        title="Licenses, Permits & Regulatory Authorizations"
        subtitle={`Permit inventory, validity, renewal status and the source document each was read from — ${siteName}.`}
        right={<ActionButton onClick={() => setAdding(true)}>New permit</ActionButton>}
      />

      <StatCards items={[
        {
          label: 'Permits tracked',
          value: all.length,
          // Counted, then named — two of them. The note listed every agency,
          // which read as one line while the register was the imported eight
          // and became a six-line paragraph the moment four permits were added
          // from four new authorities. A card is a number with a caption.
          note: agencies.length > 2
            ? `${agencies.length} agencies · ${agencies.slice(0, 2).join(', ')} and ${agencies.length - 2} more`
            : agencies.join(' · '),
        },
        { label: 'Active', value: all.filter((p) => p.status === 'Active').length, tone: 'green', icon: 'tick' },
        { label: 'Renewal in progress', value: inRenewal, tone: inRenewal ? 'amber' : undefined, note: 'Application submitted' },
        { label: 'Within renewal window', value: watch, tone: watch ? 'amber' : undefined, note: 'Next 400 days', icon: 'clock' },
        { label: 'No expiry stated', value: noExpiry, note: 'Non-expiring or not in source' },
      ]} />

      <Section title="Permit register">
        <Note tone="grey">
          A blank expiry is reproduced as the source left it. A renewal worked here updates the
          permit&apos;s status and, once received, its expiry and document reference — the workbook
          is not edited, and every step is written to the audit trail on the Source screen.
        </Note>

        <Toolbar
          search={search} onSearch={setSearch}
          placeholder="Search permit number, type or agency…"
          filters={[
            { label: 'Agency', value: agency, onChange: setAgency, options: agencies },
            { label: 'Status', value: status, onChange: setStatus, options: statuses },
          ]}
        />

        <DataTable
          rows={rows}
          pageSize={12}
          onRowClick={(p) => router.push(`/portal/waga/permits/${p.permitId}`)}
          empty={all.length
            ? 'No permits match these filters.'
            : emptyFor('No permits match these filters.', 'permits', 'New permit to record one')}
          columns={[
            {
              key: 'permitNumber', label: 'Permit', width: 190,
              render: (p) => (
                <TwoLine
                  top={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Ref>{p.permitNumber}</Ref>{p._raised && <span style={raisedChip}>New</span>}</span>}
                  bottom={p.permitType}
                />
              ),
            },
            { key: 'siteId', label: 'Site', width: 72, render: (p) => <SiteChip code={p._siteCode} /> },
            { key: 'agency', label: 'Agency', width: 104 },
            {
              key: 'expirationDate', label: 'Expires', width: 132,
              sortValue: (p) => p.expirationDate || '',
              render: (p) => (p.expirationDate
                ? <DateVal value={p.expirationDate} />
                : <Blank label={isNonExpiring(p) ? 'Non-expiring' : 'Not stated in source'} />),
            },
            {
              key: 'renewalDeadline', label: 'Renewal due', width: 120,
              render: (p) => (p.renewalStage === 'Received'
                ? <span style={{ fontSize: 11.5, color: '#047857', fontWeight: 600 }}>Renewed</span>
                : <DateVal value={p.renewalDeadline} blank="—" />),
            },
            {
              key: 'status', label: 'Status', width: 148,
              render: (p) => {
                const h = permitHealth(p)
                return <StatusBadge tone={p.status === 'Renewal Submitted' ? 'amber' : p.renewalStage === 'Received' ? 'green' : h.tone}>{p.status}</StatusBadge>
              },
            },
            {
              key: 'act', label: '', width: 128, sortable: false,
              // A non-expiring permit has no renewal to work, so offering one
              // reads as a date that does not exist. It gets a plain View / edit
              // instead; every other permit keeps the two-stage renewal action.
              render: (p) => (
                <span onClick={(e) => e.stopPropagation()} style={{ display: 'inline-block' }}>
                  {isNonExpiring(p) ? (
                    <ActionButton size="sm" variant="subtle" onClick={() => router.push(`/portal/waga/permits/${p.permitId}`)}>
                      View / edit
                    </ActionButton>
                  ) : (
                    <ActionButton size="sm" variant="subtle" onClick={() => setRenewing(p)}>
                      {p.status === 'Renewal Submitted' ? 'Mark received' : 'Renewal'}
                    </ActionButton>
                  )}
                </span>
              ),
            },
          ]}
        />
      </Section>

      {/* Every permit added and every renewal step across the register, with
          what was entered — each permit's own page narrows this to that permit. */}
      <ModuleActivity
        module="permits"
        empty="No permit has been added or renewed in the portal yet."
      />

      <RenewalModal
        permit={renewing}
        onClose={() => setRenewing(null)}
        onSubmit={submitRenewal}
        onReceive={receiveRenewal}
      />

      <AddPermitModal open={adding} existing={all} onClose={() => setAdding(false)} onSave={addPermit} />
    </div>
  )
}

/**
 * Add a permit that is not in the imported set.
 *
 * A whole record rather than an overlay, so it needs everything a seeded permit
 * carries. Blank expiry and renewal dates are allowed and kept blank — the same
 * rule the register follows for the source's own undated permits, so an added
 * non-expiring authorization is recorded as one rather than being given a date
 * to look complete.
 */
function AddPermitModal({ open, existing, onClose, onSave }) {
  // Every site the portal knows, the workbook's and any added in the portal —
  // the picker below offered the workbook's two only, so a permit held at a site
  // added here could not be recorded at all.
  const { sites: siteList, codeOf, newRecordSiteId } = useSite()
  const [siteId, setSiteId] = useState(newRecordSiteId)
  const [permitType, setPermitType] = useState('')
  const [permitTitle, setPermitTitle] = useState('')
  const [permitNumber, setPermitNumber] = useState('')
  const [agency, setAgency] = useState('')
  const [program, setProgram] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [renewalDeadline, setRenewalDeadline] = useState('')
  const [notes, setNotes] = useState('')

  const [seen, setSeen] = useState(open)
  if (open !== seen) {
    setSeen(open)
    if (open) {
      setSiteId(newRecordSiteId); setPermitType(''); setPermitTitle(''); setPermitNumber('')
      setAgency(''); setProgram(''); setIssueDate(''); setExpirationDate(''); setRenewalDeadline(''); setNotes('')
    }
  }

  const agencies = [...new Set(permits.map((p) => p.agency))].filter(Boolean)
  const valid = permitNumber.trim() && permitType.trim() && agency.trim() && siteId
  // The id carries the site's code, and a site added in the portal has one —
  // it was just invisible to the workbook's own lookup, which answers an em
  // dash for anything it does not know. Four real permits went in as
  // PERMIT-—-NEW-001 before that showed up. A dash is never an id.
  const nextId = () => {
    const code = codeOf(siteId) || siteCode(siteId)
    const safe = /^[A-Za-z0-9_-]+$/.test(code) ? code : 'ORG'
    const n = existing.filter((p) => p.siteId === siteId).length + 1
    return `PERMIT-${safe}-NEW-${String(n).padStart(3, '0')}`
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a permit" subtitle="A licence or authorization not in the imported set" width={640}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <ActionButton variant="ghost" onClick={onClose}>Cancel</ActionButton>
          <ActionButton variant="primary" disabled={!valid}
            onClick={() => onSave({
              permitId: nextId(), siteId,
              permitType: permitType.trim(), permitTitle: permitTitle.trim() || permitType.trim(),
              permitNumber: permitNumber.trim(), agency: agency.trim(), program: program.trim(),
              issueDate, expirationDate, renewalDeadline,
              status: 'Active', notes: notes.trim(), sourceFile: '',
              _raised: true, _requirementCount: 0,
            })}>
            Add permit
          </ActionButton>
        </div>
      )}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Permit number" required>
            <input value={permitNumber} onChange={(e) => setPermitNumber(e.target.value)} placeholder="e.g. 42-00300B" style={input} />
          </Field>
          <Field label="Site" required>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)} style={input}>
              {siteList.map((s) => <option key={s.siteId} value={s.siteId}>{s.code} — {s.siteName}</option>)}
            </select>
          </Field>
          <Field label="Permit type" required>
            <input value={permitType} onChange={(e) => setPermitType(e.target.value)} placeholder="e.g. Air Operating Permit" style={input} />
          </Field>
          <Field label="Title">
            <input value={permitTitle} onChange={(e) => setPermitTitle(e.target.value)} placeholder="Full permit title" style={input} />
          </Field>
          <Field label="Agency" required>
            <input value={agency} onChange={(e) => setAgency(e.target.value)} placeholder="e.g. PA DEP" list="waga-agencies" style={input} />
            <datalist id="waga-agencies">{agencies.map((a) => <option key={a} value={a} />)}</datalist>
          </Field>
          <Field label="Programme">
            <input value={program} onChange={(e) => setProgram(e.target.value)} placeholder="e.g. Clean Air Act" style={input} />
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Field label="Issued" hint="Leave blank if the source has none.">
            <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} style={input} />
          </Field>
          <Field label="Expires" hint="Blank = non-expiring / not stated.">
            <input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} style={input} />
          </Field>
          <Field label="Renewal due">
            <input type="date" value={renewalDeadline} onChange={(e) => setRenewalDeadline(e.target.value)} style={input} />
          </Field>
        </div>

        <Field label="Notes (optional)">
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything worth recording about this permit." style={{ ...input, resize: 'vertical' }} />
        </Field>
      </div>
    </Modal>
  )
}

/**
 * Work a permit's renewal.
 *
 * Two stages behind one door: submit the application, then record the renewed
 * authorization when it comes back. Which one it opens on is read off the
 * permit's current stage, so a permit already showing "Renewal Submitted" opens
 * straight on the receive step rather than asking twice.
 */
function RenewalModal({ permit, onClose, onSubmit, onReceive }) {
  const stage = permit?.status === 'Renewal Submitted' || permit?.renewalStage === 'Submitted' ? 'receive' : 'submit'

  const [submittedDate, setSubmittedDate] = useState(TODAY())
  const [receivedDate, setReceivedDate] = useState(TODAY())
  const [newExpiry, setNewExpiry] = useState('')
  const [newNumber, setNewNumber] = useState('')
  const [ref, setRef] = useState('')
  const [note, setNote] = useState('')

  const key = permit?.permitId || ''
  const [seen, setSeen] = useState(key)
  if (key !== seen) {
    setSeen(key)
    setSubmittedDate(TODAY()); setReceivedDate(TODAY()); setNewExpiry(''); setNewNumber(''); setRef(''); setNote('')
  }
  if (!permit) return null
  const p = permit

  // A renewal that ends before today, or before the term it replaces, is a typo
  // rather than a renewal — and both were accepted: a permit was marked Active
  // with an expiry already five days gone, after an earlier receive had moved
  // its expiry backwards. Dates are YYYY-MM-DD, so they compare as strings.
  const today = TODAY()
  const currentExpiry = p.expirationDate || ''
  const expiryError = !newExpiry ? ''
    : newExpiry <= today ? `The new expiry has to be after today (${fmtDate(today)}).`
      : currentExpiry && newExpiry <= currentExpiry
        ? `A renewal has to run past the current expiry (${fmtDate(currentExpiry)}).`
        : ''
  // The picker greys out every day the rule would refuse, from the later of
  // today and the current expiry.
  const floor = currentExpiry && currentExpiry > today ? currentExpiry : today
  const minExpiry = (() => {
    const d = new Date(`${floor}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + 1)
    return d.toISOString().slice(0, 10)
  })()

  return (
    <Modal open={Boolean(permit)} onClose={onClose}
      title={stage === 'receive' ? 'Record renewal received' : 'Submit permit renewal'}
      subtitle={`${p.permitNumber} · ${p.permitTitle}`} width={540}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <ActionButton variant="ghost" onClick={onClose}>Cancel</ActionButton>
          {stage === 'receive' ? (
            <ActionButton variant="success" disabled={!newExpiry || Boolean(expiryError)}
              onClick={() => onReceive(p, { receivedDate, newExpiry, newNumber: newNumber.trim(), ref: ref.trim(), note: note.trim() })}>
              Record renewal
            </ActionButton>
          ) : (
            <ActionButton variant="primary" disabled={!submittedDate}
              onClick={() => onSubmit(p, { submittedDate, ref: ref.trim(), note: note.trim() })}>
              Mark submitted
            </ActionButton>
          )}
        </div>
      )}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={box}>
          <Row k="Permit" v={`${p.permitNumber} — ${p.permitType}`} />
          <Row k="Agency" v={p.agency} />
          <Row k="Current expiry" v={p.expirationDate ? fmtDate(p.expirationDate) : 'Not stated in source'} />
          {p.renewalDeadline && p.renewalStage !== 'Received' && <Row k="Renewal due" v={fmtDate(p.renewalDeadline)} />}
          <Row k="Document on file" v={p.sourceFile || '—'} last />
        </div>

        {stage === 'receive' ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Received date">
                <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} style={input} />
              </Field>
              <Field label="New expiry date" required>
                <input type="date" value={newExpiry} min={minExpiry} onChange={(e) => setNewExpiry(e.target.value)}
                  style={{ ...input, ...(expiryError ? { borderColor: '#dc2626' } : null) }} />
                {expiryError && (
                  <span style={{ display: 'block', marginTop: 5, fontSize: 11, color: '#dc2626', fontWeight: 600, lineHeight: 1.45 }}>
                    {expiryError}
                  </span>
                )}
              </Field>
            </div>
            <Field label="New permit number (if it changed)">
              <input value={newNumber} onChange={(e) => setNewNumber(e.target.value)}
                placeholder={p.permitNumber} style={input} />
            </Field>
            <Field label="Document reference" hint="Filename or link to the renewed authorization — the file lives in your repository.">
              <input value={ref} onChange={(e) => setRef(e.target.value)}
                placeholder="e.g. 25-TV-003 Renewed.pdf" style={input} />
            </Field>
          </>
        ) : (
          <>
            <Field label="Application submitted date">
              <input type="date" value={submittedDate} onChange={(e) => setSubmittedDate(e.target.value)} style={input} />
            </Field>
            <Field label="Confirmation reference" hint="Agency confirmation number or submission receipt.">
              <input value={ref} onChange={(e) => setRef(e.target.value)}
                placeholder="e.g. Iowa Easy Air submission 2029-…" style={input} />
            </Field>
          </>
        )}

        <Field label="Note (optional)">
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Anything worth recording about this renewal." style={{ ...input, resize: 'vertical' }} />
        </Field>
      </div>
    </Modal>
  )
}

function Field({ label, required, hint, children }) {
  return (
    <label style={{ display: 'block', minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
        {label}{required && <span style={{ color: '#dc2626' }}> *</span>}
      </span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginTop: 5, lineHeight: 1.45 }}>{hint}</span>}
    </label>
  )
}

function Row({ k, v, last }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: last ? 'none' : '1px solid #eef2f7' }}>
      <span style={{ fontSize: 11.5, color: '#94a3b8', flex: '0 0 130px' }}>{k}</span>
      <span style={{ fontSize: 12.5, color: '#0f172a', fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere' }}>{v}</span>
    </div>
  )
}

const raisedChip = {
  fontSize: 9.5, fontWeight: 800, letterSpacing: '.03em', color: '#3640d8',
  background: '#eef1ff', border: '1px solid #dbe2ff', borderRadius: 999, padding: '1px 7px',
}
const box = { padding: '10px 13px', borderRadius: 10, background: '#f8fafc', border: '1px solid #eef2f7' }
const input = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
  fontFamily: 'inherit', color: '#0f172a', background: '#fff', borderRadius: 9, outline: 'none',
  borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0',
}
