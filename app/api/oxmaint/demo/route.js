// Switch the running demo, in development only.
//
// A pack is fixed when the bundle is built: eighty-seven files read the plant
// from module scope and five more data modules materialise their own datasets
// off it at import time, so nothing short of re-evaluating all of them can
// change the customer at runtime. That is a day's refactor of the layer every
// screen depends on, to save a sales engineer a terminal command.
//
// The cheaper route is that `next dev` already restarts when .env.local
// changes. So this writes one line into it and the dev server rebuilds itself
// around the new pack — the click does the thing, and no data code is touched.
//
// DEVELOPMENT ONLY, and the guard is the point: in production this would be a
// request that rewrites the server's environment file, which is not a feature,
// it is a vulnerability. A deployed build switches demos by navigating to the
// deployment that was built with that pack, which is what the switcher does
// when this route is unavailable.

import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const KEY = 'NEXT_PUBLIC_OXMAINT_PACK'
const ENV_FILE = path.join(process.cwd(), '.env.local')

// The packs this build knows about. Taken from the directory rather than a
// list, so a pack added later needs no edit here — and anything not in it is
// refused, because a value from a request must never reach a file unchecked.
const PACKS_DIR = path.join(process.cwd(), 'components', 'industries', 'oxmaint', 'lib', 'packs')

async function knownPacks() {
  const files = await fs.readdir(PACKS_DIR)
  return new Set(
    files
      .filter((f) => f.endsWith('.js') && f !== 'index.js')
      .map((f) => f.replace(/\.js$/, '')),
  )
}

const devOnly = () =>
  process.env.NODE_ENV === 'production'
    ? NextResponse.json(
      { ok: false, error: 'Switching is a development convenience. A deployed build serves one organisation.' },
      { status: 404 },
    )
    : null

export async function GET() {
  const blocked = devOnly()
  if (blocked) return blocked
  return NextResponse.json({
    ok: true,
    available: true,
    current: process.env[KEY] || null,
    packs: [...(await knownPacks())].sort(),
  })
}

export async function POST(request) {
  const blocked = devOnly()
  if (blocked) return blocked

  let pack
  try {
    ({ pack } = await request.json())
  } catch {
    return NextResponse.json({ ok: false, error: 'Expected { pack }.' }, { status: 400 })
  }

  const packs = await knownPacks()
  if (!pack || !packs.has(String(pack))) {
    return NextResponse.json(
      { ok: false, error: `Unknown pack ${JSON.stringify(pack)}. Known: ${[...packs].sort().join(', ')}.` },
      { status: 400 },
    )
  }

  // Read-modify-write rather than append. Appending a second line for the same
  // key leaves the file with two answers, and which one wins depends on the
  // parser — the sort of thing that works until it quietly does not.
  let current = ''
  try {
    current = await fs.readFile(ENV_FILE, 'utf8')
  } catch {
    // No .env.local yet is fine; this creates one carrying only this line.
  }

  const line = `${KEY}=${pack}`
  const without = current
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith(`${KEY}=`))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+$/, '')

  const next = `${without}\n${line}\n`
  await fs.writeFile(ENV_FILE, next, 'utf8')

  // The dev server notices the file and restarts itself. The caller waits for
  // the server to come back rather than reloading immediately into a port that
  // is mid-restart.
  return NextResponse.json({ ok: true, pack, restarting: true })
}
