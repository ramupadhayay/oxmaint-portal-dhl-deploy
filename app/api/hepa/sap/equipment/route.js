// GET /api/hepa/sap/equipment — the asset master.
//
// With no query it returns the whole EquipmentSet; with ?filterId= or
// ?equipment= it returns the one entity, the way OData addresses a key. This is
// the endpoint that makes "no duplicate entry" true rather than a claim: the
// equipment id and functional location are read from here, never typed twice.

import {
  sapRows, equipmentOf, latency, one, many, sapError,
} from '../_gateway'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
  const { searchParams } = request.nextUrl
  const filterId = searchParams.get('filterId')
  const equipment = searchParams.get('equipment')
  const location = searchParams.get('functionalLocation')

  await latency(200)

  const rows = sapRows()

  if (filterId || equipment) {
    const row = rows.find((r) => r.filterId === filterId || r.sapEquipmentId === equipment)
    // A key that addresses nothing is a 404 in OData, not an empty collection.
    if (!row) {
      return sapError(
        'ZHEPA/NOT_FOUND',
        `No equipment master for ${filterId || equipment}.`,
        404,
      )
    }
    return one(equipmentOf(row), { type: 'ZHEPA.Equipment' })
  }

  const filtered = location
    ? rows.filter((r) => r.sapFunctionalLocation.includes(location))
    : rows

  return many(filtered.map(equipmentOf), 'ZHEPA.Equipment')
}
