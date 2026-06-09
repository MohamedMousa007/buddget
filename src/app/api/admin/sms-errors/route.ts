import { NextResponse } from 'next/server'
import { verifyAdminPin } from '@/lib/server/adminAuth'
import { createServiceRoleClient } from '@/lib/supabase/service'

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      pin?: unknown
      op?: string
      cursor?: string
      limit?: number
    }
    const { pin, op, cursor, limit = 50 } = body ?? {}

    const denied = verifyAdminPin(pin, req)
    if (denied) return denied

    const service = createServiceRoleClient()

    if (op === 'list') {
      let query = service
        .from('sms_parse_log')
        .select(
          'id, user_id, sender, bank_name, merchant, clean_title, amount, currency, kind, failure_code, parse_method, confidence, raw_body, received_at, is_duplicate, source, account_last4',
        )
        .eq('parsed_ok', false)
        .order('received_at', { ascending: false })
        .limit(Math.min(limit, 200))

      if (cursor) {
        query = query.lt('received_at', cursor)
      }

      const { data, error } = await query
      if (error) {
        console.error('[admin/sms-errors] list failed', error)
        return NextResponse.json({ error: 'Failed to load error queue' }, { status: 500 })
      }

      return NextResponse.json({
        errors: data ?? [],
        nextCursor: data && data.length === limit ? data[data.length - 1].received_at : null,
      })
    }

    return NextResponse.json({ error: 'Unknown op' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
