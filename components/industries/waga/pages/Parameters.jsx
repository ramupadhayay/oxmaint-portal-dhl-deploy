'use client'

// Permit limits and the operating parameters that have to stay under them.
//
// The limit column is text, not a number, and that is deliberate. Most of the
// nine are plain figures — 3.2 lb/hr, 99 TPY — but the thermal oxidiser's is a
// conditional sentence: "If no test: min 1500 F; if compliant test: may be
// lower, but never less than 1200 F." Reducing that to a single number would
// misstate the permit, and the permit is the thing a regulator reads back.
//
// What makes the screen work: a reading can be logged against a limit, and a
// reading over a limit raises a deviation on the CAPA screen automatically —
// the monitoring loop the trial is meant to prove. But only where the workbook
// set an `alert_threshold_pct`. That flag is the workbook's own signal that the
// limit is a plain trendable maximum; the two conditional rules carry no
// threshold, so a reading against them is recorded with the operator's own
// in-spec / exceedance judgment rather than a machine comparison that would
// claim a precision the permit does not have.

import { useMemo, useState } from 'react'
import { Section, DataTable, Toolbar, StatusBadge, Modal, ActionButton } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Ref, SiteChip, TwoLine, Blank, Note, Source } from '../components/cells'
import { useSite } from '../lib/siteStore'
import { useStore, useCreated, useRecords, USER } from '../lib/store'
import { parameters, deviations, permits, siteCode, fmtDate, TODAY } from '../lib/data'
import ModuleActivity, { auditRowsFor } from '../components/ModuleActivity'

const MODE_TONE = {
  'Manual/Calculation': 'blue',
  'Manual/Test': 'blue',
  Calculated: 'violet',
  Inspection: 'amber',
  'Sensor/PI optional': 'green',
}
const JUDGE_TONE = { Breach: 'red', Warning: 'amber', 'In spec': 'green' }

// The leading number in a limit sentence — "99 TPY" → 99, "Maximum 876 hours in
// any rolling 12-month period" → 876. Only trusted where the workbook set a
// threshold, which is its own statement that the limit is a plain maximum.
function limitValueOf(p) {
  if (p.alertThresholdPct == null) return null
  const m = String(p.limitText).match(/([\d,]+(?:\.\d+)?)/)
  if (!m) return null
  return Number(m[1].replace(/,/g, ''))
}

// A reading judged against a maximum limit and its warning band.
function judge(value, limit, thresholdPct) {
  if (limit == null || !Number.isFinite(value)) return null
  if (value > limit) return 'Breach'
  if (thresholdPct != null && value >= (limit * thresholdPct) / 100) return 'Warning'
  return 'In spec'
}

const parameterKey = (p) => p.parameterId

export default function Parameters() {
  const { scope, siteName, emptyFor, codeOf, newRecordSiteId, sites } = useSite()
  const store = useStore()
  // Scoped: the readings list and the 'logged here' count are this site's,
  // not the trial's.
  const readings = scope(useCreated('waga_reading'))
  const createdDeviations = useCreated('waga_deviation')

  const [search, setSearch] = useState('')
  const [mode, setMode] = useState('all')
  const [logging, setLogging] = useState(null)   // the parameter being logged
  const [adding, setAdding] = useState(false)    // writing a limit the workbook has not got

  // The workbook's limits with anything written here on top. Until this screen
  // could take a limit of its own, a site added in the portal had no way ever to
  // hold one — the module was permanently empty for it, with no action on the
  // page to change that.
  const merged = useRecords('waga_parameter', parameters, parameterKey)
  const all = useMemo(() => scope(merged.map((p) => ({
    ...p,
    _siteCode: p._siteCode || codeOf(p.siteId) || siteCode(p.siteId),
  }))), [scope, merged, codeOf])
  // The modes offered are the ones present in scope, not across the trial.
  const modes = [...new Set(all.map((p) => p.dataMode))].filter(Boolean)

  // The most recent reading per parameter, for the table's live column.
  const latest = useMemo(() => {
    const m = new Map()
    for (const r of readings) {
      const prev = m.get(r.parameterId)
      if (!prev || String(r.readingDate) > String(prev.readingDate)) m.set(r.parameterId, r)
    }
    return m
  }, [readings])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((p) => (
      (mode === 'all' || p.dataMode === mode) &&
      (!q || [p.parameter, p.scope, p.limitText, p.source].join(' ').toLowerCase().includes(q))
    ))
  }, [all, search, mode])

  const withThreshold = all.filter((p) => p.alertThresholdPct != null).length
  const breaches = readings.filter((r) => r.judgment === 'Breach').length

  const logReading = async ({ parameter: p, value, readingDate, note, judgment }) => {
    const limit = limitValueOf(p)
    const reading = await store.create('waga_reading', {
      parameterId: p.parameterId, permitId: p.permitId, siteId: p.siteId,
      parameter: p.parameter, scope: p.scope, unit: p.unit || '',
      value, limitValue: limit, thresholdPct: p.alertThresholdPct ?? null,
      readingDate, note: note || '', judgment,
    })
    if (!reading) return
    await store.log('Reading logged', `${p.parameter} · ${p.scope} (${siteCode(p.siteId)})`,
      `${value}${p.unit ? ' ' + p.unit : ''} — ${judgment}`, p.siteId)

    // A breach raises a deviation, so the exceedance lands on the CAPA screen
    // rather than living only as a number here. The reading is the evidence
    // behind it.
    if (judgment === 'Breach') {
      const code = siteCode(p.siteId)
      const n = [...deviations, ...createdDeviations].filter((d) => d.siteId === p.siteId).length + 1
      const deviationId = `DEV-${code}-${String(n).padStart(3, '0')}`
      const dev = await store.create('waga_deviation', {
        deviationId, siteId: p.siteId, permitId: p.permitId,
        description: `Permit limit exceedance — ${p.parameter} on ${p.scope}`,
        eventDate: readingDate, duration: 'NA',
        monitoringMethod: p.dataMode || 'Monitoring',
        cause: `Logged reading ${value}${p.unit ? ' ' + p.unit : ''} against limit ${p.limitText}.`,
        correctiveAction: '', status: 'Open',
        source: `WAGA portal · reading ${reading.recordId}`,
        _raised: true, _fromReading: reading.recordId,
      })
      if (dev) {
        await store.log('Deviation raised (auto)', `${deviationId} · limit exceedance`, p.parameter, p.siteId)
        store.notify(`Breach logged — deviation ${deviationId} raised.`, 'error')
      }
    } else {
      store.notify(`Reading logged — ${judgment}.`)
    }
    setLogging(null)
  }

  /**
   * Write a limit the workbook does not carry.
   *
   * Badged `_added` rather than mixed in: the imported limits were read off the
   * permit documents and verified against them, and a figure typed here has not
   * been. It behaves like the others in every way that matters — a reading can
   * be logged against it, and a reading over it raises a deviation.
   */
  const addLimit = async (values) => {
    const code = codeOf(values.siteId) || siteCode(values.siteId) || 'ORG'
    const safe = /^[A-Za-z0-9_-]+$/.test(code) ? code : 'ORG'
    const n = all.filter((p) => p.siteId === values.siteId).length + 1
    const saved = await store.create('waga_parameter', {
      ...values,
      parameterId: `PAR-${safe}-NEW-${String(n).padStart(3, '0')}`,
      _added: true,
    })
    if (!saved) return
    await store.log('Limit added', `${values.parameter} · ${values.scope} (${safe})`,
      `${values.limitText}${values.dataMode ? ` · ${values.dataMode}` : ''}`, values.siteId)
    store.notify(`Limit added — ${values.parameter}.`)
    setAdding(false)
  }

  return (
    <div>
      <PageHeading
        title="Permit Limits & Monitoring Parameters"
        subtitle={`Permit limits, operating parameters, how each is monitored, and the readings logged against them — ${siteName}.`}
        right={<ActionButton onClick={() => setAdding(true)}>Add a limit</ActionButton>}
      />

      <StatCards items={[
        { label: 'Limits tracked', value: all.length, icon: 'chart' },
        { label: 'Trendable', value: withThreshold, note: 'Carry a warning threshold', tone: 'green' },
        { label: 'Readings logged', value: readings.length, note: 'Recorded in the portal', icon: 'clock' },
        { label: 'Breaches', value: breaches, tone: breaches ? 'red' : 'green', note: 'Each raised a deviation' },
        { label: 'Equipment scopes', value: new Set(all.map((p) => p.scope)).size, icon: 'asset' },
      ]} />

      <Section title="Permit limits and parameters">
        <Note tone="grey">
          Limits are shown as the permit words them. A reading can be logged against any limit;
          where the workbook set a warning threshold the reading is judged automatically and an
          exceedance raises a deviation. The two conditional rules carry no threshold, so a
          reading against them takes the operator&apos;s own judgment instead.
        </Note>

        <Toolbar
          search={search} onSearch={setSearch}
          placeholder="Search parameter, equipment or limit…"
          filters={[{ label: 'Monitoring', value: mode, onChange: setMode, options: modes }]}
        />

        <DataTable
          rows={rows}
          pageSize={12}
          empty={all.length
            ? 'No parameters match these filters.'
            : emptyFor('No parameters match these filters.', 'monitoring limits', 'Add a limit to record one')}
          columns={[
            {
              key: 'parameterId', label: 'Reference', width: 140,
              render: (p) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Ref>{p.parameterId}</Ref>
                  {p._added && <StatusBadge tone="grey">Added here</StatusBadge>}
                </span>
              ),
            },
            { key: 'siteId', label: 'Site', width: 70, render: (p) => <SiteChip code={p._siteCode} /> },
            { key: 'scope', label: 'Equipment / scope', width: 190, render: (p) => <TwoLine top={p.scope} bottom={p.parameter} /> },
            {
              key: 'limitText', label: 'Limit',
              render: (p) => <span style={{ fontSize: 12.5, color: '#0f172a', fontWeight: 600, lineHeight: 1.45 }}>{p.limitText}</span>,
            },
            {
              key: 'latest', label: 'Latest reading', width: 150, sortable: false,
              render: (p) => {
                const r = latest.get(p.parameterId)
                if (!r) return <span style={{ fontSize: 11.5, color: '#94a3b8' }}>None logged</span>
                return (
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>{r.value}{r.unit ? ` ${r.unit}` : ''}</div>
                    <StatusBadge tone={JUDGE_TONE[r.judgment] || 'grey'}>{r.judgment}</StatusBadge>
                  </div>
                )
              },
            },
            {
              key: 'dataMode', label: 'Monitored by', width: 150,
              render: (p) => <StatusBadge tone={MODE_TONE[p.dataMode] || 'grey'}>{p.dataMode}</StatusBadge>,
            },
            {
              key: 'act', label: '', width: 116, sortable: false,
              render: (p) => (
                <span onClick={(e) => e.stopPropagation()} style={{ display: 'inline-block' }}>
                  <ActionButton size="sm" variant="subtle" onClick={() => setLogging(p)}>Log reading</ActionButton>
                </span>
              ),
            },
          ]}
        />
      </Section>

      {/* Every reading logged here — value, judgment, the remark typed with it,
          who and when — directly under the limits it was logged against. The
          count in the tile above was all this screen used to say about them. */}
      <ModuleActivity
        module="parameters"
        readings={readings}
        title="Readings recorded in the portal"
        empty="No readings have been logged yet. Use Log reading on any limit above."
      />

      <Section title="Where each limit comes from">
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((p) => (
            <div key={p.parameterId} style={{ padding: '12px 14px', border: '1px solid #e4e9f0', borderLeft: '3px solid #15227a', borderRadius: 10, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                  {p._siteCode} · {p.scope} · {p.parameter}
                </div>
                <StatusBadge tone={MODE_TONE[p.dataMode] || 'grey'}>{p.dataMode}</StatusBadge>
              </div>
              <div style={{ fontSize: 12.5, color: '#334155', marginTop: 6, lineHeight: 1.5 }}>{p.limitText}</div>
              {p.source ? <Source>{p.source}</Source> : null}
            </div>
          ))}
        </div>
      </Section>

      <LogModal parameter={logging} onClose={() => setLogging(null)} onLog={logReading} />

      <AddLimitModal
        open={adding}
        sites={sites}
        defaultSiteId={newRecordSiteId}
        onClose={() => setAdding(false)}
        onSave={addLimit}
      />
    </div>
  )
}

/**
 * A limit the portal is told about rather than one the workbook carried.
 *
 * Only what a limit needs to work: whose site it is, what it applies to, what
 * the permit says, and — where it is a plain maximum — the warning band that
 * lets a reading be judged automatically. A conditional limit is left without
 * one, exactly as the imported conditional limits are, so nothing here claims a
 * precision the permit does not have.
 */
function AddLimitModal({ open, sites, defaultSiteId, onClose, onSave }) {
  const [siteId, setSiteId] = useState(defaultSiteId)
  const [permitId, setPermitId] = useState('')
  const [scopeText, setScopeText] = useState('')
  const [parameter, setParameter] = useState('')
  const [limitText, setLimitText] = useState('')
  const [unit, setUnit] = useState('')
  const [threshold, setThreshold] = useState('')
  const [dataMode, setDataMode] = useState('Manual/Calculation')
  const [source, setSource] = useState('')

  const [seen, setSeen] = useState(open)
  if (open !== seen) {
    setSeen(open)
    if (open) {
      setSiteId(defaultSiteId); setPermitId(''); setScopeText(''); setParameter('')
      setLimitText(''); setUnit(''); setThreshold(''); setDataMode('Manual/Calculation'); setSource('')
    }
  }

  const sitePermits = permits.filter((p) => p.siteId === siteId)
  const valid = siteId && parameter.trim() && scopeText.trim() && limitText.trim()

  return (
    <Modal open={open} onClose={onClose} title="Add a permit limit"
      subtitle="A limit or operating parameter the imported workbook does not carry" width={620}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <ActionButton variant="ghost" onClick={onClose}>Cancel</ActionButton>
          <ActionButton variant="primary" disabled={!valid}
            onClick={() => onSave({
              siteId,
              permitId,
              scope: scopeText.trim(),
              parameter: parameter.trim(),
              limitText: limitText.trim(),
              unit: unit.trim(),
              alertThresholdPct: threshold === '' ? null : Number(threshold),
              dataMode,
              source: source.trim(),
            })}>
            Add limit
          </ActionButton>
        </div>
      )}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <LimitField label="Site" required>
            <select value={siteId} onChange={(e) => { setSiteId(e.target.value); setPermitId('') }} style={limitInput}>
              {sites.map((s) => <option key={s.siteId} value={s.siteId}>{s.code} — {s.siteName}</option>)}
            </select>
          </LimitField>
          <LimitField label="Permit it comes from"
            hint={sitePermits.length ? '' : 'No permit on this site yet — the limit can stand on its own.'}>
            <select value={permitId} onChange={(e) => setPermitId(e.target.value)} style={limitInput}>
              <option value="">Not tied to a permit</option>
              {sitePermits.map((p) => <option key={p.permitId} value={p.permitId}>{p.permitNumber} — {p.permitType}</option>)}
            </select>
          </LimitField>
          <LimitField label="Equipment or scope" required>
            <input value={scopeText} onChange={(e) => setScopeText(e.target.value)} placeholder="e.g. C101A Thermal Oxidizer" style={limitInput} />
          </LimitField>
          <LimitField label="Parameter" required>
            <input value={parameter} onChange={(e) => setParameter(e.target.value)} placeholder="e.g. CO emissions" style={limitInput} />
          </LimitField>
        </div>
        <LimitField label="Limit, as the permit words it" required>
          <input value={limitText} onChange={(e) => setLimitText(e.target.value)} placeholder="e.g. 99 TPY" style={limitInput} />
        </LimitField>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <LimitField label="Unit">
            <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="TPY, F, hours…" style={limitInput} />
          </LimitField>
          <LimitField label="Warning at % of limit"
            hint="Leave blank for a conditional limit — readings are then judged by the operator.">
            <input type="number" min="1" max="100" value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="90" style={limitInput} />
          </LimitField>
          <LimitField label="Monitored by">
            <select value={dataMode} onChange={(e) => setDataMode(e.target.value)} style={limitInput}>
              {['Manual/Calculation', 'Manual/Test', 'Calculated', 'Inspection', 'Sensor/PI optional']
                .map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </LimitField>
        </div>
        <LimitField label="Where it is written" hint="The document and page this limit was read from, if there is one.">
          <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Permit No. 42-00254A (pg 11)" style={limitInput} />
        </LimitField>
      </div>
    </Modal>
  )
}

const limitInput = {
  width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d7dee8',
  fontSize: 13, color: '#0f172a', background: '#fff', outline: 'none',
}

function LimitField({ label, required, hint, children }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 5 }}>
        {label}{required && <span style={{ color: '#b91c1c' }}> *</span>}
      </div>
      {children}
      {hint ? <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, lineHeight: 1.45 }}>{hint}</div> : null}
    </label>
  )
}

/**
 * Log a monitoring reading.
 *
 * Where the limit is a plain maximum the judgment is computed from the value and
 * shown live as it is typed. Where it is conditional, the operator sets the
 * judgment, because only they can read the sentence the permit actually wrote.
 */
function LogModal({ parameter, onClose, onLog }) {
  const [value, setValue] = useState('')
  const [readingDate, setReadingDate] = useState(TODAY())
  const [note, setNote] = useState('')
  const [manual, setManual] = useState('In spec')

  const key = parameter?.parameterId || ''
  const [seen, setSeen] = useState(key)
  if (key !== seen) {
    setSeen(key); setValue(''); setReadingDate(TODAY()); setNote(''); setManual('In spec')
  }
  if (!parameter) return null

  const p = parameter
  const limit = limitValueOf(p)
  const auto = limit != null
  const num = Number(value)
  const computed = auto ? judge(num, limit, p.alertThresholdPct) : null
  const judgment = auto ? computed : manual
  const valid = value !== '' && (!auto || Number.isFinite(num))

  return (
    <Modal open={Boolean(parameter)} onClose={onClose} title="Log a reading" subtitle={`${p.scope} · ${p.parameter}`} width={520}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <ActionButton variant="ghost" onClick={onClose}>Cancel</ActionButton>
          <ActionButton variant={judgment === 'Breach' ? 'danger' : 'primary'} disabled={!valid}
            onClick={() => onLog({ parameter: p, value: auto ? num : value.trim(), readingDate, note: note.trim(), judgment })}>
            {judgment === 'Breach' ? 'Log breach & raise deviation' : 'Log reading'}
          </ActionButton>
        </div>
      )}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={box}>
          <Row k="Limit" v={p.limitText} />
          {p.alertThresholdPct != null && <Row k="Warning threshold" v={`${p.alertThresholdPct}% of limit`} />}
          <Row k="Monitored by" v={p.dataMode} last />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label={`Reading${p.unit ? ` (${p.unit})` : ''}`} required>
            <input type={auto ? 'number' : 'text'} step="any" value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={auto ? 'Measured value' : 'e.g. 1520 F, within rule'} style={input} />
          </Field>
          <Field label="Reading date">
            <input type="date" value={readingDate} onChange={(e) => setReadingDate(e.target.value)} style={input} />
          </Field>
        </div>

        {auto ? (
          value !== '' && Number.isFinite(num) && (
            <div style={{
              padding: '10px 13px', borderRadius: 9, fontSize: 12.5, fontWeight: 600,
              background: computed === 'Breach' ? '#fef2f2' : computed === 'Warning' ? '#fffbeb' : '#ecfdf5',
              color: computed === 'Breach' ? '#b91c1c' : computed === 'Warning' ? '#b45309' : '#047857',
              border: `1px solid ${computed === 'Breach' ? '#fecaca' : computed === 'Warning' ? '#fde68a' : '#a7f3d0'}`,
            }}>
              {computed === 'Breach'
                ? `Over the ${p.limitText} limit — logging this raises a deviation.`
                : computed === 'Warning'
                  ? `Within limit but past the ${p.alertThresholdPct}% warning threshold.`
                  : 'Within limit.'}
            </div>
          )
        ) : (
          <Field label="Judgment" hint="This limit is a conditional rule — set the judgment against the permit sentence above.">
            <select value={manual} onChange={(e) => setManual(e.target.value)} style={input}>
              <option>In spec</option>
              <option>Warning</option>
              <option>Breach</option>
            </select>
          </Field>
        )}

        <Field label="Note (optional)">
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Anything worth recording about this reading." style={{ ...input, resize: 'vertical' }} />
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
      <span style={{ fontSize: 12.5, color: '#0f172a', fontWeight: 600, minWidth: 0, lineHeight: 1.45 }}>{v}</span>
    </div>
  )
}

const box = { padding: '10px 13px', borderRadius: 10, background: '#f8fafc', border: '1px solid #eef2f7' }
const input = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
  fontFamily: 'inherit', color: '#0f172a', background: '#fff', borderRadius: 9, outline: 'none',
  borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0',
}
