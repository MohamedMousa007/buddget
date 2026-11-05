import { createServiceRoleClient } from '@/lib/supabase/service'
import { looksLikeJwt, resolveRouteIdentity } from '@/lib/supabase/resolveRouteUser'
import { isAccountActive } from '@/lib/auth/accountActive'
import { DEVICE_ID_HEADER } from '@/lib/auth/deviceIdConstants'

export interface SmsCaller {
  userId: string | null
  deviceId: string | null
  /** True when authenticated by a Supabase JWT, whose device id is client-supplied via header. */
  viaJwt: boolean
}

const NO_CALLER: SmsCaller = { userId: null, deviceId: null, viaJwt: false }

/** Bearer only: a Supabase JWT (native app, device id from header) or an `sms_ingest_tokens` token (killed-app forwarder, device id from the token row). A suspended or deleted account resolves to no caller on either path. */
export async function resolveSmsCaller(req: Request): Promise<SmsCaller> {
  const caller = await resolveSmsCallerUnchecked(req)
  return caller.userId && !(await isAccountActive(caller.userId)) ? NO_CALLER : caller
}

async function resolveSmsCallerUnchecked(req: Request): Promise<SmsCaller> {
  const auth = req.headers.get('authorization') ?? ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null
  if (!bearer) return NO_CALLER

  if (looksLikeJwt(bearer)) {
    const identity = await resolveRouteIdentity(req)
    if (identity) return { userId: identity.id, deviceId: req.headers.get(DEVICE_ID_HEADER)?.trim() || null, viaJwt: true }
  }

  const { data: tokenRow } = await createServiceRoleClient()
    .from('sms_ingest_tokens')
    .select('user_id, device_id')
    .eq('token', bearer)
    .eq('is_active', true)
    .single()

  return { userId: tokenRow?.user_id ?? null, deviceId: tokenRow?.device_id ?? null, viaJwt: false }
}
