'use client'

// Where the data came from, and what it does and does not claim.
//
// Worth a screen because this dataset is explicitly a demo. The covering
// document says so twice — "fictional but realistic", and "engineering should
// treat every ID, date, and quantity below as sample data, not production data"
// — and a portal that shows those numbers without ever saying that invites
// someone to quote one back as a fact about the plant.
//
// It is also where the two honest caveats live: nothing in the parts catalogue
// is below its reorder point, and the dates are shifted forward. Both are
// deliberate, both are visible, and neither should be discovered by a reader
// mid-demo.

import { Section, DataTable, StatusBadge } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Ref, Note, Fact } from '../components/cells'
import {
  ORG, README, ANCHOR, OFFSET_DAYS, SOURCE_TODAY, LOCATIONS, ASSETS, PARTS,
  WORK_ORDERS, PM_SCHEDULES, USERS, DOWNTIME, partsBelowReorder, partsApproaching,
  uncoveredAssets, estimateStats, fmtDate,
} from '../lib/data'

const SHEETS = [
  ['Locations', LOCATIONS.length, 'Site, departments and areas', 'locations'],
  ['Assets', ASSETS.length, 'Machine register across the whole line', 'assets'],
  ['Parts_Inventory', PARTS.length, 'Spares and consumables with reorder points', 'parts'],
  ['Work_Orders', WORK_ORDERS.length, 'Jobs, with AI estimate against actual', 'work-orders'],
  ['PM_Schedules', PM_SCHEDULES.length, 'Recurring preventive maintenance', 'pm-schedules'],
  ['Users_Teams', USERS.length, 'Roster with team, shift and skills', 'people'],
  ['Downtime_Log', DOWNTIME.length, 'Stoppages by cause and category', 'downtime'],
]

// What the covering document's summary table claimed, against what the workbook
// actually holds. Not a criticism of the sheet — it is why this portal counts
// its own figures instead of repeating a stated one.
const RESTATED = [
  ['Assets', '21 sample assets', ASSETS.length],
  ['PM schedules', '10 recurring preventive tasks', PM_SCHEDULES.length],
  ['Parts', '15 parts with reorder points', PARTS.length],
  ['Locations', 'plant + 10 departments/areas', LOCATIONS.length],
]

export default function Sources() {
  return (
    <div>
      <PageHeading
        title="Data & Notes"
        subtitle={`Every figure in this portal comes from one workbook — ${ORG.name} CMMS Demo Master Data. This page says what that workbook is, and what it does not claim.`}
      />

      <StatCards items={[
        { label: 'Source sheets', value: SHEETS.length, note: 'One workbook', icon: 'list' },
        { label: 'Records imported', value: SHEETS.reduce((s, [, n]) => s + n, 0), note: 'Across all tabs' },
        { label: 'Broken references', value: 0, tone: 'success', note: 'Checked at import', icon: 'tick' },
        { label: 'Date shift', value: ANCHOR ? `${OFFSET_DAYS >= 0 ? '+' : ''}${OFFSET_DAYS}` : 'off', unit: ANCHOR ? 'days' : '', tone: 'warning', note: ANCHOR ? `from ${fmtDate(SOURCE_TODAY)}` : 'Sheet dates shown as written' },
        { label: 'Data class', value: 'Sample', tone: 'warning', note: 'Fictional, not production' },
      ]} />

      <Note tone="warn">
        <b>This is demonstration data.</b> The covering document is explicit: the dataset is
        fictional but modelled on the real DNA Technical Fabrics process, and engineering should
        treat every ID, date and quantity as sample data. Nothing here is a measurement of the
        Columbus plant.
      </Note>

      <Section title="What the workbook contains">
        <DataTable
          rows={SHEETS.map(([sheet, count, purpose, to]) => ({ sheet, count, purpose, to }))}
          pageSize={10}
          empty=""
          columns={[
            { key: 'sheet', label: 'Sheet', width: 190, render: (r) => <Ref>{r.sheet}</Ref> },
            { key: 'count', label: 'Rows', width: 80, align: 'right', render: (r) => <span style={{ fontWeight: 700 }}>{r.count}</span> },
            { key: 'purpose', label: 'What it carries' },
          ]}
        />
      </Section>

      <Section title="Two things this portal does deliberately">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 12 }}>
          <div style={card}>
            <div style={cardTitle}>Dates are moved forward</div>
            <p style={cardBody}>
              The workbook describes a week around {fmtDate(SOURCE_TODAY)} — five jobs overdue, a
              loom down, four schedules due. Pinned to those dates, the same portal opened in two
              months shows everything overdue, which says something about the customer rather than
              the product. So dates are shifted{' '}
              {ANCHOR ? <b>{OFFSET_DAYS >= 0 ? `${OFFSET_DAYS} days forward` : `${Math.abs(OFFSET_DAYS)} days back`}</b> : <b>not at all</b>}{' '}
              at read time. The stored values are never touched, so the generated modules stay
              comparable to the sheet line for line.
            </p>
            <p style={cardBody}>
              This is only safe because the data is fictional. The WAGA compliance portal does the
              opposite for the opposite reason — its dates are real regulatory deadlines, and
              shifting one would be a defect.
            </p>
          </div>

          <div style={card}>
            <div style={cardTitle}>No stock shortage is invented</div>
            <p style={cardBody}>
              The parts sheet says it carries reorder thresholds to demonstrate stock alerts, but{' '}
              <b>no line in it is at or below its reorder point</b> — so there is no alert to raise.
              Rather than add a shortage that was never supplied, the inventory screen reports what
              is there: {partsBelowReorder.length} below reorder, {partsApproaching.length} sitting
              one unit above it ({partsApproaching.map((p) => p.partNo).join(', ')}).
            </p>
            <p style={cardBody}>
              If a shortage is added to the workbook and re-imported, the alert band fills on its
              own — nothing on that screen needs changing for it to work.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Counts are computed, not restated">
        <p style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.6, marginBottom: 13 }}>
          The covering document&apos;s summary table describes the workbook in round numbers that
          have since moved. Every figure in this portal is counted from the data at render time, so
          it cannot drift the same way.
        </p>
        <DataTable
          rows={RESTATED.map(([what, stated, actual]) => ({ what, stated, actual }))}
          pageSize={10}
          empty=""
          columns={[
            { key: 'what', label: 'Table', width: 170 },
            { key: 'stated', label: 'Document says', width: 280, render: (r) => <span style={{ color: '#94a3b8' }}>{r.stated}</span> },
            {
              key: 'actual', label: 'Workbook holds', width: 150,
              render: (r) => <span style={{ fontWeight: 700, color: '#0f172a' }}>{r.actual}</span>,
            },
            {
              key: 'match', label: '', width: 110, sortable: false,
              render: (r) => <StatusBadge tone={String(r.stated).includes(String(r.actual)) ? 'green' : 'amber'}>
                {String(r.stated).includes(String(r.actual)) ? 'Matches' : 'Differs'}
              </StatusBadge>,
            },
          ]}
        />
      </Section>

      <Section title="Gaps worth raising in the demo">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 10 }}>
          <Fact
            label="Assets with no cover"
            value={uncoveredAssets.length}
            sub="Neither a PM schedule nor a work order. A standby boiler and the QC instruments may be deliberate."
          />
          <Fact
            label="AI comparison set"
            value={estimateStats ? `${estimateStats.sample} of ${estimateStats.ofTotal}` : '—'}
            sub="Only completed jobs carry an actual duration, so that is the whole sample."
          />
          <Fact
            label="Not supplied as data"
            value="3 items"
            sub="Mobile app, real-time messaging and training — product and services, shown live rather than preloaded."
          />
        </div>
      </Section>

      <Section title="The brief, in its own words" right={<span style={{ fontSize: 11.5, color: '#94a3b8' }}>Read Me tab, verbatim</span>}>
        <div style={{ display: 'grid', gap: 6 }}>
          {README.map((line, i) => (
            <p key={i} style={{ margin: 0, fontSize: 12.5, color: /^-/.test(line) ? '#475569' : '#0f172a', lineHeight: 1.6, paddingLeft: /^-/.test(line) ? 14 : 0, fontWeight: /^-/.test(line) ? 400 : 600 }}>
              {line}
            </p>
          ))}
        </div>
      </Section>
    </div>
  )
}

const card = { padding: '15px 17px', border: '1px solid #e4e9f0', borderLeft: '3px solid #15227a', borderRadius: 11, background: '#fff' }
const cardTitle = { fontSize: 13.5, fontWeight: 700, color: '#0f172a', marginBottom: 8 }
const cardBody = { margin: '0 0 9px', fontSize: 12.5, color: '#475569', lineHeight: 1.6 }
