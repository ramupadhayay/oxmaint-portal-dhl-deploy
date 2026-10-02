// The staff door. Only an allowlisted address gets through it.
//
// This is not the admin login with an extra check bolted on. The order of the
// checks is the point: the allowlist is tested first, so an address nobody
// cleared is refused before its password is ever compared. An admin credential,
// a client's credential, a portal user's credential — none of them open this,
// and none of them are told why.
//
// Note what is NOT required: role. /internal is gated on this cookie alone, so
// the account behind it does not need to be an admin and is better off not
// being one — an internal account has no business in the console or in a
// client's portal. The allowlist is the authority here, and it lives in the
// environment so clearing somebody does not need a deploy.

import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import User from '@/lib/models/User'
import {
  INTERNAL_COOKIE, INTERNAL_TTL_SECONDS,
  generateInternalToken, isInternalEmail,
} from '@/lib/internalAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// A small brake on guessing, held in the process rather than in the database.
//
// It is per-process and it is lost on restart, and both are acceptable: this
// door has a handful of legitimate users, so anything that slows a script down
// is enough, and a shared store for it would be infrastructure to maintain for
// a screen three people open. PM2 runs one process here; behind several, each
// would keep its own count — still a brake, just a looser one.
const FAILURES = new Map()
const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES = 8

const clientIp = (request) => request.headers.get('x-forwarded-for')?.split(',')[0].trim()
  || request.headers.get('x-real-ip')
  || 'unknown'

function tooManyTries(ip) {
  const row = FAILURES.get(ip)
  if (!row) return false
  if (Date.now() - row.first > WINDOW_MS) { FAILURES.delete(ip); return false }
  return row.n >= MAX_FAILURES
}

function noteFailure(ip) {
  const row = FAILURES.get(ip)
  if (!row || Date.now() - row.first > WINDOW_MS) FAILURES.set(ip, { n: 1, first: Date.now() })
  else row.n += 1
  // Housekeeping, so a long-running process does not accumulate a row per
  // address that ever mistyped a password.
  if (FAILURES.size > 500) {
    for (const [k, r] of FAILURES) if (Date.now() - r.first > WINDOW_MS) FAILURES.delete(k)
  }
}

export async function POST(request) {
  const ip = clientIp(request)

  try {
    if (tooManyTries(ip)) {
      return NextResponse.json(
        { message: 'Too many attempts. Try again in a few minutes.' },
        { status: 429 },
      )
    }

    const { email, password } = await request.json()
    if (!email || !password) {
      return NextResponse.json({ message: 'Email and password are required' }, { status: 400 })
    }

    // One message for every failure below, and the same delay behind it.
    // Telling an unauthenticated caller which of "not cleared", "no such
    // account" and "wrong password" they hit is how a list gets enumerated —
    // and here the list is the names of our own staff.
    const reject = () => {
      noteFailure(ip)
      return NextResponse.json({ message: 'Not an internal account.' }, { status: 401 })
    }

    const normalised = String(email).trim().toLowerCase()

    // The allowlist first, before the database is even asked. An address that
    // is not cleared never reaches a password comparison.
    if (!isInternalEmail(normalised)) return reject()

    await dbConnect()
    // altPasswords is select:false on the schema, and comparePassword checks it.
    const user = await User.findOne({ email: normalised }).select('+altPasswords')
    if (!user) return reject()
    if (!(await user.comparePassword(password))) return reject()

    FAILURES.delete(ip)

    // Best-effort: a failed stats write must not fail the sign-in.
    try {
      user.loginCount = (user.loginCount || 0) + 1
      user.lastLoginAt = new Date()
      await user.save()
    } catch { /* signed in regardless */ }

    const response = NextResponse.json({ message: 'Signed in', email: user.email, name: user.name })
    const cookieSecure = process.env.COOKIE_SECURE
      ? process.env.COOKIE_SECURE === 'true'
      : process.env.NODE_ENV === 'production'

    response.cookies.set(INTERNAL_COOKIE, generateInternalToken(user.email), {
      httpOnly: true,
      secure: cookieSecure,
      // 'strict' rather than 'lax': nothing links into /internal from anywhere
      // else, so there is no cross-site navigation that needs the cookie sent.
      sameSite: 'strict',
      maxAge: INTERNAL_TTL_SECONDS,
      path: '/',
    })
    return response
  } catch (err) {
    console.error(`[internal-login] ${err.message}`)
    return NextResponse.json({ message: 'Server error' }, { status: 500 })
  }
}
