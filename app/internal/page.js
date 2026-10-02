import InternalUsage from '@/components/internal/InternalUsage'

// The staff view: is anybody using these portals, and what are they doing.
//
// A server component so it can carry `metadata`, and so the noindex sits in the
// document rather than being asserted by a client script. Nothing here is for a
// client's eyes — it answers questions about their behaviour — so it is gated on
// the admin cookie in proxy.js and told not to be indexed.

export const metadata = {
  title: 'Internal — portal usage',
  robots: { index: false, follow: false, nocache: true },
}

export default function InternalPage() {
  return <InternalUsage />
}
