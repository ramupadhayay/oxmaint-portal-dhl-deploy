'use client'

import { useRouter } from 'next/navigation'
import { RecordBuilder } from '../lib/builder'
import { PM_SCHEDULE_SCHEMA } from '../lib/builderSchemas'
import { useStore } from '../lib/store'

const LIST = '/portal/oxmaint/pm-schedules'

export default function PmScheduleCreate() {
  const router = useRouter()
  const { create } = useStore()

  const save = async (values, status) => {
    const record = await create('pm_schedule', {
      ...values,
      ...PM_SCHEDULE_SCHEMA.derive(values),
      ...(status ? { status } : {}),
    })
    if (record) router.push(LIST)
  }

  return (
    <RecordBuilder
      schema={PM_SCHEDULE_SCHEMA}
      onSubmit={(values) => save(values)}
      onSaveDraft={(values) => save(values, 'Draft')}
      onCancel={() => router.push(LIST)}
    />
  )
}
