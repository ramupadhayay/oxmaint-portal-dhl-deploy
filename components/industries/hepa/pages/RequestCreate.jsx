'use client'

// Where the QR code lands.
//
// The overview on the request register carries a QR code, and what it encodes
// is this route. Somebody standing in a corridor with a phone is the reason
// this page exists, so it is the form and nothing else — no register, no
// summary cards, no sidebar of counts they cannot act on.
//
// The form itself is the same component the register opens in its dialog. Two
// copies would have drifted, and this is the copy nobody would have noticed
// drifting.

import { useRouter } from 'next/navigation'
import { PageHeading, PALETTE } from '../lib/kit'
import { ORG } from '../lib/data'
import { useRequests } from '../lib/ops'
import CreateRequestForm from '../components/CreateRequestForm'

const { MUTE, LINE } = PALETTE

export default function RequestCreate() {
  const router = useRouter()
  const requests = useRequests()

  return (
    <div>
      <PageHeading
        back={{ label: 'Maintenance Requests', onClick: () => router.push('/portal/hepa/requests') }}
        title="Create Maintenance Request"
        subtitle="Report something you have seen. It goes to the open queue for triage — nobody is dispatched until somebody decides it needs a work order."
      />

      <section style={styles.card}>
        <CreateRequestForm
          requests={requests}
          onCancel={() => router.push('/portal/hepa/requests')}
          onDone={() => router.push('/portal/hepa/requests')}
        />
      </section>

      <p style={styles.foot}>
        {ORG.name} · {ORG.site}
      </p>
    </div>
  )
}

const styles = {
  card: {
    background: '#fff', borderRadius: 12, padding: 20, maxWidth: 1040,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
    boxShadow: '0 1px 2px rgba(15,23,42,.04)',
  },
  foot: { margin: '14px 0 0', fontSize: 11.5, color: MUTE },
}
