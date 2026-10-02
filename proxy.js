import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

// The gates in front of the console, the staff view and the WAGA portal.
//
// `jose` rather than `jsonwebtoken` because this runs before the app: the API
// routes that *issue* these tokens run on Node and use jsonwebtoken; both sign
// and verify the same HS256 token with the same secret, so the pair is
// interchangeable.
//
// Three gates, one deliberate open space between them:
//   - The console (/admin/*) has always been closed — it is the door to whatever
//     gets added to the card list, so it was shut from the start.
//   - The staff view (/internal/*) is closed on a credential of its own. It is
//     the one gate an admin cookie does not open: see below for why.
//   - The WAGA portal (/portal/waga/*) is now closed too, because it has been
//     given to a client as their own and a client's portal is not a thing to
//     leave open. An admin signed into the console bypasses it — they reach the
//     portal through the card, not the client's password.
//   - Every other portal stays open, as before: they are illustrative demos with
//     no customer's data to wander into, so a sign-in in front of them would be
//     ceremony.

// Must match lib/adminAuth.js and lib/wagaAuth.js, which sign what this verifies.
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'oxmaint-dev-secret-change-me')

async function verify(token, ok) {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return ok(payload) ? payload : null
  } catch {
    return null
  }
}
const verifyAdmin = (t) => verify(t, (p) => p?.role === 'admin')

// Who may open /internal.
//
// Its own cookie, and not the admin's. `role === 'admin'` was never tight
// enough: a dozen accounts carry that role, and one of them —
// wagaenergy@gmail.com — is also a WAGA portal login, so an admin check alone
// would let the client open a page analysing their own usage. Gating on the
// admin cookie plus a list also meant the door was "everyone, minus a list".
//
// So /internal has its own sign-in at /internal/login, which issues a token
// saying `scope: 'internal'` and nothing else in the app looks for. The
// allowlist is checked here too, so taking an address out of INTERNAL_EMAILS
// ends the sessions already issued to it.
//
// Empty list, closed door. A misconfigured allowlist must fail shut — the
// alternative is a screen about clients being readable by a client because
// somebody forgot to set a variable.
const INTERNAL_EMAILS = new Set(
  (process.env.INTERNAL_EMAILS || '')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
)
const verifyInternal = (t) => verify(
  t,
  (p) => p?.scope === 'internal' && INTERNAL_EMAILS.has(String(p?.email || '').toLowerCase()),
)
const verifyWaga = (t) => verify(t, (p) => p?.portal === 'waga')

// The subdomain the client is given. A bare visit to it lands on the WAGA portal
// rather than the console, so the client never sees a door that is not theirs.
// An env var so a staging host can add its own without a code change.
const WAGA_HOSTS = new Set(
  (process.env.WAGA_HOSTS || 'waga.ifactoryai.com')
    .split(',').map((h) => h.trim().toLowerCase()).filter(Boolean),
)

// A redirect that stays inside the build's base path.
//
// `new URL('/portal/waga/login', request.url)` throws the base path away. On the
// build mounted at /hospital that sent a signed-out visitor from
// /hospital/portal/waga to /portal/waga/login — a path that build does not
// serve — so the WAGA sign-in was a 404 from its own front door.
// `request.nextUrl` carries the base path, and the pathname it exposes here is
// already the one without it; changing only that pathname keeps the prefix.
const to = (request, pathname) => {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''
  return url
}

export default async function proxy(request) {
  const { pathname } = request.nextUrl
  const host = (request.headers.get('host') || '').split(':')[0].toLowerCase()
  const admin = await verifyAdmin(request.cookies.get('admin_token')?.value)

  // The WAGA subdomain's front page is the portal, not the console. Only the two
  // roots are redirected — deeper paths are served as asked so a shared link to
  // a specific screen still lands where it points.
  if (WAGA_HOSTS.has(host) && (pathname === '/' || pathname === '/admin')) {
    return NextResponse.redirect(to(request, '/portal/waga'))
  }

  // ── the console ──────────────────────────────────────────────────────────
  if (pathname === '/admin') {
    if (admin) return NextResponse.redirect(to(request, '/admin/portals'))
    return NextResponse.next()
  }
  if (pathname.startsWith('/admin/')) {
    if (!admin) return NextResponse.redirect(to(request, '/admin'))
    return NextResponse.next()
  }

  // ── the staff view ───────────────────────────────────────────────────────
  //
  // /internal answers questions about a client's behaviour — when they signed
  // in, what they have been updating — so it takes its own credential. An admin
  // cookie does not open it and this cookie opens nothing else.
  //
  // The sign-in page is the one path here that opens without one; somebody
  // already through is sent past it rather than shown a form asking again.
  if (pathname === '/internal/login') {
    if (await verifyInternal(request.cookies.get('internal_token')?.value)) {
      return NextResponse.redirect(to(request, '/internal'))
    }
    return NextResponse.next()
  }
  if (pathname === '/internal' || pathname.startsWith('/internal/')) {
    if (!await verifyInternal(request.cookies.get('internal_token')?.value)) {
      // Sent to the staff sign-in rather than 404'd: whoever lands here without
      // a cookie is almost always staff whose twelve hours ran out, and a 404
      // would have them wondering whether the page still exists.
      const url = to(request, '/internal/login')
      // Back where they were headed once they are in.
      if (pathname !== '/internal') url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // ── the WAGA portal ──────────────────────────────────────────────────────
  // The sign-in page is always reachable; someone already through the gate is
  // sent past it rather than shown a form asking again.
  if (pathname === '/portal/waga/login') {
    const waga = await verifyWaga(request.cookies.get('waga_token')?.value)
    if (admin || waga) return NextResponse.redirect(to(request, '/portal/waga/overview'))
    return NextResponse.next()
  }
  if (pathname === '/portal/waga' || pathname.startsWith('/portal/waga/')) {
    if (admin) return NextResponse.next()
    const waga = await verifyWaga(request.cookies.get('waga_token')?.value)
    if (!waga) {
      const url = to(request, '/portal/waga/login')
      // Send them back where they were headed once they are in.
      if (pathname !== '/portal/waga') url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/', '/admin', '/admin/:path*',
    '/internal', '/internal/:path*',
    '/portal/waga', '/portal/waga/:path*',
  ],
}
