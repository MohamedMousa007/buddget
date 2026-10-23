import { describe, expect, it } from 'vitest'
import { defaultDeviceName, notifiesOnSms, smsPushTargets, type DevicePrefs } from './policy'

const dev = (o: Partial<DevicePrefs> = {}): DevicePrefs => ({ collects_sms: false, notify_on_sms: null, revoked_at: null, ...o })
const tok = (token: string, device_id: string | null) => ({ token, device_id })

describe('sms push policy', () => {
  it('is automatic: collectors are quiet, everyone else is told, an explicit choice wins', () => {
    expect(notifiesOnSms(dev())).toBe(true)
    expect(notifiesOnSms(dev({ collects_sms: true }))).toBe(false)
    expect(notifiesOnSms(dev({ collects_sms: true, notify_on_sms: true }))).toBe(true)
    expect(notifiesOnSms(dev({ notify_on_sms: false }))).toBe(false)
  })
  it('skips the collector and removed phones when another phone can be told', () => {
    const devices = new Map([['iphone', dev({ collects_sms: true })], ['android', dev()], ['old', dev({ revoked_at: 'x' })]])
    const out = smsPushTargets([tok('a', 'iphone'), tok('b', 'android'), tok('c', 'old'), tok('d', null)], devices)
    expect(out.map((t) => t.token)).toEqual(['b', 'd'])
  })
  it('keeps a single-phone account notified even when that phone collects', () => {
    const devices = new Map([['iphone', dev({ collects_sms: true })]])
    expect(smsPushTargets([tok('a', 'iphone')], devices).map((t) => t.token)).toEqual(['a'])
  })
  it('never notifies a removed phone, even as the last resort', () => {
    const devices = new Map([['old', dev({ revoked_at: 'x' })]])
    expect(smsPushTargets([tok('c', 'old')], devices)).toEqual([])
  })
})

describe('defaultDeviceName', () => {
  it('reads the model on Android and falls back to a plain name', () => {
    expect(defaultDeviceName('android', 'Mozilla/5.0 (Linux; Android 15; SM-S938B Build/AP3A) AppleWebKit')).toBe('SM-S938B')
    expect(defaultDeviceName('android', 'Mozilla/5.0 (Linux; Android 15; K) AppleWebKit')).toBe('Android phone')
    expect(defaultDeviceName('ios', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)')).toBe('iPhone')
  })
})
