import { NextResponse } from 'next/server'

// Clearing the cookie is the whole of signing out here.
//
// The platform build also revoked the session row it wrote at login, so its
// staff console would stop listing the session as live. This app writes no such
// row, so there is nothing to revoke.
export async function POST() {
  const response = NextResponse.json({ message: 'Admin logged out' })
  response.cookies.set('admin_token', '', { maxAge: 0, path: '/' })
  // A from_ifactory marker was cleared here too, back when the way-back link
  // depended on one. The link is shown to everyone now, so nothing sets that
  // cookie and there is nothing left to clear.
  return response
}
