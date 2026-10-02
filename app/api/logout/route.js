import { NextResponse } from 'next/server'

// The portal's exit button, in the top bar. It is the way back to the console,
// not a sign-out.
//
// Nothing is cleared here on purpose. The portal is not gated in this build, so
// there is no portal session to end, and ending the *console's* session would
// be the one thing the button must not do: someone stepping back to the console
// would arrive at a sign-in form and have to type their password again to
// return to the page they just left.
//
// So it answers with a destination and leaves the cookie alone, and /admin then
// decides what that destination means: proxy.js sends a signed-in admin on to
// the console, and shows the sign-in to anyone else. One answer covers both
// without this route having to know which case it is in.
//
// Signing out properly is the console's own button, which posts to
// /api/admin/logout.
//
// The route exists at all because the top bar posts here and follows the
// `redirectTo` it gets back. Without it the fetch 404s and the button falls
// through to a hard-coded /login.
export async function POST() {
  return NextResponse.json({ redirectTo: '/admin' })
}
