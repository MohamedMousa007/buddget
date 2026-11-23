import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { deriveSmsSetupState, NO_DEVICE_FACTS } from '@/lib/sms/setupState'

const state = { native: true, ios: true, major: null as number | null, isSetup: true, enabled: true, setup: deriveSmsSetupState(true, { setupCompleted: true }, NO_DEVICE_FACTS, Date.now()) }

vi.mock('@/lib/native/isNative', () => ({ isNative: () => state.native, isIOS: () => state.ios }))
vi.mock('@/lib/native/iosVersion', async (orig) => ({ ...(await orig<typeof import('@/lib/native/iosVersion')>()), useIosMajor: () => state.major }))
vi.mock('@/hooks/useSmsTracking', () => ({
  useSmsTracking: () => ({ isEnabled: state.enabled, isSetup: state.isSetup, toggle: vi.fn(), loading: false, error: null, permission: true, setup: state.setup }),
}))

import { SmsCard } from './SmsCard'

const render = () => renderToStaticMarkup(<SmsCard />)

// BDG-008, findings/B-sms-setup.md: per phone, "Set up" until a claim or a run here, then the switch with "View guide" beside it.
describe('SmsCard', () => {
  beforeEach(() =>
    Object.assign(state, { native: true, ios: true, major: null, isSetup: true, enabled: true, setup: deriveSmsSetupState(true, { setupCompleted: true }, NO_DEVICE_FACTS, Date.now()) }),
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

  it('a claimed iPhone shows the switch, "View guide" before it, and "Waiting for your first text"', () => {
    const out = render()
    expect(out).toContain('role="switch"')
    expect(out).toContain('data-testid="sms-view-guide"')
    expect(out.indexOf('View guide')).toBeLessThan(out.indexOf('role="switch"'))
    expect(out).toContain('Waiting for your first text')
    expect(out).not.toContain('data-testid="sms-setup-button"')
  })

  it('after a Shortcut run the status says it works, no bank text yet', () => {
    state.setup = deriveSmsSetupState(true, { lastRunAt: new Date().toISOString() }, NO_DEVICE_FACTS, Date.now())
    expect(render()).toContain('Working · no bank text yet')
  })

  it('iOS 27 offers "Add shortcut" in place of "View guide", still before the switch', () => {
    state.major = 27
    const out = render()
    expect(out).toContain('>Add shortcut<')
    expect(out).not.toContain('View guide')
    expect(out.indexOf('Add shortcut')).toBeLessThan(out.indexOf('role="switch"'))
  })

  it('switched off reads "Off"; a run or SMS from before re-arming does not count', () => {
    state.enabled = false
    expect(render()).toContain('>Off<')
    state.enabled = true
    const before = new Date(Date.now() - 3 * 86_400_000).toISOString()
    state.setup = deriveSmsSetupState(true, { lastRunAt: before, armedAt: new Date().toISOString() }, { firstSmsAt: before, lastSmsAt: before, legacyLastSmsAt: null }, Date.now())
    expect(render()).toContain('Waiting for your first text')
  })

  it('once this phone delivered an SMS the status reads "Tracking · last <date>"', () => {
    const at = new Date(Date.now() - 2 * 3_600_000).toISOString()
    state.setup = deriveSmsSetupState(true, { setupCompleted: true }, { firstSmsAt: at, lastSmsAt: at, legacyLastSmsAt: null }, Date.now())
    const out = render()
    expect(out).toMatch(/Tracking · last \d{1,2} \w{3}/)
  })

  it('no SMS and no Shortcut run here for 14 days: "Set up again" with the quiet note, no switch', () => {
    const at = new Date(Date.now() - 15 * 86_400_000).toISOString()
    state.setup = deriveSmsSetupState(true, { setupCompleted: true }, { firstSmsAt: at, lastSmsAt: at, legacyLastSmsAt: null }, Date.now())
    const out = render()
    expect(out).not.toContain('role="switch"')
    expect(out).toContain('>Set up again<')
    expect(out).toContain('No bank SMS from this iPhone for 15 days')
    expect(out).toContain('href="/settings/sms"')
  })

  it('Android and the web get the switch alone', () => {
    state.ios = false
    const out = render()
    expect(out).toContain('role="switch"')
    expect(out).not.toContain('/settings/sms')
    expect(out).not.toContain('View guide')
  })
})
