import { NextResponse } from 'next/server'
import { dhlPackActive } from '@/lib/dhl-gse/register.js'
import { generateAuditReport, normalizeAuditPeriod } from '@/lib/dhl-gse/auditReport.js'

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
  const result = await generateAuditReport({ period })
  return new NextResponse(Buffer.from(result.bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${result.filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
