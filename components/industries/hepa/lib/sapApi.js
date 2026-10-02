'use client'

// The client side of the SAP gateway.
//
// Every call goes through `call` so that four things happen the same way each
// time and the console can show them: the request is timed, the response is
// kept whole rather than unwrapped into a value, an error status is returned as
// a result instead of thrown, and both halves are handed back for the inspector
// to print.
//
// Returning errors rather than throwing is deliberate. An integration screen's
// job is to show the failure, and a `throw` at this layer means every caller
// has to remember a try/catch before it can do that — which is exactly how a
// failed sync ends up silently missing from a screen.

const BASE = '/api/hepa/sap'

/**
 * @returns {{ok, status, ms, url, method, body, json, error, remedy, retryable}}
 */
export async function call(path, { method = 'GET', body, params } = {}) {
  const qs = params
    ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '' && v !== 'all')).toString()
    : ''
  const url = `${BASE}${path}${qs}`
  const started = performance.now()

  try {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const ms = Math.round(performance.now() - started)

    let json = null
    try {
      json = await res.json()
    } catch {
      // A body that is not JSON is itself the finding, so it is reported
      // rather than swallowed into a generic failure.
      return { ok: false, status: res.status, ms, url, method, body, json: null, error: 'Response was not JSON.' }
    }

    if (!res.ok || json?.error) {
      return {
        ok: false,
        status: res.status,
        ms,
        url,
        method,
        body,
        json,
        // SAP nests the readable text two levels down. Unwrapped here once so
        // no screen has to know that.
        error: json?.error?.message?.value || json?.error?.code || `HTTP ${res.status}`,
        code: json?.error?.code || null,
        remedy: json?.remedy || null,
        retryable: Boolean(json?.retryable),
      }
    }

    return { ok: true, status: res.status, ms, url, method, body, json }
  } catch (e) {
    // The network itself failed — no status, no body. Distinct from a gateway
    // that answered with an error, and the console says which.
    return {
      ok: false,
      status: 0,
      ms: Math.round(performance.now() - started),
      url,
      method,
      body,
      json: null,
      error: e.message || 'The gateway could not be reached.',
    }
  }
}

export const getStatus = () => call('/status')
export const getEquipment = (params) => call('/equipment', { params })
export const getWorkOrders = (params) => call('/work-orders', { params })
export const postSync = (filterId, action = 'confirm') =>
  call('/sync', { method: 'POST', body: { filterId, action } })
export const resetSync = (filterId) =>
  call('/sync', { method: 'DELETE', params: { filterId } })

/** Pretty-print for the inspector, with a cap so one huge collection cannot lock the tab. */
export const pretty = (value, max = 14000) => {
  if (value == null) return '—'
  const s = JSON.stringify(value, null, 2)
  return s.length > max ? `${s.slice(0, max)}\n… ${s.length - max} more characters` : s
}
