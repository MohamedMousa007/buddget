/**
 * iPhone SMS capture as five separate facts (BDG-008). None is derived from another, and a stored token counts as none.
 * - preference: the account wants SMS tracking (user_settings.sms_tracking_enabled).
 * - claimed:    on this phone the user finished the guide or confirmed "Shortcuts already exist" (native setupCompleted).
 * - runSeen:    the Catch Bank SMS action ran on this phone (native lastRunAt).
 * - verified:   an SMS from this phone reached the server (user_devices.first_sms_at).
 * - health:     how long since this phone's last SMS reached the server (user_devices.last_sms_at).
 * iOS cannot list or inspect Shortcuts, so nothing here claims a Shortcut exists, was deleted or is turned off.
 */

/** A phone whose last SMS is older than this reads as "quiet". */
export const QUIET_AFTER_DAYS = 7

export interface SmsDeviceFacts {
  /** This phone's first and last SMS on the server; null when none or not read yet. */
  firstSmsAt: string | null
  lastSmsAt: string | null
  /**
   * Newest account SMS that carries no device id: a phone still on a token issued before tokens were device-bound.
   * Used only while this phone has no SMS of its own, so such a phone keeps the account-level reading.
   */
  legacyLastSmsAt: string | null
}

export const NO_DEVICE_FACTS: SmsDeviceFacts = { firstSmsAt: null, lastSmsAt: null, legacyLastSmsAt: null }

export type SmsHealth = 'none' | 'receiving' | 'quiet'

export interface SmsSetupState {
  preference: boolean
  claimed: boolean
  runSeen: boolean
  verified: boolean
  health: SmsHealth
  /** The reading behind `health` (this phone's, or the legacy account-level one). */
  lastSmsAt: string | null
  /** Whole days since `lastSmsAt`, for the quiet copy. */
  quietDays: number
  /** Settings shows the switch instead of "Set up". Owner decision 2026-11-20: a run counts as well as a claim. */
  showSwitch: boolean
}

/** The native facts this module reads. `wired` and `tokenSaved` are deliberately not among them. */
export interface SmsNativeFacts {
  setupCompleted?: boolean
  lastRunAt?: string | null
}

/** iPhone only: a claim or a run on this phone. Also what lets the app arm capture at start-up. */
export function iosSetUpHere(status: SmsNativeFacts | null | undefined): boolean {
  return Boolean(status?.setupCompleted || status?.lastRunAt)
}

export function deriveSmsSetupState(
  preference: boolean,
  native: SmsNativeFacts | null | undefined,
  server: SmsDeviceFacts,
  now: number,
): SmsSetupState {
  const claimed = Boolean(native?.setupCompleted)
  const runSeen = Boolean(native?.lastRunAt)
  const own = server.lastSmsAt ?? server.firstSmsAt
  const lastSmsAt = own ?? server.legacyLastSmsAt
  const quietDays = lastSmsAt ? Math.max(0, Math.floor((now - Date.parse(lastSmsAt)) / 86_400_000)) : 0
  return {
    preference,
    claimed,
    runSeen,
    verified: Boolean(server.firstSmsAt ?? lastSmsAt),
    health: !lastSmsAt ? 'none' : quietDays >= QUIET_AFTER_DAYS ? 'quiet' : 'receiving',
    lastSmsAt,
    quietDays,
    showSwitch: iosSetUpHere(native),
  }
}
