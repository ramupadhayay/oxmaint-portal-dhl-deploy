import { redirect } from 'next/navigation'

// The front door is the admin console, not a portal.
//
// On the iFactory platform this page listed twenty portals behind a login. This
// deployment now hosts several portals, so the root can no longer drop straight
// into one of them — landing in the general CMMS made that portal look like the
// whole product and hid the others. The way in is the admin console: sign in
// there, then pick a portal from its list. A non-admin still has the console's
// own "Open the portal →" link, and every portal stays reachable at its own
// /portal/<slug> path.
export default function Home() {
  redirect('/admin')
}
