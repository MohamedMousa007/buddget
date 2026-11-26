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
  /** Hero legend: every balance that is not gold, stocks, crypto or property. */
  savings: string
  /** "3 years · 17.5% a year": a savings product's term and yearly return. */
  years: (n: number) => string
  months: (n: number) => string
  aYear: (pct: string) => string
  /** Pockets that hold goal money, folded into one Holdings row. */
  goalPockets: string
  /** Quiet rows at the end of the page: the emergency fund and zakat. */
  efTitle: string
  efCovered: (covered: string, target: number) => string
  efSetUp: string
  zakatTitle: string
  zakatDue: (amount: string, due: string) => string
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
    savings: 'Savings',
    years: (n) => (n === 1 ? '1 year' : `${n} years`),
    months: (n) => (n === 1 ? '1 month' : `${n} months`),
    aYear: (p) => `${p}% a year`,
    goalPockets: 'Goal pockets',
    efTitle: 'Emergency fund',
    efCovered: (c, t) => `${c} of ${t} months covered`,
    efSetUp: 'Not set up yet',
    zakatTitle: 'Zakat',
    zakatDue: (a, d) => (d ? `${a} due · ${d}` : `${a} due`),
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
    savings: 'مدخرات',
    years: (n) => (n === 1 ? 'سنة' : n === 2 ? 'سنتان' : n <= 10 ? `${n} سنوات` : `${n} سنة`),
    months: (n) => (n === 1 ? 'شهر' : n === 2 ? 'شهران' : n <= 10 ? `${n} أشهر` : `${n} شهرًا`),
    aYear: (p) => `${p}% سنويًا`,
    goalPockets: 'جيوب الأهداف',
    efTitle: 'صندوق الطوارئ',
    efCovered: (c, t) => `${c} من ${t} أشهر مغطاة`,
    efSetUp: 'لم يُجهَّز بعد',
    zakatTitle: 'الزكاة',
    zakatDue: (a, d) => (d ? `${a} مستحقة · ${d}` : `${a} مستحقة`),
  },
}

export function useWealthLtCopy(): WealthLtCopy {
  const { locale } = useLocale()
  return WEALTH_LT_COPY[locale]
}
