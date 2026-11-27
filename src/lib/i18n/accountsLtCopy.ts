import { useLocale } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/types'
import type { CardColour, CardDesign } from '@/lib/payment/cardFaces'
import { arPlural } from '@/lib/i18n/arPlural'

const AR_PLAN = { one: 'خطة', two: 'خطتين', few: 'خطط', many: 'خطة', fem: true }

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
  /** Round 9 (final UI v9): hero, faces, card sheet, Pay card, Set aside list, the add menu's Card tile. */
  v9: {
    freeToSpend: string
    exactly: (amount: string) => string
    exactlyOf: (label: string, amount: string) => string
    showExact: (label: string, amount: string) => string
    addACard: string
    spreadCards: string
    creditTip: string
    addMenuCard: string
    addMenuCardHint: string
    cardFace: string
    modern: string
    classic: string
    cardColour: string
    designs: Record<CardDesign, string>
    colours: Record<CardColour, string>
    linkedAccount: string
    linkedNone: string
    linkedHint: string
    payCard: string
    payTitle: (card: string) => string
    fullAmount: string
    from: string
    date: string
    payNote: string
    paySaved: string
    clearsWithPlans: (card: string, plans: string) => string
    clears: (amount: string) => string
    leftAfter: (amount: string) => string
    dueNow: (amount: string) => string
    owedSplit: (card: string, plans: string, n: number) => string
    installments: string
    installmentsLine: (n: number, month: string, left: string) => string
    planProgress: (paid: number, of: number, month: string) => string
    planLeft: (amount: string) => string
    setAsideTitle: string
    setAsideSub: (amount: string) => string
    pockets: string
    goals: string
    inAccount: (account: string) => string
    inPlaces: (parts: string[]) => string
    amountIn: (amount: string, account: string) => string
    notCovered: (amount: string) => string
    shortWarn: (account: string, amount: string) => string
    setAsideFootnote: string
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
    v9: {
      freeToSpend: 'Free to spend',
      exactly: (a) => `${a} exactly`,
      exactlyOf: (l, a) => `${l} · ${a} exactly`,
      showExact: (l, a) => `${l}, ${a}`,
      addACard: 'Add a card',
      spreadCards: 'Spread the cards',
      creditTip: 'Spending on this card is added to what you owe. It isn’t taken from any account until you pay the card.',
      addMenuCard: 'Card',
      addMenuCardHint: 'No account needed',
      cardFace: 'Card face',
      modern: 'Modern',
      classic: 'Classic',
      cardColour: 'Card colour',
      designs: { wave: 'Wave', metal: 'Metal', chrome: 'Chrome', glass: 'Glass', carbon: 'Carbon', contour: 'Contour', grain: 'Grain', lion: 'Lion', guilloche: 'Guilloche', facet: 'Facets', globe: 'Globe', twotone: 'Two-tone', ribbon: 'Ribbon', emboss: 'Emboss' },
      colours: { black: 'Black', teal: 'Teal', navy: 'Navy', sand: 'Sand', rose: 'Rose' },
      linkedAccount: 'Linked account',
      linkedNone: 'None',
      linkedHint: 'None is fine for a store card, a prepaid card or a card from a bank where you have no account.',
      payCard: 'Pay card',
      payTitle: (c) => `Pay ${c}`,
      fullAmount: 'Full amount',
      from: 'From',
      date: 'Date',
      payNote: 'The money leaves that account and what you owe on the card goes down. It isn’t counted as spending; the purchases already were.',
      paySaved: 'Card payment saved',
      clearsWithPlans: (c, p) => `Clears what’s due now: ${c} + ${p} in installments`,
      clears: (a) => `Clears the ${a} you owe on this card`,
      leftAfter: (a) => `${a} left to pay after this`,
      dueNow: (a) => `${a} due now`,
      owedSplit: (c, p, n) => `${c} on the card + ${p} in ${n} ${n === 1 ? 'plan' : 'plans'}`,
      installments: 'Installments:',
      installmentsLine: (n, m, l) => `${n} ${n === 1 ? 'plan' : 'plans'} · ${m} a month · ${l} left`,
      planProgress: (p, of, m) => `${p} of ${of} · ${m} a month`,
      planLeft: (a) => `${a} left`,
      setAsideTitle: 'Set aside',
      setAsideSub: (a) => `${a} kept for pockets and goals`,
      pockets: 'Pockets',
      goals: 'Goals',
      inAccount: (a) => `In ${a}`,
      inPlaces: (parts) => parts.join(' · '),
      amountIn: (a, acc) => `${a} in ${acc}`,
      notCovered: (a) => `${a} not covered`,
      shortWarn: (acc, a) => `${acc} is short ${a}.`,
      setAsideFootnote: 'Set-aside money stays in its account, so the balance doesn’t change. It’s left out of Free to spend so you don’t spend it by accident.',
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
    v9: {
      freeToSpend: 'متاح للصرف',
      exactly: (a) => `${a} بالضبط`,
      exactlyOf: (l, a) => `${l} · ${a} بالضبط`,
      showExact: (l, a) => `${l}، ${a}`,
      addACard: 'أضف بطاقة',
      spreadCards: 'افرد البطاقات',
      creditTip: 'المصروف على هذه البطاقة يُضاف لما تدين به. لا يُخصم من أي حساب حتى تسدد البطاقة.',
      addMenuCard: 'بطاقة',
      addMenuCardHint: 'بدون حساب',
      cardFace: 'شكل البطاقة',
      modern: 'عصري',
      classic: 'كلاسيكي',
      cardColour: 'لون البطاقة',
      designs: { wave: 'موجة', metal: 'معدني', chrome: 'كروم', glass: 'زجاج', carbon: 'كربون', contour: 'خطوط', grain: 'محبّب', lion: 'أسد', guilloche: 'زخرفة', facet: 'أوجه', globe: 'كرة أرضية', twotone: 'لونين', ribbon: 'شريط', emboss: 'نقش بارز' },
      colours: { black: 'أسود', teal: 'أخضر مزرق', navy: 'كحلي', sand: 'رملي', rose: 'وردي' },
      linkedAccount: 'الحساب المرتبط',
      linkedNone: 'لا يوجد',
      linkedHint: '«لا يوجد» مناسب لبطاقة متجر أو بطاقة مسبقة الدفع أو بطاقة من بنك ليس لك فيه حساب.',
      payCard: 'سدّد البطاقة',
      payTitle: (c) => `سداد ${c}`,
      fullAmount: 'المبلغ كامل',
      from: 'من',
      date: 'التاريخ',
      payNote: 'يخرج المبلغ من ذلك الحساب وينقص ما تدين به على البطاقة. لا يُحسب كمصروف؛ المشتريات حُسبت من قبل.',
      paySaved: 'تم حفظ سداد البطاقة',
      clearsWithPlans: (c, p) => `يغطي المستحق الآن: ${c} + ${p} أقساط`,
      clears: (a) => `يغطي ${a} المستحقة على هذه البطاقة`,
      leftAfter: (a) => `يتبقى ${a} بعد هذه الدفعة`,
      dueNow: (a) => `${a} مستحق الآن`,
      owedSplit: (c, p, n) => `${c} على البطاقة + ${p} في ${arPlural(n, AR_PLAN)}`,
      installments: 'الأقساط:',
      installmentsLine: (n, m, l) => `${arPlural(n, AR_PLAN)} · ${m} شهريًا · يتبقى ${l}`,
      planProgress: (p, of, m) => `${p} من ${of} · ${m} شهريًا`,
      planLeft: (a) => `يتبقى ${a}`,
      setAsideTitle: 'المُخصَّص',
      setAsideSub: (a) => `${a} مُخصَّص للجيوب والأهداف`,
      pockets: 'الجيوب',
      goals: 'الأهداف',
      inAccount: (a) => `في ${a}`,
      inPlaces: (parts) => parts.join(' · '),
      amountIn: (a, acc) => `${a} في ${acc}`,
      notCovered: (a) => `${a} غير مغطّى`,
      shortWarn: (acc, a) => `${acc} ناقص ${a}.`,
      setAsideFootnote: 'المال المُخصَّص يبقى في حسابه، فلا يتغير الرصيد. يُستبعد من «متاح للصرف» حتى لا تصرفه بالخطأ.',
    },
  },
}

export function useAccountsLtCopy(): AccountsLtCopy {
  const { locale } = useLocale()
  return ACCOUNTS_LT_COPY[locale]
}
