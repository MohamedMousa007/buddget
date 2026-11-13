import { STALE_MAIN_DAYS, defaultDeviceName, nextMain } from '@/lib/devices/policy'
import { emitNotification } from '@/lib/server/emitNotification'
import { renderServerCopy } from '@/lib/notifications/serverCopy'
import { getUserDictionary } from '@/lib/server/userDictionary'
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
  /** The Auth session this heartbeat arrived on; removing the phone ends exactly that session. */
  sessionId?: string | null
  /** The on-device SMS queue: captured messages the server has not accepted yet. */
  smsQueue?: { pending: number; oldestAt: string | null; lastResult: string | null }
}

const UNIQUE_VIOLATION = '23505'
export const MAX_LIVE_DEVICES = 20

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
  const dict = await getUserDictionary(service, userId)
  if (!next) {
    await emitNotification(service, {
      userId, category: 'device_main_changed', severity: 'warning', dedupeKey: `main-none:${leavingDeviceId}`,
      ...renderServerCopy(dict, { kind: 'device_none', cause: why }),
      push: false,
    })
    return
  }
  if (!(await setMain(service, userId, next.device_id))) return
  await emitNotification(service, {
    userId, category: 'device_main_changed', severity: 'info', dedupeKey: `main:${leavingDeviceId}:${next.device_id}`,
    ...renderServerCopy(dict, { kind: 'device_main', deviceName: next.name ?? defaultDeviceName(next.platform, null), cause: why }),
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
    if (others.length >= MAX_LIVE_DEVICES) return { revoked: false as const, device: null }
    const name = defaultDeviceName(report.platform, report.model)
    const row = {
      user_id: userId, device_id: deviceId, platform: report.platform, model: report.model ?? null,
      name, app_version: report.appVersion ?? null,
      collects_sms: report.collectsSms ?? report.collects ?? false, last_seen_at: now,
      push_permission: report.pushPermission ?? null,
      session_id: report.sessionId ?? null,
    }
    let { error } = await service.from('user_devices').insert({ ...row, is_main: !main })
    if (error?.code === UNIQUE_VIOLATION && !main) ({ error } = await service.from('user_devices').insert({ ...row, is_main: false }))
    if (!error && main) {
      await emitNotification(service, {
        userId, category: 'device_joined', severity: 'info', dedupeKey: `device-joined:${deviceId}`,
        ...renderServerCopy(await getUserDictionary(service, userId), { kind: 'device_joined', deviceName: name }),
      })
    }
  } else {
    await service.from('user_devices').update({
      platform: report.platform, model: report.model ?? null, app_version: report.appVersion ?? null, last_seen_at: now,
      ...(report.collectsSms !== undefined ? { collects_sms: report.collectsSms } : {}),
      ...(report.pushPermission !== undefined ? { push_permission: report.pushPermission } : {}),
      ...(report.sessionId ? { session_id: report.sessionId } : {}),
      ...(report.smsQueue ? { sms_queue_pending: report.smsQueue.pending, sms_queue_oldest_at: report.smsQueue.oldestAt, sms_last_result: report.smsQueue.lastResult, sms_queue_reported_at: now } : {}),
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

/** True when the owner has removed at least one phone. The trigger for refusing requests that name no phone at all (a removed phone can simply drop its id). */
export async function hasRevokedDevice(service: ServiceClient, userId: string): Promise<boolean> {
  const { count } = await service.from('user_devices').select('device_id', { count: 'exact', head: true }).eq('user_id', userId).not('revoked_at', 'is', null)
  return (count ?? 0) > 0
}

/** True when the account has ever registered a phone (removed ones count: a removed phone must not escape by going anonymous). */
export async function hasAnyDevice(service: ServiceClient, userId: string): Promise<boolean> {
  const { count } = await service.from('user_devices').select('device_id', { count: 'exact', head: true }).eq('user_id', userId)
  return (count ?? 0) > 0
}
