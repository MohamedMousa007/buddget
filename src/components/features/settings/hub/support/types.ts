import type { UserFacingStatus } from '@/lib/support/conversation'

export interface ConversationRow {
  number: number
  subject: string
  display_status: UserFacingStatus
  unread: boolean
  last_message_at: string | null
  last_message_from: string | null
  last_message_preview: string | null
  created_at: string
}

export interface ThreadMessage {
  id: string
  author_type: string
  author_name: string | null
  body: string
  created_at: string
  attachments: Array<{ url: string; mime: string }>
}

export interface ThreadTicket {
  number: number
  subject: string
  display_status: UserFacingStatus
  can_reply: boolean
  can_rate: boolean
  csat_rating: number | null
}

/** A message that has left the composer but is not in the thread yet. */
export interface PendingMessage {
  localId: string
  body: string
  attachments: Array<{ path: string; mime: string; size: number }>
  previews: string[]
  /** closed: the conversation was closed before it landed; it can only move to a new conversation. */
  state: 'sending' | 'failed' | 'closed'
  created_at: string
}

/** What a message that could not land carries into a new conversation. */
export interface CarriedDraft {
  body: string
  attachments: PendingMessage['attachments']
  previews: string[]
}

/** Body text for a message that was only a photo. */
export const PHOTO_ONLY_BODY = '📷'
