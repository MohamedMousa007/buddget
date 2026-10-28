import { NextResponse } from 'next/server'
import { hasAnyDevice, isRevokedDevice } from '@/lib/server/devices/registry'
import type { ServiceClient } from '@/lib/supabase/service'
import type { SmsCaller } from './resolveSmsUser'

/**
 * Null when the caller may proceed. A removed phone is refused, and so is a JWT caller that
 * omits the device header while the account has phones on record (a removed phone could
 * otherwise just drop the header). Accounts with no phone on record are let through.
 * The missing-header refusal is enforced only with SMS_REQUIRE_DEVICE_HEADER=1, set once the app builds that send the header are out:
 * installed older builds send no header and would otherwise lose their SMS.
 */
export async function smsDeviceGate(service: ServiceClient, caller: SmsCaller): Promise<NextResponse | null> {
  const { userId, deviceId, viaJwt } = caller
  if (!userId) return null
  if (await isRevokedDevice(service, userId, deviceId)) {
    return NextResponse.json({ error: 'This phone was removed from the account' }, { status: 403 })
  }
  if (viaJwt && !deviceId && (await hasAnyDevice(service, userId))) {
    if (process.env.SMS_REQUIRE_DEVICE_HEADER !== '1') {
      console.warn('[sms] JWT caller without device header (not enforced)', userId)
      return null
    }
    return NextResponse.json(
      { error: 'device_required', message: 'Update Buddget: this request did not identify the phone it came from' },
      { status: 403 },
    )
  }
  return null
}
