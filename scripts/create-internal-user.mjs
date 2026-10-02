// Create (or reset) the staff account that opens /internal.
//
//   node scripts/create-internal-user.mjs internal@ifactoryai.com 'the-password'
//
// Two things about this account are deliberate, and both changed when /internal
// stopped riding on the admin cookie and got its own door at /internal/login.
//
// It carries NO role and NO portals. It used to be an admin, because /internal
// was gated on `admin_token`; now the internal token is its own thing and role
// is not consulted, so the account is left as a plain member. That is not
// tidiness — an admin row can open the console and, because the WAGA gate lets
// any admin through, the client's own portal. A credential for a reporting
// screen should open the reporting screen and nothing else.
//
// The password alone is still not enough: /internal/login checks
// INTERNAL_EMAILS before it even looks the account up, so this email has to be
// listed there as well. Creating the account is half the job; the script says
// so at the end.
//
// Run it again with a new password to reset it — the email is the key, and
// nothing else on the row is touched.

import fs from 'node:fs'
import path from 'node:path'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const [email, password] = process.argv.slice(2)
if (!email || !password) {
  console.error("usage: node scripts/create-internal-user.mjs <email> '<password>'")
  process.exit(1)
}
if (password.length < 6) {
  console.error('The schema requires at least 6 characters.')
  process.exit(1)
}

const ROOT = process.cwd()
const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const uri = (env.match(/^MONGO_URI=(.+)$/m) || [])[1]?.trim()
if (!uri) {
  console.error('No MONGO_URI in .env.local')
  process.exit(1)
}

let tries = 0
for (;;) {
  try { await mongoose.connect(uri, { serverSelectionTimeoutMS: 25000 }); break }
  catch (e) { if (++tries >= 4) throw e; console.error(`retry ${tries}`) }
}

const users = mongoose.connection.db.collection('users')
const key = email.trim().toLowerCase()
const existing = await users.findOne({ email: key })

// Hashed here rather than through the model, so the script does not depend on
// every other required field the schema wants when it only means to set two.
const hash = await bcrypt.hash(password, 10)
const now = new Date()

if (existing) {
  await users.updateOne({ _id: existing._id }, {
    $set: {
      password: hash,
      // Demoted, not left as it was. An earlier version of this script made the
      // account an admin because that was the only door /internal had. Rerunning
      // it now takes that back — the internal token does not need a role, and an
      // admin row would still open the console and the client's portal.
      role: 'member',
      // Cleared, not left: an internal account must not hold a client portal.
      portals: [],
      // The demo portals keep a readable copy for the client packs. An internal
      // credential is not one of those, so it is blanked rather than stored.
      visiblePassword: '',
      altPasswords: [],
      updatedAt: now,
    },
  })
  console.log(`reset    ${key}  (existing account, password replaced)`)
} else {
  await users.insertOne({
    name: 'iFactory Internal',
    email: key,
    password: hash,
    companyName: 'iFactory AI',
    countryCode: '+91',
    mobile: '0000000000',
    role: 'member',
    department: 'Internal',
    portals: [],
    visiblePassword: '',
    altPasswords: [],
    loginCount: 0,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  })
  console.log(`created  ${key}`)
}

const row = await users.findOne({ email: key }, { projection: { email: 1, role: 1, portals: 1, department: 1 } })
console.log(`         role=${row.role}  portals=${JSON.stringify(row.portals)}  department=${row.department}`)

console.log('')
console.log('Sign in at /internal/login with this email — not at /admin, which')
console.log('issues a different cookie that /internal does not accept.')
console.log('It will only open if the same email is listed in INTERNAL_EMAILS —')
console.log('set that on every deployment that should show the screen:')
console.log(`  INTERNAL_EMAILS=${key}`)

await mongoose.disconnect()
