import { describe, expect, it } from 'vitest'
import { mustUpdate } from './clientGate'
import { isVersionBelow } from '@/lib/appVersion'

const min = { ios: '1.1.0', android: '1.1.0', iosUrl: '', androidUrl: '' }
const req = (h: Record<string, string>) => new Request('https://buddget.app/api/x', { headers: h })

describe('mustUpdate', () => {
  it('blocks a release below the minimum and lets the current one through', () => {
    expect(mustUpdate(req({ 'x-app-platform': 'ios', 'x-app-version': '1.0.2' }), min)).toBe(true)
    expect(mustUpdate(req({ 'x-app-platform': 'android', 'x-app-version': '1.1.0' }), min)).toBe(false)
    expect(mustUpdate(req({ 'x-app-platform': 'ios', 'x-app-version': '1.2.0' }), min)).toBe(false)
  })
  it('recognises an old native build by its origin, since it sends no version', () => {
    expect(mustUpdate(req({ origin: 'https://localhost', 'user-agent': 'Mozilla/5.0 (Linux; Android 14)' }), min)).toBe(true)
    expect(mustUpdate(req({ origin: 'capacitor://localhost', 'user-agent': 'iPhone' }), min)).toBe(true)
  })
  it('never blocks the web or server-to-server calls', () => {
    expect(mustUpdate(req({ origin: 'https://buddget.app' }), min)).toBe(false)
    expect(mustUpdate(req({}), min)).toBe(false)
    expect(mustUpdate(req({ 'x-app-platform': 'web', 'x-app-version': '0.0.1' }), min)).toBe(false)
  })
  it('does nothing while no minimum is set', () => {
    expect(mustUpdate(req({ origin: 'https://localhost' }), { ios: '', android: '', iosUrl: '', androidUrl: '' })).toBe(false)
  })
})

describe('isVersionBelow', () => {
  it('compares dotted numbers part by part', () => {
    expect(isVersionBelow('1.0.9', '1.1.0')).toBe(true)
    expect(isVersionBelow('1.10.0', '1.9.0')).toBe(false)
    expect(isVersionBelow('1.1', '1.1.0')).toBe(false)
    expect(isVersionBelow(undefined, '0.0.1')).toBe(true)
    expect(isVersionBelow('2.0.0', '')).toBe(false)
  })
})
