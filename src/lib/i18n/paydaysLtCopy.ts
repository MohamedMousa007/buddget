import { useLocale } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/types'

/** Light touch `page-paydays`: the hero, the history rows and the source switcher. */
export interface PaydaysLtCopy {
  eachMonth: (cur: string) => string
  eachPayday: (cur: string) => string
  nextPayday: string
  onTime: string
  ofN: (n: number, of: number) => string
  history: string
  rowTitle: (type: string, month: string) => string
  onTimeSub: (date: string) => string
  lateSub: (date: string, n: number) => string
  partialSub: (date: string, got: string, of: string) => string
  missedSub: (date: string) => string
  openSub: (date: string) => string
  expected: string
  receivedIn: string
  noAccount: string
  sources: string
  addPayday: string
  payCycle: string
  monthCircle: (month: string, state: string) => string
  states: { received: string; late: string; partial: string; missed: string }
}

export const PAYDAYS_LT_COPY: Record<Locale, PaydaysLtCopy> = {
  en: {
    eachMonth: (cur) => `${cur} each month`,
    eachPayday: (cur) => `${cur} each payday`,
    nextPayday: 'Next payday',
    onTime: 'On time',
    ofN: (n, of) => `${n} of ${of}`,
    history: 'History',
    rowTitle: (type, month) => `${type} · ${month}`,
    onTimeSub: (d) => `${d} · on time`,
    lateSub: (d, n) => (n === 1 ? `${d} · 1 day late` : `${d} · ${n} days late`),
    partialSub: (d, got, of) => `${d} · ${got} of ${of}`,
    missedSub: (d) => `${d} · missed`,
    openSub: (d) => `Due ${d} · not logged yet`,
    expected: 'expected',
    receivedIn: 'Received in',
    noAccount: 'Received in: not set',
    sources: 'Your paydays',
    addPayday: 'Add a payday',
    payCycle: 'Pay cycle',
    monthCircle: (m, s) => `${m}: ${s}`,
    states: { received: 'on time', late: 'late', partial: 'partly paid', missed: 'missed' },
  },
  ar: {
    eachMonth: (cur) => `${cur} كل شهر`,
    eachPayday: (cur) => `${cur} كل يوم قبض`,
    nextPayday: 'يوم القبض التالي',
    onTime: 'في موعده',
    ofN: (n, of) => `${n} من ${of}`,
    history: 'السجل',
    rowTitle: (type, month) => `${type} · ${month}`,
    onTimeSub: (d) => `${d} · في موعده`,
    lateSub: (d, n) => (n === 1 ? `${d} · متأخر يومًا` : n === 2 ? `${d} · متأخر يومين` : `${d} · متأخر ${n} أيام`),
    partialSub: (d, got, of) => `${d} · ${got} من ${of}`,
    missedSub: (d) => `${d} · لم يصل`,
    openSub: (d) => `مستحق ${d} · لم يُسجَّل بعد`,
    expected: 'متوقع',
    receivedIn: 'يصل إلى',
    noAccount: 'يصل إلى: غير محدد',
    sources: 'أيام القبض',
    addPayday: 'أضف يوم قبض',
    payCycle: 'دورة الراتب',
    monthCircle: (m, s) => `${m}: ${s}`,
    states: { received: 'في موعده', late: 'متأخر', partial: 'مدفوع جزئيًا', missed: 'لم يصل' },
  },
}

export function usePaydaysLtCopy(): PaydaysLtCopy {
  return PAYDAYS_LT_COPY[useLocale().locale]
}
