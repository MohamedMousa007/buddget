import type { PrivacySettings } from '@/lib/store/types'
import { isMasked } from './mask'

const HIDDEN_BODY = { en: 'Open Buddget to see the details', ar: 'افتح بادجت لعرض التفاصيل' } as const
const HIDDEN_TITLE = 'Buddget'
const ROUTING_KEYS = new Set(['route', 'url', 'link', 'deeplink', 'screen', 'path', 'tab', 'type', 'kind', 'category', 'id', 'logId', 'expenseId', 'notificationId'])

export interface PushContent {
  title: string
  body: string
  data?: Record<string, string>
}

/**
 * Push text lands on the lock screen, so a hidden-notifications user gets a generic title and line instead of amounts, and
 * the data payload keeps only routing keys. `privacy: null` means the settings could not be read: fail closed and mask.
 */
export function maskPush(content: PushContent, privacy: PrivacySettings | undefined | null, language: string | null | undefined): PushContent {
  if (privacy !== null && !isMasked(privacy, 'notifications')) return content
  return {
    title: HIDDEN_TITLE,
    body: HIDDEN_BODY[language === 'ar' ? 'ar' : 'en'],
    data: content.data && Object.fromEntries(Object.entries(content.data).filter(([k]) => ROUTING_KEYS.has(k))),
  }
}
