/**
 * Server-side DHL CVG GSE register for MCP / voice.
 *
 * Only the dhl-gse pack build loads the workbook. Other packs keep this module
 * inert so their bundles do not carry the Superhub extract.
 */

import { createRequire } from 'node:module'
import { overlayWorkOrders } from './session.js'
import { applyHierarchyPatches, seedSapMirror } from './sapMirror.js'

const KEY = process.env.NEXT_PUBLIC_OXMAINT_PACK
// Same fold as packs/dataset.js — KEY is inlined at build time, so other packs
// drop the Superhub extract. Bare `require` is what webpack can see; Node ESM
// (the verify script) has no free require, so createRequire fills in there.
let buildDataset = null
if (KEY === 'dhl-gse') {
  if (typeof require === 'function') {
    // eslint-disable-next-line global-require
    buildDataset = require('../../components/industries/oxmaint/lib/packs/dhl-gse-data').buildDataset
  } else {
    buildDataset = createRequire(import.meta.url)('../../components/industries/oxmaint/lib/packs/dhl-gse-data').buildDataset
  }
}

function seed(s) {
  let h = 2166136261
  const str = String(s)
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h ^= h >>> 16
  h = Math.imul(h, 2246822507)
  h ^= h >>> 13
  h = Math.imul(h, 3266489909)
  h ^= h >>> 16
  return (h >>> 0) / 4294967295
}

function pick(key, from) {
  return from[Math.floor(seed(key) * from.length) % from.length]
}

function between(key, lo, hi, dp = 0) {
  const v = lo + seed(key) * (hi - lo)
  return dp ? Number(v.toFixed(dp)) : Math.round(v)
}

function epochMs() {
  const t = new Date()
  t.setHours(6, 0, 0, 0)
  return t.getTime()
}

let cached = null

export function dhlPackActive() {
  return KEY === 'dhl-gse'
}

export function loadDhlDataset() {
  if (!buildDataset) return null
  if (cached) return cached
  cached = buildDataset(epochMs(), { pick, between })
  return cached
}

export function getVoiceRegister() {
  const ds = loadDhlDataset()
  if (!ds) return { ok: false, workOrders: [], assets: [], technicians: [], meta: null }
  const workOrders = overlayWorkOrders(ds.voiceWorkOrders || [])
  const assets = applyHierarchyPatches(ds.assets || [])
  seedSapMirror({ workOrders, assets })
  return {
    ok: true,
    workOrders,
    portalWorkOrders: ds.workOrders || [],
    assets,
    technicians: ds.technicians || [],
    meta: ds.meta || null,
    honesty: ds.voiceHonesty || ds.meta?.voiceVolume?.honesty || '',
    site: ds.site || null,
    voiceInsights: ds.voiceInsights || null,
    voiceWaterfall: ds.voiceWaterfall || null,
    pmSchedules: ds.pmSchedules || [],
  }
}
