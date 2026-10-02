// Sign out of the staff screen.
//
// The cookie is httpOnly, so the page cannot clear it itself — it has to be
// expired by the server that set it. POST rather than GET: a link somebody
// prefetches should not sign them out.

import { NextResponse } from 'next/server'
import { INTERNAL_COOKIE } from '@/lib/internalAuth'

export const runtime = 'nodejs'

export async function POST() {
  const response = NextResponse.json({ message: 'Signed out' })
  // Same attributes it was set with, or the browser keeps the original.
  response.cookies.set(INTERNAL_COOKIE, '', {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE
      ? process.env.COOKIE_SECURE === 'true'
      : process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  })
  return response
}
