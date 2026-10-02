'use client'

// The screen a module shows when the loaded organisation does not have it.
//
// The routes exist whatever is loaded, because a deep link into a module this
// organisation is not set up for should land on a page that explains itself
// rather than a 404 — a 404 reads as a broken product, and this is not broken,
// it is configured differently.

import { PackageOpen } from 'lucide-react'
import { ORG } from '../lib/data'

export default function ModuleOff({ module = 'This module' }) {
  return (
    <div className="max-w-8xl mx-auto p-6">
      <div className="bg-white border border-slate-200/60 rounded-lg shadow-sm p-12 text-center">
        <PackageOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <h3 className="font-semibold text-slate-800 mb-1">
          {module} is not switched on here
        </h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          This module belongs to an equipment type <strong>{ORG.organization_name}</strong> does not
          run, so there is nothing for it to show. Use the portal switcher to open an organisation
          that has it.
        </p>
      </div>
    </div>
  )
}
