import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { resolveRouteIdentity } from '@/lib/supabase/resolveRouteUser'

export type AiUserResult = { userId: string } | { denied: NextResponse }

/** Every AI route needs a signed-in user. Only a dev machine without Supabase may run anonymously. */
export async function requireAiUser(req: Request): Promise<AiUserResult> {
  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV !== 'production') return { userId: 'dev-local' }
    return { denied: NextResponse.json({ error: 'AI is not configured', stage: 'extract' }, { status: 503 }) }
  }
  const user = await resolveRouteIdentity(req)
  if (!user) return { denied: NextResponse.json({ error: 'Unauthorized', stage: 'extract' }, { status: 401 }) }
  return { userId: user.id }
}
