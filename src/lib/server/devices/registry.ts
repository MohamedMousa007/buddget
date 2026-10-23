import { defaultDeviceName } from '@/lib/devices/policy'
import type { ServiceClient } from '@/lib/supabase/service'

export interface SelfReport {
  platform: 'ios' | 'android' | 'web'
  model?: string | null
  appVersion?: string | null
  /** What this phone reports about itself the first time we see it; later the server decides. */
  collects?: boolean
  collectsSms?: boolean
}

/** Creates this install's row, or refreshes what the phone knows about itself. Roles are never overwritten by a heartbeat. */
export async function upsertSelf(service: ServiceClient, userId: string, deviceId: string, report: SelfReport) {
  const now = new Date().toISOString()
  const { data: existing } = await service.from('user_devices').select('device_id, revoked_at').eq('user_id', userId).eq('device_id', deviceId).maybeSingle()
  if (existing?.revoked_at) return { revoked: true as const }
  if (!existing) {
    await service.from('user_devices').insert({
      user_id: userId, device_id: deviceId, platform: report.platform, model: report.model ?? null,
      name: defaultDeviceName(report.platform, report.model), app_version: report.appVersion ?? null,
      collects_sms: report.collectsSms ?? report.collects ?? false, last_seen_at: now,
    })
  } else {
    await service.from('user_devices').update({
      platform: report.platform, model: report.model ?? null, app_version: report.appVersion ?? null, last_seen_at: now,
      ...(report.collectsSms !== undefined ? { collects_sms: report.collectsSms } : {}),
    }).eq('user_id', userId).eq('device_id', deviceId)
  }
  const { data } = await service.from('user_devices').select('*').eq('user_id', userId).eq('device_id', deviceId).single()
  return { revoked: false as const, device: data }
}
