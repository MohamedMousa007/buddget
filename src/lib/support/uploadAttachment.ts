'use client'

import { apiFetchAuth } from '@/lib/apiBase'
import type { Attachment } from './attachments'

/** Uploads one screenshot through a server-issued, single-use link. Returns what the message should carry, or null. */
export async function uploadSupportImage(file: File): Promise<Attachment | null> {
  try {
    const res = await apiFetchAuth('/api/support/attachments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mime: file.type, size: file.size }),
    })
    if (!res.ok) return null
    const { path, signedUrl } = (await res.json()) as { path: string; signedUrl: string }
    // Same request storage-js uploadToSignedUrl makes for a raw body; the public key satisfies the API gateway.
    const headers: Record<string, string> = { 'Content-Type': file.type, 'x-upsert': 'false', 'cache-control': 'max-age=3600' }
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (key) headers.apikey = key
    const put = await fetch(signedUrl, { method: 'PUT', headers, body: file })
    return put.ok ? { path, mime: file.type, size: file.size } : null
  } catch {
    return null
  }
}
