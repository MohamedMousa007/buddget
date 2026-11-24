/** The push and notification row a user gets when the team answers, in the user's stored language, with a deep link. */

export const SUPPORT_REPLY_KIND = 'support_reply'

export interface SupportReplyPush {
  title: string
  body: string
  data: Record<string, string>
}

const TITLE = {
  en: (name: string | null) => (name ? `${name} from the buddget team replied` : 'The buddget team replied'),
  ar: (name: string | null) => (name ? `ردّ ${name} من فريق بادجت` : 'ردّ فريق بادجت'),
}

export function supportReplyPush(a: { locale: string | null | undefined; staffFirstName: string | null; number: number; message: string }): SupportReplyPush {
  const lang = a.locale === 'ar' ? 'ar' : 'en'
  return {
    title: TITLE[lang](a.staffFirstName).slice(0, 80),
    body: a.message.replace(/\s+/g, ' ').trim().slice(0, 300),
    data: { kind: SUPPORT_REPLY_KIND, ticketNumber: String(a.number) },
  }
}

/** The ticket a tapped push or notification row points at, or null. Push data values are always strings. */
export function ticketFromPushData(data: Record<string, unknown> | undefined): number | null {
  if (!data || (data.kind !== SUPPORT_REPLY_KIND && data.kind !== 'support_resolved')) return null
  const n = Number(data.ticketNumber)
  return Number.isInteger(n) && n > 0 ? n : null
}
