import { NextResponse } from 'next/server'
import { buildInfo } from '@/lib/health/buildInfo'

export const dynamic = 'force-dynamic'

/** Shallow liveness for an uptime probe: the app answers. No database, no auth, nothing secret. */
export function GET() {
  return NextResponse.json({ ok: true, ...buildInfo(), time: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } })
}
