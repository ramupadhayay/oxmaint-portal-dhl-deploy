// Provision a login for every WAGA team member, and one admin who can read the
// passwords back.
//
// Each person on the roster becomes their own User with 'waga' portal access and
// a password — hashed for the sign-in check, and ALSO kept in a `visiblePassword`
// field so the admin console can show what was issued (a bcrypt digest cannot be
// un-hashed). The admin account carries role:'admin', which is what the users
// API checks before it returns any password.
//
//   node scripts/waga-team-seed.mjs            # create / update everyone
//   node scripts/waga-team-seed.mjs --reset    # also reset each password to the default
//
// Safe to re-run: existing accounts keep their fields, gain 'waga' access and an
// admin/member role, and only have their password reset when --reset is passed.

import mongoose from 'mongoose'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const readEnv = (file) => {
  try {
    return Object.fromEntries(
      readFileSync(join(root, file), 'utf8').split('\n').map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#') && l.includes('='))
        .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
    )
  } catch { return {} }
}
const env = { ...readEnv('.env.local'), ...readEnv('.env'), ...process.env }
const URI = env.MONGO_URI
if (!URI) { console.error('MONGO_URI is not set.'); process.exit(1) }
const RESET = process.argv.includes('--reset')

// The roster — the same nine people the Team screen lists.
const TEAM = [
  { name: 'Joe Rengers', email: 'joseph.rengers@waga-energy.com', department: 'QHSE' },
  { name: 'Chris Houseknecht', email: 'christopher.houseknecht@waga-energy.com', department: 'QHSE' },
  { name: 'Jean-Francis Duchaine', email: 'jean-francis.duchaine@waga-energy.com', department: 'QHSE' },
  { name: 'Marc Eggleston', email: 'marc.eggleston@waga-energy.com', department: 'Operations' },
  { name: 'John Gelander', email: 'john.gelander@waga-energy.com', department: 'Operations' },
  { name: 'Amiel Kirtikar', email: 'amiel.kirtikar@waga-energy.com', department: 'Project Delivery' },
  { name: 'Nicolas Polidori', email: 'nicolas.polidori@waga-energy.com', department: 'Project Delivery' },
  { name: 'Dylan Deriot', email: 'dylan.deriot@waga-energy.com', department: 'Business Development' },
  { name: 'Nathanael De Roquefeuil', email: 'nathanael.de-roquefeuil@waga-energy.com', department: 'Finance' },
]
// The admin who can see everyone's password.
const ADMIN = { name: 'WAGA Administrator', email: 'wagaenergy@gmail.com', department: 'Administration', password: 'oxmaint@2026' }

const pwFor = (name) => `${name.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '')}@waga2026`

const User = (await import('../lib/models/User.js')).default
await mongoose.connect(URI)
console.log(`connected — database "${mongoose.connection.db.databaseName}"\n`)

async function upsert({ name, email, department, role, password }) {
  const norm = email.trim().toLowerCase()
  let u = await User.findOne({ email: norm })
  const created = !u
  if (!u) {
    u = new User({ name, email: norm, password, companyName: 'WAGA Energy', countryCode: '+1', mobile: '0000000000', portals: ['waga'] })
  }
  if (!Array.isArray(u.portals) || !u.portals.includes('waga')) u.portals = [...(u.portals || []), 'waga']
  u.role = role
  u.department = department
  if (created || RESET || !u.visiblePassword) { u.password = password; u.visiblePassword = password }
  await u.save()
  return { email: norm, name, department, role, password: u.visiblePassword, created }
}

try {
  const results = []
  results.push(await upsert({ ...ADMIN, role: 'admin' }))
  for (const m of TEAM) results.push(await upsert({ ...m, role: 'member', password: pwFor(m.name) }))

  console.log('WAGA portal logins provisioned:\n')
  console.log('  ROLE     EMAIL                                        PASSWORD          DEPARTMENT')
  console.log('  ' + '-'.repeat(96))
  for (const r of results) {
    console.log(`  ${r.role.padEnd(7)}  ${r.email.padEnd(43)}  ${String(r.password).padEnd(16)}  ${r.department}${r.created ? '  (new)' : ''}`)
  }
  console.log(`\n  ${results.length} accounts. Sign in at /portal/waga/login (or waga.ifactoryai.com).`)
  console.log('  The admin (wagaenergy@gmail.com) sees every password on the Team screen.')
} catch (err) {
  console.error(`\nFailed: ${err.message}`)
  await mongoose.disconnect(); process.exit(1)
}
await mongoose.disconnect()
process.exit(0)
