import { handleMcpHttp } from '@/lib/mcp/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export function OPTIONS(request) {
  return handleMcpHttp(request)
}

export function GET(request) {
  return handleMcpHttp(request)
}

export function POST(request) {
  return handleMcpHttp(request)
}

export function DELETE(request) {
  return handleMcpHttp(request)
}

export function HEAD(request) {
  return handleMcpHttp(request)
}
