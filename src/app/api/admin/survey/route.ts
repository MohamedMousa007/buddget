import { NextResponse } from 'next/server'
import { verifyAdminPin } from '@/lib/server/adminAuth'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { surveyConfigRootSchema } from '@/lib/onboarding/surveyConfig'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const denied = verifyAdminPin(body?.pin)
    if (denied) return denied

    const op = body?.op as string | undefined
    const admin = createServiceRoleClient()

    if (op === 'list') {
      const { data, error } = await admin
        .from('onboarding_survey_config')
        .select('id, version, published, config, updated_at')
        .order('updated_at', { ascending: false })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ rows: data ?? [] })
    }

    if (op === 'update') {
      const id = body?.id as string | undefined
      const configRaw = body?.config
      if (!id || typeof id !== 'string') {
        return NextResponse.json({ error: 'Missing id' }, { status: 400 })
      }

      const parsed = surveyConfigRootSchema.safeParse(configRaw)
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: 'Invalid survey config',
            details: parsed.error.issues?.slice(0, 12) ?? String(parsed.error),
          },
          { status: 400 }
        )
      }

      const { data, error } = await admin
        .from('onboarding_survey_config')
        .update({
          config: parsed.data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('id, version, published, config, updated_at')
        .maybeSingle()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ ok: true, row: data })
    }

    if (op === 'publish') {
      const id = body?.id as string | undefined
      if (!id || typeof id !== 'string') {
        return NextResponse.json({ error: 'Missing id' }, { status: 400 })
      }

      await admin
        .from('onboarding_survey_config')
        .update({ published: false, updated_at: new Date().toISOString() })
        .gte('version', 0)

      const { data, error } = await admin
        .from('onboarding_survey_config')
        .update({ published: true, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('id, version, published, config, updated_at')
        .maybeSingle()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ ok: true, row: data })
    }

    return NextResponse.json({ error: 'Unknown op' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
