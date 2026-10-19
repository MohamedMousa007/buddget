import type { BudgetBlock } from '@/lib/store/types'
import type { LineAction, LineStatusKind } from '@/lib/budget/lineStatus'

/**
 * Copy for the seven Budget page block bodies and the line status lines.
 * Amounts, dates and counts arrive pre-formatted: this file never formats money or dates.
 */
export interface StatusTextParams {
  percent?: number
  daysLeft?: number
  /** Pre-formatted money. */
  delta?: string
  overBy?: string
  months?: number
  average?: string
}

export interface BudgetBlocksCopy {
  blockName: Record<BudgetBlock, string>
  blockSub: {
    bills: (count: number) => string
    billsMonth: (paid: number, total: number) => string
    subscriptions: (active: number) => string
    subscriptionsMonth: (charged: number, total: number) => string
    debts: (debtFreeMonth: string | null) => string
    debtsMonth: (paid: number, total: number) => string
    everyday: (count: number) => string
    everydayMonth: (percentOfPlan: number) => string
    safety: string
    goals: (count: number) => string
    grow: string
    atCycleClose: (date: string) => string
  }
  status: Record<LineStatusKind, (p: StatusTextParams) => string>
  actions: Record<LineAction, string>
  bills: {
    railTitle: string
    railAria: string
    payday: (day: number) => string
    today: (day: number) => string
    dueOn: (day: number) => string
    add: string
  }
  subscriptions: {
    nextCharge: (date: string) => string
    thenCharge: (date: string) => string
    manage: string
    chargesLeft: (n: number) => string
    allCharged: string
    yearlySetAside: (amount: string) => string
    charged: (name: string) => string
    upcoming: (name: string) => string
  }
  debts: {
    apr: (percent: string) => string
    minimum: string
    minimumDue: string
    paidThisCycle: string
    installment: (done: number, total: number) => string
    installmentPaid: (done: number, total: number) => string
    paidOff: (percent: number) => string
    left: (amount: string) => string
    extraSub: string
    extraSent: string
    extraPending: string
    extraStillAimed: (amount: string) => string
    sendExtra: (amount: string) => string
    debtFree: (month: string) => string
    add: string
  }
  everyday: {
    avg: (amount: string, trimmed: boolean) => string
    ofCap: (amount: string) => string
    legendAvg: string
    legendPast: string
    add: string
  }
  safety: {
    ofTarget: (months: number) => string
    reachedBy: (month: string) => string
    targetReached: string
    noContribution: string
    gaugeTarget: (months: number) => string
    held: (liquid: string, essentials: string) => string
    adjust: string
    topUp: string
    add: string
    atClose: (amount: string, date: string) => string
    reachesAtClose: (months: number) => string
  }
  goals: {
    open: string
    perMonth: (amount: string) => string
    ofTarget: (amount: string) => string
    atClose: (amount: string, date: string) => string
    empty: string
  }
  grow: {
    add: string
    scheduledOn: (date: string) => string
  }
}

export const budgetBlocksCopyEn: BudgetBlocksCopy = {
  blockName: {
    bills: 'Home & bills',
    subscriptions: 'Subscriptions',
    debts: 'Debts',
    everyday: 'Everyday',
    safety: 'Safety net',
    goals: 'Goals',
    grow: 'Grow & give',
  },
  blockSub: {
    bills: (n) => (n === 1 ? '1 bill' : `${n} bills`),
    billsMonth: (paid, total) => `${paid} of ${total} paid`,
    subscriptions: (n) => `Linked · ${n} active`,
    subscriptionsMonth: (c, t) => `${c} of ${t} charged`,
    debts: (m) => (m ? `Linked · debt-free ${m}` : 'Linked'),
    debtsMonth: (p, t) => `${p} of ${t} paid`,
    everyday: (n) => `${n} ${n === 1 ? 'category' : 'categories'} · vs your 3-month average`,
    everydayMonth: (p) => `${p}% of the plan`,
    safety: 'Months of essentials you could cover',
    goals: (n) => `From your goals · ${n} funded`,
    grow: 'Investing, giving, yearly set-asides',
    atCycleClose: (d) => `Funds at cycle close, ${d}`,
  },
  status: {
    ok: () => 'On track',
    near: (p) => `Near the cap · ${p.percent ?? 0}% used`,
    over: (p) => (p.overBy ? `Over the cap by ${p.overBy}` : 'Over the cap'),
    unfunded: () => 'No amount set yet',
    unbudgetedSpend: (p) => (p.overBy ? `${p.overBy} spent with no line` : 'Spent with no line'),
    dueSoon: (p) => {
      const d = p.daysLeft ?? 0
      if (d < 0) return `Overdue by ${-d} ${-d === 1 ? 'day' : 'days'}`
      if (d === 0) return 'Due today'
      return `Due in ${d} ${d === 1 ? 'day' : 'days'}`
    },
    paid: () => 'Paid',
    drifted: (p) => (p.delta ? `Live amount moved by ${p.delta}` : 'Live amount moved'),
    locked: () => 'Locked',
  },
  actions: {
    review: 'Review',
    raiseOrCap: 'Raise or cap',
    addLine: 'Add a line',
    pay: 'Pay',
    update: 'Update',
    open: 'Open',
    none: '',
  },
  bills: {
    railTitle: 'Due this cycle',
    railAria: 'Bill due days across the cycle',
    payday: (d) => `${d} payday`,
    today: (d) => `Today ${d}`,
    dueOn: (d) => {
      const mod100 = d % 100
      const suffix = mod100 >= 11 && mod100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[d % 10] ?? 'th'
      return `Due the ${d}${suffix}`
    },
    add: 'Add a bill',
  },
  subscriptions: {
    nextCharge: (d) => `Next charge · ${d}`,
    thenCharge: (d) => `Then · ${d}`,
    manage: 'Manage',
    chargesLeft: (n) => `On track, ${n} ${n === 1 ? 'charge' : 'charges'} to come`,
    allCharged: 'Everything has been charged',
    yearlySetAside: (a) => `${a} a month set aside for yearly plans`,
    charged: (n) => `${n}, charged`,
    upcoming: (n) => `${n}, charge to come`,
  },
  debts: {
    apr: (p) => `${p}% APR`,
    minimum: 'Minimum payment',
    minimumDue: 'Minimum still due',
    paidThisCycle: 'Paid this cycle',
    installment: (d, t) => `Installment ${d} of ${t}`,
    installmentPaid: (d, t) => `${d} of ${t} paid`,
    paidOff: (p) => `${p}% paid off`,
    left: (a) => `${a} left`,
    extraSub: 'On top of the minimums',
    extraSent: 'Sent',
    extraPending: 'Pending, not sent yet',
    extraStillAimed: (a) => `${a} still aimed at your debts`,
    sendExtra: (a) => `Send ${a}`,
    debtFree: (m) => `Debt-free by ${m}`,
    add: 'Add a debt',
  },
  everyday: {
    avg: (a, trimmed) => (trimmed ? `avg ${a} · trimmed` : `avg ${a}`),
    ofCap: (a) => `/ ${a}`,
    legendAvg: '3-month average',
    legendPast: 'Past the cap',
    add: 'Add a category',
  },
  safety: {
    ofTarget: (m) => `of ${m} months`,
    reachedBy: (m) => `Target reached by ${m}`,
    targetReached: 'Target reached',
    noContribution: 'Add a monthly amount to get there',
    gaugeTarget: (m) => `${m} target`,
    held: (l, e) => `${l} held · essentials about ${e} a month`,
    adjust: 'Adjust',
    topUp: 'Top up',
    add: 'Add a safety line',
    atClose: (a, d) => `+${a} ${d}`,
    reachesAtClose: (m) => `Reaches ${m} months at close`,
  },
  goals: {
    open: 'Open',
    perMonth: (a) => `${a} / mo`,
    ofTarget: (a) => `of ${a}`,
    atClose: (a, d) => `+${a} ${d}`,
    empty: 'No goals are being funded yet',
  },
  grow: {
    add: 'Add a line',
    scheduledOn: (d) => `Scheduled · ${d}`,
  },
}

const arDaysCount = (n: number) =>
  n === 1 ? 'يوم واحد' : n === 2 ? 'يومين' : n >= 3 && n <= 10 ? `${n} أيام` : `${n} يومًا`

export const budgetBlocksCopyAr: BudgetBlocksCopy = {
  blockName: {
    bills: 'المنزل والفواتير',
    subscriptions: 'الاشتراكات',
    debts: 'الديون',
    everyday: 'المصروفات اليومية',
    safety: 'شبكة الأمان',
    goals: 'الأهداف',
    grow: 'النمو والعطاء',
  },
  blockSub: {
    bills: (n) => (n === 1 ? 'فاتورة واحدة' : n === 2 ? 'فاتورتان' : n <= 10 ? `${n} فواتير` : `${n} فاتورة`),
    billsMonth: (p, t) => `${p} من ${t} مدفوعة`,
    subscriptions: (n) => `مرتبطة · ${n} نشطة`,
    subscriptionsMonth: (c, t) => `${c} من ${t} تم خصمها`,
    debts: (m) => (m ? `مرتبطة · خالٍ من الديون ${m}` : 'مرتبطة'),
    debtsMonth: (p, t) => `${p} من ${t} مدفوعة`,
    everyday: (n) => `${n} ${n <= 10 ? 'فئات' : 'فئة'} · مقارنة بمتوسط 3 أشهر`,
    everydayMonth: (p) => `${p}% من الخطة`,
    safety: 'عدد أشهر المصروفات الأساسية التي تغطيها',
    goals: (n) => `من أهدافك · ${n} ممولة`,
    grow: 'الاستثمار والعطاء والمدخرات السنوية',
    atCycleClose: (d) => `تُموَّل عند إغلاق الدورة، ${d}`,
  },
  status: {
    ok: () => 'على المسار',
    near: (p) => `قريب من الحد · ${p.percent ?? 0}% مستخدم`,
    over: (p) => (p.overBy ? `تجاوز الحد بمقدار ${p.overBy}` : 'تجاوز الحد'),
    unfunded: () => 'لم يُحدد مبلغ بعد',
    unbudgetedSpend: (p) => (p.overBy ? `${p.overBy} أُنفقت بلا بند` : 'إنفاق بلا بند'),
    dueSoon: (p) => {
      const d = p.daysLeft ?? 0
      if (d < 0) return `متأخرة ${arDaysCount(-d)}`
      if (d === 0) return 'مستحقة اليوم'
      return `تستحق خلال ${arDaysCount(d)}`
    },
    paid: () => 'مدفوعة',
    drifted: (p) => (p.delta ? `تغير المبلغ الفعلي بمقدار ${p.delta}` : 'تغير المبلغ الفعلي'),
    locked: () => 'مقفل',
  },
  actions: {
    review: 'مراجعة',
    raiseOrCap: 'رفع أو تحديد حد',
    addLine: 'إضافة بند',
    pay: 'دفع',
    update: 'تحديث',
    open: 'فتح',
    none: '',
  },
  bills: {
    railTitle: 'المستحق في هذه الدورة',
    railAria: 'أيام استحقاق الفواتير خلال الدورة',
    payday: (d) => `${d} يوم الراتب`,
    today: (d) => `اليوم ${d}`,
    dueOn: (d) => `تستحق يوم ${d}`,
    add: 'إضافة فاتورة',
  },
  subscriptions: {
    nextCharge: (d) => `الخصم التالي · ${d}`,
    thenCharge: (d) => `ثم · ${d}`,
    manage: 'إدارة',
    chargesLeft: (n) =>
      n === 1 ? 'على المسار، خصم واحد قادم' : n === 2 ? 'على المسار، خصمان قادمان' : n <= 10 ? `على المسار، ${n} خصومات قادمة` : `على المسار، ${n} خصمًا قادمًا`,
    allCharged: 'تم خصم كل الاشتراكات',
    yearlySetAside: (a) => `${a} شهريًا تُدَّخر للخطط السنوية`,
    charged: (n) => `${n}، تم الخصم`,
    upcoming: (n) => `${n}، الخصم قادم`,
  },
  debts: {
    apr: (p) => `${p}% فائدة سنوية`,
    minimum: 'الحد الأدنى للسداد',
    minimumDue: 'الحد الأدنى لم يُسدد بعد',
    paidThisCycle: 'سُدد في هذه الدورة',
    installment: (d, t) => `القسط ${d} من ${t}`,
    installmentPaid: (d, t) => `${d} من ${t} مسددة`,
    paidOff: (p) => `سُدد ${p}%`,
    left: (a) => `المتبقي ${a}`,
    extraSub: 'إضافة إلى الحد الأدنى',
    extraSent: 'أُرسل',
    extraPending: 'معلّق، لم يُرسل بعد',
    extraStillAimed: (a) => `${a} ما زالت مخصصة لديونك`,
    sendExtra: (a) => `إرسال ${a}`,
    debtFree: (m) => `خالٍ من الديون بحلول ${m}`,
    add: 'إضافة دين',
  },
  everyday: {
    avg: (a, trimmed) => (trimmed ? `المتوسط ${a} · مخفّض` : `المتوسط ${a}`),
    ofCap: (a) => `/ ${a}`,
    legendAvg: 'متوسط 3 أشهر',
    legendPast: 'بعد الحد',
    add: 'إضافة فئة',
  },
  safety: {
    ofTarget: (m) => `من ${m} أشهر`,
    reachedBy: (m) => `يتحقق الهدف بحلول ${m}`,
    targetReached: 'تحقق الهدف',
    noContribution: 'أضف مبلغًا شهريًا للوصول إليه',
    gaugeTarget: (m) => `الهدف ${m}`,
    held: (l, e) => `${l} محتفظ بها · المصروفات الأساسية نحو ${e} شهريًا`,
    adjust: 'تعديل',
    topUp: 'إضافة رصيد',
    add: 'إضافة بند للأمان',
    atClose: (a, d) => `+${a} ${d}`,
    reachesAtClose: (m) => `يبلغ ${m} أشهر عند الإغلاق`,
  },
  goals: {
    open: 'فتح',
    perMonth: (a) => `${a} / شهر`,
    ofTarget: (a) => `من ${a}`,
    atClose: (a, d) => `+${a} ${d}`,
    empty: 'لا توجد أهداف تُموَّل بعد',
  },
  grow: {
    add: 'إضافة بند',
    scheduledOn: (d) => `مجدول · ${d}`,
  },
}
