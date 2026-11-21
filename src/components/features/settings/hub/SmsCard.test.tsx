import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { deriveSmsSetupState, NO_DEVICE_FACTS } from '@/lib/sms/setupState'

const state = { native: true, ios: true, isSetup: true, enabled: true, setup: deriveSmsSetupState(true, { setupCompleted: true }, NO_DEVICE_FACTS, Date.now()) }

vi.mock('@/lib/native/isNative', () => ({ isNative: () => state.native, isIOS: () => state.ios }))
vi.mock('@/hooks/useSmsTracking', () => ({
  useSmsTracking: () => ({ isEnabled: state.enabled, isSetup: state.isSetup, toggle: vi.fn(), loading: false, error: null, permission: true, setup: state.setup }),
}))

import { SmsCard } from './SmsCard'

const render = () => renderToStaticMarkup(<SmsCard />)

// BDG-008, findings/B-sms-setup.md: per phone, "Set up" until a claim or a run here, then the switch with "View guide" beside it.
describe('SmsCard', () => {
  beforeEach(() =>
    Object.assign(state, { native: true, ios: true, isSetup: true, enabled: true, setup: deriveSmsSetupState(true, { setupCompleted: true }, NO_DEVICE_FACTS, Date.now()) }),
  )

  it('an iPhone that never set up here gets a "Set up" button and no switch', () => {
    state.isSetup = false
    state.enabled = false
    const out = render()
    expect(out).not.toContain('role="switch"')
    expect(out).toContain('data-testid="sms-setup-button"')
    expect(out).toContain('>Set up<')
    expect(out).toContain('href="/settings/sms"')
    expect(out).not.toContain('View guide')
  })

  it('a claimed iPhone shows the switch, "View guide" before it, and "Not confirmed yet"', () => {
    const out = render()
    expect(out).toContain('role="switch"')
    expect(out).toContain('data-testid="sms-view-guide"')
    expect(out.indexOf('View guide')).toBeLessThan(out.indexOf('role="switch"'))
    expect(out).toContain('Not confirmed yet')
    expect(out).not.toContain('data-testid="sms-setup-button"')
  })

  it('after a Shortcut run the status says the Shortcut ran', () => {
    state.setup = deriveSmsSetupState(true, { lastRunAt: new Date().toISOString() }, NO_DEVICE_FACTS, Date.now())
    expect(render()).toContain('The Shortcut ran')
  })

  it('once this phone delivered an SMS the status says connected', () => {
    const at = new Date(Date.now() - 2 * 3_600_000).toISOString()
    state.setup = deriveSmsSetupState(true, { setupCompleted: true }, { firstSmsAt: at, lastSmsAt: at, legacyLastSmsAt: null }, Date.now())
    expect(render()).toContain('Connected · last SMS')
  })

  it('Android and the web get the switch alone', () => {
    state.ios = false
    const out = render()
    expect(out).toContain('role="switch"')
    expect(out).not.toContain('/settings/sms')
    expect(out).not.toContain('View guide')
  })
})
