'use client'

import { useEffect, useState } from 'react'
import { Card, PALETTE } from '../../autonomous-inspection/lib/kit'
import { apiUrl } from '@/lib/apiPath'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN } = PALETTE

// The door from this demo portal into the real CMMS.
//
// Everything else on these pages runs on fixture data from lib/data. This is
// the one card that leads somewhere live, which is exactly why it says so on
// its face — a link that silently swaps a demo for production is how somebody
// ends up editing real work orders thinking they are clicking through a mockup.
//
// It renders only for a signed-in console admin. The check is asked of the
// server (/api/cmms/status) because the admin cookie is httpOnly and the
// browser cannot read it; the answer is one boolean, and the mint route checks
// again anyway. Hiding a button is presentation, not access control.
//
// A plain <a>, not a router push: /api/cmms/enter answers a redirect to another
// origin, and Next's client router cannot follow one.
export default function CmmsCard() {
  const [state, setState] = useState({ loading: true, available: false, signedIn: false })

  useEffect(() => {
    let alive = true
    fetch(apiUrl('/api/cmms/status'), { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (alive) setState({ loading: false, available: Boolean(d.available), signedIn: Boolean(d.signedIn) }) })
      // A failed check hides the card rather than showing a dead button. The
      // link is useless without a session, and offering one that cannot work is
      // worse than not offering it.
      .catch(() => { if (alive) setState({ loading: false, available: false, signedIn: false }) })
    return () => { alive = false }
  }, [])

  if (state.loading || !state.available) return null

  return (
    <Card style={{ marginBottom: 14, borderColor: '#c7d2fe', background: 'linear-gradient(180deg,#f8faff,#fff)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{
          display: 'grid', placeItems: 'center', width: 44, height: 44, flexShrink: 0,
          borderRadius: 12, background: ACCENT, color: '#fff', fontSize: 18, fontWeight: 800,
        }}>OX</span>

        <span style={{ minWidth: 220, flex: 1 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: INK }}>Oxmaint CMMS</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '2px 8px', borderRadius: 999, background: '#ecfdf5',
              fontSize: 10.5, fontWeight: 700, color: '#047857', letterSpacing: 0.2,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN }} />
              LIVE SYSTEM
            </span>
          </span>
          <span style={{ display: 'block', fontSize: 12, color: SUB, marginTop: 3, lineHeight: 1.5 }}>
            Work orders, assets, PM schedules, requests and inventory — running on real data.
            The other pages here run on sample data; this one does not.
          </span>
        </span>

        <a
          href="/api/cmms/enter"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0,
            padding: '10px 16px', borderRadius: 10, background: ACCENT, color: '#fff',
            fontSize: 12.5, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
          }}
        >
          Open CMMS
          <span style={{ fontSize: 14, lineHeight: 1 }}>→</span>
        </a>
      </div>

      <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${LINE}`, fontSize: 11, color: MUTE, lineHeight: 1.5 }}>
        Opens signed in as your console account. The link carries a one-minute,
        single-use ticket — it is worth nothing if it is forwarded or bookmarked.
      </div>
    </Card>
  )
}
