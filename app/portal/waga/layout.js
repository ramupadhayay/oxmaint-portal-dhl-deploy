import WagaShell from '@/components/industries/waga/components/Shell'

// A server component on purpose: only these can export `metadata`, and the tab
// has to read WAGA Energy on this portal without touching the other two.
export const metadata = {
  title: 'WAGA Energy — Compliance & EHS',
  description: 'WAGA Energy compliance and EHS trial — permit obligations, deadlines, monitoring limits, deviations and safety workflows.',
}

export default function WagaLayout({ children }) {
  return <WagaShell>{children}</WagaShell>
}
