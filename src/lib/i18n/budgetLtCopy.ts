import { useLocale } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/types'

/** Light touch `page-budget` and `s_line` strings added in conformance round 2. */
export interface BudgetLtCopy {
  hero: {
    leftIn: (month: string) => string
    of: (total: string) => string
    perDay: (amount: string) => string
    until: (date: string) => string
    spent: (amount: string) => string
    overTail: string
    areOver: (n: number) => string
    topIs: (name: string) => string
    toPayTail: string
    allPaid: string
    close: string
  }
  draft: { label: string }
  line: {
    sized: (n: number, kind: 'bills' | 'months', list: string) => string
    high: string
    estimated: string
  }
  planState: Record<'active' | 'ready' | 'draft', string>
}

const joinEn = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
const joinAr = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join('، ')} و${xs[xs.length - 1]}`)

export const BUDGET_LT_COPY: Record<Locale, BudgetLtCopy> = {
  en: {
    hero: {
      leftIn: (m) => `Left to spend · ${m}`,
      of: (t) => `of ${t}`,
      perDay: (a) => `${a}/day`,
      until: (d) => `until ${d}`,
      spent: (a) => `spent ${a}`,
      overTail: 'is over',
      areOver: (n) => `${n} categories are over`,
      topIs: (n) => `Most on ${n}`,
      toPayTail: 'still to pay',
      allPaid: 'All paid',
      close: 'Close',
    },
    draft: { label: 'Budget · Not applied' },
    line: {
      sized: (n, kind, list) => `Sized from your last ${n === 1 ? (kind === 'bills' ? 'bill' : 'month') : `${n} ${kind}`}: ${list}.`,
      high: 'High confidence.',
      estimated: 'Estimated.',
    },
    planState: { active: 'Active', ready: 'Not active', draft: 'Draft' },
  },
  ar: {
    hero: {
      leftIn: (m) => `المتبقي للإنفاق · ${m}`,
      of: (t) => `من ${t}`,
      perDay: (a) => `${a}/يوم`,
      until: (d) => `حتى ${d}`,
      spent: (a) => `أُنفق ${a}`,
      overTail: 'تجاوز الحد',
      areOver: (n) => `${n} فئات تجاوزت الحد`,
      topIs: (n) => `الأكثر على ${n}`,
      toPayTail: 'متبقٍ للدفع',
      allPaid: 'تم دفع الكل',
      close: 'إغلاق',
    },
    draft: { label: 'الميزانية · غير مطبّقة' },
    line: {
      sized: (n, kind, list) => `حُدّد من ${n === 1 ? (kind === 'bills' ? 'آخر فاتورة' : 'آخر شهر') : `آخر ${n} ${kind === 'bills' ? 'فواتير' : 'أشهر'}`}: ${list}.`,
      high: 'ثقة عالية.',
      estimated: 'تقديري.',
    },
    planState: { active: 'نشطة', ready: 'غير نشطة', draft: 'مسودة' },
  },
}

export const joinList = (locale: Locale, xs: string[]) => (locale === 'ar' ? joinAr(xs) : joinEn(xs))

export function useBudgetLtCopy(): BudgetLtCopy {
  return BUDGET_LT_COPY[useLocale().locale]
}
