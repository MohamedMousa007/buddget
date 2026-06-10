import { NextResponse } from 'next/server'
import { verifyAdminPin } from '@/lib/server/adminAuth'
import { createServiceRoleClient } from '@/lib/supabase/service'

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      pin?: unknown
      op?: string
      id?: string
      sender?: string
      patch?: { ai_enabled?: boolean; regex_pattern?: string }
    }
    const { pin, op, id, sender, patch } = body ?? {}

    const denied = verifyAdminPin(pin, req)
    if (denied) return denied

    const service = createServiceRoleClient()

    if (op === 'list') {
      const { data, error } = await service
        .from('sms_tracking_templates_ai')
        .select('*')
        .order('match_count', { ascending: false })
      if (error) {
        console.error('[admin/sms-templates] list failed', error)
        return NextResponse.json({ error: 'Failed to load templates' }, { status: 500 })
      }
      return NextResponse.json({ templates: data ?? [] })
    }

    if (op === 'update' && typeof id === 'string') {
      const safe: {
        updated_at: string
        ai_enabled?: boolean
        regex_pattern?: string
      } = { updated_at: new Date().toISOString() }

      if (typeof patch?.ai_enabled === 'boolean') {
        safe.ai_enabled = patch.ai_enabled
      }
      if (typeof patch?.regex_pattern === 'string') {
        // Server-side validation: reject patterns that don't compile
        try { new RegExp(patch.regex_pattern) } catch {
          return NextResponse.json({ error: 'Invalid regex pattern' }, { status: 400 })
        }
        safe.regex_pattern = patch.regex_pattern
      }

      if (Object.keys(safe).length === 1) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
      }

      const { data, error } = await service
        .from('sms_tracking_templates_ai')
        .update(safe)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('[admin/sms-templates] update failed', error)
        return NextResponse.json({ error: 'Update failed' }, { status: 500 })
      }
      return NextResponse.json({ ok: true, template: data })
    }

    if (op === 'delete' && typeof id === 'string') {
      const { error } = await service
        .from('sms_tracking_templates_ai')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('[admin/sms-templates] delete failed', error)
        return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
      }
      return NextResponse.json({ ok: true })
    }

    if (op === 'bulk_toggle' && typeof patch?.ai_enabled === 'boolean') {
      const { error } = await service
        .from('sms_tracking_templates_ai')
        .update({ ai_enabled: patch.ai_enabled, updated_at: new Date().toISOString() })
        .neq('id', '00000000-0000-0000-0000-000000000000') // Supabase requires a filter for safety

      if (error) {
        console.error('[admin/sms-templates] bulk_toggle failed', error)
        return NextResponse.json({ error: 'Bulk update failed' }, { status: 500 })
      }
      return NextResponse.json({ ok: true })
    }

    if (op === 'promote' && typeof id === 'string' && typeof sender === 'string') {
      const { error } = await service
        .from('sms_tracking_templates_ai')
        .update({ tier: 'promoted', promoted_at: new Date().toISOString(), auto_promoted: false, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) {
        console.error('[admin/sms-templates] promote failed', error)
        return NextResponse.json({ error: 'Promote failed' }, { status: 500 })
      }
      return NextResponse.json({ ok: true })
    }

    if (op === 'demote' && typeof id === 'string' && typeof sender === 'string') {
      const { error } = await service
        .from('sms_tracking_templates_ai')
        .update({ tier: 'learned', promoted_at: null, auto_promoted: false, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) {
        console.error('[admin/sms-templates] demote failed', error)
        return NextResponse.json({ error: 'Demote failed' }, { status: 500 })
      }
      return NextResponse.json({ ok: true })
    }

    if (op === 'check_eligibility') {
      const { data, error } = await service.rpc('check_sms_promotion_eligibility')
      if (error) {
        console.error('[admin/sms-templates] check_eligibility failed', error)
        return NextResponse.json({ error: 'Eligibility check failed' }, { status: 500 })
      }
      return NextResponse.json({ eligible: data ?? [] })
    }

    return NextResponse.json({ error: 'Unknown op' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
