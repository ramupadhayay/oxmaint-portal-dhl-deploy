'use client'

// Oxmaint's logo, using the product's own assets the way the product uses them.
//
// The three files are not interchangeable, and each has one job:
//
//   logo-wb.png  378x442 — the bull on its own          → the app mark
//   logo.png     638x542 — the bull WITH the wordmark   → favicon, brand card
//   banner.png   626x71  — the wordmark on its own      → wide headers
//
// This file previously produced the mark by scaling logo.png inside a square
// window to cut the wordmark off. That was wrong twice over: it clipped the
// bull's horns and hooves at small sizes — visible in the chat launcher — and
// it was unnecessary, because logo-wb.png is already the bull alone. Cropping a
// logo in CSS is a sign the wrong file is being used.

import Image from 'next/image'
import { useState } from 'react'
import { assetPath } from '@/lib/apiPath'

/**
 * The bull on its own, undistorted and uncropped.
 *
 * `tone="light"` is for dark backgrounds. The product ships no reversed asset —
 * logo-wb.png is the same navy bull — so it was navy on navy in the chat
 * header and launcher. logo-white.png is that exact silhouette in white.
 */
export function OxmaintMark({ size = 30, src, tone = 'dark' }) {
  return (
    <Image
      src={src || (tone === 'light' ? assetPath('/oxmaint/logo-white.png') : assetPath('/oxmaint/logo-wb.png'))}
      alt="Oxmaint"
      width={378} height={442}
      style={{ width: 'auto', height: size, maxWidth: size, objectFit: 'contain', flexShrink: 0 }}
      priority
    />
  )
}

/** The horizontal wordmark. */
export function OxmaintWordmark({ width = 118 }) {
  return (
    <Image src={assetPath('/oxmaint/banner.png')} alt="Oxmaint AI" width={626} height={71}
      style={{ width, height: 'auto', flexShrink: 0 }} priority />
  )
}

/**
 * The sidebar brand card.
 *
 * `logoUrl` is the organisation's own uploaded logo when it has one. A customer
 * who has white-labelled the product should see their mark here, not Oxmaint's
 * — that is the whole point of letting them upload it. The fallback is the
 * product's own lockup.
 */
export function OxmaintBrandCard({ collapsed = false, subtitle, logoUrl }) {
  const [failed, setFailed] = useState(false)
  // The mark, not the stacked lockup: the wordmark is already in the header
  // two inches away, and printing it twice is the first thing that reads as
  // unconsidered.
  const src = logoUrl && !failed ? logoUrl : assetPath('/oxmaint/logo-wb.png')
  const custom = Boolean(logoUrl) && !failed

  if (collapsed) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
        <OxmaintMark size={30} src={custom ? logoUrl : undefined} />
      </div>
    )
  }

  return (
    <div style={{ padding: '14px 14px 10px' }}>
      <div style={{
        border: '1px solid #e8ecf1', borderRadius: 14, background: '#fff',
        padding: '15px 14px', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 8, boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
      }}>
        {/* A customer logo is an unknown aspect ratio, so it is bounded by
            height and allowed to find its own width. Forcing a size here is how
            an uploaded wide logo ends up squashed. */}
        <img
          src={src}
          alt="Organisation logo"
          onError={() => setFailed(true)}
          style={{ maxWidth: '100%', maxHeight: 74, width: 'auto', objectFit: 'contain' }}
        />
        {subtitle && (
          <span style={{
            fontSize: 11, fontWeight: 600, color: '#64748b', maxWidth: '100%',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  )
}
