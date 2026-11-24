/** Screenshot attachments on support messages. The bucket enforces the same limits on upload; these checks fail early. */

export const SUPPORT_BUCKET = 'support-attachments'
export const MAX_ATTACHMENTS = 4
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
export const ATTACHMENT_TYPES: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

export interface Attachment {
  path: string
  mime: string
  size: number
}

export type AttachmentProblem = 'type' | 'size' | 'count'

export function attachmentProblem(file: { type: string; size: number }): AttachmentProblem | null {
  if (!ATTACHMENT_TYPES[file.type]) return 'type'
  if (!(file.size > 0) || file.size > MAX_ATTACHMENT_BYTES) return 'size'
  return null
}

/** Where a user's upload lives: always under their own id, named by the server. */
export function attachmentPath(uid: string, id: string, mime: string): string {
  return `${uid}/${id}.${ATTACHMENT_TYPES[mime] ?? 'bin'}`
}

const PATH_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|heic|heif)$/

/**
 * Attachments a message may carry: well formed, the right type and size, and under the sender's own folder, so nobody can
 * attach (and then get a signed link to) another person's file. Null when any entry fails.
 */
export function ownAttachments(uid: string, raw: unknown): Attachment[] | null {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw) || raw.length > MAX_ATTACHMENTS) return null
  const out: Attachment[] = []
  for (const a of raw) {
    const r = a as Partial<Attachment> | null
    if (!r || typeof r.path !== 'string' || typeof r.mime !== 'string' || typeof r.size !== 'number') return null
    if (!PATH_RE.test(r.path) || !r.path.startsWith(`${uid}/`)) return null
    if (attachmentProblem({ type: r.mime, size: r.size })) return null
    if (ATTACHMENT_TYPES[r.mime] !== r.path.split('.').pop()) return null
    out.push({ path: r.path, mime: r.mime, size: r.size })
  }
  return out
}

/** Stored attachment lists are jsonb: read them defensively. */
export function readAttachments(raw: unknown): Attachment[] {
  return Array.isArray(raw) ? raw.filter((a): a is Attachment => !!a && typeof (a as Attachment).path === 'string') : []
}
