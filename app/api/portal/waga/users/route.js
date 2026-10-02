import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import User from '@/lib/models/User'
import { verifyWagaToken } from '@/lib/wagaAuth'
import { MIN_PASSWORD_LENGTH, suggestPassword } from '@/lib/wagaPassword'

// The WAGA team directory, for the Team screen — read it, and issue a login.
//
// GET returns every account with 'waga' access, with its role and login status.
// The plaintext password is added ONLY when the signed-in caller is themselves a
// WAGA admin (role:'admin') — proven by looking their own account up from the
// cookie, never taken from the request. A member calling this gets the same list
// without a single password on it.
//
// POST issues the login. The Team screen used to add a person to the roster and
// say a credential would arrive "in a separate step" — and there was no step:
// nothing in the portal could create one, so a person added by the client sat as
// "Login pending" forever. The admin who is told they issue credentials now
// actually can.
//
// Both handlers prove admin the same way, and neither trusts anything in the
// request to say who the caller is.

/** The caller's own account, from the cookie alone. */
async function whoami(request) {
  const token = request.cookies.get('waga_token')?.value
  const decoded = token ? verifyWagaToken(token) : null
  if (!decoded?.email) return null
  return User.findOne({ email: decoded.email }).lean()
}

export async function GET(request) {
  try {
    const token = request.cookies.get('waga_token')?.value
    const decoded = token ? verifyWagaToken(token) : null
    if (!decoded?.email) {
      return NextResponse.json({ message: 'Not signed in' }, { status: 401 })
    }

    await dbConnect()

    const me = await User.findOne({ email: decoded.email }).lean()
    const isAdmin = me?.role === 'admin'

    const query = User.find({ portals: 'waga' }).sort({ role: -1, name: 1 })
    if (isAdmin) query.select('+visiblePassword')
    const users = await query.lean()

    return NextResponse.json({
      isAdmin,
      me: { email: me?.email || decoded.email, name: me?.name || '', role: me?.role || 'member' },
      users: users.map((u) => ({
        email: u.email,
        name: u.name || '',
        department: u.department || '',
        role: u.role || 'member',
        hasLogin: Array.isArray(u.portals) && u.portals.includes('waga'),
        loginCount: u.loginCount || 0,
        lastLoginAt: u.lastLoginAt || null,
        ...(isAdmin ? { password: u.visiblePassword || '' } : {}),
      })),
    })
  } catch (err) {
    console.error(`[waga-users] ${err.message}`)
    return NextResponse.json({ message: 'Server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await dbConnect()

    const me = await whoami(request)
    if (!me) return NextResponse.json({ message: 'Not signed in' }, { status: 401 })
    // Issuing a credential is an administrator's act. A member may add a person
    // to the roster; only the admin the screen names can give them a way in.
    if (me.role !== 'admin') {
      return NextResponse.json({ message: 'Only the WAGA administrator can issue a login.' }, { status: 403 })
    }

    const body = await request.json()
    const { name, email, department } = body
    const cleanEmail = String(email || '').trim().toLowerCase()
    const cleanName = String(name || '').trim()
    if (!cleanName || !cleanEmail) {
      return NextResponse.json({ message: 'A name and a work email are required.' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json({ message: 'That does not look like an email address.' }, { status: 400 })
    }

    // The admin may choose the password — the Add form shows a suggestion and
    // lets them replace it, so what they saw on screen is what gets stored.
    // Generated here only when they sent none, which keeps the roster's own
    // "Issue login" button working without a form behind it.
    const chosen = String(body.password || '').trim()
    if (chosen && chosen.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { message: `A password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
        { status: 400 },
      )
    }
    const password = chosen || suggestPassword(cleanName, cleanEmail)
    const existing = await User.findOne({ email: cleanEmail })

    if (existing) {
      // Already has portal access: say so and change nothing. Re-issuing would
      // rotate a password out from under somebody who is using it, and the
      // screen can already show the admin what it is.
      if (Array.isArray(existing.portals) && existing.portals.includes('waga')) {
        return NextResponse.json(
          { message: 'That person already has a login. Their password is on the roster.' },
          { status: 409 },
        )
      }
      // An account that exists for another portal keeps its own password —
      // granting access must not reset a credential they already use elsewhere.
      existing.portals = [...(existing.portals || []), 'waga']
      if (department) existing.department = String(department).trim()
      await existing.save()
      return NextResponse.json({
        message: 'Portal access granted to an existing account — their own password is unchanged.',
        email: existing.email,
        name: existing.name,
        password: '',
        granted: true,
      })
    }

    // `password` is hashed by the model's pre-save hook. `visiblePassword` is
    // the plaintext the admin reads back later — select:false, and a deliberate
    // convenience for this trial rather than a practice to copy.
    const created = await User.create({
      name: cleanName,
      email: cleanEmail,
      password,
      visiblePassword: password,
      // Matching the rows the client was handed, so the roster stays uniform.
      companyName: 'WAGA Energy',
      countryCode: '+1',
      mobile: '0000000000',
      role: 'member',
      department: String(department || '').trim(),
      portals: ['waga'],
    })

    return NextResponse.json({
      message: 'Login issued.',
      email: created.email,
      name: created.name,
      password,
      created: true,
    })
  } catch (err) {
    // A duplicate key here means two admins issued the same person at once.
    if (err?.code === 11000) {
      return NextResponse.json({ message: 'That email already has an account.' }, { status: 409 })
    }
    console.error(`[waga-users] ${err.message}`)
    return NextResponse.json({ message: 'Server error' }, { status: 500 })
  }
}

// Change your own password.
//
// Your OWN, and there is no parameter that says whose: the account comes from
// the cookie, so this handler cannot be pointed at somebody else no matter what
// is sent to it. An admin who needs to help someone does not need this — they
// can already read the password on the roster.
//
// The current password is required even though the cookie already proves who
// the caller is. The session is not the same claim as the credential, and
// asking for it is what stops a borrowed unlocked laptop from becoming a
// changed password.
//
// `visiblePassword` is updated alongside the hash, which is the whole point of
// the request this implements: the admin's roster must show what the password
// IS, not what it was when it was issued. It is the same deliberate trade the
// field already carried — a plaintext copy for a trial the client asked to be
// able to administer themselves — and letting it drift out of date would leave
// the screen confidently wrong, which is worse than the trade.
export async function PATCH(request) {
  try {
    await dbConnect()

    const token = request.cookies.get('waga_token')?.value
    const decoded = token ? verifyWagaToken(token) : null
    if (!decoded?.email) return NextResponse.json({ message: 'Not signed in' }, { status: 401 })

    // Not .lean(): this one is saved, and it needs the model's own
    // comparePassword and its pre-save hashing.
    const me = await User.findOne({ email: decoded.email }).select('+altPasswords')
    if (!me) return NextResponse.json({ message: 'Not signed in' }, { status: 401 })

    const { currentPassword, newPassword } = await request.json()
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ message: 'Both the current and the new password are required.' }, { status: 400 })
    }
    // The schema's own minimum. A stricter rule here would reject a password the
    // database would have accepted, which is a difference nobody can see.
    if (String(newPassword).length < 6) {
      return NextResponse.json({ message: 'The new password must be at least six characters.' }, { status: 400 })
    }
    if (String(newPassword) === String(currentPassword)) {
      return NextResponse.json({ message: 'That is the password you already have.' }, { status: 400 })
    }
    if (!(await me.comparePassword(currentPassword))) {
      return NextResponse.json({ message: 'That current password is not right.' }, { status: 401 })
    }

    me.password = String(newPassword)
    me.visiblePassword = String(newPassword)
    // The alternates existed so a shared demo credential could be rotated
    // without cutting anybody off. A person who has just chosen their own
    // password is not sharing it, and leaving the old ones live would mean the
    // password they replaced still works.
    me.altPasswords = []
    await me.save()

    return NextResponse.json({ message: 'Password changed. Use it next time you sign in.' })
  } catch (err) {
    console.error(`[waga-users] ${err.message}`)
    return NextResponse.json({ message: 'Server error' }, { status: 500 })
  }
}
