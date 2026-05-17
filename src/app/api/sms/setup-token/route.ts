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
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

export async function GET() {
  const sessionClient = await createClient()
  const { data: { user } } = await sessionClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceClient = createServiceRoleClient()

  // Check for an existing active token.
  const { data: existing } = await serviceClient
    .from('sms_ingest_tokens')
    .select('token')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const token = existing?.token ?? null

  if (token) {
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/sms/ingest`
    return NextResponse.json({ token, webhookUrl })
  }

  // Create a new token.
  const { data: newToken, error } = await serviceClient
    .from('sms_ingest_tokens')
    .insert({ user_id: user.id })
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
export async function DELETE() {
  const sessionClient = await createClient()
  const { data: { user } } = await sessionClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceClient = createServiceRoleClient()

  // Deactivate all existing active tokens.
  await serviceClient
    .from('sms_ingest_tokens')
    .update({ is_active: false })
    .eq('user_id', user.id)
    .eq('is_active', true)

  // Issue a new token.
  const { data: newToken, error } = await serviceClient
    .from('sms_ingest_tokens')
    .insert({ user_id: user.id })
    .select('token')
    .single()

  if (error || !newToken) {
    return NextResponse.json({ error: 'Failed to rotate token' }, { status: 500 })
  }

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/sms/ingest`
  return NextResponse.json({ token: newToken.token, webhookUrl, rotated: true })
}
