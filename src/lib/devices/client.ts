import { apiFetchAuth } from '@/lib/apiBase'
import { isAndroid, isIOS, isNative } from '@/lib/native/isNative'

const BEAT_KEY = 'buddget_device_beat'
const beatKey = (userId: string) => `${BEAT_KEY}:${userId}`
const BEAT_EVERY_MS = 4 * 3600_000

async function selfReport() {
  const { getInstallKey } = await import('@/lib/native/deviceId')
  return {
    platform: isIOS() ? 'ios' : isAndroid() ? 'android' : 'web',
    model: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : null,
    installKey: await getInstallKey(),
  } as const
}

/** What the OS currently lets buddget do about notifications; null while the phone has not been asked. */
async function osPushPermission(): Promise<'granted' | 'denied' | null> {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    const { receive } = await PushNotifications.checkPermissions()
    return receive === 'granted' ? 'granted' : receive === 'denied' ? 'denied' : null
  } catch {
    return null
  }
}

const permKey = (userId: string) => `buddget_push_perm:${userId}`

/**
 * Tells the server this phone exists and is alive; a phone the owner removed signs itself out. It also reports the OS
 * notification permission, and a change in it goes out at once instead of waiting for the next scheduled heartbeat,
 * so a phone that was switched off in iOS or Android settings stops being counted as a place to send pushes.
 */
export async function sendDeviceHeartbeat(userId: string, collects: boolean | undefined): Promise<void> {
  if (!isNative()) return
  try {
    const pushPermission = await osPushPermission()
    const changed = localStorage.getItem(permKey(userId)) !== String(pushPermission)
    const last = Number(localStorage.getItem(beatKey(userId)) ?? 0)
    if (!changed && Date.now() - last < BEAT_EVERY_MS) return
    const res = await apiFetchAuth('/api/devices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(await selfReport()), collects, pushPermission }) })
    if (!res.ok) return
    localStorage.setItem(beatKey(userId), String(Date.now()))
    localStorage.setItem(permKey(userId), String(pushPermission))
    if (((await res.json()) as { revoked?: boolean }).revoked) await signOutRemovedDevice()
  } catch {
    /* best effort: the next open tries again */
  }
}

let lastQueueReport = { pending: 0, evicted: 0, at: 0 }
const QUEUE_REPORT_EVERY_MS = 10 * 60_000

/**
 * Tells the server how many captured SMS this phone still holds and why the last forward ended, so a backlog that
 * never clears is visible to staff. Sent when the count changes or every 10 minutes while a backlog exists.
 */
/**
 * The phone's own capture result (the Shortcut / receiver) stays first; a failed replay from the app is added after it,
 * so a stale-session `http_401` on the replay no longer hides what the Shortcut did. Fits the server's 60-character field.
 */
export function smsLastResult(captureResult: string | null | undefined, drainOutcome: string | null | undefined): string | null {
  const drainFailed = drainOutcome && drainOutcome !== 'delivered' ? `drain:${drainOutcome}` : null
  return [captureResult || null, drainFailed].filter(Boolean).join(' ').slice(0, 60) || null
}

export async function reportSmsQueue(status: { pendingCount?: number; oldestPendingAt?: string; lastResult?: string; evictedCount?: number; drainOutcome?: string | null } | null): Promise<void> {
  if (!isNative() || !status) return
  const pending = status.pendingCount ?? 0
  const evicted = status.evictedCount ?? 0
  const changed = pending !== lastQueueReport.pending || evicted !== lastQueueReport.evicted || lastQueueReport.at === 0
  if (!changed && (pending === 0 || Date.now() - lastQueueReport.at < QUEUE_REPORT_EVERY_MS)) return
  try {
    const res = await apiFetchAuth('/api/devices', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(await selfReport()), smsQueue: { pending, oldestAt: status.oldestPendingAt ?? null, lastResult: smsLastResult(status.lastResult, status.drainOutcome), evicted } }),
    })
    if (res.ok) lastQueueReport = { pending, evicted, at: Date.now() }
  } catch {
    /* the next drain reports again */
  }
}

const ROLE_PENDING_KEY = 'sms.rolePending'

/** The role this account chose here that the server has not confirmed yet, or null. Another account's value (or an unreadable one) is dropped. */
export function readPendingSmsRole(userId: string): boolean | null {
  try {
    const raw = localStorage.getItem(ROLE_PENDING_KEY)
    if (raw === null) return null
    const v = JSON.parse(raw) as { userId?: unknown; value?: unknown }
    if (v.userId === userId && typeof v.value === 'boolean') return v.value
    localStorage.removeItem(ROLE_PENDING_KEY)
  } catch {
    try { localStorage.removeItem(ROLE_PENDING_KEY) } catch { /* storage unavailable */ }
  }
  return null
}

function storePendingSmsRole(userId: string, value: boolean | null): void {
  try {
    if (value === null) localStorage.removeItem(ROLE_PENDING_KEY)
    else localStorage.setItem(ROLE_PENDING_KEY, JSON.stringify({ userId, value }))
  } catch {
    /* storage unavailable: nothing to remember the choice with */
  }
}

/** Which intent a start uses: the choice the server never confirmed beats the stale server row. */
export function resolveStartIntent(pending: boolean | null, device: boolean | null, account: boolean | null): boolean | null {
  return pending ?? device ?? account
}

/**
 * This phone's own SMS role, written when the user switches collecting on or off here. True only on a 2xx (two tries).
 * A failed write is remembered and replayed at the next start, so a lost write cannot flip the choice back.
 */
export async function setDeviceCollectsSms(userId: string, collectsSms: boolean): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await apiFetchAuth('/api/devices', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(await selfReport()), collectsSms }) })
      if (res.ok) {
        storePendingSmsRole(userId, null)
        return true
      }
    } catch {
      /* try again, then remember the choice */
    }
  }
  storePendingSmsRole(userId, collectsSms)
  return false
}

/** true / false from this phone's server record, or null when it has none yet or the read failed. */
export async function fetchDeviceCollectsSms(): Promise<boolean | null> {
  try {
    const res = await apiFetchAuth('/api/devices')
    if (!res.ok) return null
    const data = (await res.json()) as { thisDeviceId: string | null; devices: Array<{ deviceId: string; collectsSms: boolean }> }
    const me = data.devices.find((d) => d.deviceId === data.thisDeviceId)
    return me ? me.collectsSms : null
  } catch {
    return null
  }
}

/** `boundToken`: this phone holds an active token bound to it (always true once it has delivered). */
export interface ThisDeviceSms { firstAt: string | null; lastAt: string | null; boundToken: boolean }

/** This phone's first and last SMS on the server, or null when it has no record yet or the read failed. */
export async function fetchThisDeviceSms(): Promise<ThisDeviceSms | null> {
  try {
    const res = await apiFetchAuth('/api/devices')
    if (!res.ok) return null
    return ((await res.json()) as { thisDeviceSms?: ThisDeviceSms | null }).thisDeviceSms ?? null
  } catch {
    return null
  }
}

/** A removed phone signs out and forgets its identity, so signing in again registers it as a new device. */
async function signOutRemovedDevice(): Promise<void> {
  const { resetDeviceId } = await import('@/lib/native/deviceId')
  await resetDeviceId()
  const { createClient } = await import('@/lib/supabase/client')
  await createClient().auth.signOut({ scope: 'local' })
}
