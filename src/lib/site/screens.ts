import type { SiteLocale } from './config'

/**
 * Real-device captures of the v9 app (docs/launch/store-shots-v2/ios-phone, 1206x2460, saved at 603px wide).
 * Quick add, subscriptions and reports have no v9 capture yet, so their pages show no phone (council 2026-11-28).
 */
export type ScreenKey =
  | 'today' | 'flow-sms' | 'installments' | 'buddgy' | 'accounts' | 'savings' | 'goals' | 'income'

/** Screens with an Arabic capture; Arabic pages show `<key>-ar.webp` for these. */
const ARABIC: ReadonlySet<ScreenKey> = new Set(['today', 'flow-sms', 'installments', 'accounts', 'savings', 'goals', 'income'])

/** English-only content (the chat is in English): Arabic pages show no phone for these rather than English text. */
const ENGLISH_ONLY: ReadonlySet<ScreenKey> = new Set(['buddgy'])

const ALT: Record<ScreenKey, { en: string; ar: string }> = {
  today: { en: 'buddget Flow screen with the month spent, what is left per day and recent payments', ar: 'الشاشة الرئيسية في بادجت بما أُنفق هذا الشهر والمتاح يوميًا وآخر المدفوعات' },
  'flow-sms': { en: 'buddget Flow with payments logged from bank texts', ar: 'شاشة المعاملات في بادجت بمدفوعات مسجّلة من رسائل البنك' },
  installments: { en: 'buddget installments at the full agreed price with due dates and what is left', ar: 'الأقساط في بادجت بالسعر الكامل المتفق عليه مع مواعيد الاستحقاق وما تبقّى' },
  buddgy: { en: 'Buddgy answering a question about the month from the user’s own numbers', ar: 'بادجي يجيب عن سؤال عن الشهر من أرقام المستخدم' },
  accounts: { en: 'buddget accounts with Free to spend, money set aside and net worth', ar: 'الحسابات في بادجت مع المتاح للإنفاق والمُخصَّص وصافي الثروة' },
  savings: { en: 'buddget savings with pockets, goals and monthly savings', ar: 'الادخار في بادجت بالجيوب والأهداف والمدخرات الشهرية' },
  goals: { en: 'buddget goal saved in several places, including dollars and gold', ar: 'هدف في بادجت محفوظ في أكثر من مكان، منها الدولار والذهب' },
  income: { en: 'buddget income with paydays and money linked to each payday', ar: 'الدخل في بادجت بمواعيد القبض وربط كل دفعة بموعدها' },
}

/** Whether a page in this language has a capture to show for this screen. */
export function hasScreen(key: ScreenKey | undefined, locale: SiteLocale): key is ScreenKey {
  return Boolean(key) && !(locale === 'ar' && ENGLISH_ONLY.has(key as ScreenKey))
}

export function screenSrc(key: ScreenKey, locale: SiteLocale = 'en'): string {
  return `/site/screens/${key}${locale === 'ar' && ARABIC.has(key) ? '-ar' : ''}.webp`
}

export function screenAlt(key: ScreenKey, locale: SiteLocale): string {
  return ALT[key][locale]
}
