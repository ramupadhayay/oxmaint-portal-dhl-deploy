import DataCenterShell from '@/components/industries/datacenter/components/Shell'

// A server component so it can export `metadata` — the tab has to name this
// portal without changing the CMMS portal's, and only a server component can
// set it. Scoped to this route segment, so nothing else on the deployment moves.
//
// The product name is in the title because the tab is where a portal is
// identified once it is one of several open, and "Data Center FSM" alone says
// nothing about whose it is. `icon.png` beside this file is Next's
// segment-level favicon convention — same scope, same rule — and without it
// the tab showed a broken image rather than falling back to anything.
export const metadata = {
  title: 'Data Center FSM · Oxmaint AI',
  description: 'Oxmaint AI — Future State Maintenance proof of concept: condition monitoring across data center mechanical and electrical plant.',
}

export default function DataCenterLayout({ children }) {
  return <DataCenterShell>{children}</DataCenterShell>
}
