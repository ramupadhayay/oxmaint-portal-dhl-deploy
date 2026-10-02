/**
 * Pinecone namespace oxmaint-dhl-gse — WO summaries for fast / semantic lookup.
 * Tools use it when PINECONE_API_KEY is set. Counts always come from the
 * in-memory register; this is retrieval, not the source of truth.
 */

import { woSummaryText } from './slices.js'

export const DHL_PINECONE_NAMESPACE = 'oxmaint-dhl-gse'
export const DHL_PINECONE_INDEX = 'oxmaint-multi-product'

const DIM = 1024

export function pineconeConfig(env = process.env) {
  const apiKey = String(env.PINECONE_API_KEY || '').trim()
  const host = String(env.PINECONE_INDEX_HOST || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
  return {
    apiKey,
    configured: Boolean(apiKey && host),
    host,
    index: String(env.PINECONE_INDEX || DHL_PINECONE_INDEX),
    namespace: String(env.PINECONE_NAMESPACE_DHL || env.PINECONE_NAMESPACE || DHL_PINECONE_NAMESPACE),
    dimension: Number(env.PINECONE_DIMENSION || DIM) || DIM,
    apiVersion: String(env.PINECONE_API_VERSION || '2025-04'),
  }
}

function headers(cfg) {
  return {
    'Api-Key': cfg.apiKey,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Pinecone-API-Version': cfg.apiVersion,
  }
}

async function pineconeFetch(path, { method = 'GET', body, env } = {}) {
  const cfg = pineconeConfig(env)
  if (!cfg.configured) {
    return { ok: false, skipped: true, error: 'PINECONE_API_KEY (and PINECONE_INDEX_HOST) not configured' }
  }
  const url = path.startsWith('http') ? path : `https://${cfg.host}${path}`
  const res = await fetch(url, {
    method,
    headers: headers(cfg),
    body: body == null ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = data.message || data.error || data.details || `Pinecone HTTP ${res.status}`
    return { ok: false, status: res.status, error: String(message) }
  }
  return { ok: true, data, cfg }
}

/**
 * Deterministic 1024-d embedding from text. Same string → same vector on every
 * host, so upsert and query agree without an embedding API.
 */
export function embedText(text, dim = DIM) {
  const tokens = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const vec = new Array(dim).fill(0)
  if (!tokens.length) return vec
  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i]
    let h = 2166136261
    for (let c = 0; c < tok.length; c += 1) {
      h ^= tok.charCodeAt(c)
      h = Math.imul(h, 16777619)
    }
    const idx = (h >>> 0) % dim
    vec[idx] += 1
    vec[(idx + 17) % dim] += 0.35
  }
  let norm = 0
  for (let i = 0; i < dim; i += 1) norm += vec[i] * vec[i]
  norm = Math.sqrt(norm) || 1
  for (let i = 0; i < dim; i += 1) vec[i] = vec[i] / norm
  return vec
}

function woId(w) {
  return String(w.work_order_number || w.workorder_id)
}

export function woMetadata(w) {
  return {
    wo_id: woId(w),
    title: String(w.title || '').slice(0, 200),
    status: w.status || '',
    dhl_status: w.dhl_status || '',
    priority: w.dhl_priority || w.priority || '',
    asset_id: w.asset_id || '',
    asset_name: String(w.asset_name || '').slice(0, 80),
    system: w.system || '',
    synthetic: Boolean(w.synthetic || w.voice_volume),
    text: woSummaryText(w).slice(0, 400),
  }
}

let upserted = false

export async function upsertWorkOrders(workOrders, env = process.env) {
  const cfg = pineconeConfig(env)
  if (!cfg.configured) return { ok: false, skipped: true }
  if (upserted) return { ok: true, cached: true, namespace: cfg.namespace }
  const vectors = (workOrders || []).map((w) => ({
    id: woId(w),
    values: embedText(woSummaryText(w), cfg.dimension),
    metadata: woMetadata(w),
  }))
  for (let i = 0; i < vectors.length; i += 80) {
    const slice = vectors.slice(i, i + 80)
    const result = await pineconeFetch('/vectors/upsert', {
      method: 'POST',
      body: { namespace: cfg.namespace, vectors: slice },
      env,
    })
    if (!result.ok) return result
  }
  upserted = true
  return { ok: true, upserted: vectors.length, namespace: cfg.namespace }
}

export async function queryWorkOrders({ q, topK = 12 } = {}, env = process.env) {
  const cfg = pineconeConfig(env)
  if (!cfg.configured) return { ok: false, skipped: true }
  const vector = embedText(q, cfg.dimension)
  const result = await pineconeFetch('/query', {
    method: 'POST',
    body: {
      namespace: cfg.namespace,
      topK: Math.min(50, Math.max(1, Number(topK) || 12)),
      includeMetadata: true,
      includeValues: false,
      vector,
    },
    env,
  })
  if (!result.ok) return result
  const matches = (result.data?.matches || []).map((m) => ({
    id: m.id,
    score: m.score,
    metadata: m.metadata || {},
  }))
  return { ok: true, matches, namespace: cfg.namespace, live: true }
}

export function fallbackSearch(workOrders, q, limit = 12) {
  const tokens = String(q || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 1)
  if (!tokens.length) return (workOrders || []).slice(0, limit)
  const scored = (workOrders || []).map((w) => {
    const hay = woSummaryText(w).toLowerCase()
    let score = 0
    for (const t of tokens) if (hay.includes(t)) score += 1
    return { w, score }
  }).filter((x) => x.score > 0)
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((x) => x.w)
}
