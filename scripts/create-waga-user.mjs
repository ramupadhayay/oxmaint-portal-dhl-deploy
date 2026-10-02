// Provision a WAGA portal login — one per person.
//
// The WAGA portal is given to a client behind a per-user sign-in (proxy.js gates
// it, app/api/portal/waga/login checks the credential). An account may open the
// portal only if its User document lists 'waga' in `portals`, so this script is
// how a person is granted (or revoked) access: it upserts their User row and
// puts 'waga' on the array. The password is hashed by the model's pre-save hook,
// the same as every other account — nothing here stores a plaintext credential.
//
//   node scripts/create-waga-user.mjs --email jo@client.com --password 's3cret' --name "Jo Diaz"
//   node scripts/create-waga-user.mjs --email jo@client.com --revoke      # take access away
//   node scripts/create-waga-user.mjs --list                              # who has it
//
// Safe to run more than once: an existing account keeps its other fields, gains
// 'waga' if missing, and only has its password changed when a new one is passed.

import mongoose from 'mongoose'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// The dev server reads .env.local; this reads the same file rather than asking
// for the connection string to be exported separately.
const readEnv = (file) => {
  try {
    return Object.fromEntries(
      readFileSync(join(root, file), 'utf8')
        .split('\n').map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#') && l.includes('='))
        .map((l) => {
          const i = l.indexOf('=')
          return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
        }),
    )
  } catch { return {} }
}
const env = { ...readEnv('.env.local'), ...readEnv('.env'), ...process.env }
const URI = env.MONGO_URI
if (!URI) {
  console.error('MONGO_URI is not set in .env.local, .env or the environment.')
  process.exit(1)
}

// Minimal flag parser: --key value, and bare --flag booleans.
const args = process.argv.slice(2)
const opt = (k) => {
  const i = args.indexOf(`--${k}`)
  return i >= 0 ? args[i + 1] : undefined
}
const has = (k) => args.includes(`--${k}`)

const User = (await import('../lib/models/User.js')).default
await mongoose.connect(URI)
console.log(`connected — database "${mongoose.connection.db.databaseName}"\n`)

try {
  if (has('list')) {
    const users = await User.find({ portals: 'waga' }).select('email name companyName lastLoginAt loginCount').lean()
    if (!users.length) console.log('No accounts have WAGA access yet.')
    else {
      console.log(`${users.length} account(s) with WAGA access:`)
      for (const u of users) {
        const seen = u.lastLoginAt ? new Date(u.lastLoginAt).toISOString().slice(0, 10) : 'never'
        console.log(`  ${u.email}  ·  ${u.name || '(no name)'}  ·  ${u.companyName || ''}  ·  logins ${u.loginCount || 0}, last ${seen}`)
      }
    }
    await mongoose.disconnect(); process.exit(0)
  }

  const email = (opt('email') || '').trim().toLowerCase()
  if (!email) {
    console.error('Pass --email. See the header of this file for usage.')
    await mongoose.disconnect(); process.exit(1)
  }

  const existing = await User.findOne({ email })

  if (has('revoke')) {
    if (!existing) { console.log(`No account for ${email} — nothing to revoke.`) }
    else {
      existing.portals = (existing.portals || []).filter((p) => p !== 'waga')
      await existing.save()
      console.log(`Revoked WAGA access from ${email}. The account still exists.`)
    }
    await mongoose.disconnect(); process.exit(0)
  }

  const password = opt('password')

  if (existing) {
    const had = (existing.portals || []).includes('waga')
    if (!had) existing.portals = [...(existing.portals || []), 'waga']
    if (password) existing.password = password // re-hashed by the pre-save hook
    await existing.save()
    console.log(`Updated ${email}:`)
    console.log(`  WAGA access: ${had ? 'already granted' : 'granted now'}`)
    console.log(`  Password:    ${password ? 'reset' : 'unchanged'}`)
  } else {
    if (!password) {
      console.error('A new account needs --password. Existing accounts can be updated without one.')
      await mongoose.disconnect(); process.exit(1)
    }
    // Required-but-incidental fields get sensible defaults — WAGA access is the
    // `portals` array, not any of these, and the client can be given a real name.
    const local = email.split('@')[0]
    const user = new User({
      name: opt('name') || local,
      email,
      password,
      companyName: opt('company') || 'WAGA Energy',
      countryCode: opt('country') || '+1',
      mobile: opt('mobile') || '0000000000',
      role: '',
      portals: ['waga'],
    })
    await user.save()
    console.log(`Created WAGA account:`)
    console.log(`  Email:    ${email}`)
    console.log(`  Name:     ${user.name}`)
    console.log(`  Password: ${password}`)
    console.log(`\n  Sign in at /portal/waga/login (or the waga subdomain).`)
  }
} catch (err) {
  console.error(`\nFailed: ${err.message}`)
  await mongoose.disconnect(); process.exit(1)
}

await mongoose.disconnect()
process.exit(0)
