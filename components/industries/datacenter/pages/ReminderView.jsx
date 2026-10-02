'use client'

// One inspection reminder, on its own page.
//
// Its own component rather than the generic record page because a reminder is
// not a row of fields — it is a decision somebody is about to make, and the
// facts that decide it live in five different sheets. Whether the last round
// passed, whether sensors are already watching the machine, whether the site's
// redundancy lets it come offline for the window, who hears about it if it
// slips, and what has already failed on it. A label/value list can print all of
// those; what it cannot do is put the ones that conflict next to each other.
//
// The conflict is the reason this screen exists. A calendar inspection falling
// due on an asset whose health score is already declining is the single most
// interesting thing this portal can show — it is SOW 2.2's whole argument, the
// preventive baseline and the condition-based pilot disagreeing in public — and
// on a flat fact list the due date and the health score are forty pixels apart
// and nobody joins them.
//
// The monitoring join is done here rather than in lib/inspections, on purpose:
// it pulls the client's monitoring workbook and the gap-fill sheet in behind it,
// and the three list screens that read the reminders have no use for either.

import { useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { ProductStyles, DetailColumns, DetailColumn, KV, EmptyState, Icons } from '../components/product'
import { Section, StatusBadge, ActionButton, PALETTE } from '../lib/kit'
import { INSPECTION_REMINDERS } from '../lib/inspections'
import { monAssetById } from '../lib/monitoring'
import { fmtDate, toneOf } from '../lib/data'

const { SUB, MUTE, INK, LINE, ACCENT } = PALETTE

const dueTone = (s) => ({
  Overdue: 'red', 'Due this week': 'amber', 'Due this month': 'blue', Scheduled: 'grey',
}[s] || 'grey')

const resultTone = (r) => ({
  Passed: 'green', 'Passed with observations': 'amber', Failed: 'red',
}[r] || 'grey')

// The banner's four states, as ink and paper rather than as a badge tone. The
// header has to be readable as a state from across a room — that is what a
// reminder screen is for — and a tone name does not carry a background.
const DUE_SKIN = {
  Overdue: { bg: '#fef2f2', line: '#fecaca', ink: '#b91c1c' },
  'Due this week': { bg: '#fffbeb', line: '#fde68a', ink: '#b45309' },
  'Due this month': { bg: '#eff6ff', line: '#bfdbfe', ink: '#1d4ed8' },
  Scheduled: { bg: '#f8fafc', line: LINE, ink: SUB },
}

const scoreColour = (n) => (n >= 85 ? '#059669' : n >= 60 ? '#d97706' : '#dc2626')

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

export default function ReminderView() {
  const { id } = useParams()
  const router = useRouter()
  const reminderId = decodeURIComponent(String(id))

  const r = useMemo(
    () => INSPECTION_REMINDERS.find((x) => x.reminderId === reminderId) || null,
    [reminderId])

  const back = () => router.push('/portal/datacenter/inspection-reminder')

  if (!r) {
    return (
      <div>
        <PageHeading back={{ label: 'Inspection Reminder', onClick: back }} title="Reminder" />
        <EmptyState
          icon={Icons.bell}
          title="Nothing here with that reference."
          body={`${reminderId} is not in the reminder register.`}
        />
        <div style={{ marginTop: 14 }}><ActionButton onClick={back}>Back to the register</ActionButton></div>
      </div>
    )
  }

  const skin = DUE_SKIN[r.status] || DUE_SKIN.Scheduled
  const last = r._last
  const esc = r._escalation
  const red = r._redundancy

  const mon = monAssetById.get(r.assetId) || null
  // BMS, EPMS and DCIM appear in the monitoring column and are not sensors this
  // programme fitted — they are the platforms the site already ran. Counting
  // them as condition monitoring would credit the PoC with what was there
  // before it.
  const sensors = mon?._monitoring?.filter((s) => !/^(bms|epms|dcim)$/i.test(s)) || []
  const monAlert = mon?._openAlert || mon?._lastAlert || null

  // The line this whole screen is built around: a calendar round falling due on
  // a machine the sensors have already marked down. Only said when both halves
  // are true, because said loosely it is the kind of claim that costs a demo
  // its credibility.
  const contested = mon && mon._score != null && (mon._band !== 'green' || mon._openAlert)

  const covered = r._failureModes.filter((f) => f.sensorCovered)
  const uncovered = r._failureModes.filter((f) => !f.sensorCovered)

  return (
    <div>
      <ProductStyles />

      <PageHeading
        back={{ label: 'Inspection Reminder', onClick: back }}
        title={`${r.reminderId} — ${r._asset}`}
        subtitle={`${r.task} · ${r.frequency} against ${r.standard} · ${r._site}`}
        right={(
          <>
            <ActionButton variant="ghost" onClick={() => router.push(`/portal/datacenter/assets/${encodeURIComponent(r.assetId)}`)}>
              Open the asset record
            </ActionButton>
            <ActionButton variant="ghost" onClick={() => window.print()}>Print</ActionButton>
          </>
        )}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <StatusBadge tone={dueTone(r.status)}>{r.status}</StatusBadge>
          <StatusBadge tone={toneOf(r.criticality)}>{r.criticality} asset</StatusBadge>
          {r._criticalClass && <StatusBadge tone="red">Class graded Critical</StatusBadge>}
          <StatusBadge tone="blue">{r.frequency}</StatusBadge>
          {sensors.length > 0 && <StatusBadge tone="violet">Condition monitored</StatusBadge>}
        </div>
      </PageHeading>

      {/* The date block, at the size the question deserves. This is the one
          fact somebody opens a reminder to read, and in the old two-column
          list it was the ninth row down. */}
      <div style={{ ...styles.banner, background: skin.bg, borderColor: skin.line }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...styles.bannerLabel, color: skin.ink }}>
            {r._overdue ? 'Overdue since' : 'Due'}
          </div>
          <div style={{ ...styles.bannerDate, color: r._overdue ? skin.ink : INK }}>{fmtDate(r.dueDate)}</div>
          <div style={{ ...styles.bannerAway, color: skin.ink }}>
            {r._overdue
              ? `${plural(Math.abs(r._daysAway), 'day')} past its date`
              : `in ${plural(r._daysAway, 'day')}`}
            {' · '}next occurrence {fmtDate(r._nextAfter)}
          </div>
        </div>

        <div style={styles.bannerSide}>
          <div style={styles.bannerSideLabel}>Assigned to</div>
          <div style={styles.bannerSideValue}>{r.assignedTo}</div>
          <div style={styles.bannerSideNote}>
            {r._overdue
              ? `Already with ${esc.role} — ${esc.raci?.toLowerCase() || 'named on the RACI'} at ${esc.tier}.`
              : `Escalates to ${esc.role} if it slips.`}
          </div>
        </div>
      </div>

      <StatCards items={[
        {
          label: r._overdue ? 'Days late' : 'Days until due',
          value: Math.abs(r._daysAway),
          unit: Math.abs(r._daysAway) === 1 ? 'day' : 'days',
          tone: r._overdue ? 'red' : r._daysAway <= 7 ? 'amber' : undefined,
          note: fmtDate(r.dueDate),
          icon: 'clock',
        },
        {
          label: 'Interval',
          value: r._intervalDays,
          unit: 'days',
          note: `${r.frequency}, from the PM library`,
          icon: 'list',
        },
        last && {
          label: 'Last result',
          value: `${last.score}`,
          unit: '/ 100',
          tone: last._failed ? 'red' : last.result === 'Passed' ? 'green' : 'amber',
          note: `${last.result} · ${fmtDate(last.date)}`,
          icon: 'tick',
        },
        r._adherence && {
          label: 'Clean passes on this asset',
          value: `${r._adherence.passed} of ${r._adherence.total}`,
          tone: r._adherence.failed ? 'red' : r._adherence.observations ? 'amber' : 'green',
          note: `average score ${r._adherence.averageScore}`,
          icon: 'chart',
        },
        mon && mon._score != null && {
          label: 'Health score now',
          value: mon._score,
          tone: mon._band === 'green' ? 'green' : mon._band === 'amber' ? 'amber' : 'red',
          note: `${mon._trend}${mon._delta != null ? ` · ${mon._delta > 0 ? '+' : ''}${mon._delta} over 7 days` : ''}`,
          icon: 'wave',
        },
      ].filter(Boolean)} />

      {/* Placed above the record rather than below it. The reader's next
          question after "when" is "how did it go last time", and everything
          else on this page is context for those two. */}
      <Section
        title="Last time this task was done"
        right={last && <span style={styles.mono}>{last.reportId}</span>}
      >
        {last ? (
          <>
            <div style={styles.lastRow}>
              <div style={{ ...styles.lastScore, color: scoreColour(last.score) }}>
                {last.score}
                <span style={styles.lastScoreUnit}>/100</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <StatusBadge tone={resultTone(last.result)}>{last.result}</StatusBadge>
                  <span style={{ fontSize: 12.5, color: SUB }}>
                    {fmtDate(last.date)} — {plural(last._daysAgo, 'day')} ago
                  </span>
                </div>
                <div style={{ fontSize: 13, color: INK, marginTop: 7, lineHeight: 1.6 }}>
                  {last.findings || 'No findings recorded — the round passed clean.'}
                </div>
                <div style={{ fontSize: 11.5, color: MUTE, marginTop: 6 }}>
                  {last.inspector} · {last.team}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 13 }}>
              <button
                onClick={() => router.push(`/portal/datacenter/inspection-reports/${encodeURIComponent(last.reportId)}`)}
                style={styles.link}
              >
                Open {last.reportId} →
              </button>
            </div>
            <p style={styles.caption}>
              The last completed report against {r.taskId} on this same asset. The gap between that date and
              this one is {plural(last._daysAgo + r._daysAway, 'day')}, against a {r.frequency.toLowerCase()} interval
              of {r._intervalDays}.
            </p>
          </>
        ) : (
          <div style={{ fontSize: 12.5, color: MUTE, lineHeight: 1.6 }}>
            No completed report against {r.taskId} on this asset. This would be the first recorded round.
          </div>
        )}
      </Section>

      {/* The screen's argument, stated only where both halves hold. */}
      {contested ? (
        <div style={styles.contest}>
          <div style={styles.contestLabel}>A calendar round on a machine the sensors are already watching</div>
          <div style={styles.contestBody}>
            {r.assetId} carries {sensors.length ? sensors.join(', ').toLowerCase() : 'condition monitoring'} and
            is scoring <strong>{mon._score}</strong> — {mon._trend === 'declining' ? 'and falling' : mon._trend}
            {mon._delta != null && mon._delta !== 0 ? ` (${mon._delta > 0 ? '+' : ''}${mon._delta} over the last seven days)` : ''}.
            This inspection is {r._overdue ? `${plural(Math.abs(r._daysAway), 'day')} past its date` : `due in ${plural(r._daysAway, 'day')}`} on
            a {r.frequency.toLowerCase()} calendar that knows none of that. The preventive baseline is kept
            running alongside the pilot precisely so the two can be compared — this record is one of the
            comparisons.
          </div>
          {monAlert && (
            <div style={styles.contestAlert}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
                <StatusBadge tone={toneOf(monAlert.severity)}>{monAlert.severity}</StatusBadge>
                <span style={styles.mono}>{monAlert.alertId}</span>
                <span style={{ fontSize: 11.5, color: MUTE }}>
                  {monAlert._open ? 'open' : 'closed'} · raised {fmtDate(monAlert.dateRaised)}
                  {monAlert.failureCode ? ` · ${monAlert.failureCode}` : ''}
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: INK, lineHeight: 1.55 }}>
                {monAlert.description || monAlert._failureMode || 'Raised by cross-sensor correlation.'}
              </div>
            </div>
          )}
          <div style={{ marginTop: 11 }}>
            <button
              onClick={() => router.push(`/portal/datacenter/monitoring/${encodeURIComponent(r.assetId)}`)}
              style={styles.link}
            >
              Open the monitoring view →
            </button>
          </div>
        </div>
      ) : (
        <div style={styles.plain}>
          <div style={styles.plainLabel}>
            {sensors.length ? 'Condition monitoring is quiet on this asset' : 'The calendar is the only thing watching this asset'}
          </div>
          <div style={styles.contestBody}>
            {sensors.length
              ? `${r.assetId} carries ${sensors.join(', ').toLowerCase()}${mon?._score != null ? ` and is scoring ${mon._score}` : ''} with nothing open against it. This round is the routine one it is meant to be.`
              : `${r.assetId} is not one of the assets instrumented in this PoC, so nothing is reporting on its condition between visits. A fault developing on it is found when somebody arrives on ${fmtDate(r.dueDate)}, and not before.`}
          </div>
          {mon && (
            <div style={{ marginTop: 11 }}>
              <button
                onClick={() => router.push(`/portal/datacenter/monitoring/${encodeURIComponent(r.assetId)}`)}
                style={styles.link}
              >
                Open the monitoring view →
              </button>
            </div>
          )}
        </div>
      )}

      <Section title="Record" style={{ marginTop: 14 }}>
        <DetailColumns>
          <DetailColumn icon={Icons.box} title="Asset">
            <KV label="Reference" value={r.assetId} />
            <KV label="Class" value={r.assetClass} />
            <KV label="Category" value={r._category || '—'} />
            <KV label="Manufacturer" value={r._manufacturer || '—'} />
            <KV
              label="Criticality"
              value={r.criticality}
              tone={r.criticality === 'Critical' ? '#dc2626' : undefined}
            />
          </DetailColumn>

          <DetailColumn icon={Icons.clipboard} title="What is due">
            <KV label="Task" value={r.task} />
            <KV label="PM reference" value={r.taskId} />
            <KV label="Standard" value={r.standard || '—'} />
            <KV label="Frequency" value={r.frequency} />
            <KV label="Interval" value={`${r._intervalDays} days`} />
          </DetailColumn>

          <DetailColumn icon={Icons.calendar} title="Schedule">
            <KV label="Due" value={fmtDate(r.dueDate)} />
            <KV label="Status" value={r.status} tone={r._overdue ? '#dc2626' : undefined} />
            <KV label="Last done" value={last ? fmtDate(last.date) : 'Not recorded'} />
            <KV label="Last result" value={last ? last.result : '—'} tone={last?._failed ? '#dc2626' : undefined} />
            <KV label="Next after this" value={fmtDate(r._nextAfter)} />
          </DetailColumn>

          <DetailColumn icon={Icons.user} title="Assignment">
            <KV label="Assigned to" value={r.assignedTo} />
            <KV label="Escalates to" value={esc.role} />
            <KV label="Response SLA" value={esc.sla || '—'} />
            <KV label="Site" value={r._site} />
            <KV label="Location" value={r._location || '—'} />
          </DetailColumn>
        </DetailColumns>
      </Section>

      <div style={styles.two}>
        <Section title="Can it come offline for the window?" style={{ marginBottom: 0 }}>
          {red ? (
            <>
              <div style={styles.bigAnswer}>
                <span style={{ color: red.canIsolate ? '#047857' : '#b91c1c' }}>
                  {red.canIsolate ? 'Yes — redundancy covers it' : 'Not without dropping a path'}
                </span>
              </div>
              <div style={{ display: 'grid', gap: 7, marginTop: 12 }}>
                <KV label={`${red.path} redundancy`} value={red.value || '—'} />
                <KV label="Design tier" value={red.designTier || '—'} />
                <KV label="PoC zone" value={red.zone || '—'} />
                <KV label="Redundancy impact" value={esc.tier || '—'} />
              </div>
              <p style={styles.caption}>
                {red.path.toLowerCase()} on this site is {red.value}, and this asset is filed
                under {r._category || 'plant'} — so the {red.path.toLowerCase()} figure is the one that governs the
                window, not the other. {esc.redundancyImpact}
              </p>
            </>
          ) : (
            <div style={{ fontSize: 12.5, color: MUTE }}>No site record for {r.siteId}.</div>
          )}
        </Section>

        <Section title="If it slips" style={{ marginBottom: 0 }}>
          <div style={styles.bigAnswer}>{esc.role}</div>
          <div style={{ display: 'grid', gap: 7, marginTop: 12 }}>
            <KV label="RACI" value={esc.raci || '—'} />
            <KV label="Review cadence" value={esc.cadence || '—'} />
            <KV label="Criticality tier" value={esc.tier || '—'} />
            <KV label="Response SLA" value={esc.sla || '—'} />
          </div>
          <p style={styles.caption}>
            {esc.responsibility} {esc.businessImpact ? `Losing this asset: ${esc.businessImpact.toLowerCase()}` : ''}
          </p>
          <p style={styles.aside}>
            Derived, not quoted: the criticality sheet supplies the tier, SLA and impact, and the RACI sheet
            supplies the role and what it owns. Which role a given tier escalates to is this portal&apos;s reading of
            those two, not a rule the client wrote down.
          </p>
        </Section>
      </div>

      <Section title="What the visit is looking for">
        {r._failureModes.length ? (
          <>
            <div style={styles.modes}>
              {r._failureModes.map((f) => (
                <div
                  key={f.code}
                  style={{
                    ...styles.mode,
                    borderColor: f.sensorCovered ? '#bfdbfe' : '#fed7aa',
                    background: f.sensorCovered ? '#f5f9ff' : '#fffbf5',
                  }}
                >
                  <div style={styles.modeHead}>
                    <span style={styles.modeCode}>{f.code}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: f.sensorCovered ? '#1d4ed8' : '#c2410c' }}>
                      {f.sensorCovered ? 'sensor-covered' : 'inspection only'}
                    </span>
                  </div>
                  <div style={styles.modeName}>{f.mode || 'Unlisted mode'}</div>
                  <div style={styles.modeTech}>
                    {f.technology || '—'}
                  </div>
                </div>
              ))}
            </div>
            <p style={styles.caption}>
              These are the failure modes the register records against {r.assetId}, not against this task — the PM
              library carries no failure codes, so nothing here claims the two were matched up by the client.
              {covered.length > 0 && ` ${plural(covered.length, 'mode')} ${covered.length === 1 ? 'is' : 'are'} watched continuously by the sensors on this class.`}
              {uncovered.length > 0
                ? ` ${plural(uncovered.length, 'mode')} ${uncovered.length === 1 ? 'has' : 'have'} no sensor behind ${uncovered.length === 1 ? 'it' : 'them'} — those are only ever found by somebody going to look, which is what this reminder is asking for.`
                : ' Every mode on this asset has a sensor behind it, which is what makes the calendar round a check on the sensors as much as on the machine.'}
            </p>
          </>
        ) : (
          <div style={{ fontSize: 12.5, color: MUTE }}>No failure codes recorded against this asset.</div>
        )}
      </Section>

      <Section title="History on this asset">
        {r._adherence ? (
          <div style={styles.tally}>
            <Tally label="Inspections recorded" value={r._adherence.total} />
            <Tally label="Passed clean" value={r._adherence.passed} tone="#047857" />
            <Tally label="With observations" value={r._adherence.observations} tone={r._adherence.observations ? '#b45309' : undefined} />
            <Tally label="Failed" value={r._adherence.failed} tone={r._adherence.failed ? '#b91c1c' : undefined} />
            <Tally label="Average score" value={r._adherence.averageScore} />
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: MUTE }}>No inspection history recorded on this asset.</div>
        )}

        {/* Kept apart from the tally above it, and labelled, because this one is
            the client's own log and the tally is ours. A compliance figure that
            silently mixes the two is the figure somebody quotes back. */}
        {r._pmLog && (
          <div style={styles.pmLog}>
            <div style={styles.pmLogHead}>
              The client&apos;s PM compliance log
              <span style={styles.pmLogNote}>
                {r._pmLog.onTime} on time, {r._pmLog.late} late, of {plural(r._pmLog.logged, 'entry')} on this asset
                {r._pmLog._sameTask ? ` — including ${r.taskId}` : ''}
              </span>
            </div>
            <div style={{ display: 'grid', gap: 7, marginTop: 10 }}>
              {r._pmLog.rows.map((p) => (
                <div key={p.logId} style={styles.pmRow}>
                  <span style={styles.mono}>{p.logId}</span>
                  <span style={{ fontSize: 12, color: SUB, flex: 1, minWidth: 0 }}>
                    {p.taskId} · scheduled {fmtDate(p.scheduledDate)}
                    {p.completedDate ? `, completed ${fmtDate(p.completedDate)}` : ''} · {p.team}
                  </span>
                  <StatusBadge tone={p.status === 'Completed On Time' ? 'green' : p.status === 'Completed Late' ? 'amber' : 'blue'}>
                    {p.status}
                  </StatusBadge>
                </div>
              ))}
            </div>
          </div>
        )}

        {r._incidents.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={styles.pmLogHead}>
              Past failures on this machine
              <span style={styles.pmLogNote}>{plural(r._incidents.length, 'incident')} before the PoC</span>
            </div>
            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
              {r._incidents.map((i) => (
                <button
                  key={i.incidentId}
                  onClick={() => router.push(`/portal/datacenter/incidents/${encodeURIComponent(i.incidentId)}`)}
                  style={styles.incident}
                >
                  <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>{i.description}</div>
                    <div style={{ fontSize: 11.5, color: MUTE, marginTop: 3, lineHeight: 1.5 }}>
                      {i.incidentId} · {fmtDate(i.date)} · found by {i.detectionMethod} · root cause: {i.rootCause}
                    </div>
                  </div>
                  <StatusBadge tone={/^yes$/i.test(String(i.customerImpact || '')) ? 'red' : 'green'}>
                    {i.downtime}
                  </StatusBadge>
                </button>
              ))}
            </div>
          </div>
        )}

        <p style={styles.aside}>
          {r._incidents.length
            ? 'The incident sheet is the client’s pre-PoC record. It covers seven assets across the estate; this is one of them.'
            : 'Nothing on the client’s pre-PoC incident sheet names this asset. That sheet covers seven failures across the estate, so an empty result here is an absence of record rather than proof of a clean history.'}
        </p>
      </Section>

      <Section title="Why this reminder exists" style={{ marginBottom: 0 }}>
        <div style={{ display: 'grid', gap: 7 }}>
          <KV label="Scope rationale" value={r._scopeRationale || '—'} />
          <KV label="Maintenance strategy" value={r._strategy || '—'} />
          <KV label="Monitoring method" value={r._monitoringMethod || '—'} />
          <KV label="Data sources" value={r._dataSources?.join(', ') || '—'} />
          <KV label="Sensors fitted" value={r._sensors?.length ? r._sensors.join(', ') : 'None'} />
        </div>
        <p style={styles.aside}>
          The reminder itself is generated: the client&apos;s workbooks carry an asset register and a PM task
          library but no schedule, so {r.taskId} is scheduled here at the {r.frequency.toLowerCase()} interval that
          library states, against an asset on their register. Every other field on this page is read from their
          data or derived from it, and the derived ones say so where they appear.
        </p>
      </Section>
    </div>
  )
}

function Tally({ label, value, tone }) {
  return (
    <div style={styles.tallyCell}>
      <div style={{ ...styles.tallyValue, color: tone || INK }}>{value}</div>
      <div style={styles.tallyLabel}>{label}</div>
    </div>
  )
}

const styles = {
  banner: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: 20, flexWrap: 'wrap', marginBottom: 18, borderRadius: 14, padding: '16px 18px',
    borderStyle: 'solid', borderWidth: 1,
  },
  bannerLabel: { fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 },
  bannerDate: { fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 5 },
  bannerAway: { fontSize: 12.5, fontWeight: 600, marginTop: 5 },
  bannerSide: { textAlign: 'right', minWidth: 200, maxWidth: 340 },
  bannerSideLabel: { fontSize: 10.5, fontWeight: 800, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.5 },
  bannerSideValue: { fontSize: 15, fontWeight: 700, color: INK, marginTop: 5 },
  bannerSideNote: { fontSize: 11.5, color: SUB, marginTop: 5, lineHeight: 1.5 },

  lastRow: { display: 'flex', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' },
  lastScore: { fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, flexShrink: 0 },
  lastScoreUnit: { fontSize: 14, fontWeight: 700, color: MUTE, marginLeft: 3 },

  contest: {
    borderRadius: 14, padding: '15px 17px', marginBottom: 14,
    borderStyle: 'solid', borderWidth: 1, borderColor: '#fed7aa', background: '#fff7ed',
  },
  contestLabel: { fontSize: 10.5, fontWeight: 800, color: '#c2410c', textTransform: 'uppercase', letterSpacing: 0.5 },
  contestBody: { fontSize: 13.5, color: INK, marginTop: 7, lineHeight: 1.65, maxWidth: 820 },
  contestAlert: {
    marginTop: 12, background: '#fff', borderRadius: 10, padding: '10px 12px',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#fed7aa',
  },
  plain: {
    borderRadius: 14, padding: '15px 17px', marginBottom: 14,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, background: '#f8fafc',
  },
  plainLabel: { fontSize: 10.5, fontWeight: 800, color: SUB, textTransform: 'uppercase', letterSpacing: 0.5 },

  two: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14, marginBottom: 14, alignItems: 'start' },
  bigAnswer: { fontSize: 17, fontWeight: 700, color: INK, letterSpacing: '-0.01em', lineHeight: 1.35 },

  modes: { display: 'grid', gap: 9, gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' },
  mode: { borderRadius: 11, padding: '10px 12px', borderStyle: 'solid', borderWidth: 1 },
  modeHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  modeCode: { fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 12, fontWeight: 700, color: INK },
  modeName: { fontSize: 13, fontWeight: 600, color: INK, marginTop: 6, lineHeight: 1.4 },
  modeTech: { fontSize: 11, color: MUTE, marginTop: 3 },

  tally: { display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))' },
  tallyCell: {
    borderRadius: 11, padding: '11px 13px', background: '#fcfdfe',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  tallyValue: { fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 },
  tallyLabel: { fontSize: 11, color: MUTE, marginTop: 5, lineHeight: 1.35 },

  pmLog: { marginTop: 16 },
  pmLogHead: { fontSize: 12.5, fontWeight: 700, color: INK, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' },
  pmLogNote: { fontSize: 11.5, fontWeight: 500, color: MUTE },
  pmRow: {
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    padding: '9px 11px', borderRadius: 10, background: '#fcfdfe',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  incident: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    padding: '10px 12px', background: '#fcfdfe', borderRadius: 10, fontFamily: 'inherit',
    cursor: 'pointer', borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },

  caption: { margin: '13px 0 0', fontSize: 12.5, color: SUB, lineHeight: 1.65, maxWidth: 780 },
  aside: { margin: '12px 0 0', fontSize: 11.5, color: MUTE, lineHeight: 1.6, maxWidth: 780 },
  mono: { fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 11.5, color: SUB },
  link: {
    padding: '6px 12px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
    background: '#fff', color: ACCENT, borderRadius: 8, cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#15227a33',
  },
}
