import { randomUUID } from 'node:crypto'
import { DEVICE_ID_HEADER } from '@/lib/auth/deviceIdConstants'
import { readDeviceCookie, setDeviceCookie } from '@/lib/auth/deviceCookie'

/** What a device id looks like: the same shape the cookie path enforces, capped so a client cannot mint unbounded rate-limit keys. */
export const DEVICE_ID_PATTERN = /^[0-9a-f-]{10,64}$/i

/**
 * Device fingerprint for 2FA trusted-device checks.
 * Native sends `X-Buddget-Device-Id`; web uses the HttpOnly cookie.
 */
export async function resolveDeviceId(request: Request): Promise<string> {
  const fromHeader = request.headers.get(DEVICE_ID_HEADER)?.trim()
  if (fromHeader && DEVICE_ID_PATTERN.test(fromHeader)) return fromHeader

  let deviceId = await readDeviceCookie()
  if (!deviceId) {
    deviceId = randomUUID()
    await setDeviceCookie(deviceId)
  }
  return deviceId
}
