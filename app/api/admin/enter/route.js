import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { generateAdminToken } from '@/lib/adminAuth'

// Entry from the iFactory console, so its Oxmaint card opens this console
// instead of stopping at the sign-in form.
//
// It takes a signed ticket rather than trusting where the request says it came
// from. A Referer header, or a `?from=ifactory` flag, is something any visitor
// can set by hand — the gate would be open to everyone and only look closed.
// A ticket signed with a secret the two deployments share is the difference
// between "arrived from the console" and "claims to have".
//
// The secret is not the one that signs admin cookies here. That one never
// leaves this app; this one is shared with another deployment, and giving it a
// separate name means rotating it does not sign every live session out.
//
// Fails closed and quietly: anything wrong with the ticket lands on /admin, the
// ordinary sign-in. A visitor who was entitled to enter types a password; one
// who was not sees the same page they would have seen anyway, and no error
// message tells them which part they got wrong.
//
// Tickets are good for two minutes. They are made at the moment somebody clicks
// and spent on the next request, so the window only has to cover the redirect —
// long enough to survive a slow hop, too short to be worth keeping out of a
// browser history or a proxy log.

const SSO_SECRET = process.env.IFACTORY_SSO_SECRET

// Redirects have to carry the PUBLIC origin, not the one this process sees.
//
// The app listens on localhost behind a tunnel, so `request.url` in a route
// handler is http://localhost:3000/… — and a redirect built from it sends the
// visitor's own browser to their own machine, where nothing is listening. The
// ticket verifies, the cookie is set, and the click still dead-ends.
//
// proxy.js gets this right from the same expression because middleware runs at
// the edge, where Next has already resolved the public URL. That is why the
// root redirect landed on the real host while this one landed on localhost:
// same code, different runtime, different answer.
//
// It only breaks in production. On a developer's machine localhost:3000 IS the
// right answer, so the fault is invisible exactly where it would be caught.
//
// PUBLIC_ORIGIN wins when set; otherwise fall back to nextUrl.origin, which
// honours x-forwarded-host when the proxy in front of us forwards it.
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN
const originOf = (request) => PUBLIC_ORIGIN || request.nextUrl.origin

export async function GET(request) {
  const signIn = NextResponse.redirect(new URL('/admin', originOf(request)))

  const ticket = request.nextUrl.searchParams.get('t')
  if (!SSO_SECRET || !ticket) return signIn

  let claims
  try {
    claims = jwt.verify(ticket, SSO_SECRET, { issuer: 'ifactory', maxAge: '2m' })
  } catch {
    return signIn
  }

  const response = NextResponse.redirect(new URL('/admin/portals', originOf(request)))

  // Same cookie the password form issues, on the same terms — from here on the
  // session is an ordinary one, and proxy.js cannot tell the two apart.
  const cookieSecure = process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production'

  response.cookies.set('admin_token', generateAdminToken(claims.email || 'ifactory-console'), {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: 'lax',
    maxAge: 7 * 24 * 3600,
    path: '/',
  })
  return response
}
