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
    const put = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type, 'x-upsert': 'false' }, body: file })
    return put.ok ? { path, mime: file.type, size: file.size } : null
  } catch {
    return null
  }
}
