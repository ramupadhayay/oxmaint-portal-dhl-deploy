import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import User from '@/lib/models/User'
import { generateWagaToken } from '@/lib/wagaAuth'

// WAGA portal sign-in — the client's own door to their portal.
//
// Checked against the same User documents the admin console uses, so the portal
// has no second account store of its own. What separates a WAGA client from an
// admin is not the password check but what the account is allowed to open: an
// account may sign in here only if its `portals` array contains 'waga'. An admin
// does not sign in here at all — they reach the portal through the console, and
// proxy.js lets a valid admin cookie through this gate.
//
// Per-user accounts, as chosen: each person is their own User row, so a login is
// attributable and revoking one person is deleting one row — not rotating a
// shared password out from under everyone still using it.

export async function POST(request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ message: 'Email and password are required' }, { status: 400 })
    }

    await dbConnect()

    const normalised = email.trim().toLowerCase()
    // altPasswords is select:false on the schema, and comparePassword checks it.
    const user = await User.findOne({ email: normalised }).select('+altPasswords')

    // One message for every failure below. Telling an unauthenticated caller
    // which of "no such account", "no access to this portal" and "wrong
    // password" they hit is how an account list gets enumerated.
    const reject = () => NextResponse.json({ message: 'Invalid credentials' }, { status: 401 })

    if (!user) return reject()
    if (!Array.isArray(user.portals) || !user.portals.includes('waga')) return reject()
    if (!(await user.comparePassword(password))) return reject()

    const token = generateWagaToken(user.email)

    // Best-effort: a failed stats write must not fail the login.
    //
    // `loginCount` and `lastLoginAt` answer "how often" and "when last". They
    // cannot answer "which days", and that is the question /internal is for —
    // whether the client opens the portal on an ordinary Tuesday. So each
    // sign-in is also appended to `loginHistory`, which the User schema has
    // always carried and nothing has ever written to.
    //
    // Capped at 200. A login row is worth keeping for a trial's lifetime, not
    // forever, and an unbounded array on a document is how a document grows
    // until it cannot be saved.
    try {
      const at = new Date()
      user.loginCount = (user.loginCount || 0) + 1
      user.lastLoginAt = at
      const history = Array.isArray(user.loginHistory) ? user.loginHistory : []
      history.push({
        timestamp: at,
        ip: request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '',
        userAgent: (request.headers.get('user-agent') || '').slice(0, 200),
      })
      user.loginHistory = history.slice(-200)
      await user.save()
    } catch { /* signed in regardless */ }

    const response = NextResponse.json({ message: 'Signed in', email: user.email, name: user.name })
    const cookieSecure = process.env.COOKIE_SECURE
      ? process.env.COOKIE_SECURE === 'true'
      : process.env.NODE_ENV === 'production'

    response.cookies.set('waga_token', token, {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600,
      path: '/',
    })
    return response
  } catch (err) {
    console.error(`[waga-login] ${err.message}`)
    return NextResponse.json({ message: 'Server error' }, { status: 500 })
  }
}
