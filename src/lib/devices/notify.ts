import { apiFetchAuth } from '@/lib/apiBase'
import { getOrCreateDeviceId } from '@/lib/native/deviceId'

export interface DeviceRow {
  deviceId: string
  name: string
  platform: string
  appVersion: string | null
  lastSeenAt: string
  collectsSms: boolean
  isMain: boolean
  /** The user's own choice; null means "only while this is the main phone". */
  notify: boolean | null
  pushPermission: 'granted' | 'denied' | null
  lastSmsAt: string | null
}

export interface DevicesPayload { thisDeviceId: string | null; devices: DeviceRow[] }

const CACHE_KEY = 'buddget_devices_cache'

/** Whether this phone is told about things right now: the OS allows it, and it is main or switched on. */
export const hearsNotifications = (d: Pick<DeviceRow, 'isMain' | 'notify' | 'pushPermission'>): boolean => d.pushPermission !== 'denied' && (d.notify ?? d.isMain)

/** The other phones that already get notifications, which is what a new phone should be reassured about. */
export const otherNotifiers = (payload: DevicesPayload, thisId: string | null): DeviceRow[] =>
  payload.devices.filter((d) => d.deviceId !== thisId && hearsNotifications(d))

export async function fetchDevices(): Promise<DevicesPayload | null> {
  try {
    const res = await apiFetchAuth('/api/devices')
    return res.ok ? ((await res.json()) as DevicesPayload) : null
  } catch {
    return null
  }
}

/** The last list this phone saw for this account, so the sheet opens with something while it refreshes. */
export function readCachedDevices(userId: string | null): DevicesPayload | null {
  if (!userId) return null
  try {
    const raw = localStorage.getItem(`${CACHE_KEY}:${userId}`)
    return raw ? (JSON.parse(raw) as DevicesPayload) : null
  } catch {
    return null
  }
}

export function writeCachedDevices(userId: string | null, payload: DevicesPayload): void {
  if (!userId) return
  try {
    localStorage.setItem(`${CACHE_KEY}:${userId}`, JSON.stringify(payload))
  } catch {
    /* a full or blocked store only costs the head start */
  }
}

async function patch(deviceId: string, body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await apiFetchAuth(`/api/devices/${encodeURIComponent(deviceId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return res.ok
  } catch {
    return false
  }
}

export const setDeviceNotify = (deviceId: string, notify: boolean | null) => patch(deviceId, { notify })
export const makeDeviceMain = (deviceId: string) => patch(deviceId, { makeMain: true })

/** Tells the server what this phone's notification choice and OS permission are. Best effort: the next open repeats it. */
export async function reportThisDevice(notify: boolean | null): Promise<void> {
  const id = await getOrCreateDeviceId()
  if (id) await setDeviceNotify(id, notify)
}
