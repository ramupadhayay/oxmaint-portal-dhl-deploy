import DnaShell from '@/components/industries/dna/components/Shell'

// A server component on purpose: only these can export `metadata`, and the tab
// has to name this portal without touching the other four.
export const metadata = {
  title: 'DNA Technical Fabrics — Oxmaint CMMS',
  description: 'DNA Technical Fabrics maintenance demo — work orders, PM schedules, assets, parts inventory, downtime tracking, resource planning and AI task time estimates.',
}

export default function DnaLayout({ children }) {
  return <DnaShell>{children}</DnaShell>
}
