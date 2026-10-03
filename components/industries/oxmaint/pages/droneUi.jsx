'use client'

import ModuleOff from '../components/ModuleOff'
import { DOMAIN } from '../lib/data'

export function DroneGate({ title, children }) {
  if (DOMAIN?.key !== 'drone') return <ModuleOff module={title} />
  return <div className="space-y-4">{children}</div>
}
