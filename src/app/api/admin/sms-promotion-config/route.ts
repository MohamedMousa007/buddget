import { NextResponse } from 'next/server'
import { verifyAdminPin } from '@/lib/server/adminAuth'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { invalidateSenderCache, invalidateAllCache } from '@/lib/sms/templateCache'
import { invalidateConfigCache } from '@/lib/sms/promotionChecker'

const DEFAULTS = {
  min_match_count: 50,
  min_unique_users: 3,
  min_age_days: 7,
  max_failure_rate: 0.05,
  min_avg_confidence: 0.90,
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      pin?: unknown
      op?: string
      config?: {
        min_match_count?: number
        min_unique_users?: number
        min_age_days?: number
        max_failure_rate?: number
        min_avg_confidence?: number
      }
    }
    const { pin, op, config } = body ?? {}

    const denied = verifyAdminPin(pin, req)
    if (denied) return denied

    const service = createServiceRoleClient()

    if (op === 'get') {
      const { data, error } = await service
        .from('sms_promotion_config')
        .select('*')
        .eq('id', 1)
        .single()

      if (error) {
        console.error('[admin/sms-promotion-config] get failed', error)
        return NextResponse.json({ error: 'Failed to load config' }, { status: 500 })
      }
      return NextResponse.json({ config: data })
    }

    if (op === 'save' && config) {
      const safe: Record<string, unknown> = { updated_at: new Date().toISOString() }

      if (typeof config.min_match_count === 'number') safe.min_match_count = Math.max(1, Math.floor(config.min_match_count))
      if (typeof config.min_unique_users === 'number') safe.min_unique_users = Math.max(1, Math.floor(config.min_unique_users))
      if (typeof config.min_age_days === 'number') safe.min_age_days = Math.max(0, Math.floor(config.min_age_days))
      if (typeof config.max_failure_rate === 'number') safe.max_failure_rate = Math.max(0, Math.min(1, config.max_failure_rate))
      if (typeof config.min_avg_confidence === 'number') safe.min_avg_confidence = Math.max(0, Math.min(1, config.min_avg_confidence))

      const { data, error } = await service
        .from('sms_promotion_config')
        .update(safe)
        .eq('id', 1)
        .select()
        .single()

      if (error) {
        console.error('[admin/sms-promotion-config] save failed', error)
        return NextResponse.json({ error: 'Save failed' }, { status: 500 })
      }
      invalidateConfigCache()
      return NextResponse.json({ ok: true, config: data })
    }

    if (op === 'reset_defaults') {
      const { data, error } = await service
        .from('sms_promotion_config')
        .update({ ...DEFAULTS, updated_at: new Date().toISOString() })
        .eq('id', 1)
        .select()
        .single()

      if (error) {
        console.error('[admin/sms-promotion-config] reset failed', error)
        return NextResponse.json({ error: 'Reset failed' }, { status: 500 })
      }
      invalidateConfigCache()
      return NextResponse.json({ ok: true, config: data })
    }

    if (op === 'run_auto_promote') {
      const { data: eligible, error: eligErr } = await service.rpc('check_sms_promotion_eligibility')

      if (eligErr) {
        console.error('[admin/sms-promotion-config] eligibility check failed', eligErr)
        return NextResponse.json({ error: 'Eligibility check failed' }, { status: 500 })
      }

      const rows = (eligible ?? []) as Array<{ template_id: string; sender: string }>
      let promoted = 0

      for (const row of rows) {
        const { error } = await service
          .from('sms_tracking_templates_ai')
          .update({
            tier: 'promoted',
            auto_promoted: true,
            promoted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.template_id)

        if (!error) {
          promoted++
          invalidateSenderCache(row.sender)
        }
      }

      if (promoted > 0) invalidateAllCache()

      return NextResponse.json({ ok: true, promoted, eligible: rows.length })
    }

    return NextResponse.json({ error: 'Unknown op' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
