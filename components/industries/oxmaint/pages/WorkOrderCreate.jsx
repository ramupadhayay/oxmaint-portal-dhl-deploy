'use client'

// The create screen is the builder; this page only wires it to the store and
// decides where the user lands afterwards. A failed write leaves them here with
// everything they typed rather than dropping them back on the list, which is
// the whole reason the redirect waits on the record.

import { useRouter } from 'next/navigation'
import { RecordBuilder } from '../lib/builder'
import { WORK_ORDER_SCHEMA } from '../lib/builderSchemas'
import { useStore } from '../lib/store'

const LIST = '/portal/oxmaint/work-orders'

export default function WorkOrderCreate() {
  const router = useRouter()
  const { create } = useStore()

  const save = async (values, status) => {
    const record = await create('work_order', {
      ...values,
      ...WORK_ORDER_SCHEMA.derive(values),
      ...(status ? { status } : {}),
    })
    if (record) router.push(LIST)
  }

  return (
    <RecordBuilder
      schema={WORK_ORDER_SCHEMA}
      onSubmit={(values) => save(values)}
      onSaveDraft={(values) => save(values, 'Draft')}
      onCancel={() => router.push(LIST)}
    />
  )
}
