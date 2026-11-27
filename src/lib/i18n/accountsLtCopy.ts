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
    /** A credit card with no linked account: the account that pays its bill. */
    paysFrom: string
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
  hero: {
    setAside: string
    owedOnCards: string
  }
  removed: {
    cardDeleted: (name: string) => string
    accountClosed: (name: string) => string
  }
  /** Shortfall (LOGIC_SPEC §4.2) and "Where did this money go?" before closing (§4.8). */
  short: {
    row: (amount: string) => string
    title: (account: string, amount: string) => string
    line: (amount: string, account: string) => string
    inAccount: (account: string) => string
    setAsideThere: string
    whatHappened: string
    inAnother: string
    inAnotherSub: (amount: string) => string
    spent: string
    spentSub: (first: string, then?: string) => string
    keep: string
    keepSub: (amount: string) => string
    whereNow: string
    transferHint: (amount: string, account: string, day: string) => string
    footnote: string
    moveCta: (account: string) => string
    spentCta: (amount: string) => string
    stillShort: (amount: string, account: string) => string
    noOther: string
    moved: string
    markedSpent: string
    kept: string
    bannerBody: string
    bannerCta: string
    closeTitle: string
    closeSub: (account: string, amount: string) => string
    beforeCloses: (account: string) => string
    closeMoveSub: string
    closeSpentSub: string
    closeFootnote: string
    closeCta: (account: string) => string
    closeLeft: (amount: string, account: string) => string
    closeRefused: (account: string) => string
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
      paysFrom: 'Pays this card from',
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
    hero: {
      setAside: 'set aside',
      owedOnCards: 'owed on cards',
    },
    removed: {
      cardDeleted: (n) => `${n} deleted`,
      accountClosed: (n) => `${n} closed`,
    },
    short: {
      row: (a) => `Short ${a}`,
      title: (acc, a) => `${acc} is short ${a}`,
      line: (a, acc) => `${a} of what you set aside isn't in ${acc} anymore`,
      inAccount: (acc) => `In ${acc}`,
      setAsideThere: 'Set aside there',
      whatHappened: 'What happened?',
      inAnother: 'It’s in another account',
      inAnotherSub: (a) => `The ${a} stays set aside, now where the money is`,
      spent: 'I spent it',
      spentSub: (first, then) => (then ? `Comes out of ${first} first, then ${then}` : `Comes out of ${first}`),
      keep: 'Keep for now',
      keepSub: (a) => `The rows keep showing Short ${a} until it’s covered`,
      whereNow: 'Where is it now?',
      transferHint: (a, acc, day) => `Transfer of ${a} left ${acc} on ${day}`,
      footnote: 'Your balances don’t change. Only what’s set aside moves or is let go.',
      moveCta: (acc) => `Move to ${acc}`,
      spentCta: (a) => `Mark ${a} as spent`,
      stillShort: (a, acc) => `${a} still short: ${acc} doesn’t have that much free. Pick another account, or I spent it.`,
      noOther: 'No other account can hold it right now.',
      moved: 'Set-aside money moved',
      markedSpent: 'Marked as spent',
      kept: 'Kept for now',
      bannerBody: 'Tell us where the money went.',
      bannerCta: 'Tell us',
      closeTitle: 'Where did this money go?',
      closeSub: (acc, a) => `${acc} holds ${a} set aside`,
      beforeCloses: (acc) => `Before ${acc} closes`,
      closeMoveSub: 'Everything set aside moves with it',
      closeSpentSub: 'Nothing stays set aside; goals lose this money',
      closeFootnote: 'Its history stays in Flow. A closed account counts 0 in your net worth.',
      closeCta: (acc) => `Close ${acc}`,
      closeLeft: (a, acc) => `${a} is still set aside: ${acc} doesn’t have that much free. Pick another account, or I spent it.`,
      closeRefused: (acc) => `${acc} couldn’t be closed. Check what is still set aside in it and try again.`,
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
      paysFrom: 'تُسدَّد البطاقة من',
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
    hero: {
      setAside: 'مجنَّب',
      owedOnCards: 'مستحق على البطاقات',
    },
    removed: {
      cardDeleted: (n) => `تم حذف ${n}`,
      accountClosed: (n) => `تم إغلاق ${n}`,
    },
    short: {
      row: (a) => `ناقص ${a}`,
      title: (acc, a) => `${acc} ناقص ${a}`,
      line: (a, acc) => `${a} مما خصّصته لم يعد في ${acc}`,
      inAccount: (acc) => `في ${acc}`,
      setAsideThere: 'المُخصَّص فيه',
      whatHappened: 'ماذا حدث؟',
      inAnother: 'في حساب آخر',
      inAnotherSub: (a) => `يبقى مبلغ ${a} مُخصَّصًا، في الحساب الذي فيه المال الآن`,
      spent: 'صرفته',
      spentSub: (first, then) => (then ? `يُخصم من ${first} أولًا، ثم من ${then}` : `يُخصم من ${first}`),
      keep: 'أبقِه الآن',
      keepSub: (a) => `تظل الصفوف تعرض ناقص ${a} حتى يُغطّى`,
      whereNow: 'أين هو الآن؟',
      transferHint: (a, acc, day) => `خرج تحويل ${a} من ${acc} في ${day}`,
      footnote: 'لن تتغير أرصدتك. ما يُنقل أو يُترك هو المُخصَّص فقط.',
      moveCta: (acc) => `انقله إلى ${acc}`,
      spentCta: (a) => `سجّل ${a} كمصروف`,
      stillShort: (a, acc) => `لا يزال ناقصًا ${a}: لا يتوفر في ${acc} مبلغ متاح كافٍ. اختر حسابًا آخر، أو صرفته.`,
      noOther: 'لا يوجد حساب آخر يمكنه حمله الآن.',
      moved: 'نُقل المبلغ المُخصَّص',
      markedSpent: 'سُجّل كمصروف',
      kept: 'أُبقي الآن',
      bannerBody: 'أخبرنا أين ذهب المال.',
      bannerCta: 'أخبرنا',
      closeTitle: 'أين ذهب هذا المال؟',
      closeSub: (acc, a) => `في ${acc} مبلغ ${a} مُخصَّص`,
      beforeCloses: (acc) => `قبل إغلاق ${acc}`,
      closeMoveSub: 'ينتقل معه كل المُخصَّص',
      closeSpentSub: 'لن يبقى شيء مُخصَّصًا، وستخسر الأهداف هذا المبلغ',
      closeFootnote: 'يبقى سجله في المعاملات. الحساب المغلق يُحسب صفرًا في صافي ثروتك.',
      closeCta: (acc) => `إغلاق ${acc}`,
      closeLeft: (a, acc) => `لا يزال ${a} مُخصَّصًا: لا يتوفر في ${acc} مبلغ متاح كافٍ. اختر حسابًا آخر، أو صرفته.`,
      closeRefused: (acc) => `تعذّر إغلاق ${acc}. راجع ما بقي مُخصَّصًا فيه وحاول مرة أخرى.`,
    },
  },
}

export function useAccountsLtCopy(): AccountsLtCopy {
  const { locale } = useLocale()
  return ACCOUNTS_LT_COPY[locale]
}
