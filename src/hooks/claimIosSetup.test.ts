import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  fetch: vi.fn(),
  save: vi.fn(),
  claimed: vi.fn(),
  enabled: vi.fn(),
  status: vi.fn(),
}))

vi.mock('@/lib/apiBase', () => ({ apiFetchAuth: h.fetch }))
vi.mock('@/lib/native/smsTracker', () => ({
  saveSmsToken: h.save,
  setIosSetupCompleted: h.claimed,
  setSmsEnabled: h.enabled,
  getSmsBridgeStatus: h.status,
  SMS_QUEUE_CHANGED_EVENT: 'x',
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/store/useFinanceStore', () => ({ useFinanceStore: () => ({}) }))
vi.mock('@/lib/i18n/settingsHubCopy', () => ({ useSettingsHubCopy: () => ({ sms: {} }) }))
vi.mock('@/lib/devices/client', () => ({ setDeviceCollectsSms: vi.fn(), fetchThisDeviceSms: vi.fn() }))

import { claimIosSetup } from './useSmsTracking'

const TOKEN = '11111111-2222-4333-8444-555555555555'
const ok = () => ({ ok: true, json: async () => ({ token: TOKEN }) })

beforeEach(() => {
  vi.clearAllMocks()
  h.status.mockResolvedValue({ tokenSaved: true, tokenUserId: 'u1' })
})

describe('claimIosSetup (BDG-008: the claim is recorded only once the token landed)', () => {
  it('stores the token, then records the claim and arms', async () => {
    h.fetch.mockResolvedValue(ok())
    expect(await claimIosSetup('u1')).toBe(TOKEN)
    expect(h.save).toHaveBeenCalledWith(TOKEN, 'u1')
    expect(h.claimed).toHaveBeenCalledWith(true)
    expect(h.enabled).toHaveBeenCalledWith(true)
  })

  it.each([
    ['the token request fails', () => h.fetch.mockResolvedValue({ ok: false })],
    ['the network is down', () => h.fetch.mockRejectedValue(new Error('offline'))],
    ['the token did not reach native storage', () => { h.fetch.mockResolvedValue(ok()); h.status.mockResolvedValue({ tokenSaved: false }) }],
    ['native storage holds another account\'s token', () => { h.fetch.mockResolvedValue(ok()); h.status.mockResolvedValue({ tokenSaved: true, tokenUserId: 'u2' }) }],
  ])('claims and arms nothing when %s', async (_why, arrange) => {
    arrange()
    expect(await claimIosSetup('u1')).toBeNull()
    expect(h.claimed).not.toHaveBeenCalled()
    expect(h.enabled).not.toHaveBeenCalled()
  })

  it('claims nothing without a signed-in user', async () => {
    expect(await claimIosSetup(null)).toBeNull()
    expect(h.fetch).not.toHaveBeenCalled()
  })
})
