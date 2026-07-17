/**
 * GET /api/sms/setup-token
 *
 * Returns the caller's active ingest token (creating one if it doesn't exist).
 * Used by the Settings page to populate the iOS Shortcut setup card and the
 * Android Bridge QR code.
 *
 * Auth: session cookie (user must be signed in).
 */

import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { resolveApiUserId } from '@/lib/auth/resolveApiUser'
import { DEVICE_ID_HEADER } from '@/lib/auth/deviceIdConstants'

export async function GET(request: Request) {
  const userId = await resolveApiUserId(request)

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceClient = createServiceRoleClient()
  // Native shell sends its device id; web sends none. Scope the token to the
  // device so per-device rotation/revocation never de-arms a user's other phone.
  const deviceId = request.headers.get(DEVICE_ID_HEADER)

  // Check for an existing active token for this scope.
  let existingQuery = serviceClient
    .from('sms_ingest_tokens')
    .select('token')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
  if (deviceId) existingQuery = existingQuery.eq('device_id', deviceId)
  const { data: existing } = await existingQuery.maybeSingle()

  if (existing?.token) {
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/sms/ingest`
    return NextResponse.json({ token: existing.token, webhookUrl })
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

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/sms/ingest`
  return NextResponse.json({ token: newToken.token, webhookUrl })
}

/** DELETE — rotates the token (deactivates current, issues new). */
export async function DELETE(request: Request) {
  const userId = await resolveApiUserId(request)

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceClient = createServiceRoleClient()
  const deviceId = request.headers.get(DEVICE_ID_HEADER)

  // Deactivate active tokens for this scope — only THIS device when the native
  // shell identifies itself, so rotating on one phone never de-arms another.
  // Web (no device id) rotates all of the user's tokens, as before.
  let deactivate = serviceClient
    .from('sms_ingest_tokens')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('is_active', true)
  if (deviceId) deactivate = deactivate.eq('device_id', deviceId)
  await deactivate

  // Issue a new token bound to this device (null for web).
  const { data: newToken, error } = await serviceClient
    .from('sms_ingest_tokens')
    .insert({ user_id: userId, device_id: deviceId })
    .select('token')
    .single()

  if (error || !newToken) {
    return NextResponse.json({ error: 'Failed to rotate token' }, { status: 500 })
  }

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/sms/ingest`
  return NextResponse.json({ token: newToken.token, webhookUrl, rotated: true })
}
