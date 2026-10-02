import OxmaintShell from '@/components/industries/oxmaint/components/Shell'

// The design system, imported by this segment rather than the root layout so
// Tailwind reaches this portal and no other. It leaves preflight out for the
// same reason — the other five portals are inline-styled against browser
// defaults and a reset would move every one of them. See the file's own note.
import './oxmaint.css'

// A server component on purpose: only these can export `metadata`, and the tab
// has to read "Oxmaint AI" on this portal without touching the other twenty.
//
// Both parts of the branding are scoped to this route segment. The title
// overrides the root layout's "iFactory AI" for /portal/oxmaint and everything
// under it and nowhere else, and `icon.png` sitting beside this file is Next's
// segment-level favicon convention — same scope, same rule. Nothing here is
// global, so no other portal's tab changes.
export const metadata = {
  title: 'Oxmaint AI',
  description: 'Oxmaint AI — maintenance management: assets, work orders, preventive maintenance, inventory and inspections.',
}

export default function OxmaintLayout({ children }) {
  return <OxmaintShell>{children}</OxmaintShell>
}
