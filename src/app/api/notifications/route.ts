import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const patchSchema = z.object({
  ids: z.array(z.string().uuid()).optional(),
  markAllRead: z.boolean().optional(),
})

/**
 * GET — list notifications (newest first).
 * PATCH — mark as read by id(s) or all.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, metadata, read, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(80)

  if (error) {
    // Table may not exist yet (migration pending); avoid 500 spam in the client.
    const msg = error.message ?? ''
    if (!msg.includes('does not exist') && !msg.includes('schema cache')) {
      console.warn('[notifications GET]', msg)
    }
    return NextResponse.json({ notifications: [], unreadCount: 0 })
  }

  const unread = (data ?? []).filter((n) => !n.read).length

  return NextResponse.json({ notifications: data ?? [], unreadCount: unread })
}

export async function PATCH(request: Request) {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (parsed.data.markAllRead) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)

    if (error) {
      console.error('[notifications PATCH all]', error.message)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ ok: true })
  }

  const ids = parsed.data.ids
  if (!ids?.length) {
    return NextResponse.json({ error: 'No ids' }, { status: 400 })
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .in('id', ids)

  if (error) {
    console.error('[notifications PATCH]', error.message)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true })
}
