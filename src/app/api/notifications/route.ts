import { gateOutdatedClient } from '@/lib/server/clientGate'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveApiUserId } from '@/lib/auth/resolveApiUser'
import { createServiceRoleClient } from '@/lib/supabase/service'

const patchSchema = z.object({
  ids: z.array(z.string().uuid()).optional(),
  markAllRead: z.boolean().optional(),
})

/**
 * GET — list notifications (newest first).
 * PATCH — mark as read by id(s) or all.
 */
export async function GET(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const uid = await resolveApiUserId(request)
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, message, metadata, is_read, created_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(80)

  if (error) {
    console.error('[notifications GET]', error.message)
    return NextResponse.json({ error: 'Could not load notifications' }, { status: 500 })
  }

  const unread = (data ?? []).filter((n) => !n.is_read).length

  return NextResponse.json({ notifications: data ?? [], unreadCount: unread })
}

export async function PATCH(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
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

  const uid = await resolveApiUserId(request)
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createServiceRoleClient()

  if (parsed.data.markAllRead) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', uid)
      .eq('is_read', false)

    if (error) {
      console.error('[notifications PATCH all]', error.message)
      return NextResponse.json({ error: 'Could not update notifications' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  const ids = parsed.data.ids
  if (!ids?.length) {
    return NextResponse.json({ error: 'No ids' }, { status: 400 })
  }

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', uid)
    .in('id', ids)

  if (error) {
    console.error('[notifications PATCH]', error.message)
    return NextResponse.json({ error: 'Could not update notifications' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
