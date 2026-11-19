import { Preferences } from '@capacitor/preferences'
import type { SecureItemKey } from '@/lib/native/smsTracker'

const native = () => import('@/lib/native/smsTracker')

/** Store a secret in the secure store. False when it is unavailable: nothing is kept in plain storage then. */
export async function writeSecureItem(key: SecureItemKey, legacyKey: string, value: string): Promise<boolean> {
  try {
    if (!(await (await native()).setSecureItem(key, value))) return false
    await Preferences.remove({ key: legacyKey }).catch(() => undefined)
    return true
  } catch {
    return false
  }
}

/** Read a secret; a copy an older build left in Preferences is moved over once, and the plain copy is removed only after the secure write succeeded. */
export async function readSecureItem(key: SecureItemKey, legacyKey: string): Promise<string | null> {
  try {
    const sms = await native()
    const value = await sms.getSecureItem(key)
    if (value) return value
    const old = (await Preferences.get({ key: legacyKey })).value || null
    if (old && (await sms.setSecureItem(key, old))) await Preferences.remove({ key: legacyKey })
    return old
  } catch {
    return null
  }
}

export async function removeSecureItem(key: SecureItemKey, legacyKey: string): Promise<void> {
  try { await (await native()).removeSecureItem(key) } catch { /* noop */ }
  try { await Preferences.remove({ key: legacyKey }) } catch { /* noop */ }
}
