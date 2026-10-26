export interface DevicePrefs {
  is_main: boolean
  /** true / false is the user's own choice for this phone; null means "only the main phone". */
  notify: boolean | null
  /** What the phone last told us about the OS notification permission. */
  push_permission: string | null
  revoked_at: string | null
}

export interface PushTarget { token: string; device_id: string | null }

/** A removed phone never; a phone whose OS permission is off never; otherwise the user's choice, else the main phone. */
export const notifiesDevice = (d: DevicePrefs): boolean => !d.revoked_at && d.push_permission !== 'denied' && (d.notify ?? d.is_main)

/**
 * Who hears a push, for every kind of push. An explicit "off" is never overridden, and nobody is told "because no one
 * else could be": with no phone left to tell, the in-app notification is the record. The one exception is an account
 * with no phone registered at all (an install that predates the devices list), which keeps its single phone notified.
 * Tokens that belong to no registered phone are old installs on an account that has newer phones, so they stay quiet.
 */
export function pushTargets<T extends PushTarget>(tokens: readonly T[], devices: ReadonlyMap<string, DevicePrefs>): T[] {
  const registered = [...devices.values()].some((d) => !d.revoked_at)
  if (!registered) return [...tokens]
  return tokens.filter((t) => {
    const d = t.device_id ? devices.get(t.device_id) : undefined
    return d ? notifiesDevice(d) : false
  })
}

/** A readable default name from what the shell reports. */
export function defaultDeviceName(platform: string, userAgent: string | null | undefined): string {
  if (platform === 'ios') return /iPad/.test(userAgent ?? '') ? 'iPad' : 'iPhone'
  if (platform === 'android') {
    const m = /Android [\d.]+; ([^;)]+?)(?: Build|\))/.exec(userAgent ?? '')
    const model = m?.[1]?.trim()
    return model && model !== 'K' ? model : 'Android phone'
  }
  return 'Web browser'
}

/** Which active phone takes over as main when the main one goes: texts collected first, then most recently seen. */
export function nextMain<T extends { device_id: string; collects_sms: boolean; last_seen_at: string; revoked_at: string | null; push_permission: string | null }>(devices: readonly T[], leaving: string): T | undefined {
  return devices
    .filter((d) => d.device_id !== leaving && !d.revoked_at && d.push_permission !== 'denied')
    .sort((a, b) => Number(b.collects_sms) - Number(a.collects_sms) || b.last_seen_at.localeCompare(a.last_seen_at))[0]
}

/** A main phone nobody has opened in this long hands over to the phone that is being used. */
export const STALE_MAIN_DAYS = 30
