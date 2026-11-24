import { NextResponse } from 'next/server'
import { z } from 'zod'
import { gateOutdatedClient } from '@/lib/server/clientGate'
import { resolveApiUserId } from '@/lib/auth/resolveApiUser'
import { isRateLimited } from '@/lib/server/rateLimit'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { attachmentPath, attachmentProblem, SUPPORT_BUCKET } from '@/lib/support/attachments'

const UPLOADS_PER_HOUR = 30
const bodySchema = z.object({ mime: z.string().max(40), size: z.number().int() })

/**
 * A one-time upload link for a screenshot. The server names the file under the caller's own folder; the private bucket
 * re-checks size and type on upload. The returned path is then sent with the message.
 */
export async function POST(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const uid = await resolveApiUserId(request)
  if (!uid) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const problem = attachmentProblem({ type: parsed.data.mime, size: parsed.data.size })
  if (problem) return NextResponse.json({ error: problem === 'type' ? 'Only images can be attached' : 'That image is too large', problem }, { status: 400 })

  const service = createServiceRoleClient()
  if (await isRateLimited(service, `support-upload:${uid}`, 3600, UPLOADS_PER_HOUR)) return NextResponse.json({ error: 'Too many uploads, try again later' }, { status: 429 })
  const path = attachmentPath(uid, crypto.randomUUID(), parsed.data.mime)
  const { data, error } = await service.storage.from(SUPPORT_BUCKET).createSignedUploadUrl(path)
  if (error || !data) return NextResponse.json({ error: 'Could not prepare the upload' }, { status: 500 })
  return NextResponse.json({ path, token: data.token, signedUrl: data.signedUrl })
}
