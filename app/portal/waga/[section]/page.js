'use client'

import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'

// Code-split per section, for the same reason as the other two portals: the
// overview is where everyone lands and it should not carry the eleven screens
// nobody opened in its first chunk.
//
// Every import path is written out in full. A bundler resolves dynamic imports
// statically, so a path built from a variable — even a constant one — leaves it
// nothing to follow and the chunk is never emitted.
function Fallback() {
  const bar = { background: 'linear-gradient(90deg,#eef1f5 25%,#f6f8fb 37%,#eef1f5 63%)', backgroundSize: '400% 100%', animation: 'wgShim 1.1s ease-in-out infinite', borderRadius: 10 }
  return (
    <div>
      <style>{`@keyframes wgShim{0%{background-position:100% 0}100%{background-position:-100% 0}}`}</style>
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
  'getting-started': load(() => import('@/components/industries/waga/pages/GettingStarted')),

  'overview': load(() => import('@/components/industries/waga/pages/Overview')),

  'sites': load(() => import('@/components/industries/waga/pages/Sites')),
  'permits': load(() => import('@/components/industries/waga/pages/Permits')),
  'requirements': load(() => import('@/components/industries/waga/pages/Requirements')),
  'calendar': load(() => import('@/components/industries/waga/pages/Calendar')),
  'parameters': load(() => import('@/components/industries/waga/pages/Parameters')),
  'deviations': load(() => import('@/components/industries/waga/pages/Deviations')),

  'safety': load(() => import('@/components/industries/waga/pages/Safety')),
  'pre-task': load(() => import('@/components/industries/waga/pages/PreTask')),
  'loto': load(() => import('@/components/industries/waga/pages/Loto')),
  'incidents': load(() => import('@/components/industries/waga/pages/Incidents')),
  'training': load(() => import('@/components/industries/waga/pages/Training')),

  'reports': load(() => import('@/components/industries/waga/pages/Reports')),

  'team': load(() => import('@/components/industries/waga/pages/Team')),

  'sources': load(() => import('@/components/industries/waga/pages/Sources')),
}

export default function WagaSection() {
  const { section } = useParams()
  const Page = SECTION_MAP[section] || SECTION_MAP.overview
  return <Page section={section} />
}
