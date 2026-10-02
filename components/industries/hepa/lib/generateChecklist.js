// This portal's binding of the shared checklist generator.
//
// The request, the endpoint and the shape it returns are the same everywhere,
// so the generator itself lives in the general CMMS portal. What is not the
// same everywhere is the library it falls back on when no endpoint is
// configured: this site's procedures are cleanroom certification rounds, and
// composing a chiller checklist out of them would be worse than composing
// nothing. So the templates and the category rule are bound here, once, and
// the screens keep the call they already had.

import { generateChecklist as run } from '../../oxmaint/lib/generateChecklist'
import { TEMPLATES } from './checklists'
import { categoryFor } from './checklistLibrary'

export { isConfigured, GENERATOR_NAME, validateChecklistName, validateChecklistDescription } from '../../oxmaint/lib/generateChecklist'

export function generateChecklist(request, signal) {
  return run(request, signal, { templates: TEMPLATES, categoryFor })
}
