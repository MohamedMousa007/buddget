/**
 * GET /api/sms/shortcut/[token]
 *
 * Serves a personalised Apple Shortcuts .shortcut file pre-configured with
 * the user's bearer token and the correct webhook URL.
 *
 * No session auth required — the token in the URL IS the credential.
 * When opened from Safari on an iOS device, iOS downloads it and immediately
 * prompts "Add Untrusted Shortcut" → one tap to import.
 */

import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { generateIosShortcutPlist } from '@/lib/sms/iosShortcutTemplate'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  // Validate the token exists and is active (no auth required — token is the credential).
  const supabase = createServiceRoleClient()
  const { data: tokenRow, error } = await supabase
    .from('sms_ingest_tokens')
    .select('id')
    .eq('token', token)
    .eq('is_active', true)
    .single()

  if (error || !tokenRow) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 })
  }

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/sms/ingest`
  const plistContent = generateIosShortcutPlist(webhookUrl, token)

  return new NextResponse(plistContent, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="BuddgetSMSTracker.shortcut"',
      // Prevent caching — token may be rotated.
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
