import { STALE_MAIN_DAYS, defaultDeviceName, nextMain } from '@/lib/devices/policy'
import { emitNotification } from '@/lib/server/emitNotification'
import type { ServiceClient } from '@/lib/supabase/service'

export interface SelfReport {
  platform: 'ios' | 'android' | 'web'
  model?: string | null
  appVersion?: string | null
  /** What this phone reports about itself the first time we see it; later the server decides. */
  collects?: boolean
  collectsSms?: boolean
  /** The OS notification permission, as the phone sees it. */
  pushPermission?: 'granted' | 'denied' | null
}

const UNIQUE_VIOLATION = '23505'

/**
 * Makes this phone the main one (notifications on) and clears the flag everywhere else first, so the one-main index holds.
 * The only path that promotes a phone; `extra` rides on the same write. Returns false when any write fails.
 */
export async function setMain(service: ServiceClient, userId: string, deviceId: string, extra: Record<string, unknown> = {}): Promise<boolean> {
  const demote = await service.from('user_devices').update({ is_main: false }).eq('user_id', userId).eq('is_main', true).neq('device_id', deviceId)
  if (demote.error) return false
  const { error } = await service.from('user_devices').update({ is_main: true, ...extra }).eq('user_id', userId).eq('device_id', deviceId).is('revoked_at', null)
  return !error
}

/**
 * When the main phone is removed (or goes stale) the best remaining phone takes over, and the user is told which one.
 * With no phone left to take over, the in-app notification is the only record and says so.
 */
export async function promoteMain(service: ServiceClient, userId: string, leavingDeviceId: string, why: 'removed' | 'stale', prefer?: string): Promise<void> {
  const { data: rows } = await service.from('user_devices').select('device_id, name, platform, collects_sms, last_seen_at, revoked_at, push_permission').eq('user_id', userId).is('revoked_at', null)
  const next = prefer ? rows?.find((d) => d.device_id === prefer) : nextMain(rows ?? [], leavingDeviceId)
  const cause = why === 'removed' ? 'was removed' : `has not been opened in ${STALE_MAIN_DAYS} days`
  if (!next) {
    await emitNotification(service, {
      userId, category: 'device_main_changed', severity: 'warning', dedupeKey: `main-none:${leavingDeviceId}`,
      title: 'No phone is set to get notifications',
      body: `Your main phone ${cause}, and no other phone can take over. Open Buddget on the phone you want to use and turn notifications on in Settings, Your devices.`,
      push: false,
    })
    return
  }
  if (!(await setMain(service, userId, next.device_id))) return
  await emitNotification(service, {
    userId, category: 'device_main_changed', severity: 'info', dedupeKey: `main:${leavingDeviceId}:${next.device_id}`,
    title: `${next.name ?? defaultDeviceName(next.platform, null)} is now your main phone`,
    body: `Your previous main phone ${cause}, so notifications now go to this phone. You can change it in Settings, Your devices.`,
  })
}

/** Creates this install's row, or refreshes what the phone knows about itself. Roles are never overwritten by a heartbeat. */
export async function upsertSelf(service: ServiceClient, userId: string, deviceId: string, report: SelfReport) {
  const now = new Date().toISOString()
  const { data: all } = await service.from('user_devices').select('*').eq('user_id', userId)
  const existing = all?.find((d) => d.device_id === deviceId)
  if (existing?.revoked_at) return { revoked: true as const }
  const others = (all ?? []).filter((d) => d.device_id !== deviceId && !d.revoked_at)
  const main = others.find((d) => d.is_main)

  if (!existing) {
    const name = defaultDeviceName(report.platform, report.model)
    const row = {
      user_id: userId, device_id: deviceId, platform: report.platform, model: report.model ?? null,
      name, app_version: report.appVersion ?? null,
      collects_sms: report.collectsSms ?? report.collects ?? false, last_seen_at: now,
      push_permission: report.pushPermission ?? null,
    }
    let { error } = await service.from('user_devices').insert({ ...row, is_main: !main })
    if (error?.code === UNIQUE_VIOLATION && !main) ({ error } = await service.from('user_devices').insert({ ...row, is_main: false }))
    if (!error && main) {
      await emitNotification(service, {
        userId, category: 'device_joined', severity: 'info', dedupeKey: `device-joined:${deviceId}`,
        title: 'A new phone signed in',
        body: `${name} signed in to your account. It stays quiet unless you turn notifications on for it in Settings, Your devices.`,
      })
    }
  } else {
    await service.from('user_devices').update({
      platform: report.platform, model: report.model ?? null, app_version: report.appVersion ?? null, last_seen_at: now,
      ...(report.collectsSms !== undefined ? { collects_sms: report.collectsSms } : {}),
      ...(report.pushPermission !== undefined ? { push_permission: report.pushPermission } : {}),
    }).eq('user_id', userId).eq('device_id', deviceId)
    const stale = main && Date.now() - Date.parse(main.last_seen_at) > STALE_MAIN_DAYS * 86_400_000
    if (!existing.is_main && stale && report.pushPermission !== 'denied') await promoteMain(service, userId, main.device_id, 'stale', deviceId)
    else if (!existing.is_main && !main && report.pushPermission !== 'denied') await setMain(service, userId, deviceId)
  }
  const { data } = await service.from('user_devices').select('*').eq('user_id', userId).eq('device_id', deviceId).single()
  return { revoked: false as const, device: data }
}

/** True when the owner removed this phone. A removed phone must not collect texts, mint tokens or register for pushes. */
export async function isRevokedDevice(service: ServiceClient, userId: string, deviceId: string | null | undefined): Promise<boolean> {
  if (!deviceId) return false
  const { data } = await service.from('user_devices').select('revoked_at').eq('user_id', userId).eq('device_id', deviceId).maybeSingle()
  return Boolean(data?.revoked_at)
}
