// One-off migration: scope stored records to a data pack.
//
// Two things changed when the hospitality pack was added beside chiller and
// generic. Records gained a `pack` field, because one collection now holds more
// than one customer and a work order raised in one demo was appearing in the
// other's list. And `recordId` stopped being globally unique, because the seeded
// ids are generated identically in every pack — `wo_0001` exists in all of them,
// so closing that work order in two demos writes two rows with the same id.
//
// Mongoose creates the new indexes on its own but never drops the old one, so
// the retired `recordId_1` would go on enforcing the rule it replaced. This
// drops it and backfills the records written before the field existed.
//
// Safe to run more than once: every step checks before it acts.
//
//   npm run migrate:packs

import mongoose from 'mongoose'
import { readFileSync } from 'node:fs'

// The dev server reads .env.local; this reads the same file rather than asking
// for the connection string to be exported separately.
const readEnv = (file) => {
  try {
    return Object.fromEntries(
      readFileSync(file, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#') && l.includes('='))
        .map((l) => {
          const i = l.indexOf('=')
          return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
        })
    )
  } catch { return {} }
}

const env = { ...readEnv('.env.local'), ...readEnv('.env'), ...process.env }
const URI = env.MONGO_URI

// Records written before the field existed were created when the only default
// was 'chiller'. That is where they belong, and the API route reads them back
// there too.
const LEGACY_PACK = 'chiller'

if (!URI) {
  console.error('MONGO_URI is not set in .env.local, .env or the environment — nothing to migrate.')
  process.exit(1)
}

await mongoose.connect(URI)
const col = mongoose.connection.db.collection('oxmaintrecords')
console.log(`connected — database "${mongoose.connection.db.databaseName}"\n`)

// ── 1. backfill the pack field ────────────────────────────────────────────
const unscoped = await col.countDocuments({ $or: [{ pack: { $exists: false } }, { pack: '' }] })
if (unscoped) {
  const r = await col.updateMany(
    { $or: [{ pack: { $exists: false } }, { pack: '' }] },
    { $set: { pack: LEGACY_PACK } }
  )
  console.log(`  backfilled  ${r.modifiedCount} record(s) to pack "${LEGACY_PACK}"`)
} else {
  console.log('  backfilled  nothing to do — every record already carries a pack')
}

// ── 2. drop the retired global unique index ───────────────────────────────
const indexes = await col.indexes()
const stale = indexes.find((i) => i.name === 'recordId_1' && i.unique)
if (stale) {
  await col.dropIndex('recordId_1')
  console.log('  dropped     recordId_1 (was globally unique)')
} else {
  console.log('  dropped     nothing to do — recordId_1 is already gone')
}

// ── 3. make sure the replacement exists ───────────────────────────────────
const after = await col.indexes()
if (!after.some((i) => i.name === 'pack_1_recordId_1')) {
  await col.createIndex({ pack: 1, recordId: 1 }, { unique: true, name: 'pack_1_recordId_1' })
  console.log('  created     pack_1_recordId_1 (unique per pack)')
} else {
  console.log('  created     nothing to do — pack_1_recordId_1 already exists')
}

// ── report ────────────────────────────────────────────────────────────────
const byPack = await col.aggregate([{ $group: { _id: '$pack', n: { $sum: 1 } } }, { $sort: { _id: 1 } }]).toArray()
console.log('\nrecords by pack:')
byPack.forEach((p) => console.log(`  ${String(p._id || '(none)').padEnd(14)} ${p.n}`))

await mongoose.disconnect()
console.log('\ndone.')
