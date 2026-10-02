import { NextResponse } from 'next/server'

// Sign out of the WAGA portal.
//
// Clears the client's cookie and says where to send them next. An admin viewing
// the portal through the console never had a waga_token — clearing it is a
// no-op — so they are sent back to the console rather than to a sign-in they do
// not use; a client is sent to the portal's own sign-in.
export async function POST(request) {
  const isAdmin = Boolean(request.cookies.get('admin_token')?.value)
  const response = NextResponse.json({
    redirectTo: isAdmin ? '/admin/portals' : '/portal/waga/login',
  })
  response.cookies.set('waga_token', '', {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
  return response
}
