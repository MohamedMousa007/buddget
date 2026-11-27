import { useLocale } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/types'
import { AR_UNITS, arPlural } from '@/lib/i18n/arPlural'

const AR_PAYMENT = { one: 'دفعة', two: 'دفعتين', few: 'دفعات', many: 'دفعة', fem: true }
const AR_PLAN = { one: 'خطة', two: 'خطتين', few: 'خطط', many: 'خطة', fem: true }

/** Round 9 Debts (final-ui v9, `lt-v8-debts.js`): the list sections, the Cleared page and the detail sheets. */
export interface DebtsV9Copy {
  list: {
    youOwe: string
    plans: string
    cards: string
    owedToYou: string
    owedNote: string
    plansNote: string
    cardsNote: string
    clearedAria: (n: number) => string
    due: (date: string) => string
    expected: (date: string) => string
    noDue: string
    leftOfN: (left: number, n: number) => string
    paidOf: (paid: string, total: string) => string
    backOf: (paid: string, total: string) => string
    pctOfLimit: (pct: number, limit: string) => string
    plansOnCard: (n: number, card: string) => string
    plansSub: (monthly: string, left: string) => string
    planLine: (n: number, monthly: string, left: string) => string
  }
  cleared: {
    back: string
    title: string
    heroLabel: string
    paidOff: (cur: string) => string
    months: string
    fastest: string
    last: string
    monthsShort: (n: number) => string
    head: string
    rowSub: (kind: string, month: string, n: number) => string
    kind: Record<'borrow' | 'installment' | 'credit_card', string>
    nextToClear: string
    paymentsLeft: (name: string, n: number) => string
  }
  detail: {
    borrowSub: string
    owedSub: string
    installSub: (provider: string) => string
    leftToPay: string
    stillToGet: string
    youLent: string
    youBorrowed: string
    aMonth: (amount: string) => string
    addPayment: string
    addRepayment: string
    pay: (amount: string) => string
    payments: string
    repayments: string
    swipeHint: string
    noPayments: string
    noPaymentsBody: string
    noRepayments: string
    noRepaymentsBody: (who: string) => string
    noInstallPaymentsBody: string
    paidBackTitle: (who: string) => string
    details: string
    person: string
    direction: string
    theyOweYou: string
    youOweThem: string
    lent: string
    borrowed: string
    paidBack: string
    paidSoFar: string
    left: string
    paymentsRow: string
    eachMonth: string
    dueDate: string
    noneSet: string
    started: string
    paidFrom: string
    receivedIn: string
    ofPaid: (done: number, n: number) => string
    ofN: (done: number, n: number) => string
    lastPayment: (date: string, total: string) => string
    nextPayment: string
    inDays: (date: string, days: number) => string
    paymentN: (n: number) => string
    chargedTo: (method: string) => string
    schedule: string
    showEarlier: (n: number) => string
    showLess: string
    paid: string
    next: string
    upcoming: string
    plan: string
    provider: string
    purchase: string
    totalCost: string
    paidWith: string
  }
  menu: {
    more: string
    edit: string
    settle: string
    settleOwed: string
    settleOwe: string
    early: string
    earlyHint: (left: string) => string
    delete: string
    settleTitle: (name: string) => string
    settleBody: (left: string, owed: boolean) => string
  }
  pay: { fullAmount: (amount: string) => string }
  install: {
    items: Record<'phone' | 'laptop' | 'appliance' | 'furniture' | 'car' | 'other', string>
    namePh: string
    nameAria: string
  }
}

export const DEBTS_V9_COPY: Record<Locale, DebtsV9Copy> = {
  en: {
    list: {
      youOwe: 'You owe',
      plans: 'Plans',
      cards: 'Credit cards',
      owedToYou: 'Owed to you',
      owedNote: 'Not part of Still owed. It shows what others owe you.',
      plansNote: 'A plan paid on a credit card is part of what you owe on that card, so it shows under its card, not as a second debt.',
      cardsNote: 'Tap a card to pay it. Its installment plans are inside the card.',
      clearedAria: (n) => `Cleared debts, ${n}`,
      due: (d) => `Due ${d}`,
      expected: (d) => `Expected ${d}`,
      noDue: 'No due date',
      leftOfN: (l, n) => `${l} of ${n} left`,
      paidOf: (p, t) => `${p} of ${t} paid`,
      backOf: (p, t) => `${p} of ${t} back`,
      pctOfLimit: (p, l) => `${p}% of ${l} limit`,
      plansOnCard: (n, card) => `${n === 1 ? '1 plan' : `${n} plans`} on ${card}`,
      plansSub: (m, l) => `${m} a month · ${l} left`,
      planLine: (n, m, l) => `Installments: ${n === 1 ? '1 plan' : `${n} plans`} · ${m} a month · ${l} left`,
    },
    cleared: {
      back: 'Debts',
      title: 'Cleared debts',
      heroLabel: 'Debts cleared',
      paidOff: (cur) => `${cur} paid off`,
      months: 'months paying',
      fastest: 'fastest payoff',
      last: 'last cleared',
      monthsShort: (n) => `${n} mo`,
      head: 'Cleared, newest first',
      rowSub: (k, m, n) => `${k} · ${m} · ${n} mo`,
      kind: { borrow: 'Borrow', installment: 'Installment', credit_card: 'Credit card' },
      nextToClear: 'Next to clear',
      paymentsLeft: (name, n) => `${name} · ${n === 1 ? '1 payment' : `${n} payments`} left`,
    },
    detail: {
      borrowSub: 'Borrow',
      owedSub: 'Owed to you',
      installSub: (p) => `Installment · ${p}`,
      leftToPay: 'Left to pay',
      stillToGet: 'Still to get back',
      youLent: 'You lent',
      youBorrowed: 'You borrowed',
      aMonth: (a) => `${a} a month`,
      addPayment: 'Add payment',
      addRepayment: 'Add repayment',
      pay: (a) => `Pay ${a}`,
      payments: 'Payments',
      repayments: 'Repayments',
      swipeHint: 'Swipe left to delete',
      noPayments: 'No payments yet',
      noPaymentsBody: 'Add a payment when you pay some back.',
      noRepayments: 'No repayments yet',
      noRepaymentsBody: (who) => `When ${who} pays you back, add it here and it lowers what’s left.`,
      noInstallPaymentsBody: 'Your first payment shows here once it’s paid.',
      paidBackTitle: (who) => `${who} paid you back`,
      details: 'Details',
      person: 'Person',
      direction: 'Direction',
      theyOweYou: 'They owe you',
      youOweThem: 'You owe them',
      lent: 'You lent',
      borrowed: 'Borrowed',
      paidBack: 'Paid back',
      paidSoFar: 'Paid so far',
      left: 'Left',
      paymentsRow: 'Payments',
      eachMonth: 'Each month',
      dueDate: 'Due date',
      noneSet: 'None set',
      started: 'Started',
      paidFrom: 'Paid from',
      receivedIn: 'Received in',
      ofPaid: (d, n) => `${d} of ${n} paid`,
      ofN: (d, n) => `${d} of ${n}`,
      lastPayment: (d, t) => `Last payment ${d} · total cost ${t}`,
      nextPayment: 'Next payment',
      inDays: (d, n) => (n <= 0 ? `${d} · today` : `${d} · in ${n === 1 ? '1 day' : `${n} days`}`),
      paymentN: (n) => `Payment ${n}`,
      chargedTo: (m) => `Charged to ${m}`,
      schedule: 'Schedule',
      showEarlier: (n) => (n === 1 ? 'Show 1 earlier payment' : `Show ${n} earlier payments`),
      showLess: 'Show less',
      paid: 'Paid',
      next: 'Next',
      upcoming: 'Upcoming',
      plan: 'Plan',
      provider: 'Provider',
      purchase: 'Purchase',
      totalCost: 'Total cost',
      paidWith: 'Paid with',
    },
    menu: {
      more: 'More actions',
      edit: 'Edit',
      settle: 'Mark settled',
      settleOwed: 'They paid you back in full',
      settleOwe: 'You paid it all back',
      early: 'Pay off early',
      earlyHint: (l) => `Clear all ${l} today`,
      delete: 'Delete',
      settleTitle: (n) => `Mark ${n} settled?`,
      settleBody: (l, owed) => `${l} left will be marked as ${owed ? 'paid back to you' : 'paid'}. It moves to your cleared debts.`,
    },
    pay: { fullAmount: (a) => `Full amount · ${a}` },
    install: {
      items: { phone: 'Phone', laptop: 'Laptop', appliance: 'Home appliance', furniture: 'Furniture', car: 'Car', other: 'Other' },
      namePh: 'What did you buy?',
      nameAria: 'Item name',
    },
  },
  ar: {
    list: {
      youOwe: 'عليك',
      plans: 'الخطط',
      cards: 'بطاقات الائتمان',
      owedToYou: 'مستحق لك',
      owedNote: 'ليس ضمن «المتبقي عليك». يوضح ما يدين لك به الآخرون.',
      plansNote: 'الخطة المدفوعة ببطاقة ائتمان جزء مما عليك لتلك البطاقة، لذلك تظهر تحت بطاقتها لا كدين ثانٍ.',
      cardsNote: 'اضغط على بطاقة لتسددها. خطط التقسيط الخاصة بها داخل البطاقة.',
      clearedAria: (n) => `الديون المسددة، ${n}`,
      due: (d) => `مستحق ${d}`,
      expected: (d) => `متوقع ${d}`,
      noDue: 'بلا تاريخ استحقاق',
      leftOfN: (l, n) => `باقي ${l} من ${n}`,
      paidOf: (p, t) => `${p} من ${t} مدفوع`,
      backOf: (p, t) => `${p} من ${t} رجع`,
      pctOfLimit: (p, l) => `${p}% من حد ${l}`,
      plansOnCard: (n, card) => `${arPlural(n, AR_PLAN)} على ${card}`,
      plansSub: (m, l) => `${m} في الشهر · باقي ${l}`,
      planLine: (n, m, l) => `التقسيط: ${arPlural(n, AR_PLAN)} · ${m} في الشهر · باقي ${l}`,
    },
    cleared: {
      back: 'الديون',
      title: 'الديون المسددة',
      heroLabel: 'ديون مسددة',
      paidOff: (cur) => `${cur} اتسدد`,
      months: 'شهور السداد',
      fastest: 'أسرع سداد',
      last: 'آخر سداد',
      monthsShort: (n) => arPlural(n, AR_UNITS.month),
      head: 'المسددة، الأحدث أولًا',
      rowSub: (k, m, n) => `${k} · ${m} · ${arPlural(n, AR_UNITS.month)}`,
      kind: { borrow: 'سلف', installment: 'تقسيط', credit_card: 'بطاقة ائتمان' },
      nextToClear: 'التالي للسداد',
      paymentsLeft: (name, n) => `${name} · باقي ${arPlural(n, AR_PAYMENT)}`,
    },
    detail: {
      borrowSub: 'سلف',
      owedSub: 'مستحق لك',
      installSub: (p) => `تقسيط · ${p}`,
      leftToPay: 'المتبقي للسداد',
      stillToGet: 'المتبقي لترجعه',
      youLent: 'أنت أقرضت',
      youBorrowed: 'أنت استلفت',
      aMonth: (a) => `${a} في الشهر`,
      addPayment: 'أضف دفعة',
      addRepayment: 'أضف مبلغًا رجع لك',
      pay: (a) => `ادفع ${a}`,
      payments: 'الدفعات',
      repayments: 'المبالغ الراجعة',
      swipeHint: 'اسحب لليسار للحذف',
      noPayments: 'لا دفعات بعد',
      noPaymentsBody: 'أضف دفعة عندما تسدد جزءًا.',
      noRepayments: 'لم يرجع شيء بعد',
      noRepaymentsBody: (who) => `عندما يرجع لك ${who} مبلغًا أضفه هنا فيقل المتبقي.`,
      noInstallPaymentsBody: 'تظهر أول دفعة هنا بعد سدادها.',
      paidBackTitle: (who) => `${who} رجّع لك`,
      details: 'التفاصيل',
      person: 'الشخص',
      direction: 'الاتجاه',
      theyOweYou: 'يدين لك',
      youOweThem: 'أنت مدين له',
      lent: 'أقرضت',
      borrowed: 'استلفت',
      paidBack: 'رجع لك',
      paidSoFar: 'سددت حتى الآن',
      left: 'المتبقي',
      paymentsRow: 'الدفعات',
      eachMonth: 'كل شهر',
      dueDate: 'تاريخ الاستحقاق',
      noneSet: 'غير محدد',
      started: 'البداية',
      paidFrom: 'دُفع من',
      receivedIn: 'وصل إلى',
      ofPaid: (d, n) => `${d} من ${n} مدفوعة`,
      ofN: (d, n) => `${d} من ${n}`,
      lastPayment: (d, t) => `آخر دفعة ${d} · التكلفة الكلية ${t}`,
      nextPayment: 'الدفعة القادمة',
      inDays: (d, n) => (n <= 0 ? `${d} · اليوم` : `${d} · بعد ${arPlural(n, AR_UNITS.day)}`),
      paymentN: (n) => `الدفعة ${n}`,
      chargedTo: (m) => `تُخصم من ${m}`,
      schedule: 'الجدول',
      showEarlier: (n) => `اعرض ${arPlural(n, AR_PAYMENT)} سابقة`,
      showLess: 'اعرض أقل',
      paid: 'مدفوعة',
      next: 'القادمة',
      upcoming: 'لاحقة',
      plan: 'الخطة',
      provider: 'الجهة',
      purchase: 'المشتريات',
      totalCost: 'التكلفة الكلية',
      paidWith: 'تُدفع بـ',
    },
    menu: {
      more: 'إجراءات أخرى',
      edit: 'تعديل',
      settle: 'تمّت التسوية',
      settleOwed: 'رجّع لك المبلغ كاملًا',
      settleOwe: 'سددت المبلغ كله',
      early: 'سدّد مبكرًا',
      earlyHint: (l) => `سدّد ${l} كلها اليوم`,
      delete: 'حذف',
      settleTitle: (n) => `تسوية ${n}؟`,
      settleBody: (l, owed) => `سيُعتبر المتبقي ${l} ${owed ? 'راجعًا لك' : 'مدفوعًا'}. ينتقل إلى ديونك المسددة.`,
    },
    pay: { fullAmount: (a) => `المبلغ كاملًا · ${a}` },
    install: {
      items: { phone: 'موبايل', laptop: 'لابتوب', appliance: 'جهاز منزلي', furniture: 'أثاث', car: 'سيارة', other: 'أخرى' },
      namePh: 'ماذا اشتريت؟',
      nameAria: 'اسم المنتج',
    },
  },
}

export function useDebtsV9Copy(): DebtsV9Copy {
  return DEBTS_V9_COPY[useLocale().locale]
}
