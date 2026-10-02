// This portal's binding of the shared checklist generator.
//
// The request, the endpoint and the shape it returns are the same everywhere.
// What is not is the library a draft falls back on when no endpoint answers:
// here it is this register's own checklists, so a composed draft is made of
// checks the site already walks rather than of a discipline it does not have.

import { generateChecklist as run } from './generateChecklist'
import { TEMPLATES, categoryFor } from './checklistBank'

export {
  isConfigured, GENERATOR_NAME, validateChecklistName, validateChecklistDescription,
} from './generateChecklist'

export function generateChecklist(request, signal) {
  return run(request, signal, { templates: TEMPLATES, categoryFor })
}
