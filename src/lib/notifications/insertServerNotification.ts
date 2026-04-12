import { createServiceRoleClient } from '@/lib/supabase/service'

export async function insertNotificationForUser(params: {
  userId: string
  type: string
  title: string
  body?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    const supabase = createServiceRoleClient()
    const { error } = await supabase.from('notifications').insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      metadata: params.metadata ?? {},
      read: false,
    })
    if (error) console.error('[notification insert]', error.message)
  } catch (e) {
    console.error('[notification insert]', e)
  }
}
