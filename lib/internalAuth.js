import jwt from 'jsonwebtoken'

// The credential that opens /internal — its own, deliberately not the admin's.
//
// /internal used to ride on `admin_token`: sign in at the console, and the
// allowlist decided whether the staff screen opened. That worked and was still
// wrong in two ways. Every admin was handed a cookie that /internal had to then
// refuse, so the door was "everyone, minus a list" rather than "a list". And
// the screen reports on a client whose own login also carries role=admin, which
// meant the thing standing between a client and a page about their own
// behaviour was one environment variable.
//
// So this is a separate token with a separate cookie and a separate sign-in
// page. An admin cookie no longer opens /internal, and this cookie opens
// nothing else — it is not a role, it says `scope: 'internal'` and nothing in
// the app checks for that but the staff screen.
//
// proxy.js verifies these on the edge runtime with `jose` and must resolve the
// same secret and make the same two checks. Change one, change both.

const JWT_SECRET = process.env.JWT_SECRET || 'oxmaint-dev-secret-change-me'

export const INTERNAL_COOKIE = 'internal_token'

// Twelve hours, not the admin cookie's seven days. This is a reporting screen
// somebody opens for a few minutes; a week-long cookie for it is a week-long
// cookie to lose.
export const INTERNAL_TTL_SECONDS = 12 * 3600

/**
 * Who is cleared for internal reporting.
 *
 * Configuration rather than code, so adding somebody does not need a deploy.
 * Read on every call rather than captured at import: a module-level snapshot
 * would keep serving a list the environment no longer has.
 *
 * Empty list, closed door. A misconfigured allowlist must fail shut — the
 * alternative is a screen about clients being readable because somebody forgot
 * to set a variable.
 */
export const internalEmails = () => new Set(
  (process.env.INTERNAL_EMAILS || '')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
)

export const isInternalEmail = (email) => internalEmails().has(String(email || '').trim().toLowerCase())

export function generateInternalToken(email) {
  return jwt.sign(
    { email: String(email).trim().toLowerCase(), scope: 'internal' },
    JWT_SECRET,
    { expiresIn: INTERNAL_TTL_SECONDS },
  )
}

/**
 * A valid internal cookie, or null.
 *
 * The allowlist is checked here as well as at sign-in, so taking an address out
 * of INTERNAL_EMAILS ends the sessions it has already issued. Checking only at
 * the door would leave a revoked person signed in for twelve hours.
 */
export function verifyInternalToken(token) {
  if (!token) return null
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    if (decoded?.scope !== 'internal') return null
    if (!isInternalEmail(decoded.email)) return null
    return decoded
  } catch {
    return null
  }
}
