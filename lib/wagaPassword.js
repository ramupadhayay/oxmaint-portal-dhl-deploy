// The shape of a WAGA portal password, in one place.
//
// Both ends need it: the Add form shows a suggestion before anything is saved,
// and the API generates one when a caller sends none. Two generators would
// drift, and the one people see would stop being the one that gets stored.
//
// Web Crypto rather than node:crypto — this module is imported by a browser
// component as well as a route handler, and `crypto.getRandomValues` is the one
// that exists in both. Math.random would be wrong here even for a demo: it is
// seeded, predictable, and this value is somebody's credential.

// The credentials already handed to this client read `<firstname>@waga2026`,
// which is the shape their handover pack teaches people to expect. Keeping the
// year would mean a new person's password could be worked out from their name,
// so it is replaced by four random characters: familiar to read out, not
// derivable from the roster.
//
// No l, I, 1, O or 0 in the alphabet — this gets read down a phone line.
export const PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

// The User schema's own minimum. A stricter rule here would reject a password
// the database would have accepted, which is a difference nobody can see.
export const MIN_PASSWORD_LENGTH = 6

export function suggestPassword(name, email) {
  const first = String(name || '').trim().split(/\s+/)[0]
    || String(email || '').split('@')[0]
    || 'waga'
  const stem = first.toLowerCase().replace(/[^a-z]/g, '').slice(0, 12) || 'waga'
  const bytes = new Uint8Array(4)
  globalThis.crypto.getRandomValues(bytes)
  const tail = [...bytes].map((b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join('')
  return `${stem}@waga${tail}`
}
