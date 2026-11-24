import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DevicesPayload, DeviceRow } from '@/lib/devices/notify'

const payload = vi.hoisted(() => ({ current: null as DevicesPayload | null }))

vi.mock('@/lib/native/isNative', () => ({ isNative: () => true }))
vi.mock('@/lib/native/deviceId', () => ({ getOrCreateDeviceId: async () => 'me' }))
vi.mock('@/lib/devices/notify', async (orig) => ({
  ...(await orig<typeof import('@/lib/devices/notify')>()),
  fetchDevices: async () => payload.current,
}))
vi.mock('@/components/ui/dialog/DialogProvider', () => ({ useConfirm: () => async () => true }))
vi.mock('@/lib/i18n/settingsHubCopy', () => ({ useSettingsHubCopy: () => ({ devices: {} }) }))

import { notifyCheck } from './useNotifyDecision'

const device = (over: Partial<DeviceRow>): DeviceRow => ({
  deviceId: 'x', name: 'Phone', platform: 'ios', appVersion: null, lastSeenAt: '2026-11-24T10:00:00Z',
  collectsSms: false, isMain: false, notify: null, pushPermission: 'granted', lastSmsAt: null, ...over,
})
const withMe = (notify: boolean | null) => {
  payload.current = { thisDeviceId: 'me', devices: [device({ deviceId: 'main', name: 'iPhone', isMain: true }), device({ deviceId: 'me', notify })] }
}

describe('notifyCheck', () => {
  beforeEach(() => { payload.current = null })

  it('asks a phone that has not chosen yet while another phone gets notifications', async () => {
    withMe(null)
    expect(await notifyCheck()).toEqual({ ask: true, names: 'iPhone', quiet: false })
  })

  it('never asks again once this phone said "notify here too"', async () => {
    withMe(true)
    expect(await notifyCheck()).toEqual({ ask: false, explicit: false })
  })

  it('still asks (for Settings) after "keep quiet", but says the phone chose quiet', async () => {
    withMe(false)
    expect(await notifyCheck()).toEqual({ ask: true, names: 'iPhone', quiet: true })
  })

  it('goes ahead when the lookup fails', async () => {
    expect(await notifyCheck()).toEqual({ ask: false, explicit: false })
  })
})
