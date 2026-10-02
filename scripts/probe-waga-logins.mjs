// Issuing a WAGA login, and changing your own password.
//
//   node scripts/probe-waga-logins.mjs
//
// The Team screen used to add a person and promise a credential "in a separate
// step" that did not exist. This exercises the step: an admin issues a login, a
// member signs in with it, changes their own password, and the admin can still
// read the new one — which is the part that has to keep working, because it is
// how a forgotten password gets recovered in this trial.
//
// Two throwaway accounts are created and deleted. WAGA's own rows are never
// signed in to: a login would bump their loginCount and lastLoginAt, which are
// exactly the figures /internal reports, and inflating a client's usage while
// testing is how a report becomes fiction.
//
// This connects to the live Atlas cluster. Nothing may be left behind.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const ROOT = process.cwd()
const API = 'http://127.0.0.1:3000'
const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const uri = (env.match(/^MONGO_URI=(.+)$/m) || [])[1].trim()

const ADMIN_EMAIL = 'probe-waga-admin@ifactoryai.com'
const MEMBER_EMAIL = 'probe-waga-member@ifactoryai.com'
const ADMIN_PASSWORD = `probe-${crypto.randomUUID()}`

await mongoose.connect(uri, { serverSelectionTimeoutMS: 25000 })
const users = mongoose.connection.db.collection('users')

// Refuse to touch a real row.
for (const email of [ADMIN_EMAIL, MEMBER_EMAIL]) {
  const clash = await users.findOne({ email })
  if (clash && clash.department !== 'Probe') {
    console.error(`${email} exists and is not a probe row — stopping`)
    await mongoose.disconnect()
    process.exit(1)
  }
}

const now = new Date()
await users.deleteMany({ email: { $in: [ADMIN_EMAIL, MEMBER_EMAIL] } })
await users.insertOne({
  name: 'Probe Admin', email: ADMIN_EMAIL,
  password: await bcrypt.hash(ADMIN_PASSWORD, 10),
  companyName: 'WAGA Energy', countryCode: '+1', mobile: '0000000000',
  role: 'admin', department: 'Probe', portals: ['waga'],
  visiblePassword: '', altPasswords: [], loginCount: 0, lastLoginAt: null,
  loginHistory: [], createdAt: now, updatedAt: now,
})

let cleaned = false
const cleanup = async () => {
  if (cleaned) return
  cleaned = true
  await users.deleteMany({ email: { $in: [ADMIN_EMAIL, MEMBER_EMAIL] } })
  const left = await users.countDocuments({ email: { $in: [ADMIN_EMAIL, MEMBER_EMAIL] } })
  console.log(`\ncleanup     : probe accounts removed (${left === 0 ? 'gone' : 'STILL THERE'})`)
  await mongoose.disconnect()
}
process.on('uncaughtException', async (e) => { console.error(e); await cleanup(); process.exit(1) })

/** A tiny cookie jar — each signed-in person keeps their own. */
const jar = () => ({ cookie: '' })
async function call(who, method, url, body) {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(who.cookie ? { cookie: who.cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const set = res.headers.getSetCookie?.() || []
  for (const c of set) {
    const [pair] = c.split(';')
    const [name] = pair.split('=')
    // Keep the newest value for each name, and drop the ones being expired.
    const parts = (who.cookie ? who.cookie.split('; ') : []).filter((p) => !p.startsWith(`${name}=`))
    if (!/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c)) parts.push(pair)
    who.cookie = parts.join('; ')
  }
  return { status: res.status, body: await res.json().catch(() => ({})) }
}
const signIn = async (who, email, password) =>
  call(who, 'POST', '/api/portal/waga/login', { email, password })

try {
  // ── the admin signs in ───────────────────────────────────────────────────
  const admin = jar()
  const a = await signIn(admin, ADMIN_EMAIL, ADMIN_PASSWORD)
  console.log(`admin login : ${a.status} ${a.body.message || ''}`)

  // ── issue a login for somebody on the roster ─────────────────────────────
  const issued = await call(admin, 'POST', '/api/portal/waga/users', {
    name: 'Probe Member', email: MEMBER_EMAIL, department: 'Probe',
  })
  const password = issued.body.password
  console.log(`issue login : ${issued.status} "${issued.body.message || ''}"`)
  console.log(`              password shape = ${password ? password.replace(/waga.+$/, 'waga****') : '(none!)'}`
    + `  len=${password?.length || 0}`)

  const row = await users.findOne({ email: MEMBER_EMAIL }, { projection: { portals: 1, role: 1, visiblePassword: 1, department: 1, companyName: 1 } })
  console.log(`              row: portals=${JSON.stringify(row?.portals)} role=${row?.role}`
    + ` dept=${row?.department} visiblePassword=${row?.visiblePassword === password ? 'matches' : 'MISMATCH'}`)

  // Issuing twice must not rotate a password somebody is already using.
  const again = await call(admin, 'POST', '/api/portal/waga/users', {
    name: 'Probe Member', email: MEMBER_EMAIL, department: 'Probe',
  })
  console.log(`issue twice : ${again.status} "${again.body.message || ''}"  (expected 409)`)

  // ── the member signs in with it, then changes it ──────────────────────────
  const member = jar()
  const m1 = await signIn(member, MEMBER_EMAIL, password)
  console.log(`\nmember login: ${m1.status} ${m1.body.message || ''}  (with the issued password)`)

  const NEW_PASSWORD = `chosen-${crypto.randomUUID().slice(0, 8)}`
  const wrongCurrent = await call(member, 'PATCH', '/api/portal/waga/users', {
    currentPassword: 'not-my-password', newPassword: NEW_PASSWORD,
  })
  console.log(`wrong current: ${wrongCurrent.status} "${wrongCurrent.body.message || ''}"  (expected 401)`)

  const tooShort = await call(member, 'PATCH', '/api/portal/waga/users', {
    currentPassword: password, newPassword: 'abc',
  })
  console.log(`too short   : ${tooShort.status} "${tooShort.body.message || ''}"  (expected 400)`)

  const changed = await call(member, 'PATCH', '/api/portal/waga/users', {
    currentPassword: password, newPassword: NEW_PASSWORD,
  })
  console.log(`change pw   : ${changed.status} "${changed.body.message || ''}"`)

  // ── the old one must be dead and the new one must work ───────────────────
  const oldTry = await signIn(jar(), MEMBER_EMAIL, password)
  console.log(`\nold password: ${oldTry.status} ${oldTry.body.message || ''}  (expected 401)`)
  const newTry = await signIn(jar(), MEMBER_EMAIL, NEW_PASSWORD)
  console.log(`new password: ${newTry.status} ${newTry.body.message || ''}  (expected 200)`)

  // ── and the admin must see the NEW one, not the issued one ───────────────
  const after = await users.findOne({ email: MEMBER_EMAIL }, { projection: { visiblePassword: 1, altPasswords: 1 } })
  console.log(`stored      : visiblePassword ${after?.visiblePassword === NEW_PASSWORD ? 'is the new password' : 'is STALE'}`
    + ` · altPasswords=${(after?.altPasswords || []).length}`)

  const roster = await call(admin, 'GET', '/api/portal/waga/users')
  const seen = (roster.body.users || []).find((u) => u.email === MEMBER_EMAIL)
  console.log(`admin sees  : isAdmin=${roster.body.isAdmin} · ${MEMBER_EMAIL} -> `
    + `${seen ? (seen.password === NEW_PASSWORD ? 'the new password' : `"${seen.password}" (WRONG)`) : 'not on the roster'}`
    + ` · hasLogin=${seen?.hasLogin}`)

  // ── a member must not be able to issue anybody a login ───────────────────
  const memberIssues = await call(member, 'POST', '/api/portal/waga/users', {
    name: 'Somebody Else', email: 'probe-should-not-exist@ifactoryai.com', department: 'Probe',
  })
  console.log(`member POST : ${memberIssues.status} "${memberIssues.body.message || ''}"  (expected 403)`)
  const leaked = await users.countDocuments({ email: 'probe-should-not-exist@ifactoryai.com' })
  console.log(`              account created anyway? ${leaked === 0 ? 'no' : 'YES — BUG'}`)

  // A member's roster read must carry no passwords at all.
  const memberRoster = await call(member, 'GET', '/api/portal/waga/users')
  const anyPw = (memberRoster.body.users || []).some((u) => 'password' in u)
  console.log(`member GET  : ${memberRoster.status} isAdmin=${memberRoster.body.isAdmin}`
    + ` · any password field = ${anyPw ? 'YES — BUG' : 'no'}`)

  // ── nobody signed out must reach any of it ───────────────────────────────
  const anon = jar()
  const anonGet = await call(anon, 'GET', '/api/portal/waga/users')
  const anonPost = await call(anon, 'POST', '/api/portal/waga/users', { name: 'X', email: 'x@y.com' })
  const anonPatch = await call(anon, 'PATCH', '/api/portal/waga/users', { currentPassword: 'a', newPassword: 'bbbbbb' })
  console.log(`signed out  : GET ${anonGet.status} · POST ${anonPost.status} · PATCH ${anonPatch.status}  (expected 401, 401, 401)`)
} finally {
  await cleanup()
}
