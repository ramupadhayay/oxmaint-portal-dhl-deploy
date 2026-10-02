'use client'

// A checklist, as its own page.
//
// The builder writes an instruction, a unit, an acceptable band, response
// options and three capture requirements against every item, and until now the
// only screen that displayed a checklist was a card on the library list that
// showed none of them. A record richer than its only reader is a record nobody
// can check, so this is the reader.
//
// It follows the product's view screen and the compliance portal's port of it:
// a header carrying the name and the actions, a stat row, then two columns —
// the checklist's particulars on the left and its sections and items on the
// right. Every item is a card rather than a table row, because six attributes
// do not fit in six columns without becoming noise.
//
// ── one thing deliberately not here ───────────────────────────────────────
//
// A Run button that works the checklist through on this page. The compliance
// portal has one because a changeover is not a scheduled round and there is
// nowhere else to record it. This portal already has that flow — Start New
// Inspection picks an asset, picks a checklist and saves a report — so a second
// runner would be a second place the same evidence lands, and two registers of
// the same thing is worse than one. The button here opens that flow with this
// checklist already chosen.

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import PageHeading from '../components/PageHeading'
import MetricCard, { MetricGrid, Glyph } from '../components/MetricCard'
import { ProductStyles, RecordCard, EmptyState } from '../components/product'
import { PALETTE } from '../lib/kit'
import { Mark, Panel, Pill, Action } from '../lib/checklistKit'
import { useChecklistStore, useInspectionStore } from '../lib/store'
import {
  CHECKLISTS, INSPECTION_REPORTS, shapeChecklist, shapeInspection, responseOf,
} from '../lib/inspections'
import { ASSETS_IN_SCOPE, fmtDate } from '../lib/data'
import { RESPONSE_TYPES, SCORING_METHODS, failureAction } from '../lib/checklistBuilder'

const { INK, SUB, MUTE, LINE, ACCENT } = PALETTE

const LIST = '/portal/datacenter/checklists'

const scoringLabel = (v) => SCORING_METHODS.find((m) => m.value === v)?.label || v || 'Pass/Fail'

/** Hand a checklist to the builder, the way the library card does. */
function seedBuilder(router, checklist, mode) {
  try {
    window.sessionStorage.setItem('datacenter_checklist_seed', JSON.stringify({ mode, checklist }))
  } catch { /* blocked storage — the builder opens blank, which is recoverable */ }
  router.push('/portal/datacenter/checklists/new')
}

export default function ChecklistView() {
  // Read here rather than taken as a prop: the router mounts these record
  // pages with no props, the way every other one in this portal reads its own.
  const { id: raw } = useParams()
  const id = decodeURIComponent(String(raw || ''))
  const router = useRouter()
  const { created, ready } = useChecklistStore()
  const { created: runs } = useInspectionStore()
  const [openSection, setOpenSection] = useState(null)

  const checklist = useMemo(() => {
    const authored = created.map(shapeChecklist)
    return [...authored, ...CHECKLISTS].find((c) => c.checklistId === id) || null
  }, [created, id])

  // Runs recorded against this checklist — the generated register and anything
  // worked through in the portal. Evidence that the procedure was actually used
  // belongs on the procedure.
  const ourRuns = useMemo(() => {
    if (!checklist) return []
    const portal = runs.map(shapeInspection).filter((r) => r.checklistId === checklist.checklistId)
    const generated = INSPECTION_REPORTS.filter((r) => (checklist.classes || []).includes(r.assetClass))
    return [...portal, ...generated].slice(0, 8)
  }, [runs, checklist])

  if (!checklist) {
    return (
      <div>
        <ProductStyles />
        <PageHeading
          back={{ label: 'Checklist', onClick: () => router.push(LIST) }}
          // Authored checklists arrive one request after the page does, so
          // until that answers this is "loading", not "no such checklist".
          title={ready ? 'No checklist with that reference' : 'Loading…'}
          subtitle={ready ? `Nothing in the library carries the reference ${id}.` : ''}
        />
        {ready && (
          <EmptyState
            icon={<Glyph name="list" size={44} />}
            title="No such checklist"
            body="It may have been renamed, or the reference may be from a different portal."
          />
        )}
      </div>
    )
  }

  const sections = checklist.sections || []
  // A generated library round has no sections — it is one flat list of tasks —
  // so it is shown as a single unnamed section rather than as nothing.
  const shown = sections.length
    ? sections
    : [{ id: 'all', name: checklist.category ? `${checklist.category} round` : 'Checklist', items: checklist.items || [], subSections: [] }]

  const items = checklist.items || []
  const required = items.filter((i) => i.required !== false).length
  const critical = items.filter((i) => i.critical).length
  const runnable = ASSETS_IN_SCOPE.filter((a) => (checklist.classes || []).includes(a.assetClass))

  const startInspection = () => {
    try {
      window.sessionStorage.setItem('datacenter_inspection_seed', JSON.stringify({ checklistId: checklist.checklistId }))
    } catch { /* the flow still opens, just without the checklist chosen */ }
    router.push('/portal/datacenter/inspection-reports/new')
  }

  return (
    <div>
      <ProductStyles />

      {/* The checklist's own name is the heading, as it is in the product. A
          record page headed with the name of the list it came from tells the
          reader where they are rather than what they are looking at. */}
      <PageHeading
        back={{ label: 'Checklist', onClick: () => router.push(LIST) }}
        title={checklist.name}
        subtitle={[checklist.standard, checklist.code || checklist.checklistId].filter(Boolean).join(' · ')}
      />

      <RecordCard>
        <div style={styles.sheetTop}>
          <span style={styles.tile}><Glyph name="list" size={22} /></span>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {/* None of these is a state to fix. Where a checklist came from
                  and whether it is active are facts, so they read as the text
                  around them. */}
              <Pill tone="slate">{checklist._created ? 'Written in this portal' : 'From the PM library'}</Pill>
              <Pill tone="slate">{checklist.category}</Pill>
              {checklist.generatedBy && <Pill tone="slate">Generated by {checklist.generatedBy}</Pill>}
              {checklist.version && <Pill tone="slate">v{checklist.version}</Pill>}
            </div>

            <div style={styles.metaRow}>
              <span><strong style={{ color: SUB }}>Reference:</strong> <span style={styles.code}>{checklist.checklistId}</span></span>
              <span style={styles.metaItem}><Glyph name="clock" size={13} />Updated {fmtDate(checklist.lastUpdated)}</span>
              <span style={styles.metaItem}><Glyph name="asset" size={13} />{runnable.length} asset{runnable.length === 1 ? '' : 's'} in scope</span>
              <span style={styles.metaItem}><Glyph name="tick" size={13} />{checklist.frequency}</span>
            </div>

            {checklist.description && <p style={styles.what}>{checklist.description}</p>}
          </div>

          <div style={styles.actions}>
            <Action icon="check" primary onClick={startInspection}>Start an inspection</Action>
            <Action icon="copy" onClick={() => seedBuilder(router, checklist, 'duplicate')}>Duplicate</Action>
            {/* Only what was written here. A library round is regenerated from
                the PM tasks on every load, so editing one would be editing
                something that rebuilds underneath the edit. */}
            {checklist._created && (
              <Action icon="edit" onClick={() => seedBuilder(router, checklist, 'edit')}>Edit</Action>
            )}
          </div>
        </div>
      </RecordCard>

      {/* All neutral. These describe how a checklist is built, and nothing here
          is a state to fix — not even the critical count: a step whose failure
          stops the round is a design decision, and eight of them on a ten-step
          procedure is the procedure working as intended. */}
      <MetricGrid>
        <MetricCard title="Items" value={items.length} icon={<Glyph name="list" />} />
        <MetricCard title="Sections" value={shown.length} icon={<Glyph name="clipboard" />} />
        <MetricCard title="Required" value={required} icon={<Glyph name="tick" />} />
        <MetricCard title="Critical" value={critical} icon={<Glyph name="alert" />} />
        <MetricCard title="Scoring" value={scoringLabel(checklist.scoringMethod)} icon={<Glyph name="chart" />} />
        <MetricCard title="Passing score" value={checklist.passingScore ? `${checklist.passingScore}%` : '—'} icon={<Glyph name="chart" />} />
      </MetricGrid>

      <div style={styles.columns}>
        <div style={{ minWidth: 0 }}>
          <Panel title="Basic Information" icon="sliders">
            <Rows rows={[
              ['Reference', checklist.checklistId],
              ['Category', checklist.category],
              ['Frequency', checklist.frequency],
              ['Standard', checklist.standard || 'Not stated'],
              ['Scope level', checklist.scopeLevel || 'Equipment'],
              ['Site', checklist.siteId || 'Any PoC site'],
              ['Scoring', `${scoringLabel(checklist.scoringMethod)}${checklist.passingScore ? ` · pass at ${checklist.passingScore}%` : ''}`],
              ['Created', fmtDate(checklist.createdOn || checklist.lastUpdated)],
              ...(checklist.modifiedOn ? [['Last edited', fmtDate(checklist.modifiedOn)]] : []),
            ]} />
          </Panel>

          <Panel title="What it can be run against" icon="clipboard"
            right={<Pill tone="slate">{runnable.length} asset{runnable.length === 1 ? '' : 's'}</Pill>}>
            {(checklist.classes || []).length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {checklist.classes.map((c) => <Pill key={c} tone="slate">{c}</Pill>)}
              </div>
            )}
            {runnable.length ? (
              <div style={{ display: 'grid', gap: 7 }}>
                {runnable.map((a) => (
                  <button key={a.assetId} onClick={() => router.push(`/portal/datacenter/assets/${a.assetId}`)} style={styles.link}>
                    <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                      <span style={styles.linkTop}>{a.assetId} — {a.assetName}</span>
                      <span style={styles.linkSub}>{a._site} · {a._location}</span>
                    </span>
                    {a.criticality === 'Critical' && <Pill tone="red">Critical</Pill>}
                  </button>
                ))}
              </div>
            ) : (
              <p style={styles.empty}>
                No asset in scope carries one of these classes, so this checklist cannot
                currently be run.
              </p>
            )}
          </Panel>

          {checklist.sources?.length > 0 && (
            <Panel title="Drafted from" icon="doc">
              <p style={styles.empty}>
                Every line came from the client&apos;s own PM task library for these classes.
                Nothing on this checklist was invented.
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                {checklist.sources.map((s) => <Pill key={s.id} tone="slate">{s.name}</Pill>)}
              </div>
            </Panel>
          )}

          <Panel title="Inspections against these assets" icon="check"
            right={<Pill tone="slate">{ourRuns.length}</Pill>}>
            {ourRuns.length ? (
              <div style={{ display: 'grid', gap: 7 }}>
                {ourRuns.map((r) => (
                  <button key={r.reportId} onClick={() => router.push(`/portal/datacenter/inspection-reports/${encodeURIComponent(r.reportId)}`)} style={styles.link}>
                    <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                      <span style={styles.linkTop}>{r.reportId} — {r._asset || r.assetId}</span>
                      <span style={styles.linkSub}>{fmtDate(r.date)} · {r.inspector}</span>
                    </span>
                    {r.result && <Pill tone={r.result === 'Failed' ? 'red' : 'slate'}>{r.result}</Pill>}
                  </button>
                ))}
              </div>
            ) : (
              <p style={styles.empty}>No inspection has been recorded against these assets yet.</p>
            )}
          </Panel>
        </div>

        <div style={{ minWidth: 0 }}>
          <Panel title="Checklist Items" icon="list"
            right={<Pill tone="slate">{items.length} item{items.length === 1 ? '' : 's'}</Pill>}>
            {items.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                {shown.map((s, si) => {
                  const count = (s.items?.length || 0) + (s.subSections || []).reduce((n, ss) => n + (ss.items?.length || 0), 0)
                  const collapsed = openSection !== null && openSection !== (s.id || si)
                  return (
                    <div key={s.id || si}>
                      <button onClick={() => setOpenSection(collapsed ? (s.id || si) : (openSection === (s.id || si) ? null : (s.id || si)))}
                        style={styles.sectionHead}>
                        <span style={styles.sectionNo}>{si + 1}</span>
                        <h4 style={styles.sectionName}>{s.name}</h4>
                        {s.assetClass && <Pill tone="slate">{s.assetClass}</Pill>}
                        <Pill tone="slate">{count} item{count === 1 ? '' : 's'}</Pill>
                      </button>

                      {!collapsed && (
                        <>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {(s.items || []).map((item, i) => <ItemCard key={item.itemId || item.id || i} item={item} n={i + 1} />)}
                          </div>

                          {(s.subSections || []).map((ss) => (
                            <div key={ss.id} style={styles.subBlock}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                                <Mark name="layers" size={15} color="#6d28d9" />
                                <h5 style={styles.subName}>{ss.name}</h5>
                                <Pill tone="slate">{ss.items?.length || 0} items</Pill>
                              </div>
                              {ss.instruction && <p style={styles.subInstruction}>{ss.instruction}</p>}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {(ss.items || []).map((item, i) => <ItemCard key={item.itemId || item.id || i} item={item} n={i + 1} />)}
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p style={styles.empty}>This checklist does not carry any items yet.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}

function Rows({ rows }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={styles.detailRow}>
          <span style={styles.detailKey}>{k}</span>
          <span style={styles.detailVal}>{v}</span>
        </div>
      ))}
    </div>
  )
}

/** One item, as the product draws it: number, response type, badges, then the step. */
function ItemCard({ item, n }) {
  // Both vocabularies land here — the library writes a sentence and the builder
  // writes the product's value list — so the label comes from the same helper
  // every other screen reads it through, and the glyph is looked up from it.
  const label = responseOf(item)
  const type = RESPONSE_TYPES.find((r) => r.value === item.responseType)
    || RESPONSE_TYPES.find((r) => r.label === label)
    || RESPONSE_TYPES[0]

  return (
    <div style={styles.itemCard}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={styles.itemNo}>{item.itemNumber || n}</span>
        <span style={styles.itemType}><Mark name={type.icon} size={14} color={SUB} />{label}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {item.critical && <Pill tone="red">Critical</Pill>}
          {item.required !== false && <Pill tone="slate">Required</Pill>}
        </span>
      </div>

      <p style={styles.itemText}>{item.text}</p>
      {item.instruction && <p style={styles.itemInstruction}>{item.instruction}</p>}

      {(item.min || item.max || item.expectedValue || item.options?.length > 0
        || (item.failureAction && item.failureAction !== 'Continue')) && (
        <div style={styles.itemSpec}>
          {item.expectedValue && (
            <div style={styles.specRow}>
              <span style={styles.specKey}>Expected</span>
              <span style={styles.specVal}>{item.expectedValue}{item.unit && (item.min || item.max) ? ` ${item.unit}` : ''}</span>
            </div>
          )}
          {(item.min || item.max) && (
            <div style={styles.specRow}>
              <span style={styles.specKey}>Acceptable range</span>
              <span style={styles.specVal}>
                {item.min || '—'} to {item.max || '—'}{item.unit ? ` ${item.unit}` : ''}
              </span>
            </div>
          )}
          {item.failureAction && item.failureAction !== 'Continue' && (
            <div style={styles.specRow}>
              <span style={styles.specKey}>If it fails</span>
              <Pill tone="amber">{failureAction(item.failureAction).label}</Pill>
            </div>
          )}
          {item.options?.length > 0 && (
            <div style={styles.specRow}>
              <span style={styles.specKey}>Options</span>
              <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {item.options.map((o) => <Pill key={o} tone="slate">{o}</Pill>)}
              </span>
            </div>
          )}
        </div>
      )}

      {(item.requiresPhoto || item.requiresComment || item.requiresSignature
        || item.standard || item.frequency || item.assetClass) && (
        <div style={styles.itemFlags}>
          {item.requiresPhoto && <Pill tone="slate">Photo</Pill>}
          {item.requiresComment && <Pill tone="slate">Comment</Pill>}
          {item.requiresSignature && <Pill tone="slate">Signature</Pill>}
          {item.assetClass && <span style={styles.itemFoot}>{item.assetClass}</span>}
          {item.frequency && <span style={styles.itemFoot}>{item.frequency}</span>}
          {item.standard && <span style={styles.itemFoot}>{item.standard}</span>}
        </div>
      )}
    </div>
  )
}

const styles = {
  sheetTop: { display: 'flex', gap: 14, padding: 16, alignItems: 'flex-start', flexWrap: 'wrap' },
  tile: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 46, height: 46, borderRadius: 12, background: '#eef2ff', color: ACCENT, flexShrink: 0,
  },
  metaRow: {
    display: 'flex', gap: '4px 18px', flexWrap: 'wrap', marginTop: 9,
    fontSize: 11.5, color: MUTE,
  },
  metaItem: { display: 'inline-flex', alignItems: 'center', gap: 5 },
  code: { fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 12, color: ACCENT, fontWeight: 700 },
  what: { margin: '10px 0 0', fontSize: 12.5, color: SUB, lineHeight: 1.6, maxWidth: 660 },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' },

  columns: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.35fr)', gap: 16, alignItems: 'start', marginTop: 16 },

  detailRow: { display: 'flex', gap: 14, justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${LINE}` },
  detailKey: { fontSize: 11.5, color: MUTE, fontWeight: 600, flexShrink: 0 },
  detailVal: { fontSize: 12.5, color: INK, textAlign: 'right', minWidth: 0, wordBreak: 'break-word' },

  link: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    padding: '9px 11px', background: '#fcfdfe', border: `1px solid ${LINE}`,
    borderRadius: 10, fontFamily: 'inherit', cursor: 'pointer',
  },
  linkTop: { display: 'block', fontSize: 12.5, fontWeight: 600, color: INK },
  linkSub: { display: 'block', fontSize: 11, color: MUTE, marginTop: 2 },
  empty: { margin: 0, fontSize: 12, color: MUTE, lineHeight: 1.6 },

  sectionHead: {
    display: 'flex', alignItems: 'center', gap: 9, width: '100%', marginBottom: 11,
    padding: 0, background: 'none', border: 'none', fontFamily: 'inherit',
    cursor: 'pointer', textAlign: 'left', flexWrap: 'wrap',
  },
  sectionNo: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 24, height: 24, borderRadius: 7, background: '#eef2ff',
    color: ACCENT, fontSize: 12, fontWeight: 700, flexShrink: 0,
  },
  sectionName: { margin: 0, fontSize: 13.5, fontWeight: 700, color: INK, minWidth: 0 },

  subBlock: { marginTop: 12, paddingLeft: 13, borderLeft: '2px solid #ddd6fe' },
  subName: { margin: 0, fontSize: 12.5, fontWeight: 700, color: INK },
  subInstruction: { margin: '0 0 10px', fontSize: 11.5, color: MUTE, lineHeight: 1.55 },

  itemCard: { padding: '11px 13px', borderRadius: 11, border: `1px solid ${LINE}`, background: '#fcfdfe' },
  itemNo: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 22, height: 22, padding: '0 6px', borderRadius: 7,
    background: '#f1f5f9', color: SUB, fontSize: 11, fontWeight: 700,
    fontVariantNumeric: 'tabular-nums', flexShrink: 0,
  },
  itemType: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: SUB, fontWeight: 600 },
  itemText: { margin: '9px 0 0', fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.5 },
  itemInstruction: { margin: '5px 0 0', fontSize: 11.5, color: MUTE, lineHeight: 1.55 },

  itemSpec: { marginTop: 10, padding: '9px 11px', borderRadius: 9, background: '#f8fafc', display: 'grid', gap: 6 },
  specRow: { display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' },
  specKey: { fontSize: 11, color: MUTE, fontWeight: 700 },
  specVal: { fontSize: 12, color: INK, fontWeight: 600, fontVariantNumeric: 'tabular-nums' },

  itemFlags: { display: 'flex', gap: '5px 10px', flexWrap: 'wrap', alignItems: 'center', marginTop: 10 },
  itemFoot: { fontSize: 10.5, color: MUTE, fontWeight: 600 },
}
