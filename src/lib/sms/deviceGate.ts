import { NextResponse } from 'next/server'
import { hasAnyDevice, hasRevokedDevice, isRevokedDevice } from '@/lib/server/devices/registry'
import type { ServiceClient } from '@/lib/supabase/service'
import type { SmsCaller } from './resolveSmsUser'

/**
 * Null when the caller may proceed. A removed phone is refused, and so is a JWT caller that
 * omits the device header while the account has phones on record (a removed phone could
 * otherwise just drop the header). Accounts with no phone on record are let through.
 * The missing-header refusal is always on for an account that has removed a phone (a removed phone can drop its id; measured
 * 2026-11-06: no account with a removed phone holds a device-less token, so no installed build is locked out). For every other
 * account it stays behind SMS_REQUIRE_DEVICE_HEADER=1, so older installed builds that send no header keep their SMS.
 */
export async function smsDeviceGate(service: ServiceClient, caller: SmsCaller): Promise<NextResponse | null> {
  const { userId, deviceId, viaJwt } = caller
  if (!userId) return null
  if (await isRevokedDevice(service, userId, deviceId)) {
    return NextResponse.json({ error: 'This phone was removed from the account' }, { status: 403 })
  }
  if (viaJwt && !deviceId && (await hasAnyDevice(service, userId))) {
    if (process.env.SMS_REQUIRE_DEVICE_HEADER !== '1' && !(await hasRevokedDevice(service, userId))) {
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
