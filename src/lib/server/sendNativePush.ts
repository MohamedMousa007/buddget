import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { getFirebaseAdmin } from '@/lib/server/firebaseAdmin'
import { maskPush } from '@/lib/privacy/pushMask'
import type { PrivacySettings } from '@/lib/store/types'
import { pushTargets, type DevicePrefs } from '@/lib/devices/policy'

export interface SendNativePushArgs {
  userId: string
  title: string
  body: string
  data?: Record<string, string>
  collapseKey?: string
  /** A test from one phone: goes to that phone alone, whatever its notification setting, so the button always answers. */
  onlyDeviceId?: string | null
}

export interface SendNativePushResult {
  ok: boolean
  sent?: number
  failed?: number
  error?: string
}

/**
 * Fans out a push notification to the phones that should hear it (see `pushTargets`: the main phone and any phone the
 * user switched on; never a removed phone or one that is switched off). Stale tokens (UNREGISTERED / INVALID_ARGUMENT) are deleted in the same pass
 * so the table stays clean. Returns counts; never throws.
 */
export async function sendNativePush(args: SendNativePushArgs): Promise<SendNativePushResult> {
  const fa = getFirebaseAdmin()
  if (!fa) {
    return { ok: false, error: 'FIREBASE_SERVICE_ACCOUNT_JSON not configured' }
  }

  const service = createServiceRoleClient()
  const { data: rows, error } = await service
    .from('push_tokens')
    .select('token, platform, device_id')
    .eq('user_id', args.userId)

  if (error) {
    console.error('[sendNativePush] fetch tokens failed', error)
    return { ok: false, error: 'Failed to load tokens' }
  }

  if (!rows || rows.length === 0) {
    return { ok: true, sent: 0, failed: 0 }
  }

  let targets = rows
  if (args.onlyDeviceId) {
    targets = rows.filter((r) => r.device_id === args.onlyDeviceId)
  } else {
    const { data: devs } = await service.from('user_devices').select('device_id, is_main, notify, push_permission, revoked_at').eq('user_id', args.userId)
    targets = pushTargets(rows, new Map<string, DevicePrefs>((devs ?? []).map((d) => [d.device_id, d])))
  }
  if (targets.length === 0) return { ok: true, sent: 0, failed: 0 }
  const tokens = targets.map((r) => r.token)
  const { data: prefs, error: prefsError } = await service.from('user_settings').select('privacy, language').eq('user_id', args.userId).maybeSingle()
  const { title, body, data } = maskPush(
    { title: args.title, body: args.body, data: args.data },
    prefsError ? null : ((prefs?.privacy ?? undefined) as PrivacySettings | undefined),
    prefs?.language,
  )

  let sent = 0
  let failed = 0
  const stale: string[] = []

  // firebase-admin sendEachForMulticast (max 500 tokens per call).
  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500)
    try {
      const res = await fa.messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
        data,
        android: {
          priority: 'high',
          collapseKey: args.collapseKey,
          notification: { sound: 'default', channelId: 'buddget-default' },
        },
        apns: {
          headers: args.collapseKey ? { 'apns-collapse-id': args.collapseKey } : undefined,
          payload: {
            aps: { sound: 'default', badge: 1 },
          },
        },
      })

      sent += res.successCount
      failed += res.failureCount

      res.responses.forEach((r, idx) => {
        if (r.success) return
        const code = r.error?.code ?? ''
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/invalid-argument'
        ) {
          stale.push(batch[idx]!)
        }
      })
    } catch (e) {
      console.error('[sendNativePush] batch failed', e)
      failed += batch.length
    }
  }

  if (stale.length > 0) {
    await service
      .from('push_tokens')
      .delete()
      .eq('user_id', args.userId)
      .in('token', stale)
  }

  return { ok: true, sent, failed }
}
