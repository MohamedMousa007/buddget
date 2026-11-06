import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { resolveActiveApiIdentity } from '@/lib/auth/resolveApiUser'

export type AiUserResult = { userId: string } | { denied: NextResponse }

/** Every AI route needs a signed-in, non-suspended user. Only a dev machine without Supabase may run anonymously. */
export async function requireAiUser(req: Request): Promise<AiUserResult> {
  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV !== 'production') return { userId: 'dev-local' }
    return { denied: NextResponse.json({ error: 'AI is not configured', stage: 'extract' }, { status: 503 }) }
  }
  const user = await resolveActiveApiIdentity(req)
  if (!user) return { denied: NextResponse.json({ error: 'Unauthorized', stage: 'extract' }, { status: 401 }) }
  return { userId: user.id }
}
