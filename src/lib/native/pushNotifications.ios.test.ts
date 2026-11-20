import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/native/isNative', () => ({ isNative: () => true, getPlatform: () => 'ios', isIOS: () => true }))
vi.mock('@/lib/native/deviceId', () => ({ getOrCreateDeviceId: async () => 'dev1' }))
vi.mock('@/lib/apiBase', () => ({ apiUrl: (p: string) => p }))
vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    requestPermissions: async () => ({ receive: 'granted' }),
    register: async () => undefined,
    addListener: () => undefined,
  },
}))
const getToken = vi.fn(() => new Promise<{ token: string }>(() => {}))
vi.mock('@capacitor/core', () => ({
  Capacitor: { isPluginAvailable: () => true, Plugins: { FirebaseMessaging: { getToken, addListener: () => undefined } } },
}))

import { registerPushNotifications } from './pushNotifications'

describe('registerPushNotifications on iOS', () => {
  it('answers once permission is granted, without waiting for the FCM token', async () => {
    expect(await registerPushNotifications({ accessToken: 't', userId: 'u1' })).toBe(true)
    await vi.waitFor(() => expect(getToken).toHaveBeenCalled())
  })
})
