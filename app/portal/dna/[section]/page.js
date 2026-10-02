'use client'

import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'

// Code-split per section, for the same reason as the other portals: the overview
// is where everyone lands and it should not carry the eleven screens nobody
// opened in its first chunk.
//
// Every import path is written out in full. A bundler resolves dynamic imports
// statically, so a path built from a variable — even a constant one — leaves it
// nothing to follow and the chunk is never emitted.
//
// The keys are quoted because scripts/check-portals.mjs reads the section list
// out of this file with a regex expecting quoted keys. Bare keys parse as valid
// JavaScript and are silently invisible to the screen check.
function Fallback() {
  const bar = { background: 'linear-gradient(90deg,#eef1f5 25%,#f6f8fb 37%,#eef1f5 63%)', backgroundSize: '400% 100%', animation: 'dnaShim 1.1s ease-in-out infinite', borderRadius: 10 }
  return (
    <div>
      <style>{`@keyframes dnaShim{0%{background-position:100% 0}100%{background-position:-100% 0}}`}</style>
      <div style={{ ...bar, height: 22, width: '30%', marginBottom: 10 }} />
      <div style={{ ...bar, height: 13, width: '52%', marginBottom: 20 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(186px,1fr))', gap: 12, marginBottom: 16 }}>
        {[0, 1, 2, 3, 4].map((i) => <div key={i} style={{ ...bar, height: 74 }} />)}
      </div>
      <div style={{ ...bar, height: 300 }} />
    </div>
  )
}

const load = (fn) => dynamic(fn, { loading: Fallback })

const SECTION_MAP = {
  // Dashboard
  'overview': load(() => import('@/components/industries/dna/pages/Overview')),
  'kpis': load(() => import('@/components/industries/dna/pages/Kpis')),
  'reports': load(() => import('@/components/industries/dna/pages/Reports')),

  // Asset
  'assets': load(() => import('@/components/industries/dna/pages/Assets')),
  'asset-qr': load(() => import('@/components/industries/dna/pages/AssetQr')),

  // Maintenance
  'my-tasks': load(() => import('@/components/industries/dna/pages/MyTasks')),
  'work-orders': load(() => import('@/components/industries/dna/pages/WorkOrders')),
  'requests': load(() => import('@/components/industries/dna/pages/Requests')),
  'pm-schedules': load(() => import('@/components/industries/dna/pages/PmSchedules')),

  // Operations
  'calendar': load(() => import('@/components/industries/dna/pages/Calendar')),
  'downtime': load(() => import('@/components/industries/dna/pages/Downtime')),

  // Inventory
  'parts': load(() => import('@/components/industries/dna/pages/Parts')),
  'stocks': load(() => import('@/components/industries/dna/pages/Stocks')),
  'vendors': load(() => import('@/components/industries/dna/pages/Vendors')),
  'labour': load(() => import('@/components/industries/dna/pages/Labour')),

  // Purchasing
  'purchase-orders': load(() => import('@/components/industries/dna/pages/PurchaseOrders')),
  'demand-parts': load(() => import('@/components/industries/dna/pages/DemandParts')),

  // Team, and the singles
  'team': load(() => import('@/components/industries/dna/pages/Resources')),
  'ai-estimates': load(() => import('@/components/industries/dna/pages/AiEstimates')),
  'locations': load(() => import('@/components/industries/dna/pages/Locations')),
  'sources': load(() => import('@/components/industries/dna/pages/Sources')),
}

export default function DnaSection() {
  const { section } = useParams()
  const Page = SECTION_MAP[section] || SECTION_MAP.overview
  return <Page section={section} />
}
