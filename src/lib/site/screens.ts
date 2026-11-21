import type { SiteLocale } from './config'

export type ScreenKey =
  | 'flow' | 'accounts' | 'goals' | 'budget' | 'budget-2' | 'debts' | 'debts-installments' | 'subscriptions'
  | 'reports' | 'reports-charts' | 'paydays' | 'sms-setup' | 'quickadd' | 'buddgy-1' | 'buddgy-2'
  | 'flow-dark' | 'accounts-dark' | 'goals-dark'
  | 'flow-ar' | 'accounts-ar' | 'goals-ar' | 'budget-ar' | 'debts-ar' | 'subscriptions-ar' | 'buddgy-ar'

const ALT: Record<ScreenKey, { en: string; ar: string }> = {
  flow: { en: 'buddget Flow screen showing the amount left to spend and recent payments', ar: 'شاشة المعاملات في بادجت تعرض المتبقي للإنفاق وآخر المدفوعات' },
  accounts: { en: 'buddget accounts screen with every balance in one list', ar: 'شاشة الحسابات في بادجت بكل الأرصدة في قائمة واحدة' },
  goals: { en: 'buddget goals screen with progress toward each goal', ar: 'شاشة الأهداف في بادجت مع التقدّم نحو كل هدف' },
  budget: { en: 'buddget monthly budget plan', ar: 'خطة الميزانية الشهرية في بادجت' },
  'budget-2': { en: 'buddget budget plan categories', ar: 'فئات خطة الميزانية في بادجت' },
  debts: { en: 'buddget debts screen', ar: 'شاشة الديون في بادجت' },
  'debts-installments': { en: 'buddget installments with remaining payments', ar: 'الأقساط في بادجت مع الدفعات المتبقية' },
  subscriptions: { en: 'buddget subscriptions with next billing dates', ar: 'الاشتراكات في بادجت مع مواعيد التجديد' },
  reports: { en: 'buddget report of spending by category', ar: 'تقرير الإنفاق حسب الفئة في بادجت' },
  'reports-charts': { en: 'buddget spending charts', ar: 'رسوم الإنفاق البيانية في بادجت' },
  paydays: { en: 'buddget payday calendar', ar: 'تقويم أيام القبض في بادجت' },
  'sms-setup': { en: 'buddget bank text tracking settings', ar: 'إعدادات تتبّع رسائل البنك في بادجت' },
  quickadd: { en: 'buddget quick add menu', ar: 'قائمة الإضافة السريعة في بادجت' },
  'buddgy-1': { en: 'Buddgy answering where the money is going', ar: 'بادجي يجيب عن وجهة الأموال' },
  'buddgy-2': { en: 'Buddgy chat answering a daily spending question and adding an expense', ar: 'محادثة بادجي تجيب عن الإنفاق اليومي وتضيف مصروفًا' },
  'flow-dark': { en: 'buddget Flow screen in dark mode', ar: 'شاشة المعاملات في بادجت بالوضع الداكن' },
  'accounts-dark': { en: 'buddget accounts screen in dark mode', ar: 'شاشة الحسابات في بادجت بالوضع الداكن' },
  'goals-dark': { en: 'buddget goals screen in dark mode', ar: 'شاشة الأهداف في بادجت بالوضع الداكن' },
  'flow-ar': { en: 'buddget Flow screen in Arabic', ar: 'شاشة المعاملات في بادجت بالعربية' },
  'accounts-ar': { en: 'buddget accounts screen in Arabic', ar: 'شاشة الحسابات في بادجت بالعربية' },
  'goals-ar': { en: 'buddget goals screen in Arabic', ar: 'شاشة الأهداف في بادجت بالعربية' },
  'budget-ar': { en: 'buddget budget plan in Arabic', ar: 'خطة الميزانية في بادجت بالعربية' },
  'debts-ar': { en: 'buddget debts screen in Arabic', ar: 'شاشة الديون في بادجت بالعربية' },
  'subscriptions-ar': { en: 'buddget subscriptions in Arabic', ar: 'الاشتراكات في بادجت بالعربية' },
  'buddgy-ar': { en: 'Buddgy answering in Arabic', ar: 'بادجي يجيب بالعربية' },
}

export function screenSrc(key: ScreenKey): string {
  return `/site/screens/${key}.webp`
}

export function screenAlt(key: ScreenKey, locale: SiteLocale): string {
  return ALT[key][locale]
}
