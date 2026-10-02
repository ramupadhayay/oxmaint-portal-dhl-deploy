'use client'

import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'

// The record page: /permits/PERMIT-WBU06-AIR-001, /requirements/REQ-WBU06-AIR-002.
//
// One component for both, because a permit and a requirement are read the same
// way — a detail sheet, its source, and what hangs off it. Which one is being
// asked for is the `section` in the path, so the route does not need to know.
const RecordView = dynamic(
  () => import('@/components/industries/waga/pages/RecordView'),
  { loading: () => null }
)

export default function WagaRecord() {
  const { section, id } = useParams()
  return <RecordView section={section} id={decodeURIComponent(id)} />
}
