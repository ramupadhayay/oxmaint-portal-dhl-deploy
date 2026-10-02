import { NextResponse } from 'next/server'
import { dhlPackActive } from '@/lib/dhl-gse/register.js'
import { buildAuditModel, generateAuditReport, normalizeAuditPeriod } from '@/lib/dhl-gse/auditReport.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
  if (!dhlPackActive()) {
    return NextResponse.json(
      { ok: false, error: 'Airline audit pack is only on NEXT_PUBLIC_OXMAINT_PACK=dhl-gse.' },
      { status: 404 },
    )
  }
  const period = normalizeAuditPeriod(request.nextUrl.searchParams.get('period'))
  const format = String(request.nextUrl.searchParams.get('format') || 'json').toLowerCase()
  if (format === 'pdf') {
    const result = await generateAuditReport({ period })
    return new NextResponse(Buffer.from(result.bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  }
  const model = buildAuditModel({ period })
  return NextResponse.json({
    ok: true,
    honesty: model.honesty,
    period: model.period.key,
    label: model.period.label,
    start: model.period.start,
    end: model.period.end,
    work_orders: model.period.items.length,
    pm: model.pm,
    health: model.health,
    procurement: {
      reservations: model.procurement.reservations,
      pr: model.procurement.pr,
      po: model.procurement.po,
      gr: model.procurement.gr,
      parts_hold: model.procurement.parts_hold,
    },
    workmanship: model.workmanship.technicians,
    pdf: `/api/oxmaint/audit-report.pdf?period=${model.period.key}`,
    portal: `/portal/oxmaint/gse-audit-report?period=${model.period.key}`,
  })
}
