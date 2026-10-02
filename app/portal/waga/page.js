import { redirect } from 'next/navigation'

// The portal root is not a choice — it is the way in.
export default function WagaHome() {
  redirect('/portal/waga/getting-started')
}
