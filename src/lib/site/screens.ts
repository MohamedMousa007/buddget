import type { SiteLocale } from './config'

/**
 * Real-device captures of the v9 app (docs/launch/store-shots-v2/ios-phone, 1206x2460, saved at 603px wide).
 * Quick add, subscriptions, reports and the Arabic Buddgy chat were captured from the branch preview with the same script
 * (e2e/ui/store-shots.mjs shots 18-24, 2026-11-28).
 */
export type ScreenKey =
  | 'today' | 'flow-sms' | 'installments' | 'buddgy' | 'accounts' | 'savings' | 'goals' | 'income'
  | 'quickadd' | 'subscriptions' | 'reports'

/** Screens with an Arabic capture; Arabic pages show `<key>-ar.webp` for these. */
const ARABIC: ReadonlySet<ScreenKey> = new Set(['today', 'flow-sms', 'installments', 'buddgy', 'accounts', 'savings', 'goals', 'income', 'quickadd', 'subscriptions', 'reports'])

const ALT: Record<ScreenKey, { en: string; ar: string }> = {
  today: { en: 'buddget Flow screen with the month spent, what is left per day and recent payments', ar: 'الشاشة الرئيسية في بادجت بما أُنفق هذا الشهر والمتاح يوميًا وآخر المدفوعات' },
  'flow-sms': { en: 'buddget Flow with payments logged from bank texts', ar: 'شاشة المعاملات في بادجت بمدفوعات مسجّلة من رسائل البنك' },
  installments: { en: 'buddget installments at the full agreed price with due dates and what is left', ar: 'الأقساط في بادجت بالسعر الكامل المتفق عليه مع مواعيد الاستحقاق وما تبقّى' },
  buddgy: { en: 'Buddgy answering a question about the month from the user’s own numbers', ar: 'بادجي يجيب عن سؤال عن الشهر من أرقام المستخدم' },
  accounts: { en: 'buddget accounts with Free to spend, money set aside and net worth', ar: 'الحسابات في بادجت مع المتاح للإنفاق والمُخصَّص وصافي الثروة' },
  savings: { en: 'buddget savings with pockets, goals and monthly savings', ar: 'الادخار في بادجت بالجيوب والأهداف والمدخرات الشهرية' },
  goals: { en: 'buddget goal saved in several places, including dollars and gold', ar: 'هدف في بادجت محفوظ في أكثر من مكان، منها الدولار والذهب' },
  income: { en: 'buddget income with paydays and money linked to each payday', ar: 'الدخل في بادجت بمواعيد القبض وربط كل دفعة بموعدها' },
  quickadd: { en: 'buddget quick add: expense, money in, receipt, debt payment, savings, card', ar: 'الإضافة السريعة في بادجت: مصروف، دخل وارد، إيصال، سداد دين، ادخار، بطاقة' },
  subscriptions: { en: 'buddget subscriptions with the monthly total and next billing dates', ar: 'الاشتراكات في بادجت بالإجمالي الشهري ومواعيد التجديد القادمة' },
  reports: { en: 'buddget insights on the month: pace, biggest share and Buddgy’s read', ar: 'تحليلات بادجت للشهر: معدل الصرف وأكبر نصيب وقراءة بادجي' },
}

/** Whether a page has a capture to show (a feature without one renders text only). */
export function hasScreen(key: ScreenKey | undefined): key is ScreenKey {
  return Boolean(key)
}

export function screenSrc(key: ScreenKey, locale: SiteLocale = 'en'): string {
  return `/site/screens/${key}${locale === 'ar' && ARABIC.has(key) ? '-ar' : ''}.webp`
}

export function screenAlt(key: ScreenKey, locale: SiteLocale): string {
  return ALT[key][locale]
}
