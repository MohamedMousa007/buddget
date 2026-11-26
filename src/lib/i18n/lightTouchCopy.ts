import { useLocale } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/types'
import { arPlural } from '@/lib/i18n/arPlural'

export interface LightTouchCopy {
  amountHero: {
    /** Accessible name of the tappable unit after the amount. */
    currency: (code: string) => string
    unit: (unit: string) => string
  }
  dayOfMonth: {
    /** The big day above the grid: "25th". */
    ordinal: (day: number) => string
    ofEachMonth: string
    /** A pill or row value: "25th of each month". */
    everyMonth: (day: number) => string
  }
  numberPicker: { hint: string }
  pocketPicker: {
    pocketTitle: string
    pocketSub: (count: number) => string
    goalTitle: string
    goalSub: string
    sections: { goals: string; savings: string; safetyNet: string }
    /** After a goal's saved amount: "of 48,000". */
    ofTarget: (target: string) => string
    noMatch: (query: string) => string
    newPocket: string
    newGoal: string
  }
  moneySource: {
    title: string
    tabs: { account: string; pocket: string; outside: string }
    from: string
    fromPocket: string
    outsideValue: string
    choose: string
  }
  last4: { label: string; optional: string }
}

const enOrdinal = (d: number) => `${d}${d % 100 > 10 && d % 100 < 14 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[d % 10] ?? 'th'}`

/** Strings for the Light touch shared pickers and fields (BUILD_SPEC "Shared primitives"). */
export const LIGHT_TOUCH_COPY: Record<Locale, LightTouchCopy> = {
  en: {
    amountHero: { currency: (c) => `Currency, ${c}`, unit: (u) => `Unit, ${u}` },
    dayOfMonth: { ordinal: enOrdinal, ofEachMonth: 'of each month', everyMonth: (d) => `${enOrdinal(d)} of each month` },
    numberPicker: { hint: 'Type any number, or pick one' },
    pocketPicker: {
      pocketTitle: 'Which pocket?',
      pocketSub: (n) => (n === 1 ? '1 pocket, grouped by what it’s for' : `${n} pockets, grouped by what they’re for`),
      goalTitle: 'Which goal?',
      goalSub: 'Your goals and how far each one is',
      sections: { goals: 'Goals', savings: 'Savings', safetyNet: 'Safety net' },
      ofTarget: (t) => `of ${t}`,
      noMatch: (q) => `No pocket called “${q}”`,
      newPocket: 'New pocket',
      newGoal: 'New goal',
    },
    moneySource: {
      title: 'Where the money comes from',
      tabs: { account: 'Account', pocket: 'Pocket', outside: 'Outside' },
      from: 'From',
      fromPocket: 'From pocket',
      outsideValue: 'Money you already had',
      choose: 'Choose',
    },
    last4: { label: 'Last 4 digits', optional: 'optional' },
  },
  ar: {
    amountHero: { currency: (c) => `العملة، ${c}`, unit: (u) => `الوحدة، ${u}` },
    dayOfMonth: { ordinal: (d) => `يوم ${d}`, ofEachMonth: 'من كل شهر', everyMonth: (d) => `يوم ${d} من كل شهر` },
    numberPicker: { hint: 'اكتب أي رقم، أو اختر واحدًا' },
    pocketPicker: {
      pocketTitle: 'أي جيب؟',
      pocketSub: (n) => `${arPlural(n, { one: 'جيب', two: 'جيبين', few: 'جيوب', many: 'جيبًا' })}، مقسّمة حسب الغرض`,
      goalTitle: 'أي هدف؟',
      goalSub: 'أهدافك ومدى تقدّم كل واحد',
      sections: { goals: 'الأهداف', savings: 'المدخرات', safetyNet: 'شبكة الأمان' },
      ofTarget: (t) => `من ${t}`,
      noMatch: (q) => `لا يوجد جيب باسم ”${q}“`,
      newPocket: 'جيب جديد',
      newGoal: 'هدف جديد',
    },
    moneySource: {
      title: 'من أين يأتي المال',
      tabs: { account: 'حساب', pocket: 'جيب', outside: 'من الخارج' },
      from: 'من',
      fromPocket: 'من جيب',
      outsideValue: 'مال كان معك أصلًا',
      choose: 'اختر',
    },
    last4: { label: 'آخر 4 أرقام', optional: 'اختياري' },
  },
}

export function useLightTouchCopy(): LightTouchCopy {
  const { locale } = useLocale()
  return LIGHT_TOUCH_COPY[locale]
}
