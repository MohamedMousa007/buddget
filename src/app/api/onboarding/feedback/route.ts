import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/database.types'

const MAX_BODY = 8000

/**
 * Persists user feedback during onboarding (budget preview, etc.) into
 * `public.onboarding_feedback` for product memory and AI context replay.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabase()
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const raw = (await req.json()) as {
      context?: unknown
      body?: unknown
      metadata?: unknown
    }
    const context = typeof raw.context === 'string' ? raw.context.trim() : ''
    const body = typeof raw.body === 'string' ? raw.body.trim() : ''
    if (!context || context.length > 120) {
      return NextResponse.json({ error: 'Invalid context' }, { status: 400 })
    }
    if (!body || body.length > MAX_BODY) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }
    const metadata =
      raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata) ?
        raw.metadata
      : {}

    const { error } = await supabase.from('onboarding_feedback').insert({
      user_id: user.id,
      context,
      body,
      metadata: metadata as Json,
    })
    if (error) {
      console.error('[onboarding/feedback] insert failed', error.message)
      return NextResponse.json({ error: 'Insert failed' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[onboarding/feedback] unexpected', e)
    return NextResponse.json({ error: 'Unexpected failure' }, { status: 500 })
  }
}
