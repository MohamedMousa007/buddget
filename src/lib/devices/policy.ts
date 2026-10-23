export interface DevicePrefs {
  collects_sms: boolean
  notify_on_sms: boolean | null
  revoked_at: string | null
}

export interface PushTarget { token: string; device_id: string | null }

/** Explicit choice wins; otherwise a phone that collects texts stays quiet. */
export const notifiesOnSms = (d: Pick<DevicePrefs, 'collects_sms' | 'notify_on_sms'>): boolean => d.notify_on_sms ?? !d.collects_sms

/**
 * Who hears about a captured bank text. Removed phones never; a phone that switched notifications off never; the
 * phone that collected this very text only if it asked to. If that leaves nobody (a single-phone account), the
 * remaining live phones are told anyway. Tokens with no device record are old registrations and always count.
 */
export function smsPushTargets<T extends PushTarget>(tokens: readonly T[], devices: ReadonlyMap<string, DevicePrefs>, collectorDeviceId: string | null): T[] {
  const live = tokens.filter((t) => !(t.device_id && devices.get(t.device_id)?.revoked_at))
  const wanted = live.filter((t) => {
    const d = t.device_id ? devices.get(t.device_id) : undefined
    if (!d) return true
    if (d.notify_on_sms === false) return false
    return t.device_id !== collectorDeviceId || d.notify_on_sms === true
  })
  return wanted.length > 0 ? wanted : live
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
