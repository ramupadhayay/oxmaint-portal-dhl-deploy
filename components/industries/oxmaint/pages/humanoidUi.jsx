'use client'

import ModuleOff from '../components/ModuleOff'
import { DOMAIN } from '../lib/data'

export function HumanoidGate({ title, children }) {
  if (DOMAIN?.key !== 'humanoid') return <ModuleOff module={title} />
  return <div className="space-y-4">{children}</div>
}
