import { useLocale } from '@/lib/i18n'
import type { UserFacingStatus } from './conversation'

export interface SupportCopy {
  entry: string
  entryHint: string
  unreadHint: (n: number) => string
  conversations: string
  newMessage: string
  empty: string
  emptyHint: string
  status: Record<UserFacingStatus, string>
  team: string
  you: string
  unread: string
  composer: string
  send: string
  attach: string
  removeAttachment: (n: number) => string
  sending: string
  failed: string
  retry: string
  closedNote: string
  startNew: string
  kindLabel: string
  bug: string
  idea: string
  question: string
  subject: string
  subjectHint: string
  details: string
  detailsHint: string
  start: string
  startFailed: string
  contextNote: string
  attachType: string
  attachSize: string
  attachCount: (max: number) => string
  attachFailed: string
  csatAsk: string
  csatUp: string
  csatDown: string
  csatComment: string
  csatSend: string
  csatThanks: string
  photo: string
  loadFailed: string
  back: string
  resolvedNote: string
  openThread: string
}

const en: SupportCopy = {
  entry: 'Messages',
  entryHint: 'Chat with the buddget team: bugs, ideas, questions',
  unreadHint: (n) => (n === 1 ? '1 new reply' : `${n} new replies`),
  conversations: 'Messages',
  newMessage: 'New message',
  empty: 'No conversations yet',
  emptyHint: 'Tell us about a bug, an idea or a question. A real person on the team replies here.',
  status: { open: 'Open', waiting: 'Waiting for you', resolved: 'Resolved', closed: 'Closed' },
  team: 'buddget team',
  you: 'You',
  unread: 'Unread',
  composer: 'Write a message',
  send: 'Send',
  attach: 'Attach a screenshot',
  removeAttachment: (n) => `Remove image ${n}`,
  sending: 'Sending…',
  failed: 'Not sent',
  retry: 'Retry',
  closedNote: 'This conversation is closed.',
  startNew: 'Start a new conversation',
  kindLabel: 'What is it about?',
  bug: 'Bug',
  idea: 'Idea',
  question: 'Question',
  subject: 'Subject',
  subjectHint: 'In a few words',
  details: 'Details',
  detailsHint: 'What happened, and what did you expect?',
  start: 'Send message',
  startFailed: 'That did not send. Check your connection and try again.',
  contextNote: 'We attach your app version, device and language so we can help faster.',
  attachType: 'Only images can be attached.',
  attachSize: 'That image is over 5 MB.',
  attachCount: (max) => `Up to ${max} images per message.`,
  attachFailed: 'The image did not upload. Try again.',
  csatAsk: 'How did we do?',
  csatUp: 'Good',
  csatDown: 'Not good',
  csatComment: 'Anything to add? (optional)',
  csatSend: 'Send feedback',
  csatThanks: 'Thanks for telling us.',
  photo: 'Photo',
  loadFailed: 'Could not load this. Try again.',
  back: 'Back',
  resolvedNote: 'Marked resolved. Reply if you still need help and it reopens.',
  openThread: 'Open conversation',
}

const ar: SupportCopy = {
  entry: 'الرسائل',
  entryHint: 'تحدّث مع فريق بادجت: مشاكل، أفكار، أسئلة',
  unreadHint: (n) => (n === 1 ? 'ردّ جديد' : n === 2 ? 'ردّان جديدان' : n <= 10 ? `${n} ردود جديدة` : `${n} ردًّا جديدًا`),
  conversations: 'الرسائل',
  newMessage: 'رسالة جديدة',
  empty: 'لا توجد محادثات بعد',
  emptyHint: 'أخبرنا عن مشكلة أو فكرة أو سؤال. يردّ عليك شخص حقيقي من الفريق هنا.',
  status: { open: 'مفتوحة', waiting: 'بانتظار ردّك', resolved: 'تم الحل', closed: 'مغلقة' },
  team: 'فريق بادجت',
  you: 'أنت',
  unread: 'غير مقروءة',
  composer: 'اكتب رسالة',
  send: 'إرسال',
  attach: 'أرفق لقطة شاشة',
  removeAttachment: (n) => `إزالة الصورة ${n}`,
  sending: 'جارٍ الإرسال…',
  failed: 'لم تُرسل',
  retry: 'أعد المحاولة',
  closedNote: 'هذه المحادثة مغلقة.',
  startNew: 'ابدأ محادثة جديدة',
  kindLabel: 'عن ماذا؟',
  bug: 'مشكلة',
  idea: 'فكرة',
  question: 'سؤال',
  subject: 'الموضوع',
  subjectHint: 'في كلمات قليلة',
  details: 'التفاصيل',
  detailsHint: 'ماذا حدث، وماذا كنت تتوقع؟',
  start: 'أرسل الرسالة',
  startFailed: 'لم تُرسل. تحقّق من الاتصال وحاول مجددًا.',
  contextNote: 'نرفق إصدار التطبيق والجهاز واللغة لنساعدك أسرع.',
  attachType: 'يمكن إرفاق الصور فقط.',
  attachSize: 'حجم الصورة أكبر من 5 ميجابايت.',
  attachCount: (max) => `حتى ${max} صور في الرسالة.`,
  attachFailed: 'لم تُرفع الصورة. حاول مجددًا.',
  csatAsk: 'كيف كانت تجربتك معنا؟',
  csatUp: 'جيدة',
  csatDown: 'غير جيدة',
  csatComment: 'تودّ إضافة شيء؟ (اختياري)',
  csatSend: 'أرسل التقييم',
  csatThanks: 'شكرًا لإخبارنا.',
  photo: 'صورة',
  loadFailed: 'تعذّر التحميل. حاول مجددًا.',
  back: 'رجوع',
  resolvedNote: 'تم وضعها كمحلولة. ردّ إن كنت ما زلت تحتاج مساعدة وستُفتح من جديد.',
  openThread: 'افتح المحادثة',
}

export function useSupportCopy(): SupportCopy {
  return useLocale().locale === 'ar' ? ar : en
}
