import { createServiceRoleClient } from '@/lib/supabase/service'
import { looksLikeJwt, resolveRouteIdentity } from '@/lib/supabase/resolveRouteUser'
import { DEVICE_ID_HEADER } from '@/lib/auth/deviceIdConstants'

export interface SmsCaller {
  userId: string | null
  deviceId: string | null
}

/** Bearer only: a Supabase JWT (native app, device id from header) or an `sms_ingest_tokens` token (killed-app forwarder, device id from the token row). */
export async function resolveSmsCaller(req: Request): Promise<SmsCaller> {
  const auth = req.headers.get('authorization') ?? ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null
  if (!bearer) return { userId: null, deviceId: null }

  if (looksLikeJwt(bearer)) {
    const identity = await resolveRouteIdentity(req)
    if (identity) return { userId: identity.id, deviceId: req.headers.get(DEVICE_ID_HEADER) }
  }

  const { data: tokenRow } = await createServiceRoleClient()
    .from('sms_ingest_tokens')
    .select('user_id, device_id')
    .eq('token', bearer)
    .eq('is_active', true)
    .single()

  return { userId: tokenRow?.user_id ?? null, deviceId: tokenRow?.device_id ?? null }
}
