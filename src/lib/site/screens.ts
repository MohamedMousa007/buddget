import type { SiteLocale } from './config'

export type ScreenKey =
  | 'flow' | 'accounts' | 'goals' | 'budget' | 'budget-2' | 'debts' | 'debts-installments' | 'subscriptions'
  | 'reports' | 'reports-charts' | 'paydays' | 'sms-setup' | 'quickadd' | 'buddgy-1' | 'buddgy-2'
  | 'flow-dark' | 'accounts-dark' | 'goals-dark'
  | 'flow-ar' | 'accounts-ar' | 'goals-ar' | 'budget-ar' | 'debts-ar' | 'subscriptions-ar' | 'buddgy-ar'

const ALT: Record<ScreenKey, { en: string; ar: string }> = {
  flow: { en: 'Buddget Flow screen showing the amount left to spend and recent payments', ar: 'شاشة المعاملات في Buddget تعرض المتبقي للإنفاق وآخر المدفوعات' },
  accounts: { en: 'Buddget accounts screen with every balance in one list', ar: 'شاشة الحسابات في Buddget بكل الأرصدة في قائمة واحدة' },
  goals: { en: 'Buddget goals screen with progress toward each goal', ar: 'شاشة الأهداف في Buddget مع التقدّم نحو كل هدف' },
  budget: { en: 'Buddget monthly budget plan', ar: 'خطة الميزانية الشهرية في Buddget' },
  'budget-2': { en: 'Buddget budget plan categories', ar: 'فئات خطة الميزانية في Buddget' },
  debts: { en: 'Buddget debts screen', ar: 'شاشة الديون في Buddget' },
  'debts-installments': { en: 'Buddget installments with remaining payments', ar: 'الأقساط في Buddget مع الدفعات المتبقية' },
  subscriptions: { en: 'Buddget subscriptions with next billing dates', ar: 'الاشتراكات في Buddget مع مواعيد التجديد' },
  reports: { en: 'Buddget report of spending by category', ar: 'تقرير الإنفاق حسب الفئة في Buddget' },
  'reports-charts': { en: 'Buddget spending charts', ar: 'رسوم الإنفاق البيانية في Buddget' },
  paydays: { en: 'Buddget payday calendar', ar: 'تقويم أيام القبض في Buddget' },
  'sms-setup': { en: 'Buddget bank text tracking settings', ar: 'إعدادات تتبّع رسائل البنك في Buddget' },
  quickadd: { en: 'Buddget quick add menu', ar: 'قائمة الإضافة السريعة في Buddget' },
  'buddgy-1': { en: 'Buddgy answering where the money is going', ar: 'Buddgy يجيب عن وجهة الأموال' },
  'buddgy-2': { en: 'Buddgy chat answering a daily spending question and adding an expense', ar: 'محادثة Buddgy تجيب عن الإنفاق اليومي وتضيف مصروفًا' },
  'flow-dark': { en: 'Buddget Flow screen in dark mode', ar: 'شاشة المعاملات في Buddget بالوضع الداكن' },
  'accounts-dark': { en: 'Buddget accounts screen in dark mode', ar: 'شاشة الحسابات في Buddget بالوضع الداكن' },
  'goals-dark': { en: 'Buddget goals screen in dark mode', ar: 'شاشة الأهداف في Buddget بالوضع الداكن' },
  'flow-ar': { en: 'Buddget Flow screen in Arabic', ar: 'شاشة المعاملات في Buddget بالعربية' },
  'accounts-ar': { en: 'Buddget accounts screen in Arabic', ar: 'شاشة الحسابات في Buddget بالعربية' },
  'goals-ar': { en: 'Buddget goals screen in Arabic', ar: 'شاشة الأهداف في Buddget بالعربية' },
  'budget-ar': { en: 'Buddget budget plan in Arabic', ar: 'خطة الميزانية في Buddget بالعربية' },
  'debts-ar': { en: 'Buddget debts screen in Arabic', ar: 'شاشة الديون في Buddget بالعربية' },
  'subscriptions-ar': { en: 'Buddget subscriptions in Arabic', ar: 'الاشتراكات في Buddget بالعربية' },
  'buddgy-ar': { en: 'Buddgy answering in Arabic', ar: 'Buddgy يجيب بالعربية' },
}

export function screenSrc(key: ScreenKey): string {
  return `/site/screens/${key}.webp`
}

export function screenAlt(key: ScreenKey, locale: SiteLocale): string {
  return ALT[key][locale]
}
