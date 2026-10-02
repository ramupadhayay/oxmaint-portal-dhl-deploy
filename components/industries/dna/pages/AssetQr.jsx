'use client'

// Asset QR — the printable tag that goes on the machine.
//
// This screen is also the honest answer to one of the customer's questions. They
// asked whether there is a phone app for Android and Apple; there is, and it is
// a product feature rather than something a spreadsheet can show. What a
// spreadsheet *can* lead to is the moment the app is actually for: a technician
// standing in front of a loom, holding a phone at the label on its door, and
// arriving at that machine's record without typing "AST-1203" into a search box
// with gloves on.
//
// The codes are real and scannable. They encode this portal's own route for the
// asset, so scanning one opens the record with its jobs, schedules, spares and
// downtime already on it. A decorative block pattern would have been easier and
// wrong — the first thing anybody does with a QR screen is hold a phone up to it.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { Section, Toolbar, ActionButton, StatusBadge } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Ref, DeptChip, Criticality, Note } from '../components/cells'
import { useDept } from '../lib/deptStore'
import { assets, ASSET_CATEGORIES, ORG } from '../lib/data'

/**
 * The origin, read after mount.
 *
 * A printed tag has no page to be relative to, so the code has to encode an
 * absolute URL — and `window` does not exist during server rendering. Reading it
 * inside the render with `typeof window` is the obvious move and the wrong one:
 * the server then encodes a short relative path and the client a longer absolute
 * one, the two need different numbers of modules to hold, and React reports a
 * hydration mismatch on the svg's viewBox — 29 on the server against 37 on the
 * client.
 *
 * Taking it in an effect means both renders agree on the empty string, and the
 * real origin arrives as an ordinary state update afterwards. Same approach as
 * the data centre portal's tag sheet.
 */
function useOrigin() {
  const [origin, setOrigin] = useState('')
  useEffect(() => { setOrigin(window.location.origin) }, [])
  return origin
}

/**
 * Drawn from the module matrix rather than an <img>, so it stays sharp at any
 * size and prints at the printer's resolution instead of the screen's.
 */
function QR({ text, size = 104 }) {
  const matrix = useMemo(() => {
    try {
      return QRCode.create(text, { errorCorrectionLevel: 'M' }).modules
    } catch {
      return null
    }
  }, [text])

  if (!matrix) {
    return <div style={{ width: size, height: size, background: '#f1f5f9', borderRadius: 6, flexShrink: 0 }} />
  }

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
    <svg width={size} height={size} viewBox={`0 0 ${span} ${span}`} shapeRendering="crispEdges" style={{ flexShrink: 0 }}>
      <rect width={span} height={span} fill="#fff" />
      <path d={cells.join('')} fill="#0f172a" />
    </svg>
  )
}

export default function AssetQr() {
  const router = useRouter()
  const { scope, deptName } = useDept()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')

  const all = useMemo(() => scope(assets), [scope])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((a) => (
      (category === 'all' || a.category === category) &&
      (!q || [a.assetId, a.name, a.manufacturer, a.model, a.serial].join(' ').toLowerCase().includes(q))
    ))
  }, [all, search, category])

  const origin = useOrigin()
  const urlFor = (a) => `${origin}/portal/dna/assets/${encodeURIComponent(a.assetId)}`

  return (
    <div>
      <PageHeading
        title="Assets QR"
        subtitle={`A scannable tag for every machine on the register. Print the sheet, fix a tag to each asset, and a phone gets straight to its record. ${deptName}.`}
        right={<ActionButton variant="ghost" onClick={() => window.print()}>Print sheet</ActionButton>}
      />

      <StatCards items={[
        { label: 'Tags on this sheet', value: rows.length, note: `of ${assets.length} assets`, icon: 'asset' },
        { label: 'Departments covered', value: new Set(rows.map((a) => a.locationCode)).size, icon: 'site' },
        { label: 'High criticality', value: rows.filter((a) => a.criticality === 'High').length, tone: 'warning', note: 'Tag these first' },
        { label: 'Currently down', value: rows.filter((a) => a.status === 'Down').length, tone: rows.some((a) => a.status === 'Down') ? 'destructive' : 'success' },
        { label: 'Plant', value: '1', note: ORG.siteName, icon: 'site' },
      ]} />

      <Note>
        Each code encodes that asset&apos;s own address in this portal, so scanning one on a phone
        opens the record with its work orders, PM schedules, spares and downtime already on it.
        This is the workflow behind the mobile app question — the app is shown live; the tags are
        what it reads.
      </Note>

      <Section title="Tag sheet">
        <Toolbar
          search={search} onSearch={setSearch}
          placeholder="Search asset, manufacturer or serial…"
          filters={[{ label: 'Process step', value: category, onChange: setCategory, options: ASSET_CATEGORIES }]}
        />

        {/* print rules scoped to this screen: the sheet is the point of it, and
            the sidebar, header and filters have no business on a printed page. */}
        <style>{`
          @media print {
            .dna-app > div:first-child, .dna-app header, .dna-tag-toolbar { display: none !important; }
            .dna-app > div { margin-left: 0 !important; }
            .dna-tag { break-inside: avoid; page-break-inside: avoid; }
            .dna-tag-grid { grid-template-columns: repeat(3, 1fr) !important; }
          }
        `}</style>

        <div
          className="dna-tag-grid"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(268px,1fr))', gap: 12 }}
        >
          {rows.map((a) => (
            <div
              key={a.assetId}
              className="dna-tag"
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/portal/dna/assets/${a.assetId}`)}
              onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/portal/dna/assets/${a.assetId}`) }}
              style={{
                display: 'flex', gap: 13, alignItems: 'flex-start',
                padding: '14px 15px', border: '1px solid #e4e9f0', borderRadius: 11,
                background: '#fff', cursor: 'pointer',
              }}
            >
              <QR text={urlFor(a)} size={98} />

              <div style={{ minWidth: 0, flex: 1 }}>
                <Ref>{a.assetId}</Ref>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginTop: 5, lineHeight: 1.3 }}>
                  {a.name}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, lineHeight: 1.45 }}>
                  {a.manufacturer} {a.model}
                </div>
                <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2, fontFamily: 'ui-monospace, monospace' }}>
                  {a.serial}
                </div>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                  <DeptChip code={a.locationCode} name={a._locationName} />
                  <Criticality value={a.criticality} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {!rows.length && (
          <div style={{ padding: '34px 14px', textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>
            No assets match these filters.
          </div>
        )}
      </Section>
    </div>
  )
}
