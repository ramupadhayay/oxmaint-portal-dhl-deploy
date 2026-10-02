import HospitalityShell from '@/components/industries/hospitality/components/Shell'

// A server component on purpose: only these can export `metadata`, and the tab
// has to read "Oxmaint AI" on this portal too — it is the same product shown to
// a hotel, not a different one.
//
// The favicon convention is Next's segment-level `icon.png` beside this file.
// This portal has none of its own, so it inherits the root's, which is the
// Oxmaint mark — correct here rather than an omission.
export const metadata = {
  title: 'Oxmaint AI',
  description: 'Oxmaint AI for hospitality — daily schedules, suite rotation, work orders and compliance for hotel engineering.',
}

export default function HospitalityLayout({ children }) {
  return <HospitalityShell>{children}</HospitalityShell>
}
