import { useLocale } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/types'

export interface ZakatCopy {
  legacyTitle: string
  legacyBody: (figure: string) => string
  gotIt: string
  goldCounted: (grams: string, worn: string) => string
  receivables: string
  tradeGoods: string
  tradeGoodsAdd: string
  tradeGoodsLine: string
  onlyForZakat: string
  worn: string
  wornHint: (name: string, grams: string) => string
  likelyRepaid: string
  likelyRepaidHint: (name: string, amount: string) => string
  estimate: (date: string) => string
  dueNow: string
  notYet: string
  setYearStart: (date: string) => string
  noHistory: string
  pastNote: string
}

/** Zakat-only inputs, the one-time note about old typed figures, and the one-year states. */
export const ZAKAT_COPY: Record<Locale, ZakatCopy> = {
  en: {
    legacyTitle: 'We now use your live balances.',
    legacyBody: (figure) => `Your old figure was ${figure}.`,
    gotIt: 'Got it',
    goldCounted: (grams, worn) => `Gold · ${grams} g · ${worn} g worn not counted`,
    receivables: 'Owed to you',
    tradeGoods: 'Goods held for trade',
    tradeGoodsAdd: 'Add',
    tradeGoodsLine: 'Stock you hold to sell, at today’s value. Leave it empty if you have none.',
    onlyForZakat: 'Only for zakat',
    worn: 'Worn as jewellery (personal use)',
    wornHint: (name, grams) => `${name} · ${grams} g · not counted when on`,
    likelyRepaid: 'Likely to be repaid',
    likelyRepaidHint: (name, amount) => `${name} · ${amount} · counted when on`,
    estimate: (date) => `Estimate · due on ${date}`,
    dueNow: 'Due now',
    notYet: 'Not due yet. Your zakat year starts on the day your wealth first reached nisab.',
    setYearStart: (date) => `Start my year on ${date}`,
    noHistory: 'Some items have no history that far back, so today’s value is used for them.',
    pastNote: 'The year start is rebuilt from your history, with gold and other prices at today’s value.',
  },
  ar: {
    legacyTitle: 'نستخدم الآن أرصدتك الحالية.',
    legacyBody: (figure) => `رقمك القديم كان ${figure}.`,
    gotIt: 'تمام',
    goldCounted: (grams, worn) => `ذهب · ${grams} جم · ${worn} جم للزينة لا تُحسب`,
    receivables: 'ديون لك',
    tradeGoods: 'بضاعة للتجارة',
    tradeGoodsAdd: 'أضف',
    tradeGoodsLine: 'البضاعة التي تحتفظ بها للبيع، بقيمة اليوم. اتركها فارغة إن لم يكن لديك.',
    onlyForZakat: 'للزكاة فقط',
    worn: 'حُلي للاستعمال الشخصي',
    wornHint: (name, grams) => `${name} · ${grams} جم · لا يُحسب عند التفعيل`,
    likelyRepaid: 'يُرجّح سداده',
    likelyRepaidHint: (name, amount) => `${name} · ${amount} · يُحسب عند التفعيل`,
    estimate: (date) => `تقدير · تستحق في ${date}`,
    dueNow: 'مستحقة الآن',
    notYet: 'لم تجب بعد. تبدأ سنة زكاتك من اليوم الذي بلغت فيه ثروتك النصاب أول مرة.',
    setYearStart: (date) => `ابدأ سنتي في ${date}`,
    noHistory: 'بعض البنود ليس لها سجل بهذا القدم، فتُحسب بقيمتها اليوم.',
    pastNote: 'تُحسب بداية السنة من سجلك، والذهب وباقي الأسعار بقيمة اليوم.',
  },
}

export function useZakatCopy(): ZakatCopy {
  const { locale } = useLocale()
  return ZAKAT_COPY[locale]
}
