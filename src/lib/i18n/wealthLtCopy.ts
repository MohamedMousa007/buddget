import { useLocale } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/types'

/** Light touch Wealth (A3, `page-wealth`): the Holdings and Activity lists. */
export interface WealthLtCopy {
  holdings: string
  activity: string
  add: string
  grams: (qty: string) => string
  aGram: (price: string) => string
  sinceBought: (pct: string, up: boolean) => string
  depositTo: (pocket: string) => string
  withdrewFrom: (pocket: string) => string
  movedTo: (pocket: string) => string
  movedFrom: (pocket: string) => string
  from: (account: string) => string
  to: (account: string) => string
  refreshGold: string
  boughtGold: (grams: string) => string
  bought: (asset: string) => string
  outside: string
}

export const WEALTH_LT_COPY: Record<Locale, WealthLtCopy> = {
  en: {
    holdings: 'Holdings',
    activity: 'Activity',
    add: 'Add',
    grams: (q) => `${q} g`,
    aGram: (p) => `${p} a gram`,
    sinceBought: (pct, up) => `${up ? '▲' : '▼'} ${pct} since you bought`,
    depositTo: (p) => `Deposit to ${p}`,
    withdrewFrom: (p) => `Withdrew from ${p}`,
    movedTo: (p) => `Moved to ${p}`,
    movedFrom: (p) => `Moved from ${p}`,
    from: (a) => `from ${a}`,
    to: (a) => `to ${a}`,
    refreshGold: 'Refresh gold price',
    boughtGold: (g) => `Bought gold, ${g} g`,
    bought: (a) => `Bought ${a}`,
    outside: 'Outside buddget',
  },
  ar: {
    holdings: 'المقتنيات',
    activity: 'النشاط',
    add: 'إضافة',
    grams: (q) => `${q} جم`,
    aGram: (p) => `${p} للجرام`,
    sinceBought: (pct, up) => `${up ? '▲' : '▼'} ${pct} منذ الشراء`,
    depositTo: (p) => `إيداع في ${p}`,
    withdrewFrom: (p) => `سحب من ${p}`,
    movedTo: (p) => `نقل إلى ${p}`,
    movedFrom: (p) => `نقل من ${p}`,
    from: (a) => `من ${a}`,
    to: (a) => `إلى ${a}`,
    refreshGold: 'حدّث سعر الذهب',
    boughtGold: (g) => `شراء ذهب، ${g} جم`,
    bought: (a) => `شراء ${a}`,
    outside: 'من خارج buddget',
  },
}

export function useWealthLtCopy(): WealthLtCopy {
  const { locale } = useLocale()
  return WEALTH_LT_COPY[locale]
}
