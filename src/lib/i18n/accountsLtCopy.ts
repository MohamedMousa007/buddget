import { useLocale } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/types'

/** Light touch Accounts (A2): the account and card sheets, add account, add card, Cash out, Set aside and Cash on hand. */
export interface AccountsLtCopy {
  account: {
    cashCaption: string
    free: string
    hint: string
    cashHint: string
    addCard: string
    smsSaid: (from: string, amount: string) => string
    cards: (n: number) => string
    seeAll: string
    defaultTitle: string
    defaultSub: string
    defaultOn: string
    defaultOff: string
    correction: string
    differentCurrency: string
    cardsFollowTitle: (n: number, currency: string) => string
    cardsFollowBody: string
    changeCardsToo: string
    onlyAccount: string
  }
  card: {
    availableOf: (available: string, limit: string) => string
    dueOn: (day: string) => string
  }
  addAccount: {
    choose: string
    optional: string
    bankLine: string
    walletLine: string
    cashTitle: string
    cardsHeading: string
    addCardSub: string
    notListed: string
    saveFirstTitle: string
    saveFirstBody: (provider: string) => string
    saveFirstCta: string
    notYet: string
  }
  addCard: {
    title: string
    creditTitle: string
    bankOrWallet: string
    uses: string
    usesNone: string
    credit: string
    limit: string
    owedNow: string
    dueDay: string
    currency: string
    look: string
    metal: string
    classic: string
    cta: string
    creditCta: string
    save: string
  }
  move: {
    to: string
    into: string
    cashOnHand: string
    setAsideTitle: (pocket: string) => string
    setAsideLine: (account: string, free: string) => string
    movesLine: (account: string, free: string) => string
    setAsideCta: string
  }
  cash: {
    countedToday: string
    title: string
    sub: string
    notTracked: string
    startTracking: string
  }
}

export const ACCOUNTS_LT_COPY: Record<Locale, AccountsLtCopy> = {
  en: {
    account: {
      cashCaption: 'Cash, an estimate',
      free: 'free',
      hint: 'Tap the amount or the currency to correct it',
      cashHint: 'Tap the amount when you count your cash',
      addCard: 'Add card',
      smsSaid: (from, a) => `from ${from} · SMS said ${a}`,
      cards: (n) => `Cards · ${n}`,
      seeAll: 'See all',
      defaultTitle: 'Default for new expenses',
      defaultSub: 'Picked first when you add an expense, and used for a bank message that matches no account',
      defaultOn: 'Default for new expenses',
      defaultOff: 'No longer the default',
      correction: 'Saved as a correction, never as spending',
      differentCurrency: 'Different currency',
      cardsFollowTitle: (n, c) => `Change ${n === 1 ? '1 card' : `${n} cards`} to ${c} too?`,
      cardsFollowBody: 'Past transactions keep their amounts and currency. Nothing is converted.',
      changeCardsToo: 'Change cards too',
      onlyAccount: 'Only the account',
    },
    card: {
      availableOf: (a, l) => `${a} available of ${l}`,
      dueOn: (d) => `due on the ${d}`,
    },
    addAccount: {
      choose: 'Choose',
      optional: 'Optional',
      bankLine: 'From your banking app or your last SMS',
      walletLine: 'What the wallet app shows now',
      cashTitle: 'Cash on hand',
      cardsHeading: 'Cards',
      addCardSub: 'Debit, credit or prepaid on this account. You can add it later.',
      notListed: 'Not listed? Add it by name',
      saveFirstTitle: 'Save this account and add a card?',
      saveFirstBody: (p) => `${p} is saved now, then you add its card. You can delete it later.`,
      saveFirstCta: 'Save and add a card',
      notYet: 'Not yet',
    },
    addCard: {
      title: 'Add a card',
      creditTitle: 'Add a credit card',
      bankOrWallet: 'Bank or wallet',
      uses: 'Uses',
      usesNone: 'No account',
      credit: 'Credit',
      limit: 'Limit',
      owedNow: 'Owed now',
      dueDay: 'Due day',
      currency: 'Currency',
      look: 'Look',
      metal: 'Metal',
      classic: 'Classic',
      cta: 'Add card',
      creditCta: 'Add credit card',
      save: 'Save changes',
    },
    move: {
      to: 'To',
      into: 'Into',
      cashOnHand: 'Cash on hand',
      setAsideTitle: (p) => `Set aside in ${p}`,
      setAsideLine: (a, f) => `Stays in ${a} · ${f} left free to spend`,
      movesLine: (a, f) => `Moves out of ${a} · ${f} left free to spend`,
      setAsideCta: 'Set aside',
    },
    cash: {
      countedToday: 'Counted today',
      title: 'Cash on hand',
      sub: 'Roughly is fine. Cash keeps an estimate from what you log.',
      notTracked: 'Not tracked',
      startTracking: 'Start tracking',
    },
  },
  ar: {
    account: {
      cashCaption: 'الكاش، تقديري',
      free: 'متاح',
      hint: 'اضغط المبلغ أو العملة لتصحيحه',
      cashHint: 'اضغط المبلغ لما تعدّ الكاش اللي معك',
      addCard: 'أضف بطاقة',
      smsSaid: (from, a) => `من ${from} · الرسالة قالت ${a}`,
      cards: (n) => `البطاقات · ${n}`,
      seeAll: 'عرض الكل',
      defaultTitle: 'الافتراضي للمصاريف الجديدة',
      defaultSub: 'يُختار أولاً لما تضيف مصروف، ويُستخدم لرسالة بنك لا تطابق أي حساب',
      defaultOn: 'أصبح الافتراضي للمصاريف الجديدة',
      defaultOff: 'لم يعد الافتراضي',
      correction: 'يُحفظ كتصحيح، وليس كمصروف أبداً',
      differentCurrency: 'عملة مختلفة',
      cardsFollowTitle: (n, c) => `تغيير ${n === 1 ? 'بطاقة واحدة' : n === 2 ? 'بطاقتين' : `${n} بطاقات`} إلى ${c} أيضاً؟`,
      cardsFollowBody: 'المعاملات السابقة تحتفظ بمبالغها وعملتها. لا يتم تحويل أي شيء.',
      changeCardsToo: 'غيّر البطاقات أيضاً',
      onlyAccount: 'الحساب فقط',
    },
    card: {
      availableOf: (a, l) => `${a} متاح من ${l}`,
      dueOn: (d) => `الاستحقاق ${d}`,
    },
    addAccount: {
      choose: 'اختر',
      optional: 'اختياري',
      bankLine: 'من تطبيق البنك أو آخر رسالة',
      walletLine: 'المبلغ الظاهر في تطبيق المحفظة الآن',
      cashTitle: 'الكاش اللي معك',
      cardsHeading: 'البطاقات',
      addCardSub: 'بطاقة خصم أو ائتمان أو مسبقة الدفع على هذا الحساب. تقدر تضيفها لاحقاً.',
      notListed: 'غير موجود؟ أضفه بالاسم',
      saveFirstTitle: 'نحفظ هذا الحساب ونضيف بطاقة؟',
      saveFirstBody: (p) => `يُحفظ ${p} الآن، ثم تضيف بطاقته. تقدر تحذفه لاحقاً.`,
      saveFirstCta: 'احفظ وأضف بطاقة',
      notYet: 'ليس الآن',
    },
    addCard: {
      title: 'أضف بطاقة',
      creditTitle: 'أضف بطاقة ائتمان',
      bankOrWallet: 'البنك أو المحفظة',
      uses: 'تسحب من',
      usesNone: 'بدون حساب',
      credit: 'الائتمان',
      limit: 'الحد',
      owedNow: 'المستحق الآن',
      dueDay: 'يوم الاستحقاق',
      currency: 'العملة',
      look: 'الشكل',
      metal: 'معدني',
      classic: 'كلاسيكي',
      cta: 'أضف البطاقة',
      creditCta: 'أضف بطاقة الائتمان',
      save: 'احفظ التعديلات',
    },
    move: {
      to: 'إلى',
      into: 'في',
      cashOnHand: 'الكاش اللي معك',
      setAsideTitle: (p) => `جنّب في ${p}`,
      setAsideLine: (a, f) => `يبقى في ${a} · ${f} متاح للصرف`,
      movesLine: (a, f) => `يخرج من ${a} · ${f} متاح للصرف`,
      setAsideCta: 'جنّب',
    },
    cash: {
      countedToday: 'عُدّ اليوم',
      title: 'الكاش اللي معك',
      sub: 'التقريب كافٍ. الكاش يبقى تقديرياً حسب ما تسجّله.',
      notTracked: 'غير متتبَّع',
      startTracking: 'ابدأ التتبع',
    },
  },
}

export function useAccountsLtCopy(): AccountsLtCopy {
  const { locale } = useLocale()
  return ACCOUNTS_LT_COPY[locale]
}
