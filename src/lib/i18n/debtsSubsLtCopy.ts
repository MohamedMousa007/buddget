import { useLocale } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/types'
import { AR_UNITS, arPlural } from '@/lib/i18n/arPlural'
import type { SubscriptionDisplayStatus } from '@/lib/subscriptions/subscriptionStatus'
import type { ProviderCategory } from '@/lib/constants/installmentProviders'

type Every = 'weekly' | 'monthly' | 'quarterly' | 'annually'

/** Light touch strings for Debts, Subscriptions, the budget line and the payday sheet (BUILD_SPEC A4). */
export interface DebtsSubsLtCopy {
  debts: {
    tabs: { borrow: string; installment: string; credit_card: string }
    active: string
    add: string
    addTitle: string
    addSub: string
    addBorrow: { title: string; sub: string }
    addInstallment: { title: string; sub: string }
    addCard: { title: string; sub: string }
    perMonth: (amount: string) => string
    leftOf: (left: number | string, of: number | string) => string
    statementDue: (date: string) => string
    usedPct: (pct: number) => string
    hero: { next: (amount: string, date: string) => string; month: (paid: string, of: string) => string; freeBy: (date: string) => string; cleared: (count: number, paid: string) => string; overdue: (amount: string, since: string) => string }
    late: (days: number) => string
    nextOn: (date: string) => string
    owedToYou: string
    rowActions: { pay: string; receive: string; edit: string; charges: string; delete: string }
    deleteTitle: (name: string) => string
    deleteBody: string
    payments: string
    noPayments: string
    swipeHint: string
    filterPayments: string
    paymentTitle: (name: string, month: string) => string
    cleared: (count: number, total: string) => string
    emptyTitle: string
    emptyBody: string
    emptyCta: string
  }
  borrow: {
    newTitle: string
    editTitle: string
    iOwe: string
    owedToMe: string
    youOwe: (person: string) => string
    owesYou: (person: string) => string
    them: string
    they: string
    goldLine: (value: string, perGram: string, karat: number) => string
    goldUnavailable: string
    goldCleared: string
    needAmount: string
    needPerson: string
    needItem: string
    draftTitle: string
    draftBody: string
    draftDiscard: string
    person: string
    personPh: string
    forLabel: string
    forPh: string
    date: string
    receivedIn: string
    paidFrom: string
    arrivedIn: (account: string) => string
    leftAccount: (account: string) => string
    adds: (amount: string) => string
    takes: (amount: string) => string
    gold: string
    goldHelp: string
    karatTitle: string
    karatSub: string
    karatSubtitle: (perGram: string) => string
    plan: string
    planSwitch: string
    over: string
    overTitle: string
    months: (n: number) => string
    /** The word after a typed count in the number picker. */
    monthsUnit: (n: number) => string
    every: string
    everyTitle: string
    everyValue: Record<Every, string>
    planNote: (per: string, every: Every, n: number) => string
    cta: string
    save: string
  }
  install: {
    newTitle: string
    editTitle: string
    total: string
    per: string
    perLine: (per: string) => string
    totalLine: (total: string) => string
    item: string
    itemPh: string
    provider: string
    chooseProvider: string
    starts: string
    paidWith: string
    paidWithNote: string
    plan: string
    payments: string
    paymentsTitle: string
    paymentsUnit: (n: number) => string
    planNote: (n: number, per: string) => string
    cta: string
    providerKind: Record<ProviderCategory, string>
  }
  pay: {
    debt: string; paidFrom: string; into: string; left: (left: string, after: string) => string; note: string; repeat: string; repeatHint: (day: string) => string
    /** CTAs (mockup `debtpay` / `repaid`). */
    record: string
    markRepaid: string
    /** Money back from someone (mockup `repaid`): the title and the line under it. */
    paidBack: (person: string) => string
    forOn: (what: string, date: string) => string
    ofTotal: (amount: string, total: string) => string
    /** The quiet disclosure for Repeat and Note on the repaid sheet. */
    more: string
  }
  vault: {
    title: string
    paidOff: string
    summary: (count: number, last: string) => string
    tag: Record<'borrow' | 'installment' | 'credit_card', string>
    clearedIn: (month: string, payments: number) => string
    howYouPaid: string
    hide: string
    empty: string
  }
  subs: {
    status: Record<SubscriptionDisplayStatus, string>
    statusLine: Record<SubscriptionDisplayStatus, (next: string) => string>
    cycle: Record<'weekly' | 'monthly' | 'quarterly' | 'semiannual' | 'yearly', string>
    repeats: Record<'weekly' | 'monthly' | 'quarterly' | 'semiannual' | 'yearly', string>
    nextCharge: (date: string) => string
    rate: (base: string, from: string, rate: string, to: string) => string
    paidWith: string
    category: string
    repeatsLabel: string
    remind: string
    remindHelp: string
    lastCharges: string
    save: string
    cancelLink: string
    resubscribe: string
    deleteTitle: (name: string) => string
    deleteBody: string
    addTitle: string
    addLine: (monthly: string, committed: string) => string
    priceNote: (usual: string) => string
    firstCharge: string
    every: string
    trackedNote: string
    addCta: (name: string) => string
    cancelTitle: (name: string) => string
    cancelLine: (plan: string, every: string, base: string) => string
    saveMonth: string
    saveYear: string
    endsOn: string
    cancelOn: (site: string) => string
    open: string
    cancelNote: string
    cancelCta: string
    keep: string
    endsToast: (name: string) => string
    empty: { title: string; body: string; scan: string; addMyself: string }
    hero: { label: string; aMonth: string; paid: (x: string) => string; due: (x: string) => string; next: (name: string, date: string) => string; aYear: (x: string) => string }
  }
  line: {
    subtitle: (group: string) => string
    perMonth: string
    ofIncome: (pct: number) => string
    dueDay: string
    dueDayTitle: string
    noDueDay: string
    spendingFrom: string
    spendingFromTitle: string
    spendingNote: string
    none: string
    deleteTitle: string
    deleteBody: string
    leftOf: (left: string, of: string) => string
    over: (over: string, of: string) => string
    planned: (pct: number) => string
    openBlock: (name: string) => string
    /** The one list head on the Budget page (mockup `page-budget`). */
    categories: string
    /** The quiet row under the list that opens a group's page (bills, subscriptions, debts, everyday). */
    groups: string
  }
  payday: {
    newTitle: string
    editTitle: string
    aboutMonth: (amount: string) => string
    atRate: (amount: string, base: string) => string
    name: string
    namePh: string
    type: string
    typeTitle: string
    payday: string
    receivedIn: string
    add: string
    save: string
    logPayday: string
    editPayday: string
    expected: string
    lateChip: string
    missedChip: string
  }
  method: { choose: string }
  repaid: { title: (who: string) => string; line: (what: string, date: string, got: string, of: string) => string; into: string; match: string; none: string; matchTitle: string; cta: string; someone: string }
  received: { title: (name: string, month: string) => string; expected: (amount: string) => string; short: (short: string) => string; full: (amount: string) => string; half: (amount: string) => string; receivedIn: string; payday: string }
}

const enMonths = (n: number) => (n === 1 ? '1 month' : `${n} months`)
const enPayments = (n: number) => (n === 1 ? '1 payment' : `${n} payments`)
const AR_PAYMENT = { one: 'دفعة', two: 'دفعتين', few: 'دفعات', many: 'دفعة', fem: true }
const AR_DEBT = { one: 'دين', two: 'دينين', few: 'ديون', many: 'دينًا' }

export const DEBTS_SUBS_LT_COPY: Record<Locale, DebtsSubsLtCopy> = {
  en: {
    debts: {
      tabs: { borrow: 'Borrowed', installment: 'Installments', credit_card: 'Cards' },
      active: 'Active',
      add: 'Add',
      addTitle: 'Add a debt',
      addSub: 'What are you tracking?',
      addBorrow: { title: 'Borrowed money', sub: 'From a person or a bank loan' },
      addInstallment: { title: 'Installment plan', sub: 'valU, Contact, Souhoola and others' },
      addCard: { title: 'Credit card', sub: 'Limit, owed now and due day' },
      perMonth: (a) => `${a} a month`,
      leftOf: (l, o) => `${l} of ${o} left`,
      statementDue: (d) => `Statement due ${d}`,
      usedPct: (p) => `${p}% used`,
      hero: {
        next: (a, d) => `Next ${a} on ${d}`,
        month: (p, o) => `${p} of ${o} paid this month`,
        freeBy: (d) => `debt-free by ${d}`,
        overdue: (a, d) => `Overdue · ${a} since ${d}`,
        cleared: (c, p) => `${c === 1 ? '1 debt cleared' : `${c} debts cleared`} · ${p} paid off`,
      },
      late: (n) => (n === 1 ? '1 day late' : `${n} days late`),
      nextOn: (d) => `next ${d}`,
      owedToYou: 'Owed to you',
      rowActions: { pay: 'Record a payment', receive: 'Record money back', edit: 'Edit', charges: 'See charges', delete: 'Delete' },
      deleteTitle: (n) => `Delete ${n}?`,
      deleteBody: 'Its payments go with it. This can’t be undone.',
      payments: 'Payments',
      noPayments: 'No payments yet. Debts you add are under Added.',
      swipeHint: 'Swipe left to delete',
      filterPayments: 'Filter payments',
      paymentTitle: (n, m) => `${n} · ${m}`,
      cleared: (c, t) => `${c === 1 ? '1 cleared debt' : `${c} cleared debts`} · ${t} paid off`,
      emptyTitle: 'No debts to track',
      emptyBody: 'Staying at zero is the goal. Add one if you borrow, pay in installments or carry a card balance.',
      emptyCta: 'Add a debt',
    },
    borrow: {
      newTitle: 'New borrow',
      editTitle: 'Edit borrow',
      iOwe: 'I owe',
      owedToMe: 'Owed to me',
      youOwe: (p) => `You owe ${p}`,
      owesYou: (p) => `${p} owes you`,
      them: 'them',
      they: 'They',
      goldLine: (v, g, k) => `≈ ${v} today · ${g} a gram of ${k}k`,
      goldUnavailable: 'Today’s gold price isn’t in yet',
      goldCleared: 'Today’s gold price isn’t in yet, so the amount was cleared. Type it again.',
      needAmount: 'Type the amount to add it.',
      needPerson: 'Add who it’s with to add it.',
      needItem: 'Name the item to add it.',
      draftTitle: 'Discard this debt?',
      draftBody: 'What you typed isn’t saved yet.',
      draftDiscard: 'Discard',
      person: 'Person',
      personPh: 'e.g. Ahmed',
      forLabel: 'For',
      forPh: 'e.g. Rent help',
      date: 'Date',
      receivedIn: 'Received in',
      paidFrom: 'Paid from',
      arrivedIn: (a) => `Arrived in ${a} now`,
      leftAccount: (a) => `Left ${a} now`,
      adds: (a) => `Adds ${a} to the balance`,
      takes: (a) => `Takes ${a} from the balance`,
      gold: 'Gold-backed',
      goldHelp: 'Owed in grams, valued at today’s price',
      karatTitle: 'Karat',
      karatSub: 'Priced at today’s gram rate',
      karatSubtitle: (g) => `${g} a gram`,
      plan: 'Pay-off plan',
      planSwitch: 'Pay it off by a date',
      over: 'Over',
      overTitle: 'Pay it off over',
      months: enMonths,
      monthsUnit: (n) => (n === 1 ? 'month' : 'months'),
      every: 'Every',
      everyTitle: 'How often?',
      everyValue: { weekly: 'Week', monthly: 'Month', quarterly: 'Quarter', annually: 'Year' },
      planNote: (p, e, n) => `≈ ${p} every ${({ weekly: 'week', monthly: 'month', quarterly: 'quarter', annually: 'year' } as const)[e]} · ${enPayments(n)}`,
      cta: 'Add borrow',
      save: 'Save changes',
    },
    install: {
      newTitle: 'New installment',
      editTitle: 'Edit installment',
      total: 'Total price',
      per: 'Per payment',
      perLine: (p) => `≈ ${p} a payment · no interest`,
      totalLine: (t) => `${t} in total · no interest`,
      item: 'Item',
      itemPh: 'e.g. iPhone 16',
      provider: 'Provider',
      chooseProvider: 'Choose',
      starts: 'Starts',
      paidWith: 'Paid with',
      paidWithNote: 'Paid with is the default card for these payments.',
      plan: 'Payment plan',
      payments: 'Payments',
      paymentsTitle: 'Number of payments',
      paymentsUnit: (n) => (n === 1 ? 'payment' : 'payments'),
      planNote: (n, p) => `${n} × ${p}`,
      cta: 'Add plan',
      providerKind: { bnpl_short: 'Pay in a few months', installment_long: 'Long installment plans', bank_epp: 'Bank installments', other: 'Other plans' },
    },
    pay: { debt: 'Debt', paidFrom: 'Paid from', into: 'Into', left: (l, a) => `${l} left · ${a} after this`, note: 'Add a note', repeat: 'Repeat monthly', repeatHint: (d) => `Logs it on the ${d}`, record: 'Record payment', markRepaid: 'Mark repaid', paidBack: (p) => `${p} paid you back`, forOn: (w, d) => `For ${w} on ${d}`, ofTotal: (a, t) => `${a} of ${t}`, more: 'More options' },
    vault: {
      title: 'Cleared debts',
      paidOff: 'Paid off so far',
      summary: (c, l) => `${c === 1 ? '1 debt cleared' : `${c} debts cleared`}${l ? ` · the last one in ${l}` : ''}`,
      tag: { borrow: 'Borrow', installment: 'Installment', credit_card: 'Credit card' },
      clearedIn: (m, n) => `Cleared ${m} · in ${enPayments(n)}`,
      howYouPaid: 'How you paid',
      hide: 'Hide',
      empty: 'Debts you clear show up here.',
    },
    subs: {
      status: { active: 'Active', trial: 'Trial', payment_due: 'Payment due', needs_renewal: 'Needs renewal', cancelled: 'Cancelled' },
      statusLine: {
        active: (n) => `next ${n}`,
        trial: (n) => `free until ${n}`,
        payment_due: (n) => `no charge seen for ${n} yet; Buddgy asks if you paid`,
        needs_renewal: () => 'no charge for 2 cycles; Buddgy asks if you cancelled',
        cancelled: () => 'past charges stay in Flow',
      },
      cycle: { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', semiannual: 'Every 6 months', yearly: 'Yearly' },
      repeats: { weekly: 'Every week', monthly: 'Every month', quarterly: 'Every 3 months', semiannual: 'Every 6 months', yearly: 'Every year' },
      nextCharge: (d) => `Next charge · ${d}`,
      rate: (b, f, r, t) => `${b} · 1 ${f} = ${r} ${t}`,
      paidWith: 'Paid with',
      category: 'Category',
      repeatsLabel: 'Repeats',
      remind: 'Remind me',
      remindHelp: 'A day before each charge',
      lastCharges: 'Last charges',
      save: 'Save changes',
      cancelLink: 'Cancel subscription',
      resubscribe: 'Re-subscribe',
      deleteTitle: (n) => `Delete ${n}?`,
      deleteBody: 'It leaves Subscriptions and its reminders stop. Past charges stay in Flow.',
      addTitle: 'Add a subscription',
      addLine: (m, c) => `≈ ${m} a month · Committed becomes ${c}`,
      priceNote: (u) => `Usually ${u}. Buddgy keeps your price and checks it on the first charge. If it can’t tell, our team reviews it.`,
      firstCharge: 'First charge',
      every: 'Every',
      trackedNote: 'Tracked from your bank messages. If no message comes, Buddgy asks you on the due date whether you paid.',
      addCta: (n) => `Add ${n}`,
      cancelTitle: (n) => `Cancel ${n}?`,
      cancelLine: (p, e, b) => [p, e, b ? `≈ ${b}` : ''].filter(Boolean).join(' · '),
      saveMonth: 'You save a month',
      saveYear: 'You save a year',
      endsOn: 'Ends on',
      cancelOn: (s) => `Cancel it on ${s}`,
      open: 'Open',
      cancelNote: 'You keep access until the end of the paid cycle. Reminders stop and past charges stay in Flow.',
      cancelCta: 'Cancel subscription',
      keep: 'Keep it',
      endsToast: (n) => `${n} moves to Ended`,
      hero: { label: 'Subscriptions · per month', aMonth: 'a month', paid: (x) => `Paid ${x}`, due: (x) => `${x} still due this month`, next: (n, d) => `Next ${n} on ${d}`, aYear: (x) => `${x} a year` },
      empty: { title: 'Add your subscriptions', body: 'Tap a service for its usual price, or let Buddgy find them in your SMS.', scan: 'Scan my SMS', addMyself: 'Add one myself' },
    },
    line: {
      subtitle: (g) => `${g} · monthly line`,
      perMonth: 'a month',
      ofIncome: (p) => `${p}% of your income`,
      dueDay: 'Due day',
      dueDayTitle: 'Due day',
      noDueDay: 'None',
      spendingFrom: 'Spending from',
      spendingFromTitle: 'Spending from',
      spendingNote: 'Expenses in these categories fill this line.',
      none: 'None',
      deleteTitle: 'Delete this line?',
      deleteBody: 'Its spending stays in Flow, just not counted under this line.',
      leftOf: (l, o) => `${l} left of ${o}`,
      over: (x, o) => `${x} over ${o}`,
      planned: (p) => `${p}% of your income`,
      openBlock: (n) => `Open ${n}`,
      categories: 'Categories',
      groups: 'Budget groups',
    },
    payday: {
      newTitle: 'New payday',
      editTitle: 'Edit payday',
      aboutMonth: (a) => `About ${a} a month`,
      atRate: (a, b) => `≈ ${a} ${b} a month at today’s rate`,
      name: 'Name',
      namePh: 'e.g. Nexta payroll',
      type: 'Type',
      typeTitle: 'Income type',
      payday: 'Payday',
      receivedIn: 'Received in',
      add: 'Add payday',
      save: 'Save changes',
      logPayday: 'Log a payday',
      editPayday: 'Edit payday',
      expected: 'expected',
      lateChip: 'late',
      missedChip: 'missed',
    },
    method: { choose: 'Choose' },
    repaid: {
      title: (w) => `${w} paid you back`,
      line: (w, d, g, o) => `For ${w} on ${d} · ${g} of ${o}`,
      into: 'Into',
      match: 'Match',
      none: 'None, enter the amount',
      matchTitle: 'Matching money in',
      cta: 'Mark repaid',
      someone: 'Someone',
    },
    received: {
      title: (n, m) => `${n} · ${m}`,
      expected: (a) => `Expected ${a} · full amount`,
      short: (s) => `${s} short of expected`,
      full: (a) => `Full ${a}`,
      half: (a) => `Half ${a}`,
      receivedIn: 'Received in',
      payday: 'Payday',
    },
  },
  ar: {
    debts: {
      tabs: { borrow: 'سلف', installment: 'تقسيط', credit_card: 'بطاقات' },
      active: 'جارية',
      add: 'إضافة',
      addTitle: 'إضافة دين',
      addSub: 'ماذا تريد أن تتابع؟',
      addBorrow: { title: 'مال مستلف', sub: 'من شخص أو قرض بنكي' },
      addInstallment: { title: 'خطة تقسيط', sub: 'ڤاليو وكونتكت وسهولة وغيرها' },
      addCard: { title: 'بطاقة ائتمان', sub: 'الحد والمستحق الآن ويوم الاستحقاق' },
      perMonth: (a) => `${a} في الشهر`,
      leftOf: (l, o) => `باقي ${l} من ${o}`,
      statementDue: (d) => `كشف الحساب مستحق ${d}`,
      usedPct: (p) => `${p}% مستخدم`,
      hero: {
        next: (a, d) => `القادم ${a} في ${d}`,
        month: (p, o) => `${p} من ${o} مدفوع هذا الشهر`,
        freeBy: (d) => `بلا ديون بحلول ${d}`,
        overdue: (a, d) => `متأخر · ${a} منذ ${d}`,
        cleared: (c, p) => `${arPlural(c, AR_DEBT)} مسدد · ${p} اتسدد`,
      },
      late: (n) => `متأخر ${arPlural(n, AR_UNITS.day)}`,
      nextOn: (d) => `القادم ${d}`,
      owedToYou: 'مستحق لك',
      rowActions: { pay: 'سجّل دفعة', receive: 'سجّل مبلغ رجع لك', edit: 'تعديل', charges: 'عرض المصروفات', delete: 'حذف' },
      deleteTitle: (n) => `حذف ${n}؟`,
      deleteBody: 'ستُحذف دفعاته معه. لا يمكن التراجع.',
      payments: 'الدفعات',
      noPayments: 'لا مدفوعات بعد. الديون التي تضيفها تحت «مضاف».',
      swipeHint: 'اسحب لليسار للحذف',
      filterPayments: 'فلترة الدفعات',
      paymentTitle: (n, m) => `${n} · ${m}`,
      cleared: (c, t) => `${arPlural(c, AR_DEBT)} مسدد · ${t} اتسدد`,
      emptyTitle: 'لا ديون لمتابعتها',
      emptyBody: 'الهدف أن تبقى على صفر. أضف دينًا لو استلفت أو قسّطت أو عليك رصيد بطاقة.',
      emptyCta: 'إضافة دين',
    },
    borrow: {
      newTitle: 'سلفة جديدة',
      editTitle: 'تعديل السلفة',
      iOwe: 'عليّ',
      owedToMe: 'لي',
      youOwe: (p) => `عليك لـ ${p}`,
      owesYou: (p) => `${p} عليه لك`,
      them: 'الشخص',
      they: 'الشخص',
      goldLine: (v, g, k) => `≈ ${v} اليوم · ${g} للجرام عيار ${k}`,
      goldUnavailable: 'سعر الذهب اليوم لم يصل بعد',
      goldCleared: 'سعر الذهب اليوم لم يصل بعد، لذلك مُسح المبلغ. اكتبه مرة أخرى.',
      needAmount: 'اكتب المبلغ لإضافته.',
      needPerson: 'أضف الشخص لإضافته.',
      needItem: 'اكتب اسم المنتج لإضافته.',
      draftTitle: 'تجاهل هذا الدين؟',
      draftBody: 'ما كتبته لم يُحفظ بعد.',
      draftDiscard: 'تجاهل',
      person: 'الشخص',
      personPh: 'مثلًا أحمد',
      forLabel: 'من أجل',
      forPh: 'مثلًا مساعدة في الإيجار',
      date: 'التاريخ',
      receivedIn: 'استلمته في',
      paidFrom: 'دفعته من',
      arrivedIn: (a) => `وصل إلى ${a} الآن`,
      leftAccount: (a) => `خرج من ${a} الآن`,
      adds: (a) => `يضيف ${a} للرصيد`,
      takes: (a) => `يخصم ${a} من الرصيد`,
      gold: 'بالذهب',
      goldHelp: 'الدين بالجرام، بسعر اليوم',
      karatTitle: 'العيار',
      karatSub: 'بسعر الجرام اليوم',
      karatSubtitle: (g) => `${g} للجرام`,
      plan: 'خطة السداد',
      planSwitch: 'سدّده بحلول تاريخ',
      over: 'على مدى',
      overTitle: 'سدّده على مدى',
      months: (n) => arPlural(n, AR_UNITS.month),
      monthsUnit: (n) => (n >= 3 && n <= 10 ? 'أشهر' : n > 10 ? 'شهرًا' : 'شهر'),
      every: 'كل',
      everyTitle: 'كل قد إيه؟',
      everyValue: { weekly: 'أسبوع', monthly: 'شهر', quarterly: 'ربع سنة', annually: 'سنة' },
      planNote: (p, e, n) => `≈ ${p} كل ${({ weekly: 'أسبوع', monthly: 'شهر', quarterly: 'ربع سنة', annually: 'سنة' } as const)[e]} · ${arPlural(n, AR_PAYMENT)}`,
      cta: 'إضافة السلفة',
      save: 'حفظ التغييرات',
    },
    install: {
      newTitle: 'تقسيط جديد',
      editTitle: 'تعديل التقسيط',
      total: 'السعر الكلي',
      per: 'لكل دفعة',
      perLine: (p) => `≈ ${p} للدفعة · بدون فوائد`,
      totalLine: (t) => `${t} إجمالي · بدون فوائد`,
      item: 'المنتج',
      itemPh: 'مثلًا آيفون 16',
      provider: 'الجهة',
      chooseProvider: 'اختر',
      starts: 'يبدأ',
      paidWith: 'يُدفع بـ',
      paidWithNote: '«يُدفع بـ» هي البطاقة الافتراضية لهذه الدفعات.',
      plan: 'خطة الدفع',
      payments: 'الدفعات',
      paymentsTitle: 'عدد الدفعات',
      paymentsUnit: (n) => (n >= 3 && n <= 10 ? 'دفعات' : 'دفعة'),
      planNote: (n, p) => `${n} × ${p}`,
      cta: 'إضافة الخطة',
      providerKind: { bnpl_short: 'ادفع على أشهر قليلة', installment_long: 'تقسيط طويل', bank_epp: 'تقسيط البنك', other: 'خطط أخرى' },
    },
    pay: { debt: 'الدين', paidFrom: 'دفعته من', into: 'إلى', left: (l, a) => `باقي ${l} · ${a} بعد هذه`, note: 'أضف ملاحظة', repeat: 'كرّرها كل شهر', repeatHint: (d) => `تُسجَّل في ${d}`, record: 'سجّل الدفعة', markRepaid: 'تم السداد', paidBack: (p) => `${p} رجّع لك فلوسك`, forOn: (w, d) => `عن ${w} في ${d}`, ofTotal: (a, t) => `${a} من ${t}`, more: 'خيارات أكثر' },
    vault: {
      title: 'ديون مسددة',
      paidOff: 'اتسدد حتى الآن',
      summary: (c, l) => `${arPlural(c, AR_DEBT)} مسدد${l ? ` · آخرها في ${l}` : ''}`,
      tag: { borrow: 'سلفة', installment: 'تقسيط', credit_card: 'بطاقة ائتمان' },
      clearedIn: (m, n) => `اتسدد ${m} · في ${arPlural(n, AR_PAYMENT)}`,
      howYouPaid: 'إزاي سددته',
      hide: 'إخفاء',
      empty: 'الديون اللي تسددها تظهر هنا.',
    },
    subs: {
      status: { active: 'نشط', trial: 'تجربة', payment_due: 'دفعة مستحقة', needs_renewal: 'يحتاج تجديد', cancelled: 'ملغي' },
      statusLine: {
        active: (n) => `القادم ${n}`,
        trial: (n) => `مجاني حتى ${n}`,
        payment_due: (n) => `لم نرَ خصم ${n} بعد؛ Buddgy يسألك إن كنت دفعت`,
        needs_renewal: () => 'لا خصم منذ دورتين؛ Buddgy يسألك إن كنت ألغيته',
        cancelled: () => 'المصروفات السابقة تبقى في التدفق',
      },
      cycle: { weekly: 'أسبوعي', monthly: 'شهري', quarterly: 'ربع سنوي', semiannual: 'كل 6 أشهر', yearly: 'سنوي' },
      repeats: { weekly: 'كل أسبوع', monthly: 'كل شهر', quarterly: 'كل 3 أشهر', semiannual: 'كل 6 أشهر', yearly: 'كل سنة' },
      nextCharge: (d) => `الخصم القادم · ${d}`,
      rate: (b, f, r, t) => `${b} · 1 ${f} = ${r} ${t}`,
      paidWith: 'يُدفع بـ',
      category: 'الفئة',
      repeatsLabel: 'يتكرر',
      remind: 'ذكّرني',
      remindHelp: 'قبل كل خصم بيوم',
      lastCharges: 'آخر الخصومات',
      save: 'حفظ التغييرات',
      cancelLink: 'إلغاء الاشتراك',
      resubscribe: 'اشترك مرة أخرى',
      deleteTitle: (n) => `حذف ${n}؟`,
      deleteBody: 'سيخرج من الاشتراكات وتتوقف تذكيراته. المصروفات السابقة تبقى في التدفق.',
      addTitle: 'إضافة اشتراك',
      addLine: (m, c) => `≈ ${m} في الشهر · الملتزم به يصبح ${c}`,
      priceNote: (u) => `عادةً ${u}. Buddgy يحتفظ بسعرك ويتأكد منه عند أول خصم. لو لم يتأكد، يراجعه فريقنا.`,
      firstCharge: 'أول خصم',
      every: 'كل',
      trackedNote: 'نتابعه من رسائل البنك. لو لم تصل رسالة، يسألك Buddgy يوم الاستحقاق إن كنت دفعت.',
      addCta: (n) => `إضافة ${n}`,
      cancelTitle: (n) => `إلغاء ${n}؟`,
      cancelLine: (p, e, b) => [p, e, b ? `≈ ${b}` : ''].filter(Boolean).join(' · '),
      saveMonth: 'توفّر في الشهر',
      saveYear: 'توفّر في السنة',
      endsOn: 'ينتهي في',
      cancelOn: (s) => `ألغِه من ${s}`,
      open: 'فتح',
      cancelNote: 'يبقى معك حتى نهاية الدورة المدفوعة. تتوقف التذكيرات وتبقى المصروفات السابقة في التدفق.',
      cancelCta: 'إلغاء الاشتراك',
      keep: 'أبقِه',
      endsToast: (n) => `${n} انتقل إلى المنتهية`,
      hero: { label: 'الاشتراكات · في الشهر', aMonth: 'في الشهر', paid: (x) => `مدفوع ${x}`, due: (x) => `${x} مستحق هذا الشهر`, next: (n, d) => `القادم ${n} في ${d}`, aYear: (x) => `${x} في السنة` },
      empty: { title: 'أضف اشتراكاتك', body: 'اختر خدمة بسعرها المعتاد، أو دع Buddgy يجدها في رسائلك.', scan: 'افحص رسائلي', addMyself: 'أضف واحدًا بنفسي' },
    },
    line: {
      subtitle: (g) => `${g} · بند شهري`,
      perMonth: 'في الشهر',
      ofIncome: (p) => `${p}% من دخلك`,
      dueDay: 'يوم الاستحقاق',
      dueDayTitle: 'يوم الاستحقاق',
      noDueDay: 'لا يوجد',
      spendingFrom: 'الصرف من',
      spendingFromTitle: 'الصرف من',
      spendingNote: 'المصروفات في هذه الفئات تُحسب على هذا البند.',
      none: 'لا شيء',
      deleteTitle: 'حذف هذا البند؟',
      deleteBody: 'يبقى صرفه في التدفق، لكن لا يُحسب تحت هذا البند.',
      leftOf: (l, o) => `باقي ${l} من ${o}`,
      over: (x, o) => `تجاوز ${x} فوق ${o}`,
      planned: (p) => `${p}% من دخلك`,
      openBlock: (n) => `فتح ${n}`,
      categories: 'الفئات',
      groups: 'مجموعات الميزانية',
    },
    payday: {
      newTitle: 'يوم قبض جديد',
      editTitle: 'تعديل يوم القبض',
      aboutMonth: (a) => `حوالي ${a} في الشهر`,
      atRate: (a, b) => `≈ ${a} ${b} في الشهر بسعر اليوم`,
      name: 'الاسم',
      namePh: 'مثلًا راتب نكستا',
      type: 'النوع',
      typeTitle: 'نوع الدخل',
      payday: 'يوم القبض',
      receivedIn: 'يصل إلى',
      add: 'إضافة يوم القبض',
      save: 'حفظ التغييرات',
      logPayday: 'سجّل يوم قبض',
      editPayday: 'تعديل يوم القبض',
      expected: 'متوقع',
      lateChip: 'متأخر',
      missedChip: 'فائت',
    },
    method: { choose: 'اختر' },
    repaid: {
      title: (w) => `${w} رجّع لك فلوسك`,
      line: (w, d, g, o) => `مقابل ${w} في ${d} · ${g} من ${o}`,
      into: 'إلى',
      match: 'مطابقة',
      none: 'لا شيء، أدخل المبلغ',
      matchTitle: 'مبالغ واردة مطابقة',
      cta: 'تم السداد',
      someone: 'شخص',
    },
    received: {
      title: (n, m) => `${n} · ${m}`,
      expected: (a) => `المتوقع ${a} · المبلغ كاملًا`,
      short: (s) => `أقل من المتوقع بـ ${s}`,
      full: (a) => `كامل ${a}`,
      half: (a) => `نصف ${a}`,
      receivedIn: 'وصل إلى',
      payday: 'يوم القبض',
    },
  },
}

export function useDebtsSubsLtCopy(): DebtsSubsLtCopy {
  const { locale } = useLocale()
  return DEBTS_SUBS_LT_COPY[locale]
}
