import { NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/adminAuth'

// GET /api/cmms/status — may this visitor be offered the CMMS link?
//
// The card needs to know whether the person looking at it is a console admin,
// and the admin cookie is httpOnly, so the browser cannot read it. This answers
// the one bit the card needs and nothing else — no email, no token, nothing
// that would be worth stealing.
//
// It is not a permission check. /api/cmms/enter checks again before minting,
// because anything decided in the browser is a suggestion.

export async function GET(request) {
  const admin = verifyAdminToken(request.cookies.get('admin_token')?.value)
  return NextResponse.json(
    {
      available: Boolean(admin) && (process.env.SSO_SHARED_SECRET || '').length >= 32,
      signedIn: Boolean(admin),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
