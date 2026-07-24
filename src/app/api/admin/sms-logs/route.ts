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
      // Complete log of every received SMS — confirmed, notified, logged, rejected, failed.
      let query = service
        .from('sms_parse_log')
        .select(
          'id, user_id, sender, bank_name, merchant, clean_title, amount, currency, kind, failure_code, parse_method, confidence, raw_body, received_at, is_duplicate, source, account_last4, parsed_ok, expense_id, income_id, pattern_id, payment_instrument, status, pushed_at, push_result, confirmed_at, acked_at, learn_status, learn_template_id, matched_template_id',
        )
        .order('received_at', { ascending: false })
        .limit(Math.min(limit, 200))

      if (cursor) {
        query = query.lt('received_at', cursor)
      }

      const { data, error } = await query
      if (error) {
        console.error('[admin/sms-logs] list failed', error)
        return NextResponse.json({ error: 'Failed to load SMS logs' }, { status: 500 })
      }

      const rows = data ?? []

      // Resolve user_id → email for each row (service-role can read auth.users).
      // Small user base — one listUsers page is enough and mirrors /api/admin/users.
      const emailById = new Map<string, string | null>()
      const distinctIds = new Set(rows.map((r) => r.user_id))
      if (distinctIds.size > 0) {
        const { data: usersPage } = await service.auth.admin.listUsers({ page: 1, perPage: 200 })
        for (const u of usersPage?.users ?? []) emailById.set(u.id, u.email ?? null)
      }

      const enriched = rows.map((r) => ({ ...r, email: emailById.get(r.user_id) ?? null }))

      return NextResponse.json({
        errors: enriched,
        nextCursor: data && data.length === limit ? data[data.length - 1].received_at : null,
      })
    }

    return NextResponse.json({ error: 'Unknown op' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
