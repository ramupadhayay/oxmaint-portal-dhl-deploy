'use client'

// Asset QR — the printable tag that goes on the machine.
//
// The same screen the CMMS portal ships, over this portal's register. It matters
// more here than it does there: the PoC puts new sensors on 48 machines across
// six sites, and the field engineer standing in front of a CRAH needs a way to
// get from the label on its door to its record without typing
// "IAD35-CRAH-01" into a search box on a phone.
//
// The codes are real and scannable. An earlier version of this screen in the
// other portal drew a decorative block pattern, on the reasoning that a
// scannable code would point at a URL that does not exist; that was the wrong
// trade, because the first thing anybody does with a QR screen is hold a phone
// up to it. These encode the asset's own route in this portal, so scanning one
// opens the record.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Card, Toolbar, Modal, ActionButton, StatusBadge, PALETTE } from '../lib/kit'
import { useSite } from '../lib/siteStore'
import { Facts } from '../components/Register'
import { Chips } from '../components/cells'
import { ASSET_ROWS, toneOf } from '../lib/data'

const { MUTE, SUB, INK, LINE } = PALETTE

// Rendered from the module matrix rather than an <img>, so it stays sharp at
// any size and prints at the printer's resolution instead of the screen's.
function QRish({ text, size = 96 }) {
  const matrix = useMemo(() => {
    try {
      return QRCode.create(text, { errorCorrectionLevel: 'M' }).modules
    } catch {
      return null
    }
  }, [text])

  if (!matrix) return <div style={{ width: size, height: size, background: '#f1f5f9', borderRadius: 6, flexShrink: 0 }} />

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

// The origin has to come from window.location, which does not exist on the
// server. Reading it inline made the code encode a relative path server-side
// and a full URL client-side — different bytes, different module count,
// different viewBox, and React caught the mismatch on hydration. Starting empty
// and filling in an effect keeps the first client render identical to the
// server's, then upgrades the code to a scannable URL after mount.
function useOrigin() {
  const [origin, setOrigin] = useState('')
  useEffect(() => { setOrigin(window.location.origin) }, [])
  return origin
}

const assetUrl = (origin, a) => `${origin}/portal/datacenter/assets/${encodeURIComponent(a.assetId)}`

const PAGE = 24

export default function AssetQR() {
  const { scope, siteName } = useSite()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [scopeStatus, setScopeStatus] = useState('all')
  const [preview, setPreview] = useState(null)
  const [shown, setShown] = useState(PAGE)
  const origin = useOrigin()

  const all = useMemo(() => scope(ASSET_ROWS), [scope])
  const categories = useMemo(() => [...new Set(ASSET_ROWS.map((a) => a._category).filter(Boolean))].sort(), [])

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((a) => (
      (category === 'all' || a._category === category) &&
      (scopeStatus === 'all' || a.scopeStatus === scopeStatus) &&
      (!q || [a.assetName, a.assetId, a.assetClass, a._location, a.manufacturer].join(' ').toLowerCase().includes(q))
    ))
  }, [all, search, category, scopeStatus])

  // Reset the window whenever the filters change, or a search that narrows to
  // three results still says "showing 24 of 3".
  useEffect(() => { setShown(PAGE) }, [search, category, scopeStatus, siteName])

  const tags = matches.slice(0, shown)
  const filtered = search.trim() || category !== 'all' || scopeStatus !== 'all'

  return (
    <div>
      {/* Print rule: a tag sheet is the point of this screen, and printing the
          sidebar, header and filter bar around it wastes half the page. */}
      <style>{`
        @media print {
          .dc-qr-chrome { display: none !important; }
          .dc-qr-sheet { grid-template-columns: repeat(3, 1fr) !important; }
          .dc-qr-tag { break-inside: avoid; box-shadow: none !important; }
        }
      `}</style>

      <PageHeading
        title="Assets QR"
        subtitle={`A printable tag for every asset on the register. Each code opens that asset's record in this portal, so a scan from the floor lands on its criticality, its sensors and its open alerts.`}
        right={
          <div className="dc-qr-chrome">
            <ActionButton variant="ghost" onClick={() => window.print()}>Print tag sheet</ActionButton>
          </div>
        }
      />

      <div className="dc-qr-chrome">
        <StatCards items={[
          { label: 'Assets on the register', value: all.length },
          { label: 'Tags generated', value: all.length, tone: 'green' },
          { label: 'In PoC scope', value: all.filter((a) => a._included).length, tone: 'blue' },
          { label: 'Showing', value: tags.length },
        ]} />

        <Toolbar
          search={search} onSearch={setSearch}
          placeholder="Search asset, id, class, location…"
          filters={[
            { label: 'Category', value: category, onChange: setCategory, options: categories },
            { label: 'Scope', value: scopeStatus, onChange: setScopeStatus, options: ['Included', 'Excluded'] },
          ]}
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {siteName !== 'All Sites' && <StatusBadge tone="blue">{siteName}</StatusBadge>}
              {filtered && (
                <>
                  <span style={{ fontSize: 11.5, color: MUTE, fontVariantNumeric: 'tabular-nums' }}>
                    {matches.length} of {all.length}
                  </span>
                  <button onClick={() => { setSearch(''); setCategory('all'); setScopeStatus('all') }} style={clearBtn}>Clear</button>
                </>
              )}
            </div>
          }
        />
      </div>

      <div className="dc-qr-sheet" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(232px,1fr))', gap: 12 }}>
        {tags.map((a) => (
          <div key={a.assetId} className="dc-qr-tag">
            <Card style={{ padding: 14 }}>
              <div role="button" tabIndex={0}
                onClick={() => setPreview(a)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPreview(a) } }}
                style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}>
                <QRish text={assetUrl(origin, a)} size={78} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={styles.tagName}>{a.assetName}</div>
                  <div style={styles.tagCode}>{a.assetId}</div>
                  <div style={styles.tagWhere}>{a._site} · {a._location}</div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    <StatusBadge tone={toneOf(a.criticality)}>{a.criticality}</StatusBadge>
                    {!a._included && <StatusBadge tone="grey">Excluded</StatusBadge>}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        ))}

        {!tags.length && (
          <Card style={{ gridColumn: '1 / -1' }}>
            <div style={{ padding: '32px 0', textAlign: 'center', color: MUTE, fontSize: 12.5 }}>
              No assets match these filters.
            </div>
          </Card>
        )}
      </div>

      {/* A fixed "first 24 shown" cap silently hides the rest of a 48-asset
          register from anyone printing a sheet. This says what is held back and
          offers the rest. */}
      {matches.length > tags.length && (
        <div className="dc-qr-chrome" style={{ textAlign: 'center', marginTop: 16 }}>
          <ActionButton variant="ghost" onClick={() => setShown((n) => n + PAGE)}>
            Show {Math.min(PAGE, matches.length - tags.length)} more — {matches.length - tags.length} not shown
          </ActionButton>
        </div>
      )}

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)}
        title={preview?.assetName} subtitle="Asset tag preview" width={460}
        footer={preview && (
          <ActionButton onClick={() => router.push(`/portal/datacenter/assets/${encodeURIComponent(preview.assetId)}`)}>
            Open the asset record
          </ActionButton>
        )}>
        {preview && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
            <div style={{ padding: 18, border: `1px dashed ${LINE}`, borderRadius: 12, textAlign: 'center', background: '#fff' }}>
              <QRish text={assetUrl(origin, preview)} size={148} />
              <div style={{ marginTop: 10, fontSize: 14, fontWeight: 800, color: INK }}>{preview.assetName}</div>
              <div style={styles.previewCode}>{preview.assetId}</div>
              <div style={{ fontSize: 11, color: SUB, marginTop: 3 }}>{preview._site} · {preview._location}</div>
            </div>

            <div style={{ width: '100%' }}>
              <Facts items={[
                ['Asset class', preview.assetClass],
                ['Criticality', <StatusBadge key="c" tone={toneOf(preview.criticality)}>{preview.criticality}</StatusBadge>],
                ['Response SLA', preview._sla],
                ['Manufacturer', preview.manufacturer],
                ['Monitoring method', preview.monitoringMethod],
                ['Sensors fitted', <Chips key="s" values={preview._sensors} />],
                ['Failure codes', <Chips key="f" values={preview._failureCodes} />],
              ]} />
            </div>

            <p style={{ margin: 0, fontSize: 11.5, color: MUTE, textAlign: 'center', lineHeight: 1.5 }}>
              Scanning the printed tag opens this asset&rsquo;s record — its criticality, the sensors on it,
              and every alert and work order raised against it.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}

const clearBtn = {
  padding: '5px 10px', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
  border: `1px solid ${LINE}`, borderRadius: 7, background: '#fff', color: '#15227a', cursor: 'pointer',
}

const styles = {
  tagName: { fontSize: 12.5, fontWeight: 700, color: INK, lineHeight: 1.35 },
  tagCode: { fontSize: 10.5, color: '#15227a', fontWeight: 700, marginTop: 3, fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' },
  tagWhere: { fontSize: 10.5, color: MUTE, marginTop: 3, lineHeight: 1.4 },
  previewCode: { fontSize: 12, fontWeight: 700, color: '#15227a', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', marginTop: 2 },
}
