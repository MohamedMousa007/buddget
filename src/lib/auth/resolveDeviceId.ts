import { randomUUID } from 'node:crypto'
import { DEVICE_ID_HEADER } from '@/lib/auth/deviceIdConstants'
import { readDeviceCookie, setDeviceCookie } from '@/lib/auth/deviceCookie'

/**
 * Device fingerprint for 2FA trusted-device checks.
 * Native sends `X-Buddget-Device-Id`; web uses the HttpOnly cookie.
 */
export async function resolveDeviceId(request: Request): Promise<string> {
  const fromHeader = request.headers.get(DEVICE_ID_HEADER)?.trim()
  if (fromHeader) return fromHeader

  let deviceId = await readDeviceCookie()
  if (!deviceId) {
    deviceId = randomUUID()
    await setDeviceCookie(deviceId)
  }
  return deviceId
}
