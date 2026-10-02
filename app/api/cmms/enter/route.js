import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import { verifyAdminToken } from '@/lib/adminAuth'

// GET /api/cmms/enter — hand the signed-in console admin over to the CMMS.
//
// The portal and the CMMS are separate deployments with separate sessions, so
// being signed in here means nothing there. This mints a 60-second, single-use,
// signed ticket and redirects; the CMMS verifies it, spends it, and issues its
// own session. Nobody types a second password.
//
// The gate is the ADMIN cookie, not the page the card sits on. /portal/oxmaint
// is not in proxy.js's matcher — it answers 200 with no cookie at all, unlike
// /portal/waga which redirects to a login. So minting on "you reached the
// dashboard" would hand CMMS admin to anyone who opened the URL. The card is
// only shown to an admin, and this route checks again, because a hidden button
// is not a permission.
//
// The secret is read here and never leaves the server. A ticket minted in the
// browser would mean shipping the key to everyone who loads the page.

const SSO_SECRET = process.env.SSO_SHARED_SECRET || ''
const CMMS_URL = process.env.CMMS_URL || 'https://cmms.ifactoryai.com'

// Customer organisations on the shared CMMS, each entered from its own card as
// that organisation's own admin account. A fixed server-side list: the account
// to sign in as is never read from the URL, or any console admin could mint a
// ticket for any CMMS user by editing one parameter. Without ?org the console
// admin enters as themselves, as the Oxmaint Vanilla card always has.
const ORG_ACCOUNTS = {
  canary: { email: 'admin@canary.systems', name: 'Canary Systems Admin' },
}

// This portal's public address. Behind the router, request.url is the
// container's own http://localhost:3000, so building links from it sent a
// signed-out admin to a localhost page that does not exist in their browser.
function portalOrigin(request) {
  const configured = (process.env.PORTAL_PUBLIC_URL || '').trim()
  if (configured) return new URL(configured).origin
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  return host ? `${proto}://${host}` : new URL(request.url).origin
}

// Where sign-out sends them back to. Carried inside the signed ticket — the CMMS
// only honours a return address it can verify came from here.
const portalReturnUrl = (request) => `${portalOrigin(request)}/admin/portals`

export async function GET(request) {
  const orgKey = request.nextUrl.searchParams.get('org')
  const account = orgKey ? ORG_ACCOUNTS[orgKey] : null
  if (orgKey && !account) {
    return NextResponse.json({ error: 'Unknown organisation' }, { status: 404 })
  }

  const admin = verifyAdminToken(request.cookies.get('admin_token')?.value)
  if (!admin) {
    // Sent to the console sign-in rather than 403'd: whoever clicks this is
    // staff whose session ran out, and `next` brings them back to the link.
    const url = new URL('/admin', portalOrigin(request))
    url.searchParams.set('next', orgKey ? `/api/cmms/enter?org=${orgKey}` : '/api/cmms/enter')
    return NextResponse.redirect(url)
  }

  // No default. A shared fallback secret is the same as no secret — anyone who
  // has read the repository could mint a ticket.
  if (SSO_SECRET.length < 32) {
    return NextResponse.json(
      { error: 'SSO_SHARED_SECRET is not set on this server (needs 32+ characters)' },
      { status: 503 },
    )
  }

  const adminEmail = String(admin.email || '').toLowerCase()
  const ticket = jwt.sign(
    {
      email: account ? account.email : adminEmail,
      name: account ? account.name : admin.name || 'Oxmaint Console',
      // Who really clicked. When the ticket signs in as an organisation's admin,
      // the CMMS log would otherwise show only that account.
      actor: adminEmail,
      return_url: portalReturnUrl(request),
    },
    SSO_SECRET,
    {
      algorithm: 'HS256',
      audience: 'oxmaint-cmms',
      issuer: 'oxmaint-portal',
      jwtid: randomUUID(),
      expiresIn: '60s',
    },
  )

  const target = new URL('/en/sso', CMMS_URL)
  target.searchParams.set('token', ticket)

  const response = NextResponse.redirect(target.toString())
  // The ticket is in the URL for exactly one hop. Telling every cache and proxy
  // on the way not to keep the redirect is the cheap half of not leaking it;
  // the 60-second expiry and single use are the half that actually holds.
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  return response
}
