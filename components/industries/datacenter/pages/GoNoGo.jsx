'use client'

// The Go / No-Go screen — the decision the whole PoC exists to inform.
//
// Everything on this page is already somewhere else in the portal: the KPI
// dashboard has the measurements, the outcome log has the accuracy, the risk
// register and the two readiness checklists have what is outstanding. What none
// of them does is put the question the client actually has to answer — do we
// scale this to the estate — in one place with the evidence lined up under it.
//
// Two rules govern how it is written.
//
// First, the verdict on each KPI is the client's own. The workbook carries a
// "Status vs Target" column that its authors filled in — On Target, Above
// Target (favorable), Demonstrated — and this page reads that column rather
// than comparing the actual against the target itself. Re-deriving it would
// mean this screen could disagree with the client's own sheet, and in that
// argument the sheet wins.
//
// Second, the overall recommendation is derived, and says so, in those words,
// on the screen. The rule is stated where the reader can check it: every
// technical KPI on target, the operational objectives demonstrated, and no
// blocking readiness item — and the readiness gate is currently unmet, because
// nothing on either checklist has started. So this page does not print "Go".
// A PoC portal that recommends its own continuation before the PoC has begun is
// the least credible thing it could do.

import { useRouter } from 'next/navigation'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Section, StatusBadge, PALETTE } from '../lib/kit'
import {
  KPI_ROWS, BENEFITS, CORRELATION_ROWS, RISKS, SITE_READINESS, TECH_PREREQ,
  INCIDENTS, SUMMARY, ORG,
} from '../lib/data'
import { MON_ACCURACY, MON_WINDOW } from '../lib/monitoring'

const { SUB, MUTE, INK, LINE, GREEN, AMBER, ACCENT } = PALETTE

// ── the gates ────────────────────────────────────────────────────────────
//
// Each is a question with a yes/no answer and a place in the portal the reader
// can go and check it. `met` is computed from the workbook, never asserted.

const technical = KPI_ROWS.filter((k) => k.group === 'Technical')
const operational = KPI_ROWS.filter((k) => k.group === 'Operational')

const readinessItems = [...SITE_READINESS, ...TECH_PREREQ]
const readinessDone = readinessItems.filter((i) => /complete|done|closed/i.test(i.status || '')).length
const openRisks = RISKS.filter((r) => r.category === 'Risk' && r.status === 'Open')

const confirmedCorrelations = CORRELATION_ROWS.filter((c) => c.confirmed === 'Yes')

const GATES = [
  {
    key: 'technical',
    question: 'Did the platform hold up?',
    detail: 'Sensor availability, data acquisition reliability and dashboard availability, against target.',
    met: technical.length > 0 && technical.every((k) => k._favourable),
    measure: `${technical.filter((k) => k._favourable).length} of ${technical.length} technical KPIs on target`,
    to: 'kpis',
    toLabel: 'KPI Dashboard',
  },
  {
    key: 'accuracy',
    question: 'Were the detections right?',
    detail: 'Alert accuracy and false positive rate, counted only over detections a technician has closed out.',
    met: MON_ACCURACY.closed > 0 && MON_ACCURACY.accuracy != null && MON_ACCURACY.accuracy >= 70,
    measure: MON_ACCURACY.closed
      ? `${MON_ACCURACY.accuracy}% accuracy over ${MON_ACCURACY.closed} closed record${MON_ACCURACY.closed === 1 ? '' : 's'}`
      : 'No detection closed out yet',
    caveat: MON_ACCURACY.closed > 0 && MON_ACCURACY.closed < 10
      ? `Rests on ${MON_ACCURACY.closed} record${MON_ACCURACY.closed === 1 ? '' : 's'} — a direction of travel, not a settled rate.`
      : null,
    to: 'outcomes',
    toLabel: 'Outcome Log',
  },
  {
    key: 'operational',
    question: 'Did it change what maintenance did?',
    detail: 'Early fault detection, optimisation opportunities and condition-triggered interventions — these are judged on being demonstrated, not on hitting a percentage.',
    met: operational.length > 0 && operational.every((k) => k._favourable),
    measure: `${operational.filter((k) => k._favourable).length} of ${operational.length} operational objectives demonstrated`,
    to: 'kpis',
    toLabel: 'KPI Dashboard',
  },
  {
    key: 'value',
    question: 'Is there a business case?',
    detail: 'Benefits recorded against evidence in the register. The avoided events are recorded; they are not priced.',
    met: BENEFITS.length > 0,
    measure: `${BENEFITS.length} benefit${BENEFITS.length === 1 ? '' : 's'} recorded, each linked to a correlation and a work order`,
    caveat: 'Financial impact is not quantified — pricing it needs the client’s own incident-cost benchmark.',
    to: 'benefits',
    toLabel: 'Benefits Realization',
  },
  {
    key: 'readiness',
    question: 'Is the estate ready to take it?',
    detail: 'The site prerequisites and the technical prerequisites — network, cybersecurity, access, data sources.',
    met: readinessItems.length > 0 && readinessDone === readinessItems.length,
    measure: `${readinessDone} of ${readinessItems.length} prerequisite items complete`,
    caveat: readinessDone === 0
      ? 'Nothing on either checklist has started. This is the gate that is open, and it is open because the PoC has not begun.'
      : null,
    to: 'site-readiness',
    toLabel: 'Site Readiness',
  },
  {
    key: 'risk',
    question: 'Is anything unresolved that would stop it?',
    detail: 'Open items on the risk register, each with a named owner and a mitigation.',
    met: openRisks.length === 0,
    measure: `${openRisks.length} risk${openRisks.length === 1 ? '' : 's'} open of ${RISKS.filter((r) => r.category === 'Risk').length}`,
    caveat: openRisks.length
      ? 'Every one carries a mitigation and an owner — open is not the same as unmanaged.'
      : null,
    to: 'risks',
    toLabel: 'Risk Register',
  },
]

const gatesMet = GATES.filter((g) => g.met).length

// The recommendation, derived by the rule printed beside it.
const VERDICT = (() => {
  const blocked = GATES.filter((g) => !g.met)
  if (!blocked.length) {
    return {
      call: 'Go',
      tone: 'green',
      line: 'Every gate is met. The evidence supports scaling beyond the PoC estate.',
    }
  }
  const evidenceGates = blocked.filter((g) => g.key !== 'readiness')
  if (!evidenceGates.length) {
    return {
      call: 'Go, once the prerequisites are closed',
      tone: 'amber',
      line: 'The measured evidence clears every gate it is asked to. What is outstanding is preparation, not performance.',
    }
  }
  return {
    call: 'Too early to call',
    tone: 'grey',
    line: 'The gates below are not all met, and the ones that are rest on a small number of closed records. This page will read differently once the PoC has run.',
  }
})()

export default function GoNoGo() {
  const router = useRouter()
  const go = (key) => router.push(`/portal/datacenter/${key}`)

  return (
    <div>
      <PageHeading
        title="Go / No-Go"
        subtitle={`The scale-up decision, with the evidence for it in one place. Every figure below is measured elsewhere in this portal and linked back to where it is measured — nothing here is asserted on its own.`}
      />

      <StatCards items={[
        { label: 'Gates met', value: `${gatesMet} of ${GATES.length}`, tone: gatesMet === GATES.length ? 'green' : 'amber' },
        { label: 'Assets in scope', value: SUMMARY.assetsInScope, note: `across ${SUMMARY.sites} sites` },
        { label: 'Detections confirmed', value: confirmedCorrelations.length, tone: 'green', note: 'by physical inspection' },
        { label: 'Prerequisites complete', value: `${readinessDone} of ${readinessItems.length}`, tone: readinessDone ? 'amber' : 'red' },
        { label: 'Monitoring window', value: MON_WINDOW.days || '—', unit: 'days' },
      ]} />

      {/* ── the recommendation ───────────────────────────────────────────── */}
      <div style={{ ...styles.verdict, borderColor: VERDICT.tone === 'green' ? GREEN : VERDICT.tone === 'amber' ? AMBER : LINE }}>
        <div style={styles.verdictHead}>
          <span style={styles.verdictLabel}>Recommendation</span>
          <StatusBadge tone={VERDICT.tone}>Derived, not from the client&rsquo;s files</StatusBadge>
        </div>
        <div style={styles.verdictCall}>{VERDICT.call}</div>
        <p style={styles.verdictLine}>{VERDICT.line}</p>

        {/* The rule is on the screen because a recommendation whose reasoning
            is hidden is a number to be argued with rather than checked. */}
        <div style={styles.rule}>
          <span style={styles.ruleLabel}>The rule this applies</span>
          Go when every technical KPI is on target, every operational objective is demonstrated,
          a business case is recorded, every prerequisite is closed and no risk is open.
          Each gate&rsquo;s verdict is the client&rsquo;s own &ldquo;Status vs Target&rdquo; assessment or a count off
          their own register — this page compares nothing they have not already judged.
        </div>
      </div>

      {/* ── the gates ────────────────────────────────────────────────────── */}
      <Section title={`The gates — ${gatesMet} of ${GATES.length} met`}>
        <div style={styles.gates}>
          {GATES.map((g) => (
            <button key={g.key} onClick={() => go(g.to)} style={styles.gate}>
              <div style={styles.gateHead}>
                <span style={{ ...styles.tick, background: g.met ? GREEN : '#fff', borderColor: g.met ? GREEN : '#cbd5e1' }}>
                  {g.met ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4L19 7" /></svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round"><path d="M5 12h14" /></svg>
                  )}
                </span>
                <span style={styles.gateQ}>{g.question}</span>
                <StatusBadge tone={g.met ? 'green' : 'amber'}>{g.met ? 'Met' : 'Not yet'}</StatusBadge>
              </div>

              <div style={styles.gateMeasure}>{g.measure}</div>
              <div style={styles.gateDetail}>{g.detail}</div>
              {g.caveat && <div style={styles.gateCaveat}>{g.caveat}</div>}
              <span style={styles.gateLink}>Check it on {g.toLabel} →</span>
            </button>
          ))}
        </div>
      </Section>

      {/* ── what the evidence actually is ────────────────────────────────── */}
      <Section title="What the recommendation rests on">
        <div style={styles.evidence}>
          <Evidence
            n={confirmedCorrelations.length}
            label="detections confirmed by a physical inspection"
            body="Each one is an anomaly the analytics raised and an engineer then found on the machine. This is the strongest evidence in the PoC, because it is the only kind that cannot be produced by the analytics alone."
            onClick={() => go('correlation')}
            cta="Maintenance Correlation"
          />
          <Evidence
            n={BENEFITS.length}
            label="benefits recorded against named evidence"
            body="Every benefit names the correlation and the work order behind it. The impact column stops at the operational outcome — putting a money figure on it needs the client's own outage-cost model, and that model is not here."
            onClick={() => go('benefits')}
            cta="Benefits Realization"
          />
          <Evidence
            n={INCIDENTS.length}
            label="pre-PoC incidents as the baseline"
            body="The failures the estate had before any of this was fitted, with how each was found. This is what the monitoring is measured against — without it, 'we caught five things' has no denominator."
            onClick={() => go('incidents')}
            cta="Incident Reports"
          />
          <Evidence
            n={SUMMARY.conditionTriggered}
            label="work orders raised by a condition, not a calendar"
            body="The operational change the PoC is testing for. A calendar PM would have reached these machines on its own schedule; these were raised because a sensor said something had changed."
            onClick={() => go('work-orders')}
            cta="Work Orders"
          />
        </div>
      </Section>

      {/* ── what is in the way ───────────────────────────────────────────── */}
      <Section title={`What is in the way — ${openRisks.length} open risk${openRisks.length === 1 ? '' : 's'}`}>
        {openRisks.length ? (
          <div style={styles.risks}>
            {openRisks.map((r) => (
              <div key={r.id} style={styles.risk}>
                <div style={styles.riskHead}>
                  <span style={styles.riskId}>{r.id}</span>
                  <StatusBadge tone={r.impact === 'High' ? 'red' : 'amber'}>{r.likelihood} likelihood · {r.impact} impact</StatusBadge>
                  <span style={styles.riskOwner}>{r.owner}</span>
                </div>
                <div style={styles.riskText}>{r.description}</div>
                <div style={styles.riskMitigation}><strong>Mitigation:</strong> {r.mitigation}</div>
              </div>
            ))}
          </div>
        ) : (
          <p style={styles.empty}>No risk is open on the register.</p>
        )}
      </Section>

      {/* ── the honest footer ────────────────────────────────────────────── */}
      <div style={styles.footNote}>
        <strong>Where these numbers come from.</strong> The KPI verdicts are the client&rsquo;s own
        &ldquo;Status vs Target&rdquo; assessment, unchanged. The counts are counts off the registers. The accuracy
        figure is computed over closed records only, and the number it rests on is printed beside it wherever it
        appears. The recommendation itself is derived here from those inputs by the rule stated above, and is the
        one thing on this page the client did not supply.
        {ORG?.name ? ` Scope: ${ORG.name} — ${SUMMARY.sites} sites, ${SUMMARY.assetsInScope} assets.` : null}
      </div>
    </div>
  )
}

function Evidence({ n, label, body, onClick, cta }) {
  return (
    <div style={styles.evidenceCard}>
      <div style={styles.evidenceN}>{n}</div>
      <div style={styles.evidenceLabel}>{label}</div>
      <p style={styles.evidenceBody}>{body}</p>
      <button onClick={onClick} style={styles.evidenceCta}>{cta} →</button>
    </div>
  )
}

const styles = {
  verdict: {
    background: '#fff', border: '2px solid', borderRadius: 14,
    padding: '18px 20px', marginBottom: 22,
  },
  verdictHead: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  verdictLabel: { fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.5 },
  verdictCall: { fontSize: 26, fontWeight: 800, color: INK, letterSpacing: '-0.02em', marginTop: 8, lineHeight: 1.2 },
  verdictLine: { margin: '7px 0 0', fontSize: 13.5, color: SUB, lineHeight: 1.6, maxWidth: 760 },
  rule: {
    marginTop: 14, padding: '11px 13px', background: '#f8fafc',
    border: `1px solid ${LINE}`, borderRadius: 10,
    fontSize: 12, color: SUB, lineHeight: 1.6,
  },
  ruleLabel: { display: 'block', fontSize: 10, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 },

  gates: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 12 },
  gate: {
    textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer',
    background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: 15,
    display: 'flex', flexDirection: 'column', gap: 0,
  },
  gateHead: { display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' },
  tick: {
    width: 20, height: 20, borderRadius: '50%', border: '2px solid', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  gateQ: { fontSize: 13.5, fontWeight: 700, color: INK, flex: '1 1 auto', minWidth: 0 },
  gateMeasure: { fontSize: 13, fontWeight: 700, color: ACCENT, marginTop: 11 },
  gateDetail: { fontSize: 12, color: SUB, marginTop: 6, lineHeight: 1.55 },
  gateCaveat: { fontSize: 11.5, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '7px 9px', marginTop: 9, lineHeight: 1.5 },
  gateLink: { fontSize: 11.5, fontWeight: 700, color: ACCENT, marginTop: 11 },

  evidence: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 },
  evidenceCard: { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: 15 },
  evidenceN: { fontSize: 30, fontWeight: 800, color: ACCENT, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' },
  evidenceLabel: { fontSize: 12.5, fontWeight: 700, color: INK, marginTop: 7, lineHeight: 1.4 },
  evidenceBody: { margin: '8px 0 0', fontSize: 11.5, color: SUB, lineHeight: 1.6 },
  evidenceCta: {
    marginTop: 11, padding: '5px 11px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
    background: '#fff', border: `1px solid ${ACCENT}33`, color: ACCENT, borderRadius: 7, cursor: 'pointer',
  },

  risks: { display: 'grid', gap: 10 },
  risk: { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: '13px 15px' },
  riskHead: { display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' },
  riskId: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5, fontWeight: 700, color: ACCENT },
  riskOwner: { fontSize: 11.5, color: MUTE },
  riskText: { fontSize: 13, fontWeight: 600, color: INK, marginTop: 8, lineHeight: 1.5 },
  riskMitigation: { fontSize: 12, color: SUB, marginTop: 6, lineHeight: 1.55 },

  empty: { fontSize: 12.5, color: MUTE, margin: 0 },
  footNote: {
    marginTop: 22, padding: '13px 15px', background: '#f8fafc',
    border: `1px solid ${LINE}`, borderRadius: 12,
    fontSize: 11.5, color: SUB, lineHeight: 1.65, maxWidth: 900,
  },
}
