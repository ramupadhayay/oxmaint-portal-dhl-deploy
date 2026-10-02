import InternalLogin from '@/components/internal/InternalLogin'

// The only page under /internal that opens without a cookie — proxy.js lets
// this one path through and closes everything else beside it.
//
// A server component so the noindex sits in the document rather than being
// asserted by a client script that a crawler need not run.

export const metadata = {
  title: 'Internal — sign in',
  robots: { index: false, follow: false, nocache: true },
}

export default function InternalLoginPage() {
  return <InternalLogin />
}
