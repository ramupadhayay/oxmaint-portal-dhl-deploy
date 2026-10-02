'use client'

// Reports — the estate rolled up, and taken out of the portal.
//
// The client's review asked for overview reports by permit, by site, by country
// and so on, and for a way to export them. The screens the portal already had
// answer "what is the state of this one thing"; nothing answered "give me the
// picture, on paper, for a meeting". This does.
//
// Every cut reads the same object — title, note, columns, rows, headline figures
// — so the table you are looking at, the PDF you print and the CSV you open in
// Excel are the same report rather than three renderings that drift apart. The
// column set is defined once in lib/reportsData.js and all three read it.
//
// Two things are deliberately visible rather than buried. The scope is printed
// on the page and written into every export, because a compliance figure without
// its scope is a number somebody will quote wrongly. And a cut whose dates the
// portal worked out for itself is labelled as derived, on screen and in the PDF —
// the source workbook is explicit that projected dates are not WAGA's records,
// and a report that blurs the two is the one failure this dataset cannot afford.

import { useMemo, useState } from 'react'
import { Section, DataTable, StatusBadge, ActionButton } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Note, Derived } from '../components/cells'
import { useSite } from '../lib/siteStore'
import { useStore, useCreated, useRecords } from '../lib/store'
import { buildReports } from '../lib/reportsData'
import { exportCsv, slug } from '../lib/exportCsv'
import { wagaReportPdf } from '../lib/reportsPdf'
import { ORG, fmtDate, TODAY, permits as workbookPermits, requirements as workbookRequirements, deviations as workbookDeviations } from '../lib/data'

const permitKey = (p) => p.permitId
const requirementKey = (r) => r.requirementId
const deviationKey = (d) => d.deviationId

export default function Reports() {
  const { scope, scopeName, sites } = useSite()
  const { ready, persisted, notify } = useStore()
  const filings = useCreated('waga_filing')
  const attachments = useCreated('waga_attachment')

  // The registers as the screens show them, not as the workbook shipped them.
  // Reports read the import alone, so a site added in the portal reported zero
  // sites, zero permits and zero obligations while the Sites and Permits
  // screens listed all three — the report was the only screen that disagreed,
  // and it is the one that leaves the building.
  const allPermits = useRecords('waga_permit_event', workbookPermits, permitKey)
  const allRequirements = useRecords('waga_requirement', workbookRequirements, requirementKey)
  const allDeviations = useRecords('waga_deviation', workbookDeviations, deviationKey)

  const [tab, setTab] = useState('permits')
  const [busy, setBusy] = useState('')

  const { overview, reports } = useMemo(
    () => buildReports({
      scope, scopeName, filings, attachments, sites,
      permits: allPermits, requirements: allRequirements, deviations: allDeviations,
    }),
    [scope, scopeName, filings, attachments, sites, allPermits, allRequirements, allDeviations],
  )

  const current = reports.find((r) => r.key === tab) || reports[0]

  // The clock is read here and handed down, so the screen, the PDF and the CSV
  // all carry the same instant rather than three that differ by milliseconds.
  const stamp = () => fmtDate(TODAY())

  const csvPreamble = (r) => [
    ['Report', r.title],
    ['Client', ORG.name],
    ['Programme', ORG.programme],
    ['Scope', scopeName],
    ['Prepared', stamp()],
    ['Basis', r.derived
      ? 'Dates projected by the portal from the recurrence rule on each obligation'
      : 'Imported permit workbook, plus records created in this portal'],
  ]

  const exportOne = (kind) => async () => {
    setBusy(kind)
    try {
      if (kind === 'csv') {
        exportCsv(`waga-${slug(current.title)}`, current.columns, current.rows, csvPreamble(current))
        notify(`${current.title} exported as CSV.`)
      } else {
        await wagaReportPdf({
          title: current.title,
          scopeName,
          generated: stamp(),
          overview: null,
          reports: [current],
          persisted,
          filename: `waga-${slug(current.title)}.pdf`,
        })
        notify(`${current.title} exported as PDF.`)
      }
    } catch (e) {
      notify(e?.message || 'That export could not be produced.', 'error')
    } finally {
      setBusy('')
    }
  }

  const exportAll = async () => {
    setBusy('all')
    try {
      await wagaReportPdf({
        title: 'Compliance report',
        scopeName,
        generated: stamp(),
        overview,
        reports,
        persisted,
        filename: `waga-compliance-report-${slug(scopeName)}.pdf`,
      })
      notify('Full compliance report exported.')
    } catch (e) {
      notify(e?.message || 'That report could not be produced.', 'error')
    } finally {
      setBusy('')
    }
  }

  return (
    <div>
      <PageHeading
        title="Reports"
        subtitle={`The estate rolled up by permit, site, country, regulator and obligation — and exported for a meeting or a regulator. Scope: ${scopeName}.`}
        right={(
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Disabled until the store has answered: a report exported before
                the records arrive under-reports every filing made in the portal
                and looks like a compliance gap. */}
            {!ready && <StatusBadge tone="grey">Loading records…</StatusBadge>}
            <ActionButton variant="ghost" disabled={!ready || Boolean(busy)} onClick={exportOne('csv')}>
              Export this report (CSV)
            </ActionButton>
            <ActionButton variant="ghost" disabled={!ready || Boolean(busy)} onClick={exportOne('pdf')}>
              Export this report (PDF)
            </ActionButton>
            <ActionButton disabled={!ready || Boolean(busy)} onClick={exportAll}>
              Full report (PDF)
            </ActionButton>
          </div>
        )}
      />

      <StatCards items={[
        { label: 'Sites', value: overview.sites, note: `${overview.countries} ${overview.countries === 1 ? 'country' : 'countries'}`, icon: 'site' },
        { label: 'Permits', value: overview.permits, to: 'permits' },
        { label: 'Obligations', value: overview.obligations, note: `${overview.standing} standing · ${overview.evented} event-driven`, to: 'requirements', icon: 'list' },
        { label: 'Past due', value: overview.pastDue, tone: overview.pastDue ? 'amber' : 'green', note: 'Projected, unfiled', to: 'calendar', icon: 'clock' },
        { label: 'Open deviations', value: overview.openDeviations, tone: overview.openDeviations ? 'amber' : 'green', to: 'deviations' },
        { label: 'Filings recorded', value: overview.filings, note: `${overview.filesHeld} evidence file${overview.filesHeld === 1 ? '' : 's'} held`, tone: overview.filings ? 'green' : undefined, icon: 'check' },
      ]} />

      {/* One row, always. The switcher carries each report's short name — the
          full title is the section heading directly below it and the first line
          of every export, so spelling it out here said the same thing twice and
          wrapped the strip onto a second line to do it. On a narrow window the
          strip scrolls rather than wrapping: a control that changes height as
          the window narrows moves everything under it. */}
      <div style={styles.tabs} className="wg-tabs">
        {reports.map((r) => {
          const on = r.key === current.key
          return (
            <button
              key={r.key}
              onClick={() => setTab(r.key)}
              title={r.title}
              style={{
                ...styles.tab,
                background: on ? '#15227a' : '#fff',
                color: on ? '#fff' : '#475569',
                borderColor: on ? '#15227a' : '#e4e9f0',
              }}
            >
              {r.tab || r.title}
              <span style={{
                ...styles.tabCount,
                background: on ? 'rgba(255,255,255,0.22)' : '#f1f5f9',
                color: on ? '#fff' : '#64748b',
              }}>
                {r.rows.length}
              </span>
            </button>
          )
        })}
      </div>

      <Section
        title={current.title}
        right={(
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {current.derived && <Derived>Computed from the rules</Derived>}
            <span style={{ fontSize: 11.5, color: '#94a3b8' }}>{scopeName}</span>
          </div>
        )}
      >
        <Note tone={current.derived ? 'warn' : 'info'}>{current.note}</Note>

        {current.stats?.length > 0 && (
          <div style={styles.figures}>
            {current.stats.map((s) => (
              <div key={s.label} style={styles.figure}>
                <div style={styles.figureLabel}>{s.label}</div>
                <div style={{ ...styles.figureValue, color: s.tone === 'warn' ? '#b45309' : s.tone === 'bad' ? '#b91c1c' : s.tone === 'ok' ? '#047857' : '#0f172a' }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        )}

        <DataTable
          rows={current.rows}
          pageSize={20}
          empty="Nothing in this scope."
          columns={current.columns.map((c, i) => ({
            key: `c${i}`,
            label: c.header,
            align: c.align,
            // The report's own accessor, so the cell on screen is character for
            // character the cell in the export.
            sortValue: (row) => c.value(row),
            render: (row) => <span style={{ fontSize: 12, color: '#334155' }}>{c.value(row)}</span>,
          }))}
        />
      </Section>
    </div>
  )
}

const styles = {
  tabs: {
    display: 'flex', gap: 7, flexWrap: 'nowrap', marginBottom: 14,
    overflowX: 'auto', overflowY: 'hidden',
    // Room for the scrollbar the strip only grows on a narrow window, so the
    // pills do not sit on top of it when it appears.
    paddingBottom: 4,
  },
  tab: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 13px',
    fontSize: 12, fontWeight: 700, fontFamily: 'inherit', borderRadius: 999,
    cursor: 'pointer', borderStyle: 'solid', borderWidth: 1,
    // A pill must never give up its own width to fit — that is what turned
    // "Deviations and corrective action" into two lines inside one pill.
    whiteSpace: 'nowrap', flexShrink: 0,
  },
  tabCount: { padding: '1px 7px', borderRadius: 999, fontSize: 10.5, fontWeight: 800 },
  figures: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
    gap: 10, margin: '12px 0 14px',
  },
  figure: {
    padding: '10px 13px', borderRadius: 10, background: '#f8fafc',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#eef2f7',
  },
  figureLabel: {
    fontSize: 10, fontWeight: 800, color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5,
  },
  figureValue: { fontSize: 19, fontWeight: 800, lineHeight: 1 },
}
