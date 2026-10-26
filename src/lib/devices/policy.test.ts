import { describe, expect, it } from 'vitest'
import { defaultDeviceName, nextMain, notifiesDevice, pushTargets, type DevicePrefs } from './policy'

const dev = (o: Partial<DevicePrefs> = {}): DevicePrefs => ({ is_main: false, notify: null, push_permission: null, revoked_at: null, ...o })
const tok = (token: string, device_id: string | null) => ({ token, device_id })
const tokens = (out: { token: string }[]) => out.map((t) => t.token)

describe('notifiesDevice', () => {
  it('follows the main phone unless the user chose otherwise', () => {
    expect(notifiesDevice(dev({ is_main: true }))).toBe(true)
    expect(notifiesDevice(dev())).toBe(false)
    expect(notifiesDevice(dev({ notify: true }))).toBe(true)
    expect(notifiesDevice(dev({ is_main: true, notify: false }))).toBe(false)
  })
  it('never tells a removed phone or one whose OS permission is off', () => {
    expect(notifiesDevice(dev({ is_main: true, revoked_at: 'x' }))).toBe(false)
    expect(notifiesDevice(dev({ notify: true, push_permission: 'denied' }))).toBe(false)
    expect(notifiesDevice(dev({ is_main: true, push_permission: 'granted' }))).toBe(true)
  })
})

describe('pushTargets', () => {
  it('only tells the main phone and the phones that asked', () => {
    const devices = new Map([['main', dev({ is_main: true })], ['other', dev()], ['asked', dev({ notify: true })]])
    expect(tokens(pushTargets([tok('a', 'main'), tok('b', 'other'), tok('c', 'asked')], devices))).toEqual(['a', 'c'])
  })
  it('does not override an explicit off, even for the last phone', () => {
    const devices = new Map([['main', dev({ is_main: true, notify: false })]])
    expect(pushTargets([tok('a', 'main')], devices)).toEqual([])
  })
  it('never tells a removed phone', () => {
    const devices = new Map([['main', dev({ is_main: true })], ['old', dev({ is_main: true, revoked_at: 'x' })]])
    expect(tokens(pushTargets([tok('a', 'main'), tok('b', 'old')], devices))).toEqual(['a'])
  })
  it('keeps an account that predates the devices list notified', () => {
    expect(tokens(pushTargets([tok('a', null), tok('b', null)], new Map()))).toEqual(['a', 'b'])
    expect(tokens(pushTargets([tok('a', null)], new Map([['old', dev({ revoked_at: 'x' })]])))).toEqual(['a'])
  })
  it('leaves tokens from unregistered installs quiet once the account has registered phones', () => {
    const devices = new Map([['main', dev({ is_main: true })]])
    expect(tokens(pushTargets([tok('a', 'main'), tok('b', null), tok('c', 'ghost')], devices))).toEqual(['a'])
  })
})

describe('nextMain', () => {
  const d = (device_id: string, o: Partial<{ collects_sms: boolean; last_seen_at: string; revoked_at: string | null; push_permission: string | null }> = {}) => ({ device_id, collects_sms: false, last_seen_at: '2026-10-01T00:00:00Z', revoked_at: null, push_permission: null, ...o })
  it('prefers a phone that collects texts, then the most recently seen, and skips the leaving and unusable ones', () => {
    expect(nextMain([d('a'), d('b', { collects_sms: true }), d('c', { last_seen_at: '2026-10-20T00:00:00Z' })], 'x')?.device_id).toBe('b')
    expect(nextMain([d('a'), d('c', { last_seen_at: '2026-10-20T00:00:00Z' })], 'x')?.device_id).toBe('c')
    expect(nextMain([d('a'), d('b', { revoked_at: 'x' }), d('c', { push_permission: 'denied' })], 'a')).toBeUndefined()
  })
})

describe('defaultDeviceName', () => {
  it('reads the model on Android and falls back to a plain name', () => {
    expect(defaultDeviceName('android', 'Mozilla/5.0 (Linux; Android 15; SM-S938B Build/AP3A) AppleWebKit')).toBe('SM-S938B')
    expect(defaultDeviceName('android', 'Mozilla/5.0 (Linux; Android 15; K) AppleWebKit')).toBe('Android phone')
    expect(defaultDeviceName('ios', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)')).toBe('iPhone')
  })
})
