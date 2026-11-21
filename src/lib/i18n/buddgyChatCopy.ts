import { useLocale } from '@/lib/i18n'
import { resetLabel } from '@/lib/usage/format'
import type { Locale } from '@/lib/i18n/types'
import type { ChatError } from '@/lib/buddgy/client/chatTypes'
import type { ToolRisk } from '@/lib/buddgy/tools/spec'
import { quotaDeniedMessage } from '@/lib/ai/quotaDeniedCopy'

export interface BuddgyChatCopy {
  newChat: string
  close: string
  composerPlaceholder: string
  mic: string
  micStop: string
  micSending: string
  voiceMessage: string
  send: string
  stop: string
  retry: string
  keepGoing: string
  advisorFree: string
  advisorLocked: string
  longChat: string
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
  /** How a reply was made (BDG-010). */
  mode: { quick: string; thinking: string }
  quickAddLead: string
  quickAddDone: string
  /** The chat list inside the pop-up (BDG-013). */
  list: {
    open: string
    title: string
    back: string
    search: string
    groups: Record<'today' | 'yesterday' | 'week' | 'older', string>
    untitled: string
    empty: string
    noMatch: string
    remove: (title: string) => string
    deleteTitle: string
    deleteBody: (title: string) => string
    deleteConfirm: string
    memory: string
    memoryHint: string
  }
  usage: {
    title: string
    aria: (pct: number) => string
    rows: Record<'chat' | 'h5' | 'd1' | 'chats', string>
    unlimited: string
    resets: (at: string) => string
    percentUsed: (pct: number) => string
  }
}

// BDG-012: a reset on another day names the day and date, not only a clock time.
const at = (iso: string | null, locale: Locale) => resetLabel(iso, locale) || null

function quotaEn(layer: string, resetAt: string | null): string {
  if (layer === 'sparks') return quotaDeniedMessage(layer, resetAt, 'en')
  const when = at(resetAt, 'en')
  if (layer === 'rate') return "That's a lot at once. Give me a minute, then try again."
  if (layer === 'chats_hour' || layer === 'chats_day') return `That's a lot of fresh chats. Let's pick this up${when ? ` after ${when}` : ' a bit later'}.`
  if (layer === 'feature_disabled') return 'Buddgy chat is switched off for your plan right now.'
  if (layer === 'unavailable') return 'Buddgy is resting for a moment. Try again shortly.'
  return `I've talked your ear off for now. I'll be back${when ? ` at ${when}` : ' soon'}.`
}

function quotaAr(layer: string, resetAt: string | null): string {
  if (layer === 'sparks') return quotaDeniedMessage(layer, resetAt, 'ar')
  const when = at(resetAt, 'ar')
  if (layer === 'rate') return 'رسائل كثيرة دفعة واحدة. انتظر دقيقة ثم جرّب مرة أخرى.'
  if (layer === 'chats_hour' || layer === 'chats_day') return `بدأنا محادثات كثيرة. نكمل${when ? ` بعد ${when}` : ' بعد قليل'}.`
  if (layer === 'feature_disabled') return 'محادثة بادجي متوقفة في باقتك حاليًا.'
  if (layer === 'unavailable') return 'بادجي يرتاح قليلًا. جرّب بعد لحظات.'
  return `خلّصت رصيد الكلام مؤقتًا. أرجع${when ? ` ${when}` : ' قريبًا'}.`
}

const en: BuddgyChatCopy = {
  newChat: 'New chat',
  close: 'Close chat',
  composerPlaceholder: 'Ask or tell Buddgy…',
  mic: 'Record a voice message',
  micStop: 'Stop and send',
  micSending: 'Turning your voice into text…',
  voiceMessage: 'Voice message',
  send: 'Send',
  stop: 'Stop',
  retry: 'Try again',
  keepGoing: 'Keep going',
  advisorFree: 'Using your free Advisor answer for this month.',
  advisorLocked: 'The Advisor is in Pro. This answer is from the fast model.',
  longChat: 'This chat is getting long. A new one answers faster.',
  checking: (what) => `Checking ${what}…`,
  checked: 'Checked',
  confirm: { add: 'Add', change: 'Apply', danger: 'Delete' },
  approveRisk: (risk, tone) => (tone === 'danger' ? 'Yes, delete' : tone === 'add' ? (risk === 'auto' ? 'Add' : 'Looks good, add') : 'Apply change'),
  edit: 'Edit',
  update: 'Update',
  cancel: 'Cancel',
  dismiss: 'Not now',
  undo: 'Undo',
  statuses: { applied: 'Done', dismissed: 'Skipped', failed: 'Couldn\u2019t apply', stale: 'Out of date, ask me again', undone: 'Undone' },
  offline: "You're offline. Short notes like “coffee 45” still work; for anything else I need a connection.",
  offlineShort: 'Offline',
  error: (e) =>
    e.kind === 'offline' ? "I can't reach the internet right now."
    : e.kind === 'quota' ? quotaEn(e.layer, e.resetAt)
    : e.kind === 'unauthorized' ? 'Please sign in again and I will pick this up.'
    : e.kind === 'blocked' ? "I can't help with that one. Try saying it a different way."
    : "Couldn\u2019t finish that. Try again.",
  stopped: 'Stopped',
  localTag: 'Instant',
  mode: { quick: 'Quick', thinking: 'Thinking' },
  quickAddLead: 'Got it. Here is what I will add:',
  quickAddDone: 'Got it.',
  list: {
    open: 'Your chats',
    title: 'Chats',
    back: 'Back to the chat',
    search: 'Search chats',
    groups: { today: 'Today', yesterday: 'Yesterday', week: 'Previous 7 days', older: 'Older' },
    untitled: 'New chat',
    empty: 'Your chats with Buddgy will show here.',
    noMatch: 'No chats match.',
    remove: (title) => `Delete ${title}`,
    deleteTitle: 'Delete this chat?',
    deleteBody: (title) => `“${title}” and everything Buddgy kept from it will be deleted. What Buddgy remembers about you stays in Memory, and anything you already added stays too.`,
    deleteConfirm: 'Delete chat',
    memory: 'Memory',
    memoryHint: 'What Buddgy remembers about you',
  },
  usage: {
    title: 'Your Buddgy usage',
    aria: (pct) => `Buddgy usage, ${pct}% used`,
    rows: { chat: 'This chat', h5: 'Last 5 hours', d1: 'Today', chats: 'Chats today' },
    unlimited: 'No limit',
    resets: (at) => `Resets ${at}`,
    percentUsed: (pct) => `${pct}% used`,
  },
}

const ar: BuddgyChatCopy = {
  newChat: 'محادثة جديدة',
  close: 'إغلاق المحادثة',
  composerPlaceholder: 'اسأل بادجي أو قله…',
  mic: 'سجّل رسالة صوتية',
  micStop: 'أوقف وأرسل',
  micSending: 'نحوّل صوتك إلى نص…',
  voiceMessage: 'رسالة صوتية',
  send: 'إرسال',
  stop: 'إيقاف',
  retry: 'حاول مرة أخرى',
  keepGoing: 'كمّل',
  advisorFree: 'تستخدم إجابة المستشار المجانية لهذا الشهر.',
  advisorLocked: 'المستشار ضمن برو. هذه الإجابة من النموذج السريع.',
  longChat: 'هذه المحادثة طالت. المحادثة الجديدة أسرع في الرد.',
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
    : 'تعذّر إكمال ذلك. حاول مرة أخرى.',
  stopped: 'تم الإيقاف',
  localTag: 'فوري',
  mode: { quick: 'سريع', thinking: 'تفكير' },
  quickAddLead: 'تمام. ده اللي هضيفه:',
  quickAddDone: 'تمام.',
  list: {
    open: 'محادثاتك',
    title: 'المحادثات',
    back: 'الرجوع إلى المحادثة',
    search: 'ابحث في المحادثات',
    groups: { today: 'اليوم', yesterday: 'أمس', week: 'آخر ٧ أيام', older: 'أقدم' },
    untitled: 'محادثة جديدة',
    empty: 'ستظهر محادثاتك مع بادجي هنا.',
    noMatch: 'لا توجد محادثات مطابقة.',
    remove: (title) => `حذف ${title}`,
    deleteTitle: 'حذف هذه المحادثة؟',
    deleteBody: (title) => `ستُحذف «${title}» وكل ما احتفظ به بادجي منها. ما يتذكره بادجي عنك يبقى في الذاكرة، وما أضفته بالفعل يبقى أيضًا.`,
    deleteConfirm: 'حذف المحادثة',
    memory: 'الذاكرة',
    memoryHint: 'ما يتذكره بادجي عنك',
  },
  usage: {
    title: 'استخدامك لبادجي',
    aria: (pct) => `استخدام بادجي، ${pct}٪ مستخدم`,
    rows: { chat: 'هذه المحادثة', h5: 'آخر ٥ ساعات', d1: 'اليوم', chats: 'محادثات اليوم' },
    unlimited: 'بلا حد',
    resets: (at) => `يتجدد ${at}`,
    percentUsed: (pct) => `${pct}٪ مستخدم`,
  },
}

export const buddgyChatCopy: Record<Locale, BuddgyChatCopy> = { en, ar }

export function useBuddgyChatCopy(): BuddgyChatCopy {
  return buddgyChatCopy[useLocale().locale]
}
