import { useLocale } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/types'

export interface CashCurrencyCopy {
  menuItem: string
  title: string
  sub: string
  currency: string
  /** Asked when Cash holds money: what it holds in the new currency. */
  amountIn: (currency: string) => string
  amountHint: string
  save: string
}

/** The Cash currency sheet (QA bug 15). */
export const CASH_CURRENCY_COPY: Record<Locale, CashCurrencyCopy> = {
  en: {
    menuItem: 'Change currency',
    title: 'Cash currency',
    sub: 'The currency your cash is counted in.',
    currency: 'Currency',
    amountIn: (c) => `How much cash do you have in ${c}?`,
    amountHint: 'Filled in with today’s rate. Change it if your cash is a different amount.',
    save: 'Save',
  },
  ar: {
    menuItem: 'غيّر العملة',
    title: 'عملة الكاش',
    sub: 'العملة التي يُحسب بها الكاش عندك.',
    currency: 'العملة',
    amountIn: (c) => `كم معك كاش بعملة ${c}؟`,
    amountHint: 'المبلغ محسوب بسعر اليوم. غيّره لو المبلغ الفعلي مختلف.',
    save: 'حفظ',
  },
}

export function useCashCurrencyCopy(): CashCurrencyCopy {
  const { locale } = useLocale()
  return CASH_CURRENCY_COPY[locale]
}
