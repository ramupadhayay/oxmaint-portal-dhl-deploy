// The portal's section routes, prerendered.
//
// Every screen here is a client component, so the server has nothing to decide
// per request — but a dynamic segment with no static params is rendered on
// demand anyway, which put a round trip to this origin in front of every
// navigation and every first load. Naming the sections lets the build emit them
// as static HTML: the browser gets the shell from the CDN's cache and hydrates,
// and the origin is not in the path at all.
//
// dynamicParams stays on, so a slug that is not in the list (an old bookmark, a
// typo) still renders and falls back to the dashboard, exactly as before.

import SectionClient from './SectionClient'
import { SECTION_SLUGS } from './sections'

export function generateStaticParams() {
  return SECTION_SLUGS.map((section) => ({ section }))
}

export const dynamicParams = true

export default function OxmaintSectionPage() {
  return <SectionClient />
}
