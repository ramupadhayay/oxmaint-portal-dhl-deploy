import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import User from '@/lib/models/User'
import { generateAdminToken } from '@/lib/adminAuth'

// Admin sign-in — checked against User documents whose role is 'admin'.
//
// The accounts are not configured here and there is no admin password in the
// environment: they live in MongoDB beside the portal's own records. Access is
// therefore whatever the portal's own database already grants — an admin who
// can sign in to the portal signs in here with the same credentials, and
// revoking the account revokes both. An env-var password would have been less
// code and a second source of truth.
//
// The build this came from also wrote a session row per login so a staff
// console could list and kill live sessions. That console is not part of this
// app, so the row is not written — nothing here would ever read it.

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

    // One message for all three failures below. Telling an unauthenticated
    // caller which of "no such account", "not an admin" and "wrong password"
    // they hit is how an account list gets enumerated.
    const reject = () => NextResponse.json({ message: 'Invalid admin credentials' }, { status: 401 })

    if (!user) return reject()
    if (!user.role || user.role.toLowerCase() !== 'admin') return reject()
    if (!(await user.comparePassword(password))) return reject()

    const token = generateAdminToken(user.email)

    // Best-effort: a failed stats write must not fail the login.
    try {
      user.loginCount = (user.loginCount || 0) + 1
      user.lastLoginAt = new Date()
      await user.save()
    } catch { /* signed in regardless */ }

    const response = NextResponse.json({ message: 'Admin login successful', email: user.email })
    const cookieSecure = process.env.COOKIE_SECURE
      ? process.env.COOKIE_SECURE === 'true'
      : process.env.NODE_ENV === 'production'

    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600,
      path: '/',
    })
    return response
  } catch (err) {
    console.error(`[admin-login] ${err.message}`)
    return NextResponse.json({ message: 'Server error' }, { status: 500 })
  }
}
