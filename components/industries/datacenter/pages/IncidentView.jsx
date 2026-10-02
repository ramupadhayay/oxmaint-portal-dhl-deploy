'use client'

// One pre-PoC incident, on its own page.
//
// Its own component rather than the generic record page because the thing worth
// knowing about these seven is not in any one of them. Read as a row, INC-2025-014
// says "0 (redundant)" and looks like a non-event. Read against the other six it
// is the argument the programme rests on: four of the seven cost no downtime at
// all, and the reason is redundancy absorbing the failure, not the failure being
// minor. A label/value list cannot make that point; a chart of all seven with
// this one picked out makes it in a glance.
//
// The rest is prose. Description and root cause are sentences the client wrote,
// and a sentence in a 160px-label table row reads like a database field rather
// than an account of what happened.

import { useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { ProductStyles, DetailColumns, DetailColumn, KV, EmptyState, Icons } from '../components/product'
import { Section, StatusBadge, ActionButton, PALETTE } from '../lib/kit'
import { INCIDENT_ROWS } from '../lib/inspections'
import { GAP_INCIDENT_DETAIL } from '../lib/gapfillJoin'
import { monAssetById } from '../lib/monitoring'
import { fmtDate, toneOf } from '../lib/data'

const { SUB, MUTE, INK, LINE, ACCENT } = PALETTE

const detailById = new Map(GAP_INCIDENT_DETAIL.map((d) => [d.incidentId, d]))

/**
 * Downtime as a number, from the client's own cell wherever it is one.
 *
 * The client's file writes downtime as prose — "0 (redundant)", "1.5",
 * "0.5 (N+1 covered)", "N/A (test)" — which is readable and unchartable. The
 * gap-fill sheet types the same seven events into a numeric column, so a number
 * is available; but the client's string is the contractual record and where it
 * carries a figure that figure wins. The sheet only fills in what the string
 * leaves as words.
 *
 * "N/A (test)" is the one that must not be flattened. The gap-fill sheet writes
 * it as 0, and 0 is very nearly right — but it was a scheduled load-bank test,
 * so there was no service to lose. Charting it as a zero alongside four genuine
 * zeroes claims a save that never happened, so it is carried as null and drawn
 * as not applicable.
 */
function downtimeOf(row) {
  const written = String(row.downtime || '').trim()
  const detail = detailById.get(row.incidentId) || null

  if (/^n\/?a/i.test(written)) return { hours: null, note: detail?.downtimeNote || null, applicable: false }

  const fromClient = Number.parseFloat(written)
  const hours = Number.isFinite(fromClient) ? fromClient : (detail?.downtimeHours ?? null)

  return {
    hours,
    // The parenthetical in the client's cell and the gap-fill sheet's note say
    // the same thing; the sheet says it in a full clause, so it is preferred.
    note: detail?.downtimeNote || (written.match(/\(([^)]+)\)/)?.[1] ?? null),
    applicable: true,
  }
}

// How each of the seven was found, in three buckets. The strings are the
// client's own vocabulary and there are only three routes in them: something
// alarmed after the fact, somebody was on a scheduled round, or a person
// noticed. Worth bucketing because the count across the seven is the point —
// see the note under the detection block.
function routeOf(method) {
  const s = String(method || '')
  if (/operator/i.test(s)) return { key: 'operator', label: 'Reported by an operator', tone: 'amber' }
  if (/\bPM\b|inspection|scheduled/i.test(s)) return { key: 'round', label: 'Found on a scheduled round', tone: 'amber' }
  if (/alarm/i.test(s)) return { key: 'alarm', label: 'Announced by an alarm', tone: 'blue' }
  return { key: 'other', label: 'Recorded by the site', tone: 'grey' }
}

// Built once. Every incident page draws all seven, so computing this per render
// would redo the same join seven times for a set that never changes.
const INCIDENTS = INCIDENT_ROWS.map((row) => ({
  ...row,
  ...downtimeOf(row),
  _route: routeOf(row.detectionMethod),
}))

const TOTAL_HOURS = Math.round(INCIDENTS.reduce((n, i) => n + (i.hours || 0), 0) * 10) / 10
const CLEAN = INCIDENTS.filter((i) => i.applicable && i.hours === 0).length
const NOT_APPLICABLE = INCIDENTS.filter((i) => !i.applicable).length
const BY_ROUTE = INCIDENTS.reduce((m, i) => ({ ...m, [i._route.key]: (m[i._route.key] || 0) + 1 }), {})

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// "Vibration and Thermal and Ultrasound" is what a plain join(' and ') produces
// on the three-sensor assets, and it reads like a machine wrote it.
const listJoin = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)

export default function IncidentView() {
  const { id } = useParams()
  const router = useRouter()
  const incidentId = decodeURIComponent(String(id))

  const incident = useMemo(() => INCIDENTS.find((i) => i.incidentId === incidentId) || null, [incidentId])
  const back = () => router.push('/portal/datacenter/incidents')

  if (!incident) {
    return (
      <div>
        <PageHeading back={{ label: 'Incident Reports', onClick: back }} title="Incident" />
        <EmptyState
          icon={Icons.warning}
          title="Nothing here with that reference."
          body={`${incidentId} is not in the incident register.`}
        />
        <div style={{ marginTop: 14 }}><ActionButton onClick={back}>Back to the register</ActionButton></div>
      </div>
    )
  }

  const mon = monAssetById.get(incident.assetId) || null
  // BMS and EPMS are in the monitoring column too, and they are not sensors this
  // programme fitted — they are the systems that raised the incident in the
  // first place. Counting them as "now instrumented" would credit the PoC with
  // what the site already had.
  const sensors = mon?._monitoring?.filter((s) => !/^(bms|epms|dcim)$/i.test(s)) || []
  const firstReading = mon?._readings?.[0]?.date || null
  // "Raised since" has to actually be since. An alert that predates the incident
  // is a different story and must not be told as this one.
  const last = mon?._lastAlert || null
  const sinceAlert = last && String(last.dateRaised || '') > String(incident.date) ? last : null

  const share = TOTAL_HOURS > 0 && incident.hours ? Math.round((incident.hours / TOTAL_HOURS) * 100) : 0

  return (
    <div>
      <ProductStyles />

      <PageHeading
        back={{ label: 'Incident Reports', onClick: back }}
        title={`${incident.incidentId} — ${incident._asset}`}
        subtitle={`${fmtDate(incident.date)} · ${incident._site} · ${incident.detectionMethod}`}
        right={(
          <>
            <ActionButton onClick={() => router.push(`/portal/datacenter/assets/${encodeURIComponent(incident.assetId)}`)}>
              Open the asset record
            </ActionButton>
            <ActionButton variant="ghost" onClick={() => window.print()}>Print</ActionButton>
          </>
        )}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <StatusBadge tone={incident.hours ? 'amber' : 'green'}>
            {incident.applicable ? `${incident.hours} h downtime` : 'Downtime not applicable'}
          </StatusBadge>
          <StatusBadge tone={incident._customerImpact ? 'red' : 'green'}>
            {incident._customerImpact ? 'Customer-facing' : 'No customer impact'}
          </StatusBadge>
          {incident._criticality && <StatusBadge tone={toneOf(incident._criticality)}>{incident._criticality} asset</StatusBadge>}
          <StatusBadge tone={incident._route.tone}>{incident._route.label}</StatusBadge>
        </div>
      </PageHeading>

      <StatCards items={[
        {
          label: 'Downtime',
          value: incident.applicable ? incident.hours : 'n/a',
          unit: incident.applicable ? (incident.hours === 1 ? 'hour' : 'hours') : undefined,
          tone: incident.hours ? 'amber' : 'green',
          note: incident.note,
          icon: 'clock',
        },
        {
          label: 'Customer impact',
          value: incident._customerImpact ? 'Yes' : 'None',
          tone: incident._customerImpact ? 'red' : 'green',
          note: incident._customerImpact ? 'Service was affected' : 'No service loss recorded',
          icon: 'people',
        },
        {
          label: 'Share of estate downtime',
          value: `${share}%`,
          note: `of ${TOTAL_HOURS} h across ${INCIDENTS.length} incidents`,
          icon: 'chart',
        },
        {
          label: 'Condition monitoring now',
          value: sensors.length ? plural(sensors.length, 'sensor') : 'None',
          tone: sensors.length ? 'green' : undefined,
          note: sensors.length ? sensors.join(', ') : 'Not in the PoC monitoring scope',
          icon: 'wave',
        },
      ]} />

      <Section
        title={`Downtime across all ${INCIDENTS.length} pre-PoC incidents`}
        right={<span style={styles.scale}>{TOTAL_HOURS} h in total</span>}
      >
        <DowntimeBars
          rows={INCIDENTS}
          currentId={incident.incidentId}
          onOpen={(row) => router.push(`/portal/datacenter/incidents/${encodeURIComponent(row.incidentId)}`)}
        />
        <p style={styles.caption}>
          {CLEAN} of the {INCIDENTS.length} cost no downtime at all
          {NOT_APPLICABLE ? ` and ${NOT_APPLICABLE === 1 ? 'a further one was' : `a further ${NOT_APPLICABLE} were`} a scheduled test rather than a live event` : ''}.
          That is not the same as a quiet estate — every one of these was a real failure, and the reason the
          hours are zero is that the redundancy took the load. The whole set comes to {TOTAL_HOURS} hours,
          none of it customer-facing.
        </p>
      </Section>

      <div style={styles.two}>
        <Section title="What failed" style={{ marginBottom: 0 }}>
          <Prose>{incident.description}</Prose>
          {incident.note && (
            <p style={styles.aside}>
              Recorded downtime: {incident.applicable ? `${incident.hours} h` : 'not applicable'} — {lower(incident.note)}.
            </p>
          )}
        </Section>

        <Section title="Root cause" style={{ marginBottom: 0 }}>
          <Prose accent>{incident.rootCause}</Prose>
          <p style={styles.aside}>
            The cause as the client recorded it after the event. Nothing on this page claims it was predicted —
            these {INCIDENTS.length} are the baseline the monitoring is measured against, not results from it.
          </p>
        </Section>
      </div>

      <Section title="How it was found">
        <div style={styles.foundMethod}>{incident.detectionMethod}</div>
        <div style={{ marginTop: 8 }}><StatusBadge tone={incident._route.tone}>{incident._route.label}</StatusBadge></div>
        <p style={styles.caption}>
          Across all {INCIDENTS.length}, {BY_ROUTE.alarm || 0} were announced by an alarm once the fault had already
          happened, {BY_ROUTE.round || 0} were found on a scheduled round and {BY_ROUTE.operator || 0} by an
          operator. None was found before the fact. The absence of historical condition data is itself a
          risk, and this column is what that risk looks like on the ground.
        </p>
      </Section>

      <Section title="The asset">
        <DetailColumns>
          <DetailColumn icon={Icons.box} title="Register">
            <KV label="Reference" value={incident.assetId} />
            <KV label="Name" value={incident._asset} />
            <KV label="Class" value={incident._assetClass || '—'} />
            <KV label="Criticality" value={incident._criticality || '—'} tone={incident._criticality === 'Critical' ? '#dc2626' : undefined} />
          </DetailColumn>

          <DetailColumn icon={Icons.pin} title="Where">
            <KV label="Site" value={incident._site} />
            <KV label="Site code" value={incident.siteId} />
            <KV label="Incident date" value={fmtDate(incident.date)} />
          </DetailColumn>

          <DetailColumn icon={Icons.activity} title="Monitoring">
            <KV label="Instrumented" value={sensors.length ? 'Yes' : 'No'} />
            <KV label="Sensors" value={sensors.length ? sensors.join(', ') : '—'} />
            <KV label="First reading" value={firstReading ? fmtDate(firstReading) : '—'} />
          </DetailColumn>
        </DetailColumns>

        <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => router.push(`/portal/datacenter/assets/${encodeURIComponent(incident.assetId)}`)} style={styles.link}>
            Open the asset record →
          </button>
          {mon && (
            <button onClick={() => router.push(`/portal/datacenter/monitoring/${encodeURIComponent(incident.assetId)}`)} style={styles.link}>
              Open the monitoring view →
            </button>
          )}
        </div>
      </Section>

      {/* The strongest line on the page, and the one easiest to overstate. What
          is true: this failure predates the sensors, and the asset carries them
          now. What is not claimed: that they would have caught this particular
          root cause. A later detection on the same asset is shown as a fact
          with its own reference rather than as a save. */}
      {mon ? (
        <div style={styles.mon}>
          <div style={styles.monLabel}>This failure predates the monitoring</div>
          <div style={styles.monBody}>
            {incident.assetId} now carries {sensors.length ? listJoin(sensors) : 'condition monitoring'}
            {firstReading ? `, with readings from ${fmtDate(firstReading)}` : ''} — after this incident on {fmtDate(incident.date)}.
            The asset that failed here is instrumented today.
          </div>
          {sinceAlert && (
            <div style={styles.since}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
                <StatusBadge tone={toneOf(sinceAlert.severity)}>{sinceAlert.severity}</StatusBadge>
                <span style={styles.mono}>{sinceAlert.alertId}</span>
                <span style={{ fontSize: 11.5, color: MUTE }}>raised since, on this asset</span>
              </div>
              <div style={{ fontSize: 12.5, color: INK, lineHeight: 1.55 }}>{sinceAlert.description}</div>
            </div>
          )}
        </div>
      ) : (
        <div style={styles.noMon}>
          <div style={styles.noMonLabel}>Still uninstrumented</div>
          <div style={styles.monBody}>
            {incident.assetId} is not one of the assets carrying condition monitoring in this PoC. A repeat of this
            failure would be found the same way it was found last time — {lower(incident.detectionMethod)}, after the fact.
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Seven bars, one per incident, this one picked out.
 *
 * Written here rather than reaching for the kit's HBars because the whole point
 * of this chart is what HBars cannot draw: a zero. HBars gives a zero-value row
 * an empty grey track, which reads as missing data — exactly the wrong reading
 * when the zero is the finding. So a clean incident gets a filled green track
 * and the word "None", and the two that cost hours get a bar. A reader scanning
 * the column sees five green and two blue without reading a number.
 */
function DowntimeBars({ rows, currentId, onOpen }) {
  const max = Math.max(...rows.map((r) => r.hours || 0)) || 1

  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {rows.map((r) => {
        const current = r.incidentId === currentId
        const clean = r.applicable && !r.hours
        const track = clean
          ? { background: '#ecfdf5', borderColor: '#a7f3d0' }
          : r.applicable
            ? { background: '#f1f5f9', borderColor: '#e2e8f0' }
            : { background: '#f8fafc', borderColor: '#e2e8f0' }

        return (
          <button
            key={r.incidentId}
            onClick={() => !current && onOpen(r)}
            style={{
              ...styles.row,
              background: current ? '#f5f7ff' : 'transparent',
              borderColor: current ? '#c7d2fe' : 'transparent',
              cursor: current ? 'default' : 'pointer',
            }}
          >
            <div style={styles.rowLabel}>
              <span style={{ ...styles.rowId, color: current ? ACCENT : SUB, fontWeight: current ? 800 : 600 }}>
                {r.incidentId}
              </span>
              <span style={styles.rowAsset}>{r._asset}</span>
            </div>

            <div style={{ ...styles.track, ...track }}>
              {/* Drawn only when there is something to draw. A one-pixel stub
                  standing in for zero is a bar, and a reader reads bars. */}
              {!!r.hours && (
                <div style={{
                  width: `${Math.max(6, (r.hours / max) * 100)}%`,
                  height: '100%',
                  borderRadius: 999,
                  background: current ? ACCENT : '#a5b4fc',
                }} />
              )}
            </div>

            <div style={{
              ...styles.rowValue,
              color: r.hours ? (current ? ACCENT : INK) : (r.applicable ? '#047857' : MUTE),
            }}>
              {r.applicable ? (r.hours ? `${r.hours} h` : 'None') : 'n/a'}
            </div>
          </button>
        )
      })}
    </div>
  )
}

function Prose({ children, accent }) {
  return (
    <p style={{
      margin: 0, fontSize: 14.5, lineHeight: 1.7, color: '#1e293b',
      borderLeftStyle: 'solid', borderLeftWidth: 3, borderLeftColor: accent ? ACCENT : '#dbe2ee',
      paddingLeft: 14,
    }}>{children}</p>
  )
}

// The client's notes are written as fragments starting with a capital —
// "Redundant leg only; …" — and they are dropped mid-sentence here.
//
// Only an ordinary capitalised word is lowered. "N+1 covered" and "BMS Alarm"
// start the way they do because that is how the thing is spelt, and a rule that
// cannot tell those apart produces "n+1" and "bMS", which is worse than leaving
// every note capitalised.
const lower = (s) => {
  const t = String(s || '').trim().replace(/\.$/, '')
  return /^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t
}

const styles = {
  two: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14, marginBottom: 14, alignItems: 'start' },
  scale: { fontSize: 11.5, fontWeight: 600, color: MUTE },
  caption: { margin: '14px 0 0', fontSize: 12.5, color: SUB, lineHeight: 1.65, maxWidth: 760 },
  aside: { margin: '12px 0 0', fontSize: 11.5, color: MUTE, lineHeight: 1.6 },

  row: {
    display: 'grid', gridTemplateColumns: 'minmax(0,215px) 1fr 62px',
    alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
    padding: '7px 9px', borderRadius: 9, fontFamily: 'inherit',
    borderStyle: 'solid', borderWidth: 1,
  },
  rowLabel: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 },
  rowId: { fontSize: 11.5, fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', letterSpacing: '-0.01em' },
  rowAsset: { fontSize: 11, color: MUTE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  track: { height: 12, borderRadius: 999, borderStyle: 'solid', borderWidth: 1, overflow: 'hidden' },
  rowValue: { fontSize: 12, fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' },

  foundMethod: { fontSize: 17, fontWeight: 700, color: INK, letterSpacing: '-0.01em', lineHeight: 1.3 },

  mon: {
    borderStyle: 'solid', borderWidth: 1, borderColor: '#a7f3d0', background: '#ecfdf5',
    borderRadius: 12, padding: '14px 16px',
  },
  monLabel: { fontSize: 10.5, fontWeight: 800, color: '#047857', textTransform: 'uppercase', letterSpacing: 0.5 },
  monBody: { fontSize: 13.5, color: INK, marginTop: 6, lineHeight: 1.6, maxWidth: 780 },
  since: {
    marginTop: 11, background: '#fff', borderRadius: 10, padding: '10px 12px',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#a7f3d0',
  },
  noMon: {
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, background: '#f8fafc',
    borderRadius: 12, padding: '14px 16px',
  },
  noMonLabel: { fontSize: 10.5, fontWeight: 800, color: SUB, textTransform: 'uppercase', letterSpacing: 0.5 },
  mono: { fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 11.5, color: SUB },
  link: {
    padding: '6px 12px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
    background: '#fff', color: ACCENT, borderRadius: 8, cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#15227a33',
  },
}
