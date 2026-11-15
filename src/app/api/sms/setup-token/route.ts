/**
 * GET /api/sms/setup-token
 *
 * Returns the caller's active ingest token (creating one if it doesn't exist).
 * Used by the Settings page to populate the iOS Shortcut setup card and the
 * Android Bridge QR code.
 *
 * Auth: session cookie (user must be signed in).
 */

import { isRateLimited } from '@/lib/server/rateLimit'
import { ISSUES_PER_HOUR, ROTATIONS_PER_HOUR, capActiveIngestTokens, trimRetiredIngestTokens } from '@/lib/server/tokenCaps'
import { gateOutdatedClient } from '@/lib/server/clientGate'
import { NextResponse } from 'next/server'
import { newIngestToken } from '@/lib/sms/ingestToken'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { resolveActiveApiUserId } from '@/lib/auth/resolveApiUser'
import { DEVICE_ID_HEADER } from '@/lib/auth/deviceIdConstants'
import { hasAnyDevice, hasRevokedDevice, isRevokedDevice } from '@/lib/server/devices/registry'

async function isUnregisteredDevice(service: ReturnType<typeof createServiceRoleClient>, userId: string, deviceId: string): Promise<boolean> {
  const { data } = await service.from('user_devices').select('device_id').eq('user_id', userId).eq('device_id', deviceId).maybeSingle()
  return !data && (await hasAnyDevice(service, userId))
}

/**
 * A removed phone, a client-chosen id the account never registered (once it has phones on record), and, once the owner has
 * removed any phone, a request that names no phone at all (a removed phone could otherwise just drop its id) get no token.
 */
async function deviceRefusal(service: ReturnType<typeof createServiceRoleClient>, userId: string, deviceId: string | null) {
  if (!deviceId && (await hasRevokedDevice(service, userId))) {
    return NextResponse.json({ error: 'device_required' }, { status: 403 })
  }
  if (await isRevokedDevice(service, userId, deviceId)) {
    return NextResponse.json({ error: 'This phone was removed from the account' }, { status: 403 })
  }
  if (deviceId && (await isUnregisteredDevice(service, userId, deviceId))) {
    return NextResponse.json({ error: 'device_not_registered' }, { status: 403 })
  }
  return null
}

export async function GET(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const userId = await resolveActiveApiUserId(request)

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceClient = createServiceRoleClient()
  // Native shell sends its device id; web sends none. Scope the token to the
  // device so per-device rotation/revocation never de-arms a user's other phone.
  const deviceId = request.headers.get(DEVICE_ID_HEADER)
  const refusal = await deviceRefusal(serviceClient, userId, deviceId)
  if (refusal) return refusal

  if (await isRateLimited(serviceClient, `sms-setup-token:${userId}`, 3600, ISSUES_PER_HOUR)) {
    return NextResponse.json({ error: 'Too many token requests, try again later' }, { status: 429 })
  }

  // Only the hash is stored, so a token already issued cannot be handed back: every call issues one, bound to this
  // device (null for web). The newest few of the scope stay active, so a phone that has not saved the new one yet keeps sending.
  const fresh = newIngestToken()
  const { error } = await serviceClient
    .from('sms_ingest_tokens')
    .insert({ user_id: userId, device_id: deviceId, token_hash: fresh.token_hash })

  if (error) {
    console.error('[sms/setup-token] insert error', error.message)
    return NextResponse.json({ error: 'Failed to create token' }, { status: 500 })
  }

  await capActiveIngestTokens(serviceClient, userId, deviceId)
  await trimRetiredIngestTokens(serviceClient, userId)

  return NextResponse.json({ token: fresh.token })
}

/** DELETE — rotates the token (deactivates current, issues new). */
export async function DELETE(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const userId = await resolveActiveApiUserId(request)

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceClient = createServiceRoleClient()
  const deviceId = request.headers.get(DEVICE_ID_HEADER)

  const refusal = await deviceRefusal(serviceClient, userId, deviceId)
  if (refusal) return refusal

  if (await isRateLimited(serviceClient, `sms-rotate:${userId}`, 3600, ROTATIONS_PER_HOUR)) {
    return NextResponse.json({ error: 'Too many rotations, try again later' }, { status: 429 })
  }

  // Issue the new token first so a failed insert never leaves the user without one, then retire the others
  // of the same scope only: this device's tokens, or (no device id) the device-less ones. Rotating never de-arms another phone.
  const fresh = newIngestToken()
  const { error } = await serviceClient
    .from('sms_ingest_tokens')
    .insert({ user_id: userId, device_id: deviceId, token_hash: fresh.token_hash })

  if (error) {
    return NextResponse.json({ error: 'Failed to rotate token' }, { status: 500 })
  }

  let deactivate = serviceClient
    .from('sms_ingest_tokens')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('is_active', true)
    .neq('token_hash', fresh.token_hash)
  deactivate = deviceId ? deactivate.eq('device_id', deviceId) : deactivate.is('device_id', null)
  const { error: deactivateError } = await deactivate
  if (deactivateError) {
    console.error('[sms/setup-token] deactivate error', deactivateError.message)
    return NextResponse.json({ error: 'Failed to rotate token' }, { status: 500 })
  }
  await trimRetiredIngestTokens(serviceClient, userId)

  return NextResponse.json({ token: fresh.token, rotated: true })
}
