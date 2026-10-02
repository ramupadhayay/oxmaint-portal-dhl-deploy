// Where this build's API actually lives.
//
// A demo served on a sub-path — `BASE_PATH=/hospital` — mounts every page and
// route handler under it, so the records API is at `/hospital/api/oxmaint/...`.
// `next/link` and the router learn that from the config. `fetch` does not: a
// literal `fetch('/api/oxmaint/records')` resolves against the domain root, and
// the root is a different build.
//
// So the hospital portal's browser tab was reading and writing the chiller
// deployment's records. It showed as a 409 on every save — the pack guard
// catching a hospital-fls tab talking to a chiller server — and before that
// guard existed it was silent: a DHL tab overwrote AbbVie's ast_0001. The tabs
// were never wrong about which organisation they were. They were asking the
// wrong server.
//
// `NEXT_PUBLIC_BASE_PATH` is set from the same BASE_PATH the config reads
// (next.config.js), so the two halves cannot disagree. Empty for a root build,
// which leaves every URL exactly as it was.

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ''

/**
 * An absolute path to this build's own API.
 *
 * Takes a root-relative path and returns it under the deployment's base path.
 * Use it for every `fetch` of an internal route; anything already absolute
 * (another origin) is returned untouched.
 */
export function apiUrl(path) {
  if (!path || /^[a-z]+:\/\//i.test(path)) return path
  if (!BASE_PATH) return path
  return `${BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * A file in /public, as this build has to ask for it.
 *
 * Same problem as the API, one layer down. A sub-path build serves its public
 * folder under the base path, so `/oxmaint/logo-wb.png` is the root
 * deployment's file — a different application, and on a box that serves only
 * the sub-path, nothing at all.
 *
 * `next/image` does not fix this either. Its optimiser fetches the file from
 * its own origin using the `src` it was given, so a root-relative src came back
 * 400 "not a valid image" and every logo in the hospital build was a broken
 * icon. Leave data: and blob: URLs, and an uploaded logo's absolute URL, alone.
 */
export function assetPath(path) {
  if (!path || typeof path !== 'string') return path
  if (/^([a-z]+:|\/\/)/i.test(path)) return path
  if (!BASE_PATH) return path
  return `${BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`
}

export default apiUrl
