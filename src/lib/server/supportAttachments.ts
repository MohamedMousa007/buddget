import 'server-only'
import type { ServiceClient } from '@/lib/supabase/service'
import { readAttachments, SUPPORT_BUCKET } from '@/lib/support/attachments'

const VIEW_SECONDS = 600

export interface SignedAttachment {
  url: string
  mime: string
}

/** Short-lived view links for every attachment in a thread, in one storage call. Missing files are left out. */
export async function signThreadAttachments<M extends { attachments?: unknown }>(service: ServiceClient, messages: M[]): Promise<Array<Omit<M, 'attachments'> & { attachments: SignedAttachment[] }>> {
  const lists = messages.map((m) => readAttachments(m.attachments))
  const paths = lists.flat().map((a) => a.path)
  const urls = new Map<string, string>()
  if (paths.length) {
    const { data } = await service.storage.from(SUPPORT_BUCKET).createSignedUrls(paths, VIEW_SECONDS)
    for (const d of data ?? []) if (d.path && d.signedUrl) urls.set(d.path, d.signedUrl)
  }
  return messages.map((m, i) => {
    const { attachments: _drop, ...rest } = m
    void _drop
    return { ...rest, attachments: lists[i]!.flatMap((a) => (urls.has(a.path) ? [{ url: urls.get(a.path)!, mime: a.mime }] : [])) }
  })
}
