'use client'

// QR labels for the estate.
//
// The point at a hotel is the suite. A tech standing in 214 with a dripping
// dishwasher should not be searching a list for which of ninety-eight
// dishwashers this is — they scan the label inside the cupboard door and the
// portal opens on that asset with its history.
//
// Rendered as SVG rather than a canvas image so the sheet prints at the
// printer's resolution instead of the screen's. A QR that will not scan off the
// page is worse than no label, because someone has to find out by trying.

import { useMemo, useState } from 'react'
import QRCode from 'qrcode'
import {
  PageHeading, StatCards, Card, Toolbar, ActionButton, StatusBadge, PALETTE,
} from '../lib/kit'
import { ASSETS, SUITES, ORG } from '../lib/data'

const { ACCENT, INK, SUB, MUTE, LINE } = PALETTE

const SCOPE = ['Suites', 'Plant']

function Qr({ text, size = 92 }) {
  const matrix = useMemo(() => {
    try { return QRCode.create(text, { errorCorrectionLevel: 'M' }).modules } catch { return null }
  }, [text])

  if (!matrix) return <div style={{ width: size, height: size, background: '#f1f5f9', borderRadius: 6 }} />

  const n = matrix.size
  const quiet = 2
  const span = n + quiet * 2
  const cells = []
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (matrix.data[y * n + x]) cells.push(`M${x + quiet} ${y + quiet}h1v1h-1z`)
    }
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${span} ${span}`} shapeRendering="crispEdges"
      style={{ background: '#fff', borderRadius: 4, flexShrink: 0 }}>
      <path d={cells.join('')} fill="#0f172a" />
    </svg>
  )
}

export default function AssetQR() {
  const [scope, setScope] = useState('Suites')
  const [q, setQ] = useState('')

  // A suite label carries the suite, not one appliance: it goes on the inside of
  // the entry door and opens the suite's whole register. Plant gets a label per
  // machine, because there is one of each and it is the machine you are at.
  const items = useMemo(() => {
    if (scope === 'Plant') {
      return ASSETS.filter((a) => !a.in_suite)
        .filter((a) => !q || `${a.asset_name} ${a.asset_code}`.toLowerCase().includes(q.toLowerCase()))
        .map((a) => ({
          id: a.asset_id,
          title: a.asset_name,
          code: a.asset_code,
          sub: a.location_name,
          payload: `${ORG.organization_code}|ASSET|${a.asset_code}`,
        }))
    }
    return SUITES
      .filter((s) => !q || `${s.suite_number} ${s.suite_type}`.toLowerCase().includes(q.toLowerCase()))
      .map((s) => ({
        id: s.suite_id,
        title: `Suite ${s.suite_number}`,
        code: `DOV-STE-${s.suite_number}`,
        sub: `${s.suite_type} · Floor ${s.floor}`,
        payload: `${ORG.organization_code}|SUITE|${s.suite_number}`,
      }))
  }, [scope, q])

  const perSuite = ASSETS.filter((a) => a.in_suite).length / Math.max(1, SUITES.length)

  return (
    <div>
      {/* The shell hides the chrome and `.ox-noprint` hides this screen's own
          controls. All that is needed here is keeping a label from being split
          across a page break — half a QR code scans as nothing. */}
      <style>{`
        @media print {
          .qr-card { break-inside: avoid; page-break-inside: avoid; }
          #qr-sheet { gap: 8px !important; }
        }
      `}</style>

      <PageHeading
        title="Asset QR"
        subtitle="Labels for the suites and the plant, ready to print"
        right={(
          <div className="ox-noprint">
            <ActionButton icon="🖨" onClick={() => window.print()}>Print sheet</ActionButton>
          </div>
        )}
      />

      <StatCards items={[
        { label: 'Labels on this sheet', value: items.length, note: scope === 'Suites' ? 'one per suite door' : 'one per machine' },
        { label: 'Suites', value: SUITES.length, note: `${Math.round(perSuite)} assets behind each label` },
        { label: 'Plant', value: ASSETS.filter((a) => !a.in_suite).length, note: 'labelled individually' },
        { label: 'Scan opens', value: 'The register', note: 'suite or asset, with its history' },
      ]} />

      <div className="ox-noprint">
        <Toolbar
          search={q}
          onSearch={setQ}
          placeholder={scope === 'Suites' ? 'Suite number or type…' : 'Asset or code…'}
          filters={[{ label: 'Scope', value: scope, onChange: setScope, options: SCOPE }]}
          right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{items.length} labels</span>}
        />
      </div>

      <div id="qr-sheet" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 10 }}>
        {items.map((it) => (
          <div key={it.id} className="qr-card" style={{
            display: 'flex', gap: 11, alignItems: 'center',
            border: `1px solid ${LINE}`, borderRadius: 10, padding: '11px 12px', background: '#fff',
          }}>
            <Qr text={it.payload} size={84} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: INK, letterSpacing: '-0.01em' }}>{it.title}</div>
              <div style={{ fontSize: 10.5, color: MUTE, marginTop: 2 }}>{it.sub}</div>
              <div style={{
                fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 10,
                color: SUB, marginTop: 5, overflowWrap: 'anywhere',
              }}>{it.code}</div>
            </div>
          </div>
        ))}
      </div>

      {!items.length && (
        <Card><p style={{ margin: 0, fontSize: 13, color: MUTE }}>Nothing matches that search.</p></Card>
      )}
    </div>
  )
}
