'use client'

import { PageHeader, Card, Section, DataTable, StatusBadge, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { ORG, DOMAIN } from '../lib/data'
import {
  CHILLERS, PARAMS, LEAK_FACTORS, ENERGY_ASSUMPTIONS, WINDOW_DAYS, MODULE_ACTIVE,
} from '../lib/dataChiller'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN } = PALETTE

const OBJECTIVES = [
  'Detect refrigerant loss from operating data, before the charge is low enough to cost capacity.',
  'Measure efficiency drift against each machine\'s own commissioning performance rather than a fleet target.',
  'Rank machines by risk, so limited refrigeration labour goes where it changes an outcome.',
  'Hand a technician an inspection that already carries the parameters that triggered it.',
  'Keep a per-machine record of refrigerant added, and of what the leak test found.',
]

const WORKFLOW = [
  { title: 'Acquisition', body: 'Controller, BMS and gateway points are read on a fixed interval over BACnet, Modbus, OPC UA or MQTT. No new control system is introduced.' },
  { title: 'Baseline', body: 'Each machine\'s own performance is learned at matched load and ambient, so later comparisons are like for like.' },
  { title: 'Detection', body: 'Readings are judged against the operating ranges and against that baseline. Correlated movement across several parameters raises an alert; a single parameter wandering does not.' },
  { title: 'Triage', body: 'The alert carries severity, likely cause, the parameters that triggered it and a recommended inspection action.' },
  { title: 'Work', body: 'An inspection or corrective work order is raised against the asset with the score\'s factors written into it, so the job explains itself on the technician\'s device.' },
  { title: 'Close-out', body: 'Findings, refrigerant recovered or added, and the repair are recorded back against the asset and its charge log.' },
  { title: 'Review', body: 'Monthly fleet reporting: COP against baseline, refrigerant added per machine, and alerts raised against alerts confirmed.' },
]

const BENEFITS = [
  ['Refrigerant loss found earlier', 'Charge loss shows in subcooling and superheat weeks before it shows in capacity or in an annual leak test.'],
  ['Fewer unplanned interventions', 'Work moves from breakdown response into a planned window, because the warning arrives with time on it.'],
  ['Efficiency drift made visible', 'COP is tracked against a stated baseline, so a gradual loss is an event rather than a slow rise in the bill.'],
  ['Better refrigerant records', 'Gas added per machine is held against the asset, which is what a regulatory record and a leak investigation both need.'],
  ['Prioritised maintenance', 'A ranked fleet lets a small refrigeration team spend the week on the machines that justify it.'],
  ['No new control system', 'The platform reads existing instrumentation and OEM controllers; new sensors are added only where a gap is found.'],
]

export default function ChillerSolution() {
  const { scope, siteName } = useSite()
  if (!MODULE_ACTIVE) return <ModuleOff />

  const covered = scope(CHILLERS).length
  const sourceRows = DOMAIN.dataSources.map(([measurement, source], i) => ({
    id: `src_${i}`, measurement, source,
  }))

  return (
    <div>
      <PageHeader
        icon={sectionIcon('chiller-solution', ACCENT)}
        title="Solution Overview"
        subtitle={`${DOMAIN.label} for ${ORG.organization_name} · ${DOMAIN.subtitle}`}
      />

      <Card style={{ marginBottom: 14 }}>
        <p style={{ margin: 0, fontSize: 13, color: SUB, lineHeight: 1.65 }}>
          The module monitors the refrigeration, thermal, electrical and operating parameters a chiller already
          reports, and uses them for two things: to estimate whether a machine is losing refrigerant, and to show how
          far its efficiency has moved from the performance it was accepted at. It sits on the existing CMMS, so a
          detection becomes an inspection and then a work order against the same asset record the rest of the portal
          uses. Here it covers {covered} machines at {siteName}, with {PARAMS.length} parameters
          and {WINDOW_DAYS} days of history each.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 13, paddingTop: 12, borderTop: `1px solid ${LINE}` }}>
          {DOMAIN.monitoredKinds.map((k) => <StatusBadge key={k} tone="blue">{k}</StatusBadge>)}
          {DOMAIN.refrigerants.map((r) => <StatusBadge key={r} tone="grey">{r}</StatusBadge>)}
        </div>
      </Card>

      <Section title="Objectives">
        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {OBJECTIVES.map((o) => (
            <li key={o} style={{ fontSize: 12.5, color: SUB, lineHeight: 1.55 }}>{o}</li>
          ))}
        </ul>
      </Section>

      <Section title="Architecture">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 12 }}>
          {DOMAIN.architecture.map((layer) => (
            <div key={layer.n} style={{ border: `1px solid ${LINE}`, borderRadius: 11, padding: '13px 14px', background: '#fcfdfe' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
                <span style={{
                  width: 25, height: 25, borderRadius: 7, flexShrink: 0, background: '#e8ecff', color: ACCENT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 800,
                }}>{layer.n}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{layer.title}</span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: SUB, lineHeight: 1.55 }}>{layer.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Data sources and sensors"
        right={<span style={{ fontSize: 11.5, color: MUTE }}>what the site audit confirms</span>}>
        <DataTable
          pageSize={12}
          rows={sourceRows}
          empty="No data sources defined."
          columns={[
            { key: 'measurement', label: 'Measurement', sortable: false, render: (r) => <span style={{ fontWeight: 600 }}>{r.measurement}</span> },
            { key: 'source', label: 'Source', sortable: false },
          ]} />
        <p style={{ margin: '13px 0 0', fontSize: 11.5, color: SUB, lineHeight: 1.55 }}>
          Most of these points already exist on an instrumented chiller. Phase 1 establishes which are present, which
          are readable over the BMS, and where a sensor has to be added.
        </p>
      </Section>

      <Section title="AI use cases">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 11 }}>
          {DOMAIN.useCases.map((u) => (
            <div key={u} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <span style={{ fontSize: 12.5, color: SUB, lineHeight: 1.55 }}>{u}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Maintenance and response workflow">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {WORKFLOW.map((s, i) => (
            <div key={s.title} style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              padding: '11px 0', borderBottom: i === WORKFLOW.length - 1 ? 'none' : `1px solid ${LINE}`,
            }}>
              <span style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: ACCENT, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 800,
              }}>{i + 1}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>{s.title}</div>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: SUB, lineHeight: 1.55 }}>{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Expected benefits">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
          {BENEFITS.map(([title, body]) => (
            <div key={title} style={{ border: `1px solid ${LINE}`, borderRadius: 11, padding: '12px 14px' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>{title}</div>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: SUB, lineHeight: 1.55 }}>{body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Implementation roadmap">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
          {DOMAIN.roadmap.map((p) => (
            <div key={p.phase} style={{ border: `1px solid ${LINE}`, borderRadius: 11, padding: '13px 14px' }}>
              <span style={{
                display: 'inline-block', padding: '2.5px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 800,
                color: ACCENT, background: '#e8ecff', letterSpacing: 0.3,
              }}>{p.phase}</span>
              <div style={{ fontSize: 13, fontWeight: 700, color: INK, margin: '8px 0 4px' }}>{p.title}</div>
              <p style={{ margin: 0, fontSize: 12, color: SUB, lineHeight: 1.55 }}>{p.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="What is modelled">
        <p style={{ margin: 0, fontSize: 12.5, color: SUB, lineHeight: 1.65 }}>
          Two numbers in this module are estimates and are labelled as such wherever they appear. The
          <strong style={{ color: INK }}> leak risk score</strong> is a weighted judgement over operating data — no
          refrigerant sensor is involved — built from {LEAK_FACTORS.length} factors:{' '}
          {LEAK_FACTORS.map((f) => `${f.label.toLowerCase()} (${f.weight})`).join(', ')}. It says a machine is behaving
          the way a leaking machine behaves, and the leak test it raises is what confirms or clears it. The
          <strong style={{ color: INK }}> cost of efficiency drift</strong> is arithmetic over two stated assumptions —
          {' '}{ORG.currency_symbol}{ENERGY_ASSUMPTIONS.tariff_per_kwh.toFixed(2)} per kWh
          and {ENERGY_ASSUMPTIONS.hours_per_year.toLocaleString('en-US')} running hours a year — and moves with both.
          Everything else on these screens is read from the plant record or from the monitored parameters.
        </p>
      </Section>
    </div>
  )
}

function ModuleOff() {
  return (
    <Card style={{ textAlign: 'center', padding: '44px 20px' }}>
      <div style={{ fontSize: 14.5, fontWeight: 700, color: INK }}>This module is not switched on here</div>
      <p style={{ margin: '7px auto 0', maxWidth: 470, fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>
        The chiller solution overview belongs to refrigeration plant, which the organisation loaded here does not run.
        Use the portal switcher to open one that does.
      </p>
    </Card>
  )
}
