import type { BudgetBlock } from '@/lib/store/types'
import type { BudgetChapter } from '@/lib/budget/blocks'
import type { InsightKind } from '@/lib/budget/insights'

/** Pre-formatted values for an insight sentence: amounts as money, counts as plain numbers. */
export type InsightText = Record<string, string>

export interface BudgetChromeCopy {
  planBar: {
    activeSub: string
    switchPlan: string
    options: string
    modeLabel: string
    plan: string
    month: string
  }
  flow: {
    planLabel: string
    monthLabel: string
    balanced: string
    stillFree: (amount: string) => string
    over: (amount: string) => string
    assign: string
    fix: string
    dayOf: (day: number, days: number) => string
    jumpTo: (name: string) => string
    legendLabel: string
  }
  blocks: Record<BudgetBlock, { name: string; short: string }>
  chapters: Record<BudgetChapter, { name: string; sub: string }>
  chapter: {
    index: (n: number, total: number) => string
    expand: (name: string) => string
    collapse: (name: string) => string
    spentOf: (spent: string, planned: string) => string
    spent: string
  }
  insights: {
    count: (n: number) => string
    sheetTitle: string
    why: string
    open: string
    dismiss: string
    short: Record<InsightKind, string>
    finding: Record<InsightKind, (p: InsightText) => string>
    reason: Record<InsightKind, (p: InsightText) => string>
    action: Record<'openLine' | 'raise' | 'cap' | 'moveBuffer' | 'update' | 'addLine', string>
  }
  empty: {
    headline: string
    body: string
    points: [string, string, string]
    buddgy: string
    /** Shown instead when the app already holds spending history to build from. */
    drafted: { headline: (months: number) => string; body: string; cta: string }
    manual: string
  }
  learning: string
  upgrade: {
    title: (lines: number) => string
    review: string
    later: string
  }
}

export const budgetChromeCopyEn: BudgetChromeCopy = {
  planBar: {
    activeSub: 'Active · applies to every month',
    switchPlan: 'Switch plan',
    options: 'Plan options',
    modeLabel: 'Budget view',
    plan: 'Plan',
    month: 'This month',
  },
  flow: {
    planLabel: 'Every paycheck, planned',
    monthLabel: 'Spent so far this month',
    balanced: 'Balanced',
    stillFree: (a) => `${a} still free`,
    over: (a) => `${a} over-assigned`,
    assign: 'Assign it',
    fix: 'Fix it',
    dayOf: (d, n) => `Day ${d} of ${n}`,
    jumpTo: (name) => `Jump to ${name}`,
    legendLabel: 'Blocks of your plan',
  },
  blocks: {
    bills: { name: 'Home & bills', short: 'Bills' },
    subscriptions: { name: 'Subscriptions', short: 'Subs' },
    debts: { name: 'Debts', short: 'Debts' },
    everyday: { name: 'Everyday', short: 'Everyday' },
    safety: { name: 'Safety net', short: 'Safety' },
    goals: { name: 'Goals', short: 'Goals' },
    grow: { name: 'Grow', short: 'Grow' },
  },
  chapters: {
    mustPay: { name: 'Must pay', sub: 'Bills, subscriptions, debts' },
    live: { name: 'Live', sub: 'Everyday spending' },
    secure: { name: 'Secure', sub: 'Safety net, goals, growth' },
  },
  chapter: {
    index: (n, t) => `Chapter ${n} of ${t}`,
    expand: (name) => `${name}, expand`,
    collapse: (name) => `${name}, collapse`,
    spentOf: (s, p) => `${s} of ${p}`,
    spent: 'spent',
  },
  insights: {
    count: (n) => (n === 1 ? '1 thing worth a look' : `${n} things worth a look`),
    sheetTitle: 'Worth a look',
    why: 'Why it matters',
    open: 'Open',
    dismiss: 'Not now',
    short: {
      safetyNet: 'Safety net is thin',
      lineOverCap: 'A line keeps running over',
      housingShare: 'Housing is a big share',
      essentialsShare: 'Essentials take most of it',
      subscriptionsDrift: 'Subscriptions have shifted',
      unassignedSpend: 'Spending with no line',
      freeToAssign: 'Money left to assign',
    },
    finding: {
      safetyNet: (p) => `Your safety net covers ${p.runway} months, below your ${p.target}-month target.`,
      lineOverCap: (p) => `${p.name} went over its limit ${p.months} months in a row.`,
      housingShare: (p) => `Housing takes ${p.percent}% of your income (${p.housing}).`,
      essentialsShare: (p) => `Essentials take ${p.percent}% of your income (${p.essentials}).`,
      subscriptionsDrift: (p) => `Your subscriptions now cost ${p.live}, versus ${p.planned} in the plan.`,
      unassignedSpend: (p) => `${p.amount} was spent this month with no line to count against.`,
      freeToAssign: (p) => `${p.amount} of your income has no job yet.`,
    },
    reason: {
      safetyNet: () => 'A thicker cushion keeps one surprise from becoming debt.',
      lineOverCap: () => 'A limit that never holds is a guess. Raise it to match reality or cap the spending.',
      housingShare: () => 'Above about a third of income, housing squeezes everything else.',
      essentialsShare: () => 'When essentials take this much, there is little room to save.',
      subscriptionsDrift: () => 'The plan should match what actually gets charged.',
      unassignedSpend: () => 'Spending that no line claims makes the plan look better than it is.',
      freeToAssign: () => 'Unassigned money tends to disappear. Give it a place.',
    },
    action: {
      openLine: 'Open line',
      raise: 'Raise the limit',
      cap: 'Cap the spending',
      moveBuffer: 'Move money',
      update: 'Update the plan',
      addLine: 'Add a line',
    },
  },
  empty: {
    headline: 'Plan every paycheck',
    body: 'Answer a few questions and get a budget built around your life. It takes about two minutes.',
    points: ['Built from your own numbers', 'Debts and goals included', 'Adjusts as you spend'],
    buddgy: 'Start with Buddgy',
    drafted: {
      headline: (months) => `We can draft a plan from your last ${months === 1 ? 'month' : `${months} months`}`,
      body: 'Buddgy only asks about what your records do not show.',
      cta: 'Review my draft',
    },
    manual: 'Or set it up myself',
  },
  learning: 'First month: some amounts are estimates, so going over is only a heads-up for now. They sharpen as you spend.',
  upgrade: {
    title: (n) => `We grouped your ${n} lines into blocks. Check they look right.`,
    review: 'Review',
    later: 'Later',
  },
}

export const budgetChromeCopyAr: BudgetChromeCopy = {
  planBar: {
    activeSub: 'نشطة · تُطبَّق على كل شهر',
    switchPlan: 'تبديل الخطة',
    options: 'خيارات الخطة',
    modeLabel: 'عرض الميزانية',
    plan: 'الخطة',
    month: 'هذا الشهر',
  },
  flow: {
    planLabel: 'كل راتب، مخطَّط له',
    monthLabel: 'المصروف حتى الآن هذا الشهر',
    balanced: 'متوازنة',
    stillFree: (a) => `${a} ما زالت حرة`,
    over: (a) => `${a} زيادة عن الدخل`,
    assign: 'وزّعها',
    fix: 'عالجها',
    dayOf: (d, n) => `اليوم ${d} من ${n}`,
    jumpTo: (name) => `انتقل إلى ${name}`,
    legendLabel: 'أقسام خطتك',
  },
  blocks: {
    bills: { name: 'السكن والفواتير', short: 'الفواتير' },
    subscriptions: { name: 'الاشتراكات', short: 'الاشتراكات' },
    debts: { name: 'الديون', short: 'الديون' },
    everyday: { name: 'اليومي', short: 'اليومي' },
    safety: { name: 'شبكة الأمان', short: 'الأمان' },
    goals: { name: 'الأهداف', short: 'الأهداف' },
    grow: { name: 'النمو', short: 'النمو' },
  },
  chapters: {
    mustPay: { name: 'واجب السداد', sub: 'الفواتير والاشتراكات والديون' },
    live: { name: 'المعيشة', sub: 'الإنفاق اليومي' },
    secure: { name: 'الأمان', sub: 'شبكة الأمان والأهداف والنمو' },
  },
  chapter: {
    index: (n, t) => `الفصل ${n} من ${t}`,
    expand: (name) => `${name}، توسيع`,
    collapse: (name) => `${name}، طي`,
    spentOf: (s, p) => `${s} من ${p}`,
    spent: 'مصروف',
  },
  insights: {
    count: (n) => (n === 1 ? 'أمر واحد يستحق النظر' : n === 2 ? 'أمران يستحقان النظر' : `${n} أمور تستحق النظر`),
    sheetTitle: 'يستحق النظر',
    why: 'لماذا يهم',
    open: 'فتح',
    dismiss: 'ليس الآن',
    short: {
      safetyNet: 'شبكة الأمان ضعيفة',
      lineOverCap: 'بند يتجاوز حدّه باستمرار',
      housingShare: 'السكن يأخذ حصة كبيرة',
      essentialsShare: 'الأساسيات تأخذ معظم الدخل',
      subscriptionsDrift: 'الاشتراكات تغيّرت',
      unassignedSpend: 'إنفاق بلا بند',
      freeToAssign: 'مبلغ ينتظر التوزيع',
    },
    finding: {
      safetyNet: (p) => `شبكة أمانك تغطي ${p.runway} أشهر، أقل من هدفك البالغ ${p.target} أشهر.`,
      lineOverCap: (p) => `تجاوز بند ${p.name} حدّه ${p.months} أشهر متتالية.`,
      housingShare: (p) => `السكن يأخذ ${p.percent}% من دخلك (${p.housing}).`,
      essentialsShare: (p) => `الأساسيات تأخذ ${p.percent}% من دخلك (${p.essentials}).`,
      subscriptionsDrift: (p) => `تكلفة اشتراكاتك الآن ${p.live} مقابل ${p.planned} في الخطة.`,
      unassignedSpend: (p) => `أُنفق ${p.amount} هذا الشهر دون بند يُحتسب عليه.`,
      freeToAssign: (p) => `${p.amount} من دخلك بلا وجهة بعد.`,
    },
    reason: {
      safetyNet: () => 'وسادة أمان أكبر تمنع مفاجأة واحدة من أن تتحول إلى دين.',
      lineOverCap: () => 'حدّ لا يُحترم مجرد تخمين. ارفعه ليطابق الواقع أو اضبط الإنفاق.',
      housingShare: () => 'عندما يتجاوز السكن نحو ثلث الدخل، يضيّق على كل شيء آخر.',
      essentialsShare: () => 'حين تأخذ الأساسيات هذه الحصة، يبقى مجال ضئيل للادخار.',
      subscriptionsDrift: () => 'يجب أن تطابق الخطة ما يُخصم فعلاً.',
      unassignedSpend: () => 'الإنفاق الذي لا ينتمي لبند يجعل الخطة تبدو أفضل مما هي عليه.',
      freeToAssign: () => 'المال غير الموزَّع يتبخر بسهولة. امنحه وجهة.',
    },
    action: {
      openLine: 'فتح البند',
      raise: 'رفع الحد',
      cap: 'ضبط الإنفاق',
      moveBuffer: 'نقل مبلغ',
      update: 'تحديث الخطة',
      addLine: 'إضافة بند',
    },
  },
  empty: {
    headline: 'خطط لكل راتب',
    body: 'أجب عن بضعة أسئلة لتحصل على ميزانية مبنية على حياتك. تستغرق دقيقتين تقريبًا.',
    points: ['مبنية على أرقامك أنت', 'تشمل الديون والأهداف', 'تتكيف مع إنفاقك'],
    buddgy: 'ابدأ مع Buddgy',
    drafted: {
      headline: (months) => `يمكننا صياغة خطة من ${months === 1 ? 'الشهر الماضي' : `آخر ${months} أشهر`}`,
      body: 'يسألك Buddgy فقط عما لا تُظهره سجلاتك.',
      cta: 'راجع المسودة',
    },
    manual: 'أو أعدها بنفسي',
  },
  learning: 'الشهر الأول: بعض المبالغ تقديرية، لذا تجاوزها مجرد تنبيه الآن. وتصبح أدق مع إنفاقك.',
  upgrade: {
    title: (n) => `جمّعنا بنودك الـ${n} في أقسام. تأكد أنها تبدو صحيحة.`,
    review: 'مراجعة',
    later: 'لاحقاً',
  },
}
