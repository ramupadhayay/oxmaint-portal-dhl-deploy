'use client'

// The estate — every site, and where each one sits.
//
// The portal has always filtered by site without ever showing the sites
// themselves; they were two rows inside an import file. Now that the scope
// filter has a country above it, the estate needs a screen of its own — and the
// client needs somewhere to add the next plant, because a country filter over
// one country is a filter with nothing to compare.
//
// TWO KINDS OF ROW, NEVER MERGED. The workbook's sites were read off permit
// documents and verified; a site added here was typed into a form. Both are real
// sites and both scope the whole portal, but only the first are evidence, so a
// portal-added row wears a badge saying so and its own count is reported
// separately. That is the same rule the Team screen follows for people, and the
// same rule the workbook's README sets for every other field: never let
// something entered here be mistaken for something read from a source.
//
// A new site starts with no permits and no obligations, and the table says so
// rather than showing zeros that look like a loading fault.

import { useMemo, useState } from 'react'
import { Section, DataTable, Toolbar, StatusBadge, Modal, ActionButton } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Ref, SiteChip, TwoLine, Blank, Note } from '../components/cells'
import { useSite } from '../lib/siteStore'
import { useStore, useRecords, USER } from '../lib/store'
import ModuleActivity from '../components/ModuleActivity'
import { permits, requirements, parameters, deviations } from '../lib/data'
import { permitKey, requirementKey, deviationKey } from '../lib/keys'
import { countryOptions } from '../lib/countries'

const REQUIRED = ['code', 'siteName', 'country']

export default function Sites() {
  const { sites, addedSites, countries, setScope, scopeName } = useSite()
  const store = useStore()
  const [search, setSearch] = useState('')
  const [origin, setOrigin] = useState('all')
  const [adding, setAdding] = useState(false)

  // Counted from the registers rather than stored, so a site's figures can never
  // disagree with the screen they came from — and from the registers as they
  // stand, workbook rows with portal changes merged plus anything added here.
  // Counting the workbook alone left a site added in the portal showing no
  // permits after a permit had been added against it.
  const allPermits = useRecords('waga_permit_event', permits, permitKey)
  const allRequirements = useRecords('waga_requirement', requirements, requirementKey)
  const allDeviations = useRecords('waga_deviation', deviations, deviationKey)
  const allParameters = useRecords('waga_parameter', parameters, (x) => x.parameterId)

  const rows = useMemo(() => sites.map((s) => ({
    ...s,
    _permits: allPermits.filter((p) => p.siteId === s.siteId).length,
    _requirements: allRequirements.filter((r) => r.siteId === s.siteId).length,
    _limits: allParameters.filter((p) => p.siteId === s.siteId).length,
    _deviations: allDeviations.filter((d) => d.siteId === s.siteId).length,
    _agencies: [...new Set(allPermits.filter((p) => p.siteId === s.siteId).map((p) => p.agency).filter(Boolean))],
  })), [sites, allPermits, allRequirements, allDeviations, allParameters])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((s) => (
      (origin === 'all'
        || (origin === 'From the workbook' && !s._added)
        || (origin === 'Added in the portal' && s._added))
      && (!q || [s.code, s.siteName, s.city, s.state, s.country, s.legalEntity]
        .filter(Boolean).join(' ').toLowerCase().includes(q))
    ))
  }, [rows, search, origin])

  const create = async (values) => {
    const saved = await store.create('waga_site', {
      ...values,
      // The id is the record's own. A workbook site is SITE-WBU06 because the
      // workbook said so; inventing that shape for a typed row would make the
      // two indistinguishable in every record that references a site.
      status: 'Added in the portal',
      addedBy: USER.name,
    })
    if (!saved) return
    await store.log('Added site', `${values.code} — ${values.siteName}`,
      // The site's own id is the record's id — `asSite` resolves it the same
      // way — so the line that records the addition sits under the site it
      // added rather than floating above every scope.
      `${[values.city, values.state, values.country].filter(Boolean).join(', ')} · added in the portal`,
      saved.siteId || saved.recordId)
    store.notify(`${values.siteName} added. It is now in the scope filter.`)
    setAdding(false)
  }

  return (
    <div>
      <PageHeading
        title="Sites"
        subtitle={`Every plant this portal covers, and where it sits. The scope filter in the header reads this list — country, then state or region, then site. Currently showing ${scopeName}.`}
        right={<ActionButton onClick={() => setAdding(true)}>Add a site</ActionButton>}
      />

      <StatCards items={[
        { label: 'Sites', value: sites.length, note: `${addedSites.length} added in the portal`, icon: 'site' },
        { label: 'Countries', value: countries.length, note: countries.map((c) => c.label).join(' · ') },
        {
          label: 'States / regions',
          value: new Set(sites.map((s) => s.state).filter(Boolean)).size,
          note: [...new Set(sites.map((s) => s.state).filter(Boolean))].sort().join(' · '),
        },
        { label: 'Legal entities', value: new Set(sites.map((s) => s.legalEntity).filter(Boolean)).size },
        { label: 'Permits held', value: allPermits.length, to: 'permits' },
        { label: 'Obligations', value: allRequirements.length, to: 'requirements', icon: 'list' },
      ]} />

      <Section title="The estate">
        <Note>
          The two <b>workbook</b> sites were read off the permit documents and verified against them.
          A site <b>added in the portal</b> was entered here — it scopes every screen the same way,
          but it is not evidence. It starts empty: add its permits on Permits &amp; Licenses, its
          obligations under each permit, and its limits on Limits &amp; Monitoring — or wait for the
          next workbook import. The badge on each row says which kind of site it is.
        </Note>

        <Toolbar
          search={search} onSearch={setSearch}
          placeholder="Search site, city, state or legal entity…"
          filters={[
            { label: 'Origin', value: origin, onChange: setOrigin, options: ['From the workbook', 'Added in the portal'] },
          ]}
        />

        <DataTable
          rows={shown}
          pageSize={20}
          empty="No sites match these filters."
          onRowClick={(s) => setScope({ countryKey: s.country || '', stateKey: s.state || '', siteId: s.siteId })}
          columns={[
            { key: 'code', label: 'Code', width: 90, render: (s) => <SiteChip code={s.code} /> },
            {
              key: 'siteName', label: 'Site', render: (s) => (
                <TwoLine top={s.siteName} bottom={s.legalEntity || ''} />
              ),
            },
            {
              key: 'city', label: 'Location', width: 200,
              render: (s) => (
                <TwoLine
                  top={[s.city, s.state].filter(Boolean).join(', ') || <Blank />}
                  bottom={s.country || ''}
                />
              ),
            },
            {
              key: '_origin', label: 'Origin', width: 170, sortable: false,
              render: (s) => (s._added
                ? <StatusBadge tone="violet">Added in the portal</StatusBadge>
                : <StatusBadge tone="green">From the workbook</StatusBadge>),
            },
            {
              key: '_agencies', label: 'Regulators', width: 170, sortable: false,
              render: (s) => (s._agencies.length
                ? <span style={{ fontSize: 12, color: '#475569' }}>{s._agencies.join(' · ')}</span>
                : <Blank label="None yet" />),
            },
            {
              key: '_permits', label: 'Permits', width: 90, align: 'right',
              render: (s) => (s._added && !s._permits ? <Blank label="—" /> : s._permits),
            },
            {
              key: '_requirements', label: 'Obligations', width: 110, align: 'right',
              render: (s) => (s._added && !s._requirements ? <Blank label="—" /> : s._requirements),
            },
            { key: '_limits', label: 'Limits', width: 80, align: 'right' },
            { key: '_deviations', label: 'Deviations', width: 100, align: 'right' },
          ]}
        />
      </Section>

      <ModuleActivity
        module="sites"
        empty="No site has been added in the portal yet."
      />

      <AddSite open={adding} onClose={() => setAdding(false)} onCreate={create} />
    </div>
  )
}

/**
 * Add a site.
 *
 * Only three fields are required — a code, a name, and the country, because the
 * country is the level the scope filter groups by and a site without one falls
 * into a bucket called "No country stated". Everything else is optional and
 * renders as a stated blank rather than being guessed at.
 */
function AddSite({ open, onClose, onCreate }) {
  const [v, setV] = useState({})
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  // The register's own spellings first, then the rest of the world.
  const countries = useMemo(() => countryOptions(v.country), [v.country])

  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) { setV({}); setTouched(false) }
  }

  const set = (k) => (e) => setV((p) => ({ ...p, [k]: e.target.value }))
  const missing = REQUIRED.filter((k) => !String(v[k] || '').trim())

  const submit = async () => {
    setTouched(true)
    if (missing.length || saving) return
    setSaving(true)
    try {
      await onCreate({
        code: v.code.trim(),
        siteName: v.siteName.trim(),
        country: v.country.trim(),
        state: (v.state || '').trim(),
        city: (v.city || '').trim(),
        legalEntity: (v.legalEntity || '').trim(),
        address: (v.address || '').trim(),
        zip: (v.zip || '').trim(),
      })
    } finally { setSaving(false) }
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      title="Add a site"
      subtitle="A plant this portal should cover, on top of the ones the workbook carries"
      width={560}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <ActionButton variant="ghost" onClick={onClose} disabled={saving}>Cancel</ActionButton>
          <ActionButton onClick={submit} disabled={saving || (touched && missing.length > 0)}>
            Add site
          </ActionButton>
        </div>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={styles.note}>
          This site will appear in the header&apos;s scope filter immediately, under the country you
          give it. It is recorded as added in the portal, and stays distinct from the sites read off
          the permit documents. It starts with nothing on it: scope to it and add its permits, the
          obligations under each permit, and its monitoring limits — or wait for the next workbook
          import to bring them in.
        </p>

        <div style={styles.two}>
          <Field label="Site code" required error={touched && !v.code} hint="Short, as people say it out loud — WBU08">
            <input value={v.code || ''} onChange={set('code')} placeholder="WBU08" style={styles.input} />
          </Field>
          {/* Picked, not typed. The header's geography is built by grouping
              sites on the exact string in this column, so a free-text box put a
              site typed "United States" in a second country from the two
              already filed under "USA" — and nobody sees that until the filter
              shows two countries where there is one. */}
          <Field label="Country" required error={touched && !v.country} hint="The level the scope filter groups by">
            <select value={v.country || ''} onChange={set('country')} style={{ ...styles.input, cursor: 'pointer' }}>
              <option value="">Select a country…</option>
              {countries.inRegister.length > 0 && (
                <optgroup label="Already in the register">
                  {countries.inRegister.map((c) => <option key={c} value={c}>{c}</option>)}
                </optgroup>
              )}
              <optgroup label="All countries">
                {countries.rest.map((c) => <option key={c} value={c}>{c}</option>)}
              </optgroup>
            </select>
          </Field>
        </div>

        <Field label="Site name" required error={touched && !v.siteName}>
          <input value={v.siteName || ''} onChange={set('siteName')} placeholder="Bordeaux RNG Plant" style={styles.input} />
        </Field>

        <div style={styles.two}>
          <Field label="State / region">
            <input value={v.state || ''} onChange={set('state')} placeholder="Nouvelle-Aquitaine" style={styles.input} />
          </Field>
          <Field label="City">
            <input value={v.city || ''} onChange={set('city')} placeholder="Bordeaux" style={styles.input} />
          </Field>
        </div>

        <Field label="Legal entity">
          <input value={v.legalEntity || ''} onChange={set('legalEntity')} placeholder="WAGA Bordeaux SAS" style={styles.input} />
        </Field>

        <div style={styles.two}>
          <Field label="Address">
            <input value={v.address || ''} onChange={set('address')} style={styles.input} />
          </Field>
          <Field label="Postcode">
            <input value={v.zip || ''} onChange={set('zip')} style={styles.input} />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

function Field({ label, hint, required, error, children }) {
  return (
    <label style={{ display: 'block', minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
        {label}
        {required && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}
      </span>
      {children}
      {error
        ? <span style={{ display: 'block', fontSize: 11, color: '#b91c1c', marginTop: 5 }}>Required</span>
        : hint && <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginTop: 5, lineHeight: 1.45 }}>{hint}</span>}
    </label>
  )
}

const styles = {
  two: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  note: {
    margin: 0, padding: '9px 12px', borderRadius: 9, fontSize: 11.5, lineHeight: 1.55,
    background: '#f8fafc', color: '#475569', borderLeft: '3px solid #cbd5e1',
  },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
    fontFamily: 'inherit', color: '#0f172a', background: '#fff', borderRadius: 9, outline: 'none',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0',
  },
}
