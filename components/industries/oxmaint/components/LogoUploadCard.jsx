'use client'

// The organisation logo, uploaded by the customer.
//
// This is the product's own behaviour: a customer replaces the Oxmaint mark
// with theirs and it appears in the shell. The real backend takes a multipart
// upload and returns a URL; there is no file store behind this demo, so the
// image is read into a data URL and kept with the other records — which means
// it genuinely survives a reload and is the same for the next person, rather
// than being a preview that evaporates.
//
// The size cap is the reason that works. A 4MB photograph as base64 is 5.5MB of
// JSON on every page load, so anything above a sensible logo size is downscaled
// before it is stored, and the original is never kept.

import { useRef, useState } from 'react'
import { Card, ActionButton, StatusBadge, PALETTE } from '../lib/kit'
import { useOrgBranding } from '../lib/store'
import { ORG } from '../lib/data'
import { assetPath } from '@/lib/apiPath'

const { MUTE, SUB, INK, LINE, RED } = PALETTE

const MAX_EDGE = 512          // px — plenty for a logo at any size we render it
const MAX_SOURCE_BYTES = 5e6  // refuse obviously wrong files before decoding

// Downscale in a canvas and re-encode as PNG, so transparency survives. A logo
// re-encoded as JPEG comes back with a black box behind it.
function shrink(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('That file is not an image the browser can open.'))
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve({ url: canvas.toDataURL('image/png'), w, h })
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

export default function LogoUploadCard() {
  const { logoUrl, setLogo, clearLogo } = useOrgBranding()
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dims, setDims] = useState(null)

  const choose = async (file) => {
    setError('')
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file — PNG with a transparent background works best.')
      return
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setError('That file is over 5MB. A logo should be a few hundred kilobytes.')
      return
    }
    setBusy(true)
    try {
      const { url, w, h } = await shrink(file)
      setDims({ w, h })
      await setLogo(url, file.name)
    } catch (e) {
      setError(e.message || 'Could not use that image.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }}>
        <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: INK }}>Organisation logo</h3>
        {logoUrl ? <StatusBadge tone="green">Custom</StatusBadge> : <StatusBadge tone="grey">Default</StatusBadge>}
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); choose(e.dataTransfer.files?.[0]) }}
          onClick={() => inputRef.current?.click()}
          role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') inputRef.current?.click() }}
          style={{
            width: 168, height: 132, flexShrink: 0, cursor: 'pointer',
            border: `1px dashed ${LINE}`, borderRadius: 12, background: '#fcfdfe',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12,
          }}>
          <img
            src={logoUrl || assetPath('/oxmaint/logo.png')}
            alt="Organisation logo"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', opacity: busy ? 0.4 : 1 }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <p style={{ margin: '0 0 10px', fontSize: 12.5, color: SUB, lineHeight: 1.55 }}>
            Replaces the Oxmaint mark in the sidebar and on the sign-in screen for everyone at
            {' '}{ORG.organization_name}. A square or near-square PNG with a transparent background
            works best — a wide lockup will be shrunk to fit the card and become hard to read.
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ActionButton onClick={() => inputRef.current?.click()} disabled={busy}>
              {busy ? 'Processing…' : logoUrl ? 'Replace logo' : 'Upload logo'}
            </ActionButton>
            {logoUrl && (
              <ActionButton variant="ghost" onClick={() => { setDims(null); clearLogo() }} disabled={busy}>
                Reset to default
              </ActionButton>
            )}
          </div>

          <input
            ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={(e) => { choose(e.target.files?.[0]); e.target.value = '' }}
          />

          {error && <p style={{ margin: '9px 0 0', fontSize: 12, color: RED, fontWeight: 600 }}>{error}</p>}
          {!error && dims && (
            <p style={{ margin: '9px 0 0', fontSize: 11.5, color: MUTE }}>
              Stored at {dims.w} × {dims.h}. Anything larger is downscaled — a logo does not need
              to be a photograph.
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}
