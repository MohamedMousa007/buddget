import { NextResponse } from 'next/server'
import { verifyAdminPin } from '@/lib/server/adminAuth'
import { createServiceRoleClient } from '@/lib/supabase/service'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const denied = verifyAdminPin(body?.pin)
    if (denied) return denied

    const days = Math.min(Math.max(Number(body?.days) || 7, 1), 90)
    const since = new Date(Date.now() - days * 86400000).toISOString()

    const admin = createServiceRoleClient()
    const { data: events, error } = await admin
      .from('app_analytics_events')
      .select('user_id, event_type, metadata, created_at')
      .gte('created_at', since)
      .limit(8000)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    type Row = {
      user_id: string
      event_type: string
      metadata: Record<string, unknown> | null
      created_at: string
    }

    const rows = (events ?? []) as Row[]
    const byUser: Record<
      string,
      { heartbeats: number; engagedSecondsApprox: number; sessionStarts: number }
    > = {}

    for (const row of rows) {
      const uid = row.user_id
      if (!byUser[uid]) {
        byUser[uid] = { heartbeats: 0, engagedSecondsApprox: 0, sessionStarts: 0 }
      }
      if (row.event_type === 'heartbeat') {
        byUser[uid].heartbeats += 1
        const sec = Number((row.metadata as { seconds?: number } | null)?.seconds)
        byUser[uid].engagedSecondsApprox += Number.isFinite(sec) ? sec : 45
      }
      if (row.event_type === 'session_start') {
        byUser[uid].sessionStarts += 1
      }
    }

    return NextResponse.json({
      since,
      days,
      eventCount: rows.length,
      byUser,
    })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
