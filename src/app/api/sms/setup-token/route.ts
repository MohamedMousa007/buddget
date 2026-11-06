/**
 * GET /api/sms/setup-token
 *
 * Returns the caller's active ingest token (creating one if it doesn't exist).
 * Used by the Settings page to populate the iOS Shortcut setup card and the
 * Android Bridge QR code.
 *
 * Auth: session cookie (user must be signed in).
 */

import { gateOutdatedClient } from '@/lib/server/clientGate'
import { NextResponse } from 'next/server'
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

  // Check for an existing active token for this scope.
  let existingQuery = serviceClient
    .from('sms_ingest_tokens')
    .select('token')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
  existingQuery = deviceId ? existingQuery.eq('device_id', deviceId) : existingQuery.is('device_id', null)
  const { data: existing } = await existingQuery.maybeSingle()

  if (existing?.token) {
    return NextResponse.json({ token: existing.token })
  }

  // Create a new token bound to this device (null for web).
  const { data: newToken, error } = await serviceClient
    .from('sms_ingest_tokens')
    .insert({ user_id: userId, device_id: deviceId })
    .select('token')
    .single()

  if (error || !newToken) {
    console.error('[sms/setup-token] insert error', error?.message)
    return NextResponse.json({ error: 'Failed to create token' }, { status: 500 })
  }

  return NextResponse.json({ token: newToken.token })
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

  // Issue the new token first so a failed insert never leaves the user without one, then retire the others
  // of the same scope only: this device's tokens, or (no device id) the device-less ones. Rotating never de-arms another phone.
  const { data: newToken, error } = await serviceClient
    .from('sms_ingest_tokens')
    .insert({ user_id: userId, device_id: deviceId })
    .select('token')
    .single()

  if (error || !newToken) {
    return NextResponse.json({ error: 'Failed to rotate token' }, { status: 500 })
  }

  let deactivate = serviceClient
    .from('sms_ingest_tokens')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('is_active', true)
    .neq('token', newToken.token)
  deactivate = deviceId ? deactivate.eq('device_id', deviceId) : deactivate.is('device_id', null)
  const { error: deactivateError } = await deactivate
  if (deactivateError) {
    console.error('[sms/setup-token] deactivate error', deactivateError.message)
    return NextResponse.json({ error: 'Failed to rotate token' }, { status: 500 })
  }

  return NextResponse.json({ token: newToken.token, rotated: true })
}
