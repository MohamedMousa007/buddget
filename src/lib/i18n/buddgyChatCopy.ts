import { useLocale } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/types'
import type { ChatError } from '@/lib/buddgy/client/chatTypes'
import type { ToolRisk } from '@/lib/buddgy/tools/spec'

export interface BuddgyChatCopy {
  newChat: string
  close: string
  composerPlaceholder: string
  send: string
  stop: string
  retry: string
  keepGoing: string
  checking: (what: string) => string
  checked: string
  confirm: Record<'add' | 'change' | 'danger', string>
  approveRisk: (risk: ToolRisk, tone: 'add' | 'change' | 'danger') => string
  edit: string
  update: string
  cancel: string
  dismiss: string
  undo: string
  statuses: { applied: string; dismissed: string; failed: string; stale: string; undone: string }
  offline: string
  offlineShort: string
  error: (e: ChatError) => string
  stopped: string
  localTag: string
  quickAddLead: string
  quickAddDone: string
}

const hhmm = (iso: string | null, locale: Locale) =>
  iso ? new Date(iso).toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', { hour: 'numeric', minute: '2-digit' }) : null

function quotaEn(layer: string, resetAt: string | null): string {
  const at = hhmm(resetAt, 'en')
  if (layer === 'chats_hour' || layer === 'chats_day') return `That's a lot of fresh chats. Let's pick this up${at ? ` after ${at}` : ' a bit later'}.`
  if (layer === 'feature_disabled') return 'Buddgy chat is switched off for your plan right now.'
  if (layer === 'unavailable') return 'Buddgy is resting for a moment. Try again shortly.'
  return `I've talked your ear off for now. I'll be back${at ? ` around ${at}` : ' soon'}.`
}

function quotaAr(layer: string, resetAt: string | null): string {
  const at = hhmm(resetAt, 'ar')
  if (layer === 'chats_hour' || layer === 'chats_day') return `بدأنا محادثات كثيرة. نكمل${at ? ` بعد ${at}` : ' بعد قليل'}.`
  if (layer === 'feature_disabled') return 'محادثة بادجي متوقفة في باقتك حاليًا.'
  if (layer === 'unavailable') return 'بادجي يرتاح قليلًا. جرّب بعد لحظات.'
  return `خلّصت رصيد الكلام مؤقتًا. أرجع${at ? ` حوالي ${at}` : ' قريبًا'}.`
}

const en: BuddgyChatCopy = {
  newChat: 'New chat',
  close: 'Close chat',
  composerPlaceholder: 'Ask or tell Buddgy…',
  send: 'Send',
  stop: 'Stop',
  retry: 'Try again',
  keepGoing: 'Keep going',
  checking: (what) => `Checking ${what}…`,
  checked: 'Checked',
  confirm: { add: 'Add', change: 'Apply', danger: 'Delete' },
  approveRisk: (risk, tone) => (tone === 'danger' ? 'Yes, delete' : tone === 'add' ? (risk === 'auto' ? 'Add' : 'Looks good, add') : 'Apply change'),
  edit: 'Edit',
  update: 'Update',
  cancel: 'Cancel',
  dismiss: 'Not now',
  undo: 'Undo',
  statuses: { applied: 'Done', dismissed: 'Skipped', failed: 'Could not apply', stale: 'Out of date, ask me again', undone: 'Undone' },
  offline: "You're offline. Short notes like “coffee 45” still work; for anything else I need a connection.",
  offlineShort: 'Offline',
  error: (e) =>
    e.kind === 'offline' ? "I can't reach the internet right now."
    : e.kind === 'quota' ? quotaEn(e.layer, e.resetAt)
    : e.kind === 'unauthorized' ? 'Please sign in again and I will pick this up.'
    : e.kind === 'blocked' ? "I can't help with that one. Try saying it a different way."
    : "That didn't go through. Give it another try.",
  stopped: 'Stopped',
  localTag: 'Instant',
  quickAddLead: 'Got it. Here is what I will add:',
  quickAddDone: 'Got it.',
}

const ar: BuddgyChatCopy = {
  newChat: 'محادثة جديدة',
  close: 'إغلاق المحادثة',
  composerPlaceholder: 'اسأل بادجي أو قله…',
  send: 'إرسال',
  stop: 'إيقاف',
  retry: 'حاول مرة أخرى',
  keepGoing: 'كمّل',
  checking: (what) => `أراجع ${what}…`,
  checked: 'راجعت',
  confirm: { add: 'إضافة', change: 'تطبيق', danger: 'حذف' },
  approveRisk: (risk, tone) => (tone === 'danger' ? 'نعم، احذف' : tone === 'add' ? (risk === 'auto' ? 'إضافة' : 'تمام، أضِف') : 'طبّق التعديل'),
  edit: 'تعديل',
  update: 'تحديث',
  cancel: 'إلغاء',
  dismiss: 'مش دلوقتي',
  undo: 'تراجع',
  statuses: { applied: 'تم', dismissed: 'تم التخطي', failed: 'تعذّر التطبيق', stale: 'قديم، اسألني مرة تانية', undone: 'تم التراجع' },
  offline: 'أنت غير متصل. الملاحظات القصيرة مثل «قهوة ٤٥» تعمل، وغيرها يحتاج اتصالًا.',
  offlineShort: 'غير متصل',
  error: (e) =>
    e.kind === 'offline' ? 'مش قادر أوصل للإنترنت دلوقتي.'
    : e.kind === 'quota' ? quotaAr(e.layer, e.resetAt)
    : e.kind === 'unauthorized' ? 'سجّل الدخول مرة أخرى وأكمل معك.'
    : e.kind === 'blocked' ? 'مقدرش أساعد في ده. جرّب صياغة تانية.'
    : 'العملية ما تمّتش. جرّب مرة أخرى.',
  stopped: 'تم الإيقاف',
  localTag: 'فوري',
  quickAddLead: 'تمام. ده اللي هضيفه:',
  quickAddDone: 'تمام.',
}

export const buddgyChatCopy: Record<Locale, BuddgyChatCopy> = { en, ar }

export function useBuddgyChatCopy(): BuddgyChatCopy {
  return buddgyChatCopy[useLocale().locale]
}
