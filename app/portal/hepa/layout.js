import HepaShell from '@/components/industries/hepa/components/Shell'

// A server component on purpose: only these can export `metadata`, and the tab
// has to read "Oxmaint AI" on this portal without touching the others.
export const metadata = {
  title: 'Oxmaint AI',
  description: 'Oxmaint AI — HEPA filter compliance: integrity testing, leak detection, '
    + 'certification document lifecycle and SAP integration for cleanroom facilities.',
}

export default function HepaLayout({ children }) {
  return <HepaShell>{children}</HepaShell>
}
