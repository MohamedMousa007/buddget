import { describe, expect, it } from 'vitest'
import { NO_DEVICE_FACTS, QUIET_AFTER_DAYS, deriveSmsSetupState, iosSetUpHere } from './setupState'

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

  it('old token with no device id keeps the account-level reading', () => {
    const s = derive({ setupCompleted: true }, { firstSmsAt: null, lastSmsAt: null, legacyLastSmsAt: ago(3) })
    expect(s).toMatchObject({ verified: true, health: 'receiving', lastSmsAt: ago(3) })
  })

  it('this phone\'s own reading wins over the legacy one', () => {
    const s = derive({ setupCompleted: true }, { firstSmsAt: ago(24 * 20), lastSmsAt: ago(24 * 10), legacyLastSmsAt: ago(1) })
    expect(s).toMatchObject({ health: 'quiet', lastSmsAt: ago(24 * 10) })
  })
})
