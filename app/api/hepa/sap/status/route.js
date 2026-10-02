// GET /api/hepa/sap/status — the handshake.
//
// What a health check calls and what the console's "Test connection" button
// hits. It reports the queue depth from the same records the Sync Monitor
// renders, so a failure the screen shows is a failure this endpoint admits to.

import {
  GATEWAY, ENDPOINTS, sapRows, latency, one,
} from '../_gateway'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const t0 = Date.now()
  await latency(180)

  const rows = sapRows()
  const errors = rows.filter((r) => String(r.syncStatus).startsWith('Error'))
  const pending = rows.filter((r) => r.syncStatus === 'Pending')

  return one({
    System: GATEWAY.system,
    Client: GATEWAY.client,
    Host: GATEWAY.host,
    Service: GATEWAY.service,
    Protocol: GATEWAY.protocol,
    Authentication: GATEWAY.auth,
    MaintenancePlant: GATEWAY.plant,
    Reachable: true,
    // Never dressed up as a live SAP link.
    Mode: GATEWAY.mode,
    ModeNote: GATEWAY.modeNote,
    MappedEquipment: rows.length,
    QueueDepth: errors.length + pending.length,
    ErrorsQueued: errors.length,
    Pending: pending.length,
    Endpoints: ENDPOINTS.length,
    ResponseTimeMs: Date.now() - t0,
    ServerTime: new Date().toISOString(),
  }, { type: 'ZHEPA.ServiceStatus' })
}
