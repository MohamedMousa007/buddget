import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const state = { native: true, ios: true, isSetup: true }

vi.mock('@/lib/native/isNative', () => ({ isNative: () => state.native, isIOS: () => state.ios }))
vi.mock('@/hooks/useSmsTracking', () => ({
  useSmsTracking: () => ({ isEnabled: true, isSetup: state.isSetup, toggle: vi.fn(), loading: false, error: null, permission: true }),
}))

import { SmsCard } from './SmsCard'

const render = () => renderToStaticMarkup(<SmsCard />)

describe('SmsCard', () => {
  beforeEach(() => Object.assign(state, { native: true, ios: true, isSetup: true }))

  it('a set-up iPhone keeps the switch and a row back to the Shortcut guide', () => {
    const out = render()
    expect(out).toContain('role="switch"')
    expect(out).toContain('href="/settings/sms"')
    expect(out).toContain('Setup guide')
  })

  it('an iPhone not set up yet goes to the guide instead of a switch', () => {
    state.isSetup = false
    const out = render()
    expect(out).not.toContain('role="switch"')
    expect(out).toContain('href="/settings/sms"')
    expect(out).not.toContain('Setup guide')
  })

  it('Android and the web get the switch alone', () => {
    state.ios = false
    const out = render()
    expect(out).toContain('role="switch"')
    expect(out).not.toContain('/settings/sms')
  })
})
