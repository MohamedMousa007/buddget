import { arCount } from '@/lib/i18n/arPlural'

/**
 * Copy for the redesigned Subscriptions surfaces (home, add, SMS review, detail, cancel,
 * Budget links, notifications). Strings are from the design handoff's SPEC section 9 and its
 * frames; anything else is marked `// ext:` so a copy review can find it.
 *
 * Amounts, dates and counts arrive pre-formatted: this file never formats a number.
 */
export interface SubscriptionsCopy {
  hero: {
    label: string
    monthlyEquivalent: string
    perYear: string
    nextCharge: string
    paid: (amount: string) => string
    left: (amount: string) => string
  }
  segments: { upcoming: string; all: string; ended: string; label: string }
  activeCount: (n: number) => string
  groups: { overdue: string; week: string; month: string; later: string; yearly: string; all: string; ended: string }
  emptyTab: string
  empty: { title: string; sub: string; scan: string }
  chips: {
    inDays: (n: number) => string
    today: string
    trialEnds: string
    paused: string
    ends: (date: string) => string
    expected: string
    price: (pct: string) => string
    planChanges: (date: string) => string
    failed: string
    shared: (n: number) => string
    estimate: string
    yearly: string
    active: string
    subscription: string
  }
  notes: {
    was: (amount: string) => string
    myShareOf: (amount: string) => string
    perMonth: (amount: string) => string
    fxDrift: (usd: string, pct: string) => string
  }
  nudge: {
    adopt: string
    review: string
    paid: string
    notYet: string
    dismiss: string
    price: (name: string, amount: string) => string
    ask: (name: string) => string // ext
    trial: (name: string, days: number) => string
    still: (name: string) => string
    keep: string // ext
    plan: (name: string, plan: string) => string
  }
  rail: {
    next30: string
    priceChange: string
    trialEnding: string
    priceMove: (from: string, to: string, pct: string) => string
    trialThen: (date: string, amount: string) => string
  }
  sms: {
    found: (n: number) => string
    scanned: (n: number) => string
    nothingAdded: string
    notASub: string
    add: string
    linkTo: (name: string) => string
    addN: (n: number) => string
    matches: (name: string) => string
    confidence: { high: string; medium: string; low: string }
    monthlyDay: (day: number) => string
    prompt: (n: number) => string
    review: string
    none: string // ext
  }
  add: {
    search: string
    popular: string
    custom: string
    categories: {
      streaming: string
      music: string
      gaming: string
      telecom: string
      ai: string
      cloud: string
      fitness: string
      shopping: string
      learning: string
      news: string
      other: string
    }
    amount: string
    firstCharge: string
    cycle: string
    paidWith: string
    tracking: string
    remind: string
    more: string
    fxRest: (rate: string) => string
    impact: (amount: string, currency: string) => string
    committedBecomes: (amount: string) => string
    addNamed: (name: string) => string
    saveNamed: (name: string) => string // ext
    billedIn: (category: string, currency: string) => string
    perMonthShort: string
    perYearShort: string
    perWeekShort: string
    perQuarterShort: string
    perHalfYearShort: string // ext
    serviceName: string // ext
    trialEnd: string // ext
    category: string // ext
    notes: string // ext
    sharedWith: string // ext
    myShare: string // ext
    noEstimate: string // ext
  }
  cycles: { weekly: string; monthly: string; quarterly: string; semiannual: string; yearly: string }
  tracking: {
    sms: { name: string; hint: string }
    ask: { name: string; hint: string }
    log: { name: string; hint: string }
  }
  detail: {
    title: string
    perMonth: string
    perYear: string
    perWeek: string
    perQuarter: string
    perHalfYear: string // ext
    nextCharges: string
    tracking: string
    change: string
    matched: string
    smsCharge: (date: string) => string
    manualCharge: (date: string) => string // ext
    unlink: string // ext
    priceHistory: string
    since: (date: string) => string
    before: string
    noCharges: string
    noChargesPaused: string
    edit: string
    pause: string
    resume: string
    cancel: string
    delete: string
    resubscribe: string
    markPaid: string
    keepAfterTrial: string
    adopt: (amount: string) => string
    applyPlan: string
    banner: {
      trial: { title: (date: string) => string; body: string }
      paused: { title: string; body: (date: string) => string }
      cancelled: { title: (date: string) => string; body: string }
      price: { title: (amount: string) => string; body: (amount: string) => string }
      plan: { title: (plan: string, date: string) => string; body: (amount: string) => string }
      overdue: { title: (date: string) => string; body: string }
      failed: { title: (date: string) => string; body: string }
      shared: { title: (amount: string) => string; body: (names: string, share: string) => string }
    }
  }
  cancel: {
    title: (name: string) => string
    endsOn: string
    note: string
    howTo: string
    hintLabel: string // ext
    effect: string
    confirm: string
    keep: string
    open: (url: string) => string
  }
  budget: {
    committed: string
    leftToPay: string
    entryLine: (n: number, name: string, date: string) => string
    setAside: string
    nothingDue: string // ext
    overBudget: (amount: string) => string
    planLeft: (amount: string) => string
  }
  quickAdd: { subscription: string }
  notifications: {
    digestTitle: (n: number) => string
    digestBody: (items: string) => string
    digestItem: (name: string, amount: string, when: string) => string
    inDays: (n: number) => string
    trialTitle: (name: string, days: number) => string
    trialBody: (amount: string, date: string) => string
    priceTitle: (name: string, amount: string) => string
    priceBody: (amount: string) => string
    dueReminders: string
    dueRemindersHint: string
    priceAlerts: string
    priceAlertsHint: string
  }
}

export const subscriptionsCopyEn: SubscriptionsCopy = {
  hero: {
    label: 'Due in the next 30 days',
    monthlyEquivalent: 'Monthly equivalent',
    perYear: 'Per year',
    nextCharge: 'Next charge',
    paid: (a) => `Paid ${a}`,
    left: (a) => `Left ${a}`,
  },
  segments: { upcoming: 'Upcoming', all: 'All', ended: 'Ended', label: 'View' },
  activeCount: (n) => `${n} active`,
  groups: {
    overdue: 'Overdue',
    week: 'This week',
    month: 'This month',
    later: 'Later',
    yearly: 'Yearly',
    all: 'All',
    ended: 'Ended',
  },
  emptyTab: 'Nothing has ended yet.',
  empty: {
    title: 'Add your subscriptions',
    sub: 'Tap a service to add it with its usual price.',
    scan: 'Scan my SMS',
  },
  chips: {
    inDays: (n) => `In ${n} ${n === 1 ? 'day' : 'days'}`,
    today: 'Today',
    trialEnds: 'Trial ends',
    paused: 'Paused',
    ends: (d) => `Ends ${d}`,
    expected: 'Expected, not seen',
    price: (p) => `Price ${p}`,
    planChanges: (d) => `Plan changes ${d}`,
    failed: 'Payment failed',
    shared: (n) => `Shared · ${n}`,
    estimate: 'Estimate',
    yearly: 'Yearly',
    active: 'Active',
    subscription: 'Subscription',
  },
  notes: {
    was: (a) => `was ${a}`,
    myShareOf: (a) => `my share of ${a}`,
    perMonth: (a) => `${a} / mo`,
    fxDrift: (usd, p) => `${usd} · FX ${p}`,
  },
  nudge: {
    adopt: 'Adopt',
    review: 'Review',
    paid: 'Paid',
    notYet: 'Not yet',
    dismiss: 'Dismiss',
    price: (n, a) => `${n} now charges ${a}`,
    ask: (n) => `${n} is due. Paid?`,
    trial: (n, d) => (d === 0 ? `${n} trial ends today` : `${n} trial ends in ${d} ${d === 1 ? 'day' : 'days'}`),
    still: (n) => `Still using ${n}?`,
    keep: 'Keep',
    plan: (n, p) => `${n} looks like it moved to ${p}`,
  },
  rail: {
    next30: 'Next 30 days',
    priceChange: 'Price change',
    trialEnding: 'Trial ending',
    priceMove: (f, t, p) => `${f} → ${t} · ${p}`,
    trialThen: (d, a) => `Ends ${d} · then ${a} / mo`,
  },
  sms: {
    found: (n) => `Found ${n} possible ${n === 1 ? 'subscription' : 'subscriptions'}`,
    scanned: (n) => `${n} messages scanned · last 90 days`,
    nothingAdded: 'Nothing is added until you confirm.',
    notASub: 'Not a subscription',
    add: 'Add',
    linkTo: (n) => `Link to ${n}`,
    addN: (n) => `Add ${n} ${n === 1 ? 'subscription' : 'subscriptions'}`,
    matches: (n) => `Matches your ${n}. Charges link to it`,
    confidence: { high: 'High', medium: 'Medium', low: 'Low' },
    monthlyDay: (d) => `Monthly · day ${d}`,
    prompt: (n) => `Found ${n} possible ${n === 1 ? 'subscription' : 'subscriptions'}`,
    review: 'Review',
    none: 'No recurring charges found in the last 90 days.',
  },
  add: {
    search: 'Search services',
    popular: 'Popular in Egypt',
    custom: 'Custom',
    categories: {
      streaming: 'Streaming',
      music: 'Music',
      gaming: 'Gaming',
      telecom: 'Telecom & internet',
      ai: 'AI & software',
      cloud: 'Cloud',
      fitness: 'Fitness',
      shopping: 'Shopping & delivery',
      learning: 'Learning',
      news: 'News',
      other: 'Other',
    },
    amount: 'Amount',
    firstCharge: 'First charge',
    cycle: 'Cycle',
    paidWith: 'Paid with',
    tracking: 'Tracking',
    remind: 'Remind me before it’s due',
    more: 'More: trial, sharing, category, notes',
    fxRest: (r) => `at ${r} · refined after the first charge`,
    impact: (a, c) => `+${c} ${a} / month`,
    committedBecomes: (a) => `Committed becomes ${a}`,
    addNamed: (n) => `Add ${n}`,
    saveNamed: (n) => `Save ${n}`,
    billedIn: (c, cur) => `${c} · billed in ${cur}`,
    perMonthShort: '/ mo',
    perYearShort: '/ yr',
    perWeekShort: '/ wk',
    perQuarterShort: '/ qtr',
    perHalfYearShort: '/ 6 mo',
    serviceName: 'Service name',
    trialEnd: 'Trial ends',
    category: 'Category',
    notes: 'Notes',
    sharedWith: 'Shared with',
    myShare: 'My share',
    noEstimate: 'No exchange rate available',
  },
  cycles: { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', semiannual: 'Every 6 months', yearly: 'Yearly' },
  tracking: {
    sms: { name: 'Match from SMS', hint: 'Links the charge when merchant and amount match' },
    ask: { name: 'Ask me on the due date', hint: 'One tap: Paid or Not yet' },
    log: { name: 'Log automatically', hint: 'Creates the expense on the due date' },
  },
  detail: {
    title: 'Subscription',
    perMonth: 'per month',
    perYear: 'per year',
    perWeek: 'per week',
    perQuarter: 'per quarter',
    perHalfYear: 'every 6 months',
    nextCharges: 'Next charges',
    tracking: 'Tracking',
    change: 'Change',
    matched: 'Matched charges',
    smsCharge: (d) => `SMS · ${d}`,
    manualCharge: (d) => `Logged · ${d}`,
    unlink: 'Unlink charge',
    priceHistory: 'Price history',
    since: (d) => `Since ${d}`,
    before: 'Before',
    noCharges: 'No upcoming charges.',
    noChargesPaused: 'No charges while paused.',
    edit: 'Edit',
    pause: 'Pause',
    resume: 'Resume',
    cancel: 'Cancel subscription',
    delete: 'Delete',
    resubscribe: 'Resubscribe',
    markPaid: 'Mark paid',
    keepAfterTrial: 'Keep after trial',
    adopt: (a) => `Adopt ${a}`,
    applyPlan: 'Apply plan change',
    banner: {
      trial: {
        title: (d) => `Trial ends ${d}`,
        body: 'Alerts 2 days before and on the day. Not counted in Committed until it converts to paid.',
      },
      paused: {
        title: 'No charges, no reminders',
        body: (d) => `Paused since ${d}. Resume restarts from the next cycle.`,
      },
      cancelled: {
        title: (d) => `Access until ${d}`,
        body: 'Then archived under Ended. No more charges or reminders after that.',
      },
      price: {
        title: (a) => `Last charge was ${a}`,
        body: (a) => `Plan price is ${a}. Adopting keeps the old price in history.`,
      },
      plan: {
        title: (p, d) => `${p} from ${d}`,
        body: (a) => `${a} per month. Detected from a higher charge.`,
      },
      overdue: { title: (d) => `Expected ${d}`, body: 'No matching SMS after 3 days. Not yet?' },
      failed: {
        title: (d) => `Card declined ${d}`,
        body: 'From your bank SMS. Check the card, then mark paid once it goes through.',
      },
      shared: {
        title: (a) => `My share of ${a}`,
        body: (n, s) => `Shared with ${n}. Only ${s} counts toward Committed.`,
      },
    },
  },
  cancel: {
    title: (n) => `Cancel ${n}?`,
    endsOn: 'Ends on',
    note: 'Last paid cycle. You keep access until then.',
    howTo: 'How to cancel',
    hintLabel: 'Cancel it in the service’s own account page',
    effect: 'Reminders stop and it moves to Ended. Past charges stay in Flow.',
    confirm: 'Cancel subscription',
    keep: 'Keep it',
    open: (u) => `Open ${u}`,
  },
  budget: {
    committed: 'Committed',
    leftToPay: 'left to pay this month',
    entryLine: (n, name, d) => `${n} due · ${name} ${d}`,
    setAside: 'Set aside for yearly plans',
    nothingDue: 'Nothing due this month',
    overBudget: (a) => `${a} over budget`,
    planLeft: (a) => `${a} left to pay · due dates`,
  },
  quickAdd: { subscription: 'Subscription' },
  notifications: {
    digestTitle: (n) => `${n} ${n === 1 ? 'subscription' : 'subscriptions'} due soon`,
    digestBody: (items) => items,
    digestItem: (name, amount, when) => `${name} ${amount} ${when}`,
    inDays: (n) => (n === 0 ? 'today' : `in ${n} ${n === 1 ? 'day' : 'days'}`),
    trialTitle: (n, d) => `${n} trial ends in ${d} ${d === 1 ? 'day' : 'days'}`,
    trialBody: (a, d) => `${a} a month after ${d}. Keep or cancel.`,
    priceTitle: (n, a) => `${n} is now ${a}`,
    priceBody: (a) => `Was ${a}. Tap to update the plan.`,
    dueReminders: 'Due date reminders',
    dueRemindersHint: '3 days before and on the day',
    priceAlerts: 'Price and trial alerts',
    priceAlertsHint: 'Price rises, trials ending',
  },
}

export const subscriptionsCopyAr: SubscriptionsCopy = {
  hero: {
    label: 'مستحق خلال 30 يومًا القادمة',
    monthlyEquivalent: 'المعادل الشهري',
    perYear: 'في السنة',
    nextCharge: 'الخصم القادم',
    paid: (a) => `مدفوع ${a}`,
    left: (a) => `متبقي ${a}`,
  },
  segments: { upcoming: 'القادمة', all: 'الكل', ended: 'المنتهية', label: 'العرض' },
  activeCount: (n) => `${n} نشطًا`,
  groups: {
    overdue: 'متأخر',
    week: 'هذا الأسبوع',
    month: 'هذا الشهر',
    later: 'لاحقًا',
    yearly: 'سنوي',
    all: 'الكل',
    ended: 'المنتهية',
  },
  emptyTab: 'لم ينتهِ شيء بعد.',
  empty: {
    title: 'أضف اشتراكاتك',
    sub: 'اضغط على خدمة لإضافتها بسعرها المعتاد.',
    scan: 'افحص رسائلي',
  },
  chips: {
    inDays: (n) => (n === 1 ? 'بعد يوم' : n === 2 ? 'بعد يومين' : n <= 10 ? `بعد ${n} أيام` : `بعد ${n} يومًا`),
    today: 'اليوم',
    trialEnds: 'تنتهي التجربة',
    paused: 'متوقف مؤقتًا',
    ends: (d) => `ينتهي ${d}`,
    expected: 'متوقع، لم يظهر',
    price: (p) => `السعر ${p}`,
    planChanges: (d) => `تغيير الخطة ${d}`,
    failed: 'فشلت الدفعة',
    shared: (n) => `مشترك · ${n}`,
    estimate: 'تقدير',
    yearly: 'سنوي',
    active: 'نشط',
    subscription: 'اشتراك',
  },
  notes: {
    was: (a) => `كان ${a}`,
    myShareOf: (a) => `نصيبي من ${a}`,
    perMonth: (a) => `${a} / شهر`,
    fxDrift: (usd, p) => `${usd} · سعر الصرف ${p}`,
  },
  nudge: {
    adopt: 'اعتماد',
    review: 'مراجعة',
    paid: 'تم الدفع',
    notYet: 'لم يُدفع بعد',
    dismiss: 'تجاهل',
    price: (n, a) => `${n} يخصم الآن ${a}`,
    ask: (n) => `${n} مستحق. تم الدفع؟`,
    trial: (n, d) => (d === 0 ? `تجربة ${n} تنتهي اليوم` : d === 1 ? `تجربة ${n} تنتهي بعد يوم` : d === 2 ? `تجربة ${n} تنتهي بعد يومين` : `تجربة ${n} تنتهي بعد ${arCount(d, 'day')}`),
    still: (n) => `هل ما زلت تستخدم ${n}؟`,
    keep: 'إبقاؤه',
    plan: (n, p) => `يبدو أن ${n} انتقل إلى ${p}`,
  },
  rail: {
    next30: 'الـ 30 يومًا القادمة',
    priceChange: 'تغيّر السعر',
    trialEnding: 'تجربة تنتهي',
    priceMove: (f, t, p) => `${f} ← ${t} · ${p}`,
    trialThen: (d, a) => `تنتهي ${d} · ثم ${a} / شهر`,
  },
  sms: {
    found: (n) => (n === 1 ? 'وجدنا اشتراكًا محتملًا' : n === 2 ? 'وجدنا اشتراكين محتملين' : `وجدنا ${n} اشتراكات محتملة`),
    scanned: (n) => `تم فحص ${arCount(n, 'message')} · آخر 90 يومًا`,
    nothingAdded: 'لا يُضاف شيء قبل تأكيدك.',
    notASub: 'ليس اشتراكًا',
    add: 'إضافة',
    linkTo: (n) => `ربط بـ ${n}`,
    addN: (n) => (n === 1 ? 'إضافة اشتراك' : n === 2 ? 'إضافة اشتراكين' : `إضافة ${n} اشتراكات`),
    matches: (n) => `يطابق ${n} الحالي. تُربط الخصومات به`,
    confidence: { high: 'مرتفعة', medium: 'متوسطة', low: 'منخفضة' },
    monthlyDay: (d) => `شهريًا · يوم ${d}`,
    prompt: (n) => (n === 1 ? 'وجدنا اشتراكًا محتملًا' : n === 2 ? 'وجدنا اشتراكين محتملين' : `وجدنا ${n} اشتراكات محتملة`),
    review: 'مراجعة',
    none: 'لم نجد خصومات متكررة خلال آخر 90 يومًا.',
  },
  add: {
    search: 'ابحث عن خدمة',
    popular: 'الأكثر استخدامًا في مصر',
    custom: 'مخصص',
    categories: {
      streaming: 'بث',
      music: 'موسيقى',
      gaming: 'ألعاب',
      telecom: 'اتصالات وإنترنت',
      ai: 'ذكاء اصطناعي وبرامج',
      cloud: 'تخزين سحابي',
      fitness: 'لياقة',
      shopping: 'تسوق وتوصيل',
      learning: 'تعلّم',
      news: 'أخبار',
      other: 'أخرى',
    },
    amount: 'المبلغ',
    firstCharge: 'أول خصم',
    cycle: 'الدورة',
    paidWith: 'طريقة الدفع',
    tracking: 'التتبّع',
    remind: 'ذكّرني قبل الاستحقاق',
    more: 'المزيد: تجربة، مشاركة، فئة، ملاحظات',
    fxRest: (r) => `بسعر ${r} · يُحدَّث بعد أول خصم`,
    impact: (a, c) => `+${a} ${c} / شهر`,
    committedBecomes: (a) => `الملتزم به يصبح ${a}`,
    addNamed: (n) => `إضافة ${n}`,
    saveNamed: (n) => `حفظ ${n}`,
    billedIn: (c, cur) => `${c} · بـ ${cur}`,
    perMonthShort: '/ شهر',
    perYearShort: '/ سنة',
    perWeekShort: '/ أسبوع',
    perQuarterShort: '/ ربع سنة',
    perHalfYearShort: '/ 6 أشهر',
    serviceName: 'اسم الخدمة',
    trialEnd: 'تنتهي التجربة',
    category: 'الفئة',
    notes: 'ملاحظات',
    sharedWith: 'مشترك مع',
    myShare: 'نصيبي',
    noEstimate: 'لا يتوفر سعر صرف',
  },
  cycles: { weekly: 'أسبوعي', monthly: 'شهري', quarterly: 'ربع سنوي', semiannual: 'كل 6 أشهر', yearly: 'سنوي' },
  tracking: {
    sms: { name: 'مطابقة من الرسائل', hint: 'يربط الخصم عند تطابق التاجر والمبلغ' },
    ask: { name: 'اسألني في يوم الاستحقاق', hint: 'ضغطة واحدة: تم الدفع أو لم يُدفع' },
    log: { name: 'تسجيل تلقائي', hint: 'ينشئ المصروف في يوم الاستحقاق' },
  },
  detail: {
    title: 'الاشتراك',
    perMonth: 'شهريًا',
    perYear: 'سنويًا',
    perWeek: 'أسبوعيًا',
    perQuarter: 'كل ربع سنة',
    perHalfYear: 'كل 6 أشهر',
    nextCharges: 'الخصومات القادمة',
    tracking: 'التتبّع',
    change: 'تغيير',
    matched: 'الخصومات المطابقة',
    smsCharge: (d) => `رسالة · ${d}`,
    manualCharge: (d) => `مسجل · ${d}`,
    unlink: 'فك ربط الخصم',
    priceHistory: 'سجل الأسعار',
    since: (d) => `منذ ${d}`,
    before: 'قبل ذلك',
    noCharges: 'لا خصومات قادمة.',
    noChargesPaused: 'لا خصم أثناء الإيقاف.',
    edit: 'تعديل',
    pause: 'إيقاف مؤقت',
    resume: 'استئناف',
    cancel: 'إلغاء الاشتراك',
    delete: 'حذف',
    resubscribe: 'إعادة الاشتراك',
    markPaid: 'تم الدفع',
    keepAfterTrial: 'استمرار بعد التجربة',
    adopt: (a) => `اعتماد ${a}`,
    applyPlan: 'تطبيق تغيير الخطة',
    banner: {
      trial: {
        title: (d) => `تنتهي التجربة ${d}`,
        body: 'تنبيه قبل يومين وفي اليوم نفسه. لا يُحتسب ضمن الملتزم به حتى يتحول إلى مدفوع.',
      },
      paused: {
        title: 'لا خصم ولا تذكيرات',
        body: (d) => `متوقف منذ ${d}. الاستئناف يبدأ من الدورة التالية.`,
      },
      cancelled: {
        title: (d) => `الوصول حتى ${d}`,
        body: 'ثم يُؤرشف ضمن المنتهية. لا خصم ولا تذكيرات بعد ذلك.',
      },
      price: {
        title: (a) => `آخر خصم كان ${a}`,
        body: (a) => `سعر الخطة ${a}. الاعتماد يُبقي السعر القديم في السجل.`,
      },
      plan: {
        title: (p, d) => `${p} من ${d}`,
        body: (a) => `${a} شهريًا. تم اكتشافه من خصم أعلى.`,
      },
      overdue: { title: (d) => `متوقع ${d}`, body: 'لا رسالة مطابقة بعد 3 أيام. لم يُدفع بعد؟' },
      failed: {
        title: (d) => `رُفضت البطاقة ${d}`,
        body: 'من رسالة البنك. تحقق من البطاقة ثم اضغط تم الدفع بعد نجاحها.',
      },
      shared: {
        title: (a) => `نصيبي من ${a}`,
        body: (n, s) => `مشترك مع ${n}. ${s} فقط تُحتسب ضمن الملتزم به.`,
      },
    },
  },
  cancel: {
    title: (n) => `إلغاء ${n}؟`,
    endsOn: 'ينتهي في',
    note: 'آخر دورة مدفوعة. يبقى الوصول حتى ذلك التاريخ.',
    howTo: 'كيف تلغي',
    hintLabel: 'ألغِ من صفحة حسابك في الخدمة',
    effect: 'تتوقف التذكيرات وينتقل إلى المنتهية. تبقى الخصومات السابقة في التدفق.',
    confirm: 'إلغاء الاشتراك',
    keep: 'إبقاؤه',
    open: (u) => `افتح ${u}`,
  },
  budget: {
    committed: 'الملتزم به',
    leftToPay: 'متبقي للدفع هذا الشهر',
    entryLine: (n, name, d) => `${n} مستحقة · ${name} ${d}`,
    setAside: 'مخصص للخطط السنوية',
    nothingDue: 'لا شيء مستحق هذا الشهر',
    overBudget: (a) => `تجاوز الميزانية بـ ${a}`,
    planLeft: (a) => `متبقي ${a} للدفع · حسب التواريخ`,
  },
  quickAdd: { subscription: 'اشتراك' },
  notifications: {
    digestTitle: (n) => (n === 1 ? 'اشتراك قريب من الاستحقاق' : n === 2 ? 'اشتراكان قريبان من الاستحقاق' : `${n} اشتراكات قريبة من الاستحقاق`),
    digestBody: (items) => items,
    digestItem: (name, amount, when) => `${name} ${amount} ${when}`,
    inDays: (n) => (n === 0 ? 'اليوم' : n === 1 ? 'بعد يوم' : n === 2 ? 'بعد يومين' : n <= 10 ? `بعد ${n} أيام` : `بعد ${n} يومًا`),
    trialTitle: (n, d) => (d === 1 ? `تجربة ${n} تنتهي بعد يوم` : d === 2 ? `تجربة ${n} تنتهي بعد يومين` : `تجربة ${n} تنتهي بعد ${arCount(d, 'day')}`),
    trialBody: (a, d) => `${a} شهريًا بعد ${d}. استمرار أو إلغاء.`,
    priceTitle: (n, a) => `${n} أصبح ${a}`,
    priceBody: (a) => `كان ${a}. اضغط لتحديث الخطة.`,
    dueReminders: 'تذكيرات الاستحقاق',
    dueRemindersHint: 'قبل 3 أيام وفي اليوم نفسه',
    priceAlerts: 'تنبيهات السعر والتجربة',
    priceAlertsHint: 'ارتفاع الأسعار، انتهاء التجارب',
  },
}
