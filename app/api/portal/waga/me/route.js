import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import User from '@/lib/models/User'
import { verifyWagaToken } from '@/lib/wagaAuth'

// Who is signed in — for the header profile and the getting-started greeting.
// The identity comes from the cookie the login set, looked up fresh so the name,
// role and department are the account's own, never taken from the request.
export async function GET(request) {
  try {
    const token = request.cookies.get('waga_token')?.value
    const decoded = token ? verifyWagaToken(token) : null
    if (!decoded?.email) {
      return NextResponse.json({ message: 'Not signed in' }, { status: 401 })
    }
    await dbConnect()
    const u = await User.findOne({ email: decoded.email }).lean()
    if (!u) return NextResponse.json({ message: 'Account not found' }, { status: 404 })
    return NextResponse.json({
      email: u.email,
      name: u.name || '',
      role: u.role || 'member',
      isAdmin: u.role === 'admin',
      department: u.department || '',
      companyName: u.companyName || '',
    })
  } catch (err) {
    console.error(`[waga-me] ${err.message}`)
    return NextResponse.json({ message: 'Server error' }, { status: 500 })
  }
}
