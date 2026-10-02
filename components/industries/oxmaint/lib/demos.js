'use client'

// Which demos exist, and where each one is served from.
//
// A pack is fixed when the bundle is built: eighty-seven files read the plant
// from module scope, and module scope has no URL and no cookie. So switching
// demos is not a state change — it is a navigation to a differently-built copy
// of the same app, each mounted on its own path.
//
// That is what `basePath` is for, and it is why the switcher reloads rather than
// re-rendering. The alternative was making the whole data layer per-request,
// which is a real piece of work and buys nothing a reload does not.
//
// WHERE THE PATHS COME FROM. `NEXT_PUBLIC_OX_DEMOS` can carry the whole list as
// JSON for a deployment that serves a different set. Without it the defaults
// below apply, and each entry's `base` is the basePath its build was made with.
// A portal whose build is not being served is still listed — disabled, with the
// command that serves it — because a switcher that silently hides the other
// demos is a switcher that looks broken to the one person who knows they exist.

import { PACK_KEY } from './data'

const DEFAULTS = [
  {
    key: 'hospital-fls',
    base: '/hospital',
    label: 'Riverside Regional Medical Center',
    subtitle: 'Hospital fire & life safety — NFPA testing and survey readiness',
  },
  {
    key: 'dhl-gse',
    base: '/dhl',
    label: 'DHL Express',
    subtitle: 'Ground support equipment — 168 units across five stations',
  },
  {
    key: 'chiller',
    base: '',
    label: 'AbbVie',
    subtitle: 'Chiller AI — refrigerant leak detection and efficiency drift',
  },
  {
    key: 'hospitality',
    base: '/hotel',
    label: 'Residence Inn Dover',
    subtitle: 'Extended-stay hotel engineering — 98 suites',
  },
  {
    key: 'tyre-plant',
    base: '/tyre',
    label: 'Meridian Tyre Works',
    subtitle: 'Radial tyre plant — RCM across mixing, curing and utilities',
  },
  {
    key: 'generic',
    base: '/generic',
    label: 'Generic manufacturing',
    subtitle: 'No industry framing — the product as it ships',
  },
]

function parseConfigured() {
  const raw = process.env.NEXT_PUBLIC_OX_DEMOS
  if (!raw) return null
  try {
    const list = JSON.parse(raw)
    return Array.isArray(list) && list.length ? list : null
  } catch {
    // A malformed list must not take the switcher down with it. The defaults
    // are always a correct answer; a half-parsed one is not.
    return null
  }
}

/** The demo this bundle *is*. */
export const CURRENT_KEY = PACK_KEY

/**
 * Every demo, with where to go and whether it can be reached.
 *
 * `served` is what this deployment claims to be serving, not what is actually
 * up — nothing here can probe another origin. The current demo is always
 * served, because you are looking at it.
 */
export function demos() {
  const list = parseConfigured() || DEFAULTS
  const servedBases = new Set(
    String(process.env.NEXT_PUBLIC_OX_DEMOS_SERVED || '')
      .split(',').map((s) => s.trim()).filter(Boolean),
  )
  return list.map((d) => {
    const current = d.key === CURRENT_KEY
    return {
      ...d,
      current,
      // With nothing configured, only the demo you are in is known to be
      // served. Saying so is better than offering three links that 404.
      served: current || servedBases.has(d.key) || servedBases.has(d.base || '/'),
      href: `${d.base || ''}/portal/oxmaint`,
    }
  })
}

/**
 * Go to another demo.
 *
 * A full document load, deliberately. The point of the switch is that the whole
 * bundle is rebuilt around a different pack — a client-side route change would
 * keep this bundle's plant and change only the address, which is the one
 * outcome worse than not switching at all.
 */
export function goToDemo(demo) {
  if (typeof window === 'undefined' || !demo?.href) return
  window.location.assign(demo.href)
}
