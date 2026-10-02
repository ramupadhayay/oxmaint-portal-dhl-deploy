import { redirect } from 'next/navigation'

// /login exists only to catch links that predate this build.
//
// On the platform this portal came from, /login was the shared sign-in in front
// of twenty-one portals. Here the portal is open and the only sign-in is the
// admin console — but the path is still typed from muscle memory and still
// linked from bookmarks, and a 404 tells whoever followed one that the site is
// broken rather than that the door moved.
export default function LoginRedirect() {
  redirect('/admin')
}
