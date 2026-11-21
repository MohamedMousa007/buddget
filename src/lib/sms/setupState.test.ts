import { describe, expect, it } from 'vitest'
import { NO_DEVICE_FACTS, QUIET_AFTER_DAYS, SETUP_AGAIN_AFTER_DAYS, deriveSmsSetupState, iosSetUpHere, needsLegacyReading } from './setupState'

const NOW = Date.parse('2026-11-20T12:00:00Z')
const ago = (h: number) => new Date(NOW - h * 3_600_000).toISOString()
const derive = (native: Parameters<typeof deriveSmsSetupState>[1], server = NO_DEVICE_FACTS, preference = true) =>
  deriveSmsSetupState(preference, native, server, NOW)

describe('deriveSmsSetupState (BDG-008)', () => {
  it('never set up: no switch, nothing verified', () => {
    expect(derive({})).toMatchObject({ claimed: false, runSeen: false, verified: false, health: 'none', showSwitch: false })
  })

  it('a stored token alone counts as nothing (reinstall with a surviving Keychain item)', () => {
    const native = { setupCompleted: false, lastRunAt: null, tokenSaved: true, wired: true }
    expect(derive(native)).toMatchObject({ claimed: false, runSeen: false, showSwitch: false })
    expect(iosSetUpHere(native)).toBe(false)
  })

  it('exit midway before any run: still "Set up"', () => {
    expect(derive({ setupCompleted: false }).showSwitch).toBe(false)
  })

  it('exit midway after the test text ran the Shortcut: run seen shows the switch, not verified', () => {
    expect(derive({ lastRunAt: ago(0.1) })).toMatchObject({ claimed: false, runSeen: true, verified: false, showSwitch: true })
  })

  it('finished or skip confirmed: claimed, switch, but not verified until an SMS reaches the server', () => {
    expect(derive({ setupCompleted: true })).toMatchObject({ claimed: true, verified: false, health: 'none', showSwitch: true })
  })

  it('token fetch failed at Finish: the claim is never written, so the phone stays "Set up"', () => {
    expect(derive({ setupCompleted: false, lastRunAt: null }).showSwitch).toBe(false)
  })

  it('first SMS from this phone: verified and receiving', () => {
    const s = derive({ setupCompleted: true }, { firstSmsAt: ago(2), lastSmsAt: ago(2), legacyLastSmsAt: null })
    expect(s).toMatchObject({ verified: true, health: 'receiving', lastSmsAt: ago(2) })
  })

  it('second phone: another phone\'s SMS never reach this phone\'s facts, so it reads none', () => {
    expect(derive({ setupCompleted: true }, NO_DEVICE_FACTS)).toMatchObject({ verified: false, health: 'none', lastSmsAt: null })
  })

  it('account switch on a set-up phone: the device claim stays, the new account is unverified', () => {
    expect(derive({ setupCompleted: true, lastRunAt: ago(48) }, NO_DEVICE_FACTS, false)).toMatchObject({
      preference: false, showSwitch: true, verified: false, health: 'none',
    })
  })

  it(`quiet after ${QUIET_AFTER_DAYS} days with no SMS from this phone`, () => {
    const s = derive({ setupCompleted: true }, { firstSmsAt: ago(24 * 30), lastSmsAt: ago(24 * 9), legacyLastSmsAt: null })
    expect(s).toMatchObject({ verified: true, health: 'quiet', quietDays: 9 })
  })

  it(`"Set up again" after ${SETUP_AGAIN_AFTER_DAYS} days with no SMS and no Shortcut run on this phone`, () => {
    const server = { firstSmsAt: ago(24 * 40), lastSmsAt: ago(24 * 15), legacyLastSmsAt: null }
    expect(derive({ setupCompleted: true }, server).setUpAgain).toBe(true)
    expect(derive({ setupCompleted: true, lastRunAt: ago(24 * 20) }, server).setUpAgain).toBe(true)
  })

  it('a recent Shortcut run or a recent SMS keeps the switch (no "Set up again")', () => {
    const quiet = { firstSmsAt: ago(24 * 40), lastSmsAt: ago(24 * 15), legacyLastSmsAt: null }
    expect(derive({ setupCompleted: true, lastRunAt: ago(24 * 2) }, quiet).setUpAgain).toBe(false)
    expect(derive({ setupCompleted: true }, { ...quiet, lastSmsAt: ago(24 * 13) }).setUpAgain).toBe(false)
    expect(derive({ setupCompleted: true }).setUpAgain).toBe(false)
  })

  it('old token with no device id keeps the account-level reading once a run was seen here, but is not verified', () => {
    const s = derive({ setupCompleted: true, lastRunAt: ago(3) }, { firstSmsAt: null, lastSmsAt: null, legacyLastSmsAt: ago(3) })
    expect(s).toMatchObject({ verified: false, health: 'receiving', lastSmsAt: ago(3) })
  })

  it('without a run here the legacy reading is not shown (a phone that never delivered stays "waiting")', () => {
    const s = derive({ setupCompleted: true }, { firstSmsAt: null, lastSmsAt: null, legacyLastSmsAt: ago(3) })
    expect(s).toMatchObject({ verified: false, health: 'none', lastSmsAt: null })
  })

  it('this phone\'s own reading wins over the legacy one', () => {
    const s = derive({ setupCompleted: true }, { firstSmsAt: ago(24 * 20), lastSmsAt: ago(24 * 10), legacyLastSmsAt: ago(1) })
    expect(s).toMatchObject({ health: 'quiet', lastSmsAt: ago(24 * 10) })
  })
})

describe('needsLegacyReading (BDG-008: which phones may read device-less SMS)', () => {
  it('only a phone with no SMS of its own and no token bound to it', () => {
    expect(needsLegacyReading({ firstAt: null, lastAt: null, boundToken: false })).toBe(true)
  })
  it('never for a phone holding a bound token: its silence is its own', () => {
    expect(needsLegacyReading({ firstAt: null, lastAt: null, boundToken: true })).toBe(false)
  })
  it('never once the phone has its own SMS, or when its record could not be read', () => {
    expect(needsLegacyReading({ firstAt: ago(5), lastAt: ago(1), boundToken: false })).toBe(false)
    expect(needsLegacyReading(null)).toBe(false)
  })
})
