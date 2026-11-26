import { useLocale } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/types'
import { arPlural, AR_UNITS } from '@/lib/i18n/arPlural'

/**
 * Light-touch Insights strings (area A5). Money and names arrive already formatted; `*like this*` marks the figures
 * a line puts in bold. Kept out of the shared dictionaries so parallel areas do not collide.
 */
export interface InsightsLtCopy {
  hero: {
    dayOf: (month: string, day: number, total: number) => string
    status: { onTrack: string; overPace: string; overBudget: string; aboveUsual: string; belowUsual: string }
    finishLead: (month: string) => string
    big: (amount: string, over: boolean) => string
    ofBudget: (budget: string) => string
    land: (daily: string, now: string, over: boolean) => string
    nothingLeft: string
    usualLead: string
    usualBig: (amount: string, more: boolean) => string
    usualSide: string
    projectionLead: (month: string) => string
    earlyLead: (month: string) => string
    earlyNote: (month: string, daysMore: number) => string
    noIncomeBody: (month: string) => string
    addIncome: string
    tiles: {
      label: { mainReason: string; beforePayday: string; unusualBuy: string; bigDay: string }
      shift: (name: string, pct: number, up: boolean) => string
      shiftSub: (pct: number, up: boolean) => string
      top: (name: string, share: number) => string
      topSub: string
      bills: (total: string) => string
      billsSub: (count: number, days: number) => string
      unusual: (description: string, amount: string) => string
      unusualSub: (times: number, category: string) => string
      bigDaySub: (avg: string) => string
      empty: string
      locked: string
    }
    lockedMore: (n: number) => string
  }
  read: {
    title: (month: string) => string
    paceBudget: (p: { daily: string; delta: string; over: boolean; far: boolean }) => string
    paceUsual: (p: { daily: string; delta: string; more: boolean }) => string
    paceProjection: (p: { daily: string; projected: string }) => string
    early: (p: { spent: string; daysMore: number }) => string
    driverShift: (p: { name: string; pct: number; up: boolean }) => string
    driverTop: (p: { name: string; share: number }) => string
    driverUnusual: (p: { description: string; amount: string }) => string
    bills: (p: { count: number; total: string }) => string
    actionLand: (p: { daily: string }) => string
    actionNothingLeft: string
    actionKeep: (p: { delta: string }) => string
    q: {
      whyCategory: { label: (name: string) => string; seed: (name: string) => string }
      whereCut: { label: string; seed: string }
      makePlan: { label: string; seed: string }
      billsOk: { label: string; seed: string }
      whatNext: { label: string; seed: string }
    }
    freeTitle: string
    freeBody: string
  }
  pace: {
    title: string
    legend: { you: string; plan: string; heading: string }
    by: (date: string) => string
    budget: (amount: string) => string
    today: string
    tip: (date: string, past: boolean, value: string, plan: string | null) => string
    aria: string
    headers: [string, string, string]
  }
  where: {
    title: string
    vs: (month: string) => string
    spent: (currency: string) => string
    other: string
    same: string
    up: (pct: number) => string
    down: (pct: number) => string
    tip: (name: string, amount: string, share: number) => string
    aria: string
    headers: [string, string, string, string]
    note: (days: number) => string
  }
  months: {
    title: string
    six: string
    year: string
    budgetLine: string
    overThenUnder: (month: string, by: string) => string
    lastOver: (month: string, by: string) => string
    allUnder: string
    kept: (pct: number) => string
    tip: (month: string, spent: string, state: 'soFar' | 'over' | 'under') => string
    aria: string
    headers: [string, string]
  }
  patterns: {
    title: string
    bigDay: string
    avg: (amount: string) => string
    bigDayNone: string
    nw: string
    nwBy: (projected: string, date: string) => string
    nwNone: string
    nwAria: string
    weekAria: string
    lockedWhat: string
  }
  changed: { title: string; moreBody: string; askAria: (line: string) => string }
  recap: {
    title: (month: string) => string
    spent: string
    kept: string
    over: string
    biggest: string
    lockedWhat: string
  }
  learning: {
    label: string
    title: string
    body: (daysMore: number) => string
    progress: (days: number, daysNeeded: number, purchases: number, purchasesNeeded: number) => string
    examplesTitle: string
    example: string
    items: { title: string; sub: string }[]
  }
  lockSheet: { body: string; free: string }
  proTag: string
  more: string
  lookingAhead: string
}

const s = (n: number, one: string, many: string) => (n === 1 ? one : many)

export const INSIGHTS_LT_COPY: Record<Locale, InsightsLtCopy> = {
  en: {
    hero: {
      dayOf: (m, d, t) => `${m} · day ${d} of ${t}`,
      status: { onTrack: 'On track', overPace: 'Over pace', overBudget: 'Over budget', aboveUsual: 'Above usual', belowUsual: 'Below usual' },
      finishLead: (m) => `At this pace you finish ${m}`,
      big: (a, over) => `${a} ${over ? 'over' : 'under'}`,
      ofBudget: (b) => `your ${b} budget`,
      land: (d, now, over) => (over ? `Spend *${d} a day* from now to land on budget, instead of ${now}.` : `You can spend *${d} a day* from now and still land on budget.`),
      nothingLeft: 'Nothing is left in the budget before payday.',
      usualLead: 'At this pace you spend',
      usualBig: (a, more) => `${a} ${more ? 'more' : 'less'}`,
      usualSide: 'than your usual month',
      projectionLead: (m) => `At this pace ${m} ends at`,
      earlyLead: (m) => `Spent so far in ${m}`,
      earlyNote: (m, d) => (d > 0 ? `I will say where ${m} ends in ${d} more ${s(d, 'day', 'days')}.` : `A few more purchases, then I can say where ${m} ends.`),
      noIncomeBody: (m) => `Add your income to see if ${m} ends on budget and what you can spend each day.`,
      addIncome: 'Add income',
      tiles: {
        label: { mainReason: 'Main reason', beforePayday: 'Before payday', unusualBuy: 'Unusual buy', bigDay: 'Your big day' },
        shift: (n, p, up) => `${n} ${up ? '+' : '−'}${p}%`,
        shiftSub: (p, up) => `Running ${p}% ${up ? 'above' : 'below'} your usual`,
        top: (n, sh) => `${n} ${sh}%`,
        topSub: 'Your biggest share this month',
        bills: (t) => `${t} due`,
        billsSub: (c, d) => `${c} ${s(c, 'bill', 'bills')} in the next ${d} ${s(d, 'day', 'days')}`,
        unusual: (d, a) => `${d} ${a}`,
        unusualSub: (x, c) => `${x}× your usual ${c} buy`,
        bigDaySub: (a) => `About ${a} on average`,
        empty: 'Nothing to flag yet',
        locked: 'Hidden, part of Pro',
      },
      lockedMore: (n) => `${n} more ${s(n, 'finding is', 'findings are')} in Pro`,
    },
    read: {
      title: (m) => `Buddgy’s read on ${m}`,
      paceBudget: ({ daily, delta, over, far }) =>
        over
          ? `You’re spending *${daily} a day*, ${far ? 'well' : 'a bit'} above plan, so the month ends about *${delta} over*.`
          : `You’re spending *${daily} a day*, within plan, so the month ends about *${delta} under*.`,
      paceUsual: ({ daily, delta, more }) => `You’re spending *${daily} a day*, so the month ends about *${delta} ${more ? 'more' : 'less'}* than usual.`,
      paceProjection: ({ daily, projected }) => `You’re spending *${daily} a day*, so the month ends at about *${projected}*.`,
      early: ({ spent, daysMore }) => (daysMore > 0 ? `It’s early: *${spent}* spent so far, and in ${daysMore} more ${s(daysMore, 'day', 'days')} I can say where the month ends.` : `It’s early: *${spent}* spent so far.`),
      driverShift: ({ name, pct, up }) => (up ? `Most of it is ${name}, running *${pct}% above* your usual.` : `${name} is running *${pct}% below* your usual.`),
      driverTop: ({ name, share }) => `${name} takes the biggest share, *${share}%* of what you spent.`,
      driverUnusual: ({ description, amount }) => `One purchase stands out: *${amount}* at ${description}.`,
      bills: ({ count, total }) => `${count} ${s(count, 'bill', 'bills')} worth *${total}* ${s(count, 'is', 'are')} due before payday.`,
      actionLand: ({ daily }) => `Keep to *${daily} a day* and you land on budget.`,
      actionNothingLeft: 'Nothing is left in the budget: hold off on anything that can wait until payday.',
      actionKeep: ({ delta }) => `Keep this up and you have about *${delta}* to spare.`,
      q: {
        whyCategory: { label: (n) => `Why is ${n} up?`, seed: (n) => `Why is ${n} up this month, and what could I change?` },
        whereCut: { label: 'Where can I cut?', seed: 'Where can I cut this month without missing anything important?' },
        makePlan: { label: 'Make me a plan', seed: 'Make me a simple plan to land on budget this month, using get_insights and my month summary.' },
        billsOk: { label: 'Can I cover my bills?', seed: 'Can I cover the bills due before payday and still reach payday?' },
        whatNext: { label: 'What should I do next?', seed: 'Read my month and tell me the one thing to do next.' },
      },
      freeTitle: 'Explain my month',
      freeBody: 'Buddgy reads your month and tells you, in plain words, what changed and what to do next.',
    },
    pace: {
      title: 'Spending pace',
      legend: { you: 'You', plan: 'Plan', heading: 'Where it’s heading' },
      by: (d) => `by ${d}`,
      budget: (a) => `Budget ${a}`,
      today: 'Today',
      tip: (d, past, v, p) => `${d} · ${past ? 'spent' : 'at this pace'} ${v}${p ? ` · plan ${p}` : ''}`,
      aria: 'Spending so far against the plan',
      headers: ['Day', 'Spent', 'Plan'],
    },
    where: {
      title: 'Where it went',
      vs: (m) => `vs ${m}`,
      spent: (c) => `${c} spent`,
      other: 'Other',
      same: 'same',
      up: (p) => `up ${p}%`,
      down: (p) => `down ${p}%`,
      tip: (n, a, sh) => `${n} · ${a} · ${sh}%`,
      aria: 'Spending by category',
      headers: ['Category', 'Spent', 'Share', 'Change'],
      note: (d) => `Change compares the first ${d} ${s(d, 'day', 'days')} of each month.`,
    },
    months: {
      title: 'Month by month',
      six: '6 months',
      year: 'Year',
      budgetLine: 'dashed line = budget',
      overThenUnder: (m, by) => `${m} went over by ${by}. Since then you’ve stayed under.`,
      lastOver: (m, by) => `${m} went over budget by ${by}.`,
      allUnder: 'You’ve stayed under budget every month shown.',
      kept: (p) => (p >= 0 ? ` You kept *${p}%* of your income on average.` : ` You spent *${-p}%* more than your income on average.`),
      tip: (m, a, st) => `${m} · ${a} spent${st === 'soFar' ? ' so far' : st === 'over' ? ' · over budget' : ''}`,
      aria: 'Spending per month against the budget',
      headers: ['Month', 'Spent'],
    },
    patterns: {
      title: 'Patterns',
      bigDay: 'Your big day',
      avg: (a) => `${a} on average`,
      bigDayNone: 'Needs 8 weeks of spending',
      nw: 'Net worth path',
      nwBy: (p, d) => `≈ ${p} by ${d}`,
      nwNone: 'Needs 3 months of history',
      nwAria: 'Net worth, recent months',
      weekAria: 'Average spend by weekday',
      lockedWhat: 'Your big spending day and where your net worth is heading',
    },
    changed: { title: 'What changed', moreBody: 'Pro opens every finding, the year view, the what-if and your monthly recap.', askAria: (l) => `Ask Buddgy: ${l}` },
    recap: {
      title: (m) => `${m} in one look`,
      spent: 'Spent',
      kept: 'Kept',
      over: 'Over income',
      biggest: 'Biggest buy',
      lockedWhat: 'Your month at a glance is part of Pro',
    },
    learning: {
      label: 'Insights',
      title: 'I’m learning your patterns',
      body: (d) => (d > 0 ? `${d} more ${s(d, 'day', 'days')} of spending, then I can show how you spend across the month.` : 'A few more purchases, then I can show how you spend across the month.'),
      progress: (d, dn, p, pn) => `${d} of ${dn} days · ${p} of ${pn} purchases`,
      examplesTitle: 'What I will show you',
      example: 'Example',
      items: [
        { title: 'Which category grew, and why', sub: 'e.g. Food is up 18%, mostly delivery' },
        { title: 'If your money lasts to payday', sub: 'e.g. Lasts to Nov 8 at this pace' },
        { title: 'What your bills and subscriptions cost', sub: 'e.g. 2,062 a month, 24,744 a year' },
      ],
    },
    lockSheet: { body: 'Pro opens every pattern, the year view, the what-if and your monthly recap.', free: 'Your daily amount, bills and debts stay free.' },
    proTag: 'Pro',
    more: 'More reports',
    lookingAhead: 'Looking ahead',
  },
  ar: {
    hero: {
      dayOf: (m, d, t) => `${m} · يوم ${d} من ${t}`,
      status: { onTrack: 'ماشي تمام', overPace: 'أسرع من الخطة', overBudget: 'فوق الميزانية', aboveUsual: 'أعلى من المعتاد', belowUsual: 'أقل من المعتاد' },
      finishLead: (m) => `بالمعدل ده هتقفل ${m}`,
      big: (a, over) => `${a} ${over ? 'زيادة' : 'أقل'}`,
      ofBudget: (b) => `عن ميزانيتك ${b}`,
      land: (d, now, over) => (over ? `اصرف *${d} في اليوم* من النهارده عشان تقفل على الميزانية، بدل ${now}.` : `تقدر تصرف *${d} في اليوم* من النهارده وتفضل جوه الميزانية.`),
      nothingLeft: 'مافيش حاجة فاضلة في الميزانية قبل الراتب.',
      usualLead: 'بالمعدل ده هتصرف',
      usualBig: (a, more) => `${a} ${more ? 'زيادة' : 'أقل'}`,
      usualSide: 'عن شهرك المعتاد',
      projectionLead: (m) => `بالمعدل ده ${m} هيقفل على`,
      earlyLead: (m) => `صرفت لحد دلوقتي في ${m}`,
      earlyNote: (m, d) => (d > 0 ? `هقولك ${m} هيقفل على كام بعد ${arPlural(d, AR_UNITS.day)}.` : `كام عملية شرا كمان وأقولك ${m} هيقفل على كام.`),
      noIncomeBody: (m) => `ضيف دخلك عشان تعرف ${m} هيقفل جوه الميزانية ولا لأ، وتقدر تصرف كام في اليوم.`,
      addIncome: 'ضيف دخل',
      tiles: {
        label: { mainReason: 'السبب الأساسي', beforePayday: 'قبل الراتب', unusualBuy: 'شرا مش معتاد', bigDay: 'يومك الكبير' },
        shift: (n, p, up) => `${n} ${up ? '+' : '−'}${p}%`,
        shiftSub: (p, up) => `${up ? 'أعلى' : 'أقل'} من المعتاد بـ ${p}%`,
        top: (n, sh) => `${n} ${sh}%`,
        topSub: 'أكبر نصيب الشهر ده',
        bills: (t) => `${t} مستحقة`,
        billsSub: (c, d) => `${arPlural(c, { one: 'فاتورة', two: 'فاتورتين', few: 'فواتير', many: 'فاتورة', fem: true })} في ${arPlural(d, AR_UNITS.day)} الجايين`,
        unusual: (d, a) => `${d} ${a}`,
        unusualSub: (x, c) => `${x}× شرا ${c} المعتاد`,
        bigDaySub: (a) => `حوالي ${a} في المتوسط`,
        empty: 'مافيش حاجة تتقال لسه',
        locked: 'مخفي، جزء من Pro',
      },
      lockedMore: (n) => `${arPlural(n, { one: 'ملاحظة', two: 'ملاحظتين', few: 'ملاحظات', many: 'ملاحظة', fem: true })} كمان في Pro`,
    },
    read: {
      title: (m) => `قراءة Buddgy لـ ${m}`,
      paceBudget: ({ daily, delta, over, far }) =>
        over
          ? `بتصرف *${daily} في اليوم*، ${far ? 'أعلى بكتير' : 'أعلى شوية'} من الخطة، فالشهر هيقفل حوالي *${delta} زيادة*.`
          : `بتصرف *${daily} في اليوم*، جوه الخطة، فالشهر هيقفل حوالي *${delta} أقل*.`,
      paceUsual: ({ daily, delta, more }) => `بتصرف *${daily} في اليوم*، فالشهر هيقفل حوالي *${delta} ${more ? 'زيادة' : 'أقل'}* عن المعتاد.`,
      paceProjection: ({ daily, projected }) => `بتصرف *${daily} في اليوم*، فالشهر هيقفل على حوالي *${projected}*.`,
      early: ({ spent, daysMore }) => (daysMore > 0 ? `لسه بدري: صرفت *${spent}* لحد دلوقتي، وبعد ${arPlural(daysMore, AR_UNITS.day)} أقولك الشهر هيقفل على كام.` : `لسه بدري: صرفت *${spent}* لحد دلوقتي.`),
      driverShift: ({ name, pct, up }) => (up ? `أغلبه من ${name}، *أعلى بـ ${pct}%* من المعتاد.` : `${name} *أقل بـ ${pct}%* من المعتاد.`),
      driverTop: ({ name, share }) => `${name} واخد أكبر نصيب، *${share}%* من اللي صرفته.`,
      driverUnusual: ({ description, amount }) => `فيه عملية شرا باينة: *${amount}* في ${description}.`,
      bills: ({ count, total }) => `${arPlural(count, { one: 'فاتورة', two: 'فاتورتين', few: 'فواتير', many: 'فاتورة', fem: true })} بـ *${total}* مستحقة قبل الراتب.`,
      actionLand: ({ daily }) => `خليك على *${daily} في اليوم* وهتقفل على الميزانية.`,
      actionNothingLeft: 'مافيش حاجة فاضلة في الميزانية: أجّل أي حاجة تستنى لحد الراتب.',
      actionKeep: ({ delta }) => `كمّل كده وهيفضل معاك حوالي *${delta}*.`,
      q: {
        whyCategory: { label: (n) => `ليه ${n} زاد؟`, seed: (n) => `ليه ${n} زاد الشهر ده، وأقدر أغيّر إيه؟` },
        whereCut: { label: 'أوفّر منين؟', seed: 'أقدر أوفّر منين الشهر ده من غير ما أفوّت حاجة مهمة؟' },
        makePlan: { label: 'اعملي خطة', seed: 'اعملي خطة بسيطة أقفل بيها على الميزانية الشهر ده، استخدم get_insights وملخص شهري.' },
        billsOk: { label: 'هقدر أدفع فواتيري؟', seed: 'هقدر أدفع الفواتير المستحقة قبل الراتب وأوصل للقبض؟' },
        whatNext: { label: 'أعمل إيه بعد كده؟', seed: 'اقرا شهري وقولي حاجة واحدة أعملها دلوقتي.' },
      },
      freeTitle: 'اشرحلي شهري',
      freeBody: 'Buddgy بيقرا شهرك ويقولك بكلام بسيط إيه اللي اتغيّر وتعمل إيه بعد كده.',
    },
    pace: {
      title: 'معدل الصرف',
      legend: { you: 'إنت', plan: 'الخطة', heading: 'رايح على فين' },
      by: (d) => `لحد ${d}`,
      budget: (a) => `الميزانية ${a}`,
      today: 'النهارده',
      tip: (d, past, v, p) => `${d} · ${past ? 'صرفت' : 'بالمعدل ده'} ${v}${p ? ` · الخطة ${p}` : ''}`,
      aria: 'الصرف لحد دلوقتي مقابل الخطة',
      headers: ['اليوم', 'المصروف', 'الخطة'],
    },
    where: {
      title: 'الفلوس راحت فين',
      vs: (m) => `مقارنة بـ ${m}`,
      spent: (c) => `${c} مصروفة`,
      other: 'تاني',
      same: 'زي ما هو',
      up: (p) => `زاد ${p}%`,
      down: (p) => `قل ${p}%`,
      tip: (n, a, sh) => `${n} · ${a} · ${sh}%`,
      aria: 'الصرف حسب الفئة',
      headers: ['الفئة', 'المصروف', 'النسبة', 'التغيير'],
      note: (d) => `التغيير بيقارن أول ${arPlural(d, AR_UNITS.day)} من كل شهر.`,
    },
    months: {
      title: 'شهر بشهر',
      six: '6 شهور',
      year: 'السنة',
      budgetLine: 'الخط المتقطع = الميزانية',
      overThenUnder: (m, by) => `${m} عدّى الميزانية بـ ${by}. ومن ساعتها وإنت تحتها.`,
      lastOver: (m, by) => `${m} عدّى الميزانية بـ ${by}.`,
      allUnder: 'فضلت تحت الميزانية في كل الشهور اللي هنا.',
      kept: (p) => (p >= 0 ? ` وفّرت *${p}%* من دخلك في المتوسط.` : ` صرفت *${-p}%* أكتر من دخلك في المتوسط.`),
      tip: (m, a, st) => `${m} · ${a} مصروفة${st === 'soFar' ? ' لحد دلوقتي' : st === 'over' ? ' · فوق الميزانية' : ''}`,
      aria: 'الصرف كل شهر مقابل الميزانية',
      headers: ['الشهر', 'المصروف'],
    },
    patterns: {
      title: 'أنماط',
      bigDay: 'يومك الكبير',
      avg: (a) => `${a} في المتوسط`,
      bigDayNone: 'محتاج 8 أسابيع صرف',
      nw: 'مسار صافي ثروتك',
      nwBy: (p, d) => `≈ ${p} لحد ${d}`,
      nwNone: 'محتاج تاريخ 3 شهور',
      nwAria: 'صافي الثروة، آخر الشهور',
      weekAria: 'متوسط الصرف حسب يوم الأسبوع',
      lockedWhat: 'يوم صرفك الكبير وصافي ثروتك رايح على فين',
    },
    changed: { title: 'إيه اللي اتغيّر', moreBody: 'Pro بيفتح كل الملاحظات وعرض السنة وخاصية لو والملخص الشهري.', askAria: (l) => `اسأل Buddgy: ${l}` },
    recap: {
      title: (m) => `${m} في نظرة`,
      spent: 'صرفت',
      kept: 'وفّرت',
      over: 'فوق الدخل',
      biggest: 'أكبر شرا',
      lockedWhat: 'شهرك في نظرة جزء من Pro',
    },
    learning: {
      label: 'تحليلات',
      title: 'بتعرّف على أنماطك',
      body: (d) => (d > 0 ? `${arPlural(d, AR_UNITS.day)} صرف كمان، وبعدها أوريك بتصرف إزاي على مدار الشهر.` : 'كام عملية شرا كمان، وبعدها أوريك بتصرف إزاي على مدار الشهر.'),
      progress: (d, dn, p, pn) => `${d} من ${dn} أيام · ${p} من ${pn} عمليات شرا`,
      examplesTitle: 'اللي هوريهولك',
      example: 'مثال',
      items: [
        { title: 'أنهي فئة زادت، وليه', sub: 'مثلًا: الأكل زاد 18%، أغلبه دليفري' },
        { title: 'فلوسك هتكفي لحد الراتب ولا لأ', sub: 'مثلًا: هتكفي لحد 8 نوفمبر بالمعدل ده' },
        { title: 'فواتيرك واشتراكاتك بتكلفك كام', sub: 'مثلًا: 2,062 في الشهر، 24,744 في السنة' },
      ],
    },
    lockSheet: { body: 'Pro بيفتح كل الأنماط وعرض السنة وخاصية لو والملخص الشهري.', free: 'مبلغك اليومي والفواتير والديون تفضل مجانية.' },
    proTag: 'Pro',
    more: 'تقارير أكتر',
    lookingAhead: 'نظرة لقدّام',
  },
}

export function useInsightsLtCopy(): InsightsLtCopy {
  const { locale } = useLocale()
  return INSIGHTS_LT_COPY[locale]
}
