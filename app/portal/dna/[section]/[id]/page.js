'use client'

import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'

// The record page: /work-orders/WO-2001, /assets/AST-1203, /pm-schedules/PM-001.
//
// One component for all three, because a job, a machine and a schedule are read
// the same way — a detail sheet and everything that hangs off it. Which one is
// being asked for is the `section` in the path, so the route does not need to
// know.
const RecordView = dynamic(
  () => import('@/components/industries/dna/pages/RecordView'),
  { loading: () => null }
)

export default function DnaRecord() {
  const { section, id } = useParams()
  return <RecordView section={section} id={decodeURIComponent(id)} />
}
