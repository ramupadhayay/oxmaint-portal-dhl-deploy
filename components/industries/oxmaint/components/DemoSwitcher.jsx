'use client'

// The portal switcher, at the foot of the sidebar.
//
// One product, several organisations' plant. Moving between them used to mean
// an environment variable and a restart — fine for a developer and useless ten
// minutes before a call.
//
// TWO WAYS IT SWITCHES, because the two places it runs are genuinely different.
//
// In development it asks the server to rewrite one line of .env.local, which
// `next dev` notices and restarts itself over. The click does the whole thing:
// no terminal, no second port, no stopping anything. That works because dev
// already watches that file — see app/api/oxmaint/demo/route.js for why this is
// a far better trade than rebuilding the data layer to be swappable.
//
// In a deployed build there is no such route and no such file: the organisation
// is whatever the bundle was built with, and switching means going to the
// deployment that carries the other one.
//
// WHO SEES IT: everyone, deployed builds included.
//
// This was argued both ways and settled deliberately. The dialog does name the
// other organisations this product is set up for, a line of their estate each,
// so a customer can read who else we are talking to — and the call is that this
// is a product that runs for several organisations, which is a thing worth
// being seen to be, not a leak. It was briefly put behind a flag and that is
// reversed here; there is no build that hides it.
//
// If that call is ever revisited, the gate is one constant and an early return
// after the hooks — not a redesign.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Layers, Check, ExternalLink, Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '../ui/dialog'
import { demos, goToDemo } from '../lib/demos'
import { PACK_LABEL } from '../lib/data'
import { apiUrl } from '@/lib/apiPath'

export default function DemoSwitcher() {
  const [open, setOpen] = useState(false)
  // null while unknown, true when the dev route answered. Unknown is rendered
  // as the deployed behaviour, so a production build never flashes a control
  // that cannot work there.
  const [liveSwitch, setLiveSwitch] = useState(null)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const timers = useRef([])

  const list = demos()

  // Asked once, when the dialog is first opened rather than on every page load.
  useEffect(() => {
    if (!open || liveSwitch !== null) return
    let cancelled = false
    fetch(apiUrl('/api/oxmaint/demo'))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setLiveSwitch(Boolean(d?.available)) })
      .catch(() => { if (!cancelled) setLiveSwitch(false) })
    return () => { cancelled = true }
  }, [open, liveSwitch])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  /**
   * Wait for the dev server to finish restarting, then reload into it.
   *
   * Reloading straight away lands on a port that is mid-restart and shows a
   * connection error, which reads as the switch having failed when it has
   * actually worked. So the page is only reloaded once the server answers
   * again.
   */
  const waitAndReload = useCallback((attempt = 0) => {
    if (attempt > 40) {
      setError('The server did not come back. It may still be rebuilding — try reloading in a moment.')
      setBusy(null)
      return
    }
    const t = setTimeout(() => {
      fetch(apiUrl('/api/oxmaint/demo'), { cache: 'no-store' })
        .then((r) => (r.ok ? window.location.reload() : waitAndReload(attempt + 1)))
        .catch(() => waitAndReload(attempt + 1))
    }, attempt === 0 ? 1200 : 600)
    timers.current.push(t)
  }, [])

  const switchTo = useCallback(async (demo) => {
    if (demo.current) return
    setError('')

    // Deployed: the other demo is another deployment, so this is a navigation.
    if (!liveSwitch) {
      if (demo.served) goToDemo(demo)
      return
    }

    setBusy(demo.key)
    try {
      const res = await fetch(apiUrl('/api/oxmaint/demo'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pack: demo.key }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok || !body?.ok) {
        setError(body?.error || 'The portal could not be switched.')
        setBusy(null)
        return
      }
      waitAndReload()
    } catch {
      setError('The portal could not be switched — the server did not answer.')
      setBusy(null)
    }
  }, [liveSwitch, waitAndReload])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={`Currently showing ${PACK_LABEL}`}
        style={styles.trigger}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f7fb' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        <Layers size={13} strokeWidth={2} style={{ flexShrink: 0, color: '#7c8798' }} />
        <span style={styles.triggerLabel}>Switch portal</span>
      </button>

      <Dialog open={open} onOpenChange={(o) => { if (!busy) setOpen(o) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Switch portal</DialogTitle>
            <DialogDescription>
              The same product, set up for a different organisation — its sites, equipment, work
              and people.
              {liveSwitch
                ? ' Choosing one loads it here; it takes a few seconds.'
                : ' Choosing one opens the portal that holds it.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {list.map((d) => {
              const working = busy === d.key
              // In dev every pack is reachable, because the server rebuilds into
              // it. Deployed, only what is actually being served.
              const disabled = Boolean(busy) || (!liveSwitch && !d.served && !d.current)
              return (
                <button
                  key={d.key}
                  disabled={disabled || d.current}
                  onClick={() => switchTo(d)}
                  className={`w-full flex items-start gap-3 rounded-lg border p-3 text-left transition ${
                    d.current
                      ? 'border-primary bg-primary/5 cursor-default'
                      : disabled
                        ? 'border-slate-200 opacity-55 cursor-not-allowed'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="mt-1 shrink-0">
                    {working ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin text-primary" />
                    ) : (
                      <span className={`block h-2.5 w-2.5 rounded-full ${d.current ? 'bg-primary' : 'bg-slate-300'}`} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{d.label}</span>
                      {d.current && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          <Check className="h-3 w-3" />
                          You are here
                        </span>
                      )}
                      {working && (
                        <span className="text-[11px] font-medium text-primary">Rebuilding…</span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">{d.subtitle}</span>
                    {!d.current && !liveSwitch && !d.served && (
                      <span className="mt-1 block text-[11px] text-slate-400">
                        Not available from here
                      </span>
                    )}
                  </span>
                  {!d.current && !liveSwitch && d.served && (
                    <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  )}
                </button>
              )
            })}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800">
              {error}
            </div>
          )}

          <p className="text-xs text-slate-400">
            Anything you create stays with the organisation you created it in.
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}

const styles = {
  trigger: {
    display: 'flex', alignItems: 'center', gap: 7, width: '100%',
    padding: '5px 4px', marginBottom: 2, borderRadius: 7,
    background: 'transparent', border: 'none', cursor: 'pointer',
    fontFamily: 'inherit', textAlign: 'left', transition: 'background .12s',
  },
  triggerLabel: {
    fontSize: 10.5, fontWeight: 600, color: '#7c8798',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
}
