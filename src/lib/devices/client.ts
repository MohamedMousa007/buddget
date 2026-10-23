import { apiFetchAuth } from '@/lib/apiBase'
import { isAndroid, isIOS, isNative } from '@/lib/native/isNative'

const BEAT_KEY = 'buddget_device_beat'
const beatKey = (userId: string) => `${BEAT_KEY}:${userId}`
const BEAT_EVERY_MS = 4 * 3600_000

function selfReport() {
  return {
    platform: isIOS() ? 'ios' : isAndroid() ? 'android' : 'web',
    model: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : null,
  } as const
}

/** Tells the server this phone exists and is alive; a phone the owner removed signs itself out. */
export async function sendDeviceHeartbeat(userId: string, collects: boolean | undefined): Promise<void> {
  if (!isNative()) return
  try {
    const last = Number(localStorage.getItem(beatKey(userId)) ?? 0)
    if (Date.now() - last < BEAT_EVERY_MS) return
    const res = await apiFetchAuth('/api/devices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...selfReport(), collects }) })
    if (!res.ok) return
    localStorage.setItem(beatKey(userId), String(Date.now()))
    if (((await res.json()) as { revoked?: boolean }).revoked) await signOutRemovedDevice()
  } catch {
    /* best effort: the next open tries again */
  }
}

/** This phone's own SMS role, written when the user switches collecting on or off here. */
export async function setDeviceCollectsSms(collectsSms: boolean): Promise<void> {
  try {
    await apiFetchAuth('/api/devices', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...selfReport(), collectsSms }) })
  } catch {
    /* the heartbeat reports the real state on the next open */
  }
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

/** A removed phone signs out and forgets its identity, so signing in again registers it as a new device. */
async function signOutRemovedDevice(): Promise<void> {
  const { resetDeviceId } = await import('@/lib/native/deviceId')
  await resetDeviceId()
  const { createClient } = await import('@/lib/supabase/client')
  await createClient().auth.signOut()
}
