'use client'

import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { PageHeader, Card, Toolbar, StatStrip, StatusBadge, ActionButton, Fields, Modal, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { ASSETS, fmtDate } from '../lib/data'

const { MUTE, SUB, INK, LINE } = PALETTE

// A real, scannable QR code.
//
// This drew a deterministic block pattern before, on the reasoning that a
// scannable code would point at a URL that does not exist. That was the wrong
// trade: the first thing anyone does with a QR screen is hold a phone up to it,
// and a code that does not scan fails in front of the room. It now encodes a
// genuine asset URL — the link resolves to the portal's own asset route, so
// scanning it is honest as well as functional.
//
// Rendered from the module matrix rather than an image, so it stays sharp at
// any size and prints properly.
function QRish({ text, size = 96 }) {
  const matrix = useMemo(() => {
    try {
      return QRCode.create(text, { errorCorrectionLevel: 'M' }).modules
    } catch {
      return null
    }
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

// What the code actually carries. A bare asset code scans to a meaningless
// string; a URL opens the asset.
//
// The origin has to come from window.location, which does not exist on the
// server. Reading `typeof window === 'undefined' ? '' : window.location.origin`
// inline made the QR encode a relative path on the server and a full URL on
// the client — different bytes, different module count, different viewBox,
// and React caught the mismatch on hydration. Threading the origin through
// state that starts empty and fills in a useEffect keeps the first client
// render identical to the server, then upgrades the QR to a scannable full
// URL after mount.
function useOrigin() {
  const [origin, setOrigin] = useState('')
  useEffect(() => { setOrigin(window.location.origin) }, [])
  return origin
}
const assetUrl = (origin, a) =>
  `${origin}/portal/oxmaint/assets?asset=${encodeURIComponent(a.asset_code)}`

export default function AssetQR() {
  const { scope, siteName } = useSite()
  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')
  const [preview, setPreview] = useState(null)
  const origin = useOrigin()

  const all = useMemo(() => scope(ASSETS), [scope])
  const types = useMemo(() => [...new Set(ASSETS.map((a) => a.asset_type))].sort(), [])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((a) => (
      (type === 'all' || a.asset_type === type) &&
      (!q || [a.asset_name, a.asset_code, a.functional_location_name].join(' ').toLowerCase().includes(q))
    )).slice(0, 24)
  }, [all, search, type])

  return (
    <div>
      <PageHeader
        icon={sectionIcon('asset-qr', '#15227a')}
        title="Asset QR"
        subtitle={`Printable asset tags · ${siteName}`}
        right={<ActionButton variant="ghost" onClick={() => window.print()}>Print sheet</ActionButton>}
      />

      <StatStrip items={[
        { label: 'Assets', value: all.length },
        { label: 'Tags generated', value: all.length, tone: 'green' },
        { label: 'Showing', value: rows.length },
      ]} />

      <Toolbar
        search={search} onSearch={setSearch}
        placeholder="Search asset name, code, location…"
        filters={[{ label: 'Type', value: type, onChange: setType, options: types }]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>first 24 shown</span>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(216px,1fr))', gap: 12 }}>
        {rows.map((a) => (
          <Card key={a.asset_id} style={{ padding: 14, cursor: 'pointer' }}>
            <div role="button" tabIndex={0} onClick={() => setPreview(a)}
              onKeyDown={(e) => { if (e.key === 'Enter') setPreview(a) }}
              style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <QRish text={assetUrl(origin, a)} size={78} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.asset_name}</div>
                <div style={{ fontSize: 10.5, color: '#15227a', fontWeight: 700, marginTop: 2, fontFamily: 'ui-monospace, monospace' }}>{a.asset_code}</div>
                <div style={{ fontSize: 10.5, color: MUTE, marginTop: 3 }}>{a.functional_location_name}</div>
                <div style={{ marginTop: 6 }}><StatusBadge>{a.status}</StatusBadge></div>
              </div>
            </div>
          </Card>
        ))}
        {!rows.length && (
          <Card style={{ gridColumn: '1 / -1' }}>
            <div style={{ padding: '32px 0', textAlign: 'center', color: MUTE, fontSize: 12.5 }}>No assets match these filters.</div>
          </Card>
        )}
      </div>

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.asset_name} subtitle="Asset tag preview" width={420}>
        {preview && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
            <div style={{ padding: 18, border: `1px dashed ${LINE}`, borderRadius: 12, textAlign: 'center', background: '#fff' }}>
              <QRish text={assetUrl(origin, preview)} size={148} />
              <div style={{ marginTop: 10, fontSize: 14, fontWeight: 800, color: INK }}>{preview.asset_name}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#15227a', fontFamily: 'ui-monospace, monospace', marginTop: 2 }}>{preview.asset_code}</div>
              <div style={{ fontSize: 11, color: SUB, marginTop: 3 }}>{preview.site_name} · {preview.functional_location_name}</div>
            </div>
            <div style={{ width: '100%' }}>
              <Fields rows={[
                ['Type', preview.asset_type],
                ['Serial', preview.serial_number],
                ['Manufacturer', preview.manufacturer],
                ['Last maintained', fmtDate(preview.last_maintenance_date)],
              ]} />
            </div>
            <p style={{ margin: 0, fontSize: 11.5, color: MUTE, textAlign: 'center', lineHeight: 1.5 }}>
              Scanning the printed tag opens this asset's record — its history, its schedules and its open work.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
