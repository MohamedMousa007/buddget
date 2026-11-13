import type { PaceState } from '@/lib/budget/monthSummary'
import { arCount, arPlural } from '@/lib/i18n/arPlural'

/** Copy for the Budget overview: the hero (month and plan) and the seven ledger rows. Money and dates arrive pre-formatted. */
export interface BudgetOverviewCopy {
  hero: {
    leftLabel: string
    perDay: (amount: string) => string
    daysLeft: (n: number) => string
    pace: Record<PaceState, string>
    topCategory: string
    overBudget: string
    overCount: (n: number) => string
    nothing: string
    stillToPay: string
    allPaid: string
    learningTitle: string
    learningBody: string
    planned: string
    daysLeftLabel: string
    income: string
    saving: (pct: string) => string
    debtFree: (month: string) => string
    split: { spending: string; debt: string; saving: string }
    splitLabel: string
    over: (amount: string) => string
    paceLabel: string
  }
  ledger: {
    empty: string
    allPaid: (n: number) => string
    progress: (done: number, total: number) => string
    next: (day: number) => string
    overLine: (name: string, amount: string) => string
    ahead: string
    moves: (day: number) => string
    movesThisMonth: string
    moved: string
    onTrack: string
    behind: (n: number) => string
    left: string
    over: string
    done: string
    toMove: string
    of: (amount: string) => string
    share: (pct: string) => string
    held: (months: string, target: number) => string
    changeUp: (pct: number) => string
    changeDown: (pct: number) => string
    count: { bills: (n: number) => string; subscriptions: (n: number) => string; debts: (n: number) => string; everyday: (n: number) => string; goals: (n: number) => string; grow: (n: number) => string }
    estimated: (n: number) => string
    flagged: string
    open: (name: string) => string
  }
}

const ordinal = (n: number): string => {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`
}
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export const budgetOverviewCopyEn: BudgetOverviewCopy = {
  hero: {
    leftLabel: 'Left to spend · Everyday',
    perDay: (a) => `${a} a day`,
    daysLeft: (n) => `${n} ${n === 1 ? 'day' : 'days'} left`,
    pace: { ok: 'On pace', ahead: 'Ahead of pace', over: 'Over plan' },
    topCategory: 'Top category',
    overBudget: 'Over budget',
    overCount: (n) => (n === 1 ? '1 category' : `${n} categories`),
    nothing: 'None',
    stillToPay: 'Still to pay',
    allPaid: 'All paid',
    learningTitle: 'Buddgy is still learning this plan',
    learningBody: 'Pace appears after 2 weeks of your own spending. Until then these figures use typical amounts.',
    planned: 'Planned',
    daysLeftLabel: 'Days left',
    income: 'Monthly income',
    saving: (p) => `Saving ${p}`,
    debtFree: (m) => `Debt-free ${m}`,
    split: { spending: 'Spending', debt: 'Debt', saving: 'Saving' },
    splitLabel: 'How your income is split',
    over: (a) => `Over income by ${a}`,
    paceLabel: 'Spend against an even pace; the line is today',
  },
  ledger: {
    empty: 'Nothing planned',
    allPaid: (n) => `All ${n} paid`,
    progress: (d, t) => `${d} of ${t} done`,
    next: (d) => `next on the ${ordinal(d)}`,
    overLine: (name, a) => `${name} ${a} over`,
    ahead: 'ahead',
    moves: (d) => `Moves on the ${ordinal(d)}`,
    movesThisMonth: 'Moves this month',
    moved: 'Moved',
    onTrack: 'On track',
    behind: (n) => `${n} behind`,
    left: 'left',
    over: 'over',
    done: 'Done',
    toMove: 'to move',
    of: (a) => `of ${a}`,
    share: (p) => `${p} of income`,
    held: (m, t) => `${m} of ${t} months held`,
    changeUp: (p) => `▲ ${p}% vs last month`,
    changeDown: (p) => `▼ ${p}% vs last month`,
    count: {
      bills: (n) => plural(n, 'bill', 'bills'),
      subscriptions: (n) => plural(n, 'subscription', 'subscriptions'),
      debts: (n) => plural(n, 'debt', 'debts'),
      everyday: (n) => plural(n, 'category', 'categories'),
      goals: (n) => plural(n, 'goal', 'goals'),
      grow: (n) => plural(n, 'line', 'lines'),
    },
    estimated: (n) => `${n} estimated`,
    flagged: 'Needs a check',
    open: (name) => `Open ${name}`,
  },
}

const F = {
  bill: { one: 'فاتورة', two: 'فاتورتين', few: 'فواتير', many: 'فاتورة', fem: true },
  subscription: { one: 'اشتراك', two: 'اشتراكين', few: 'اشتراكات', many: 'اشتراكًا' },
  category: { one: 'فئة', two: 'فئتين', few: 'فئات', many: 'فئة', fem: true },
  goal: { one: 'هدف', two: 'هدفين', few: 'أهداف', many: 'هدفًا' },
  line: { one: 'بند', two: 'بندين', few: 'بنود', many: 'بندًا' },
}

export const budgetOverviewCopyAr: BudgetOverviewCopy = {
  hero: {
    leftLabel: 'المتبقي للإنفاق · اليومي',
    perDay: (a) => `${a} في اليوم`,
    daysLeft: (n) => `متبقي ${arCount(n, 'day')}`,
    pace: { ok: 'ضمن الوتيرة', ahead: 'أسرع من الوتيرة', over: 'فوق الخطة' },
    topCategory: 'أعلى فئة',
    overBudget: 'تجاوز الميزانية',
    overCount: (n) => arPlural(n, F.category),
    nothing: 'لا شيء',
    stillToPay: 'لم يُدفع بعد',
    allPaid: 'كله مدفوع',
    learningTitle: 'بادجي ما زال يتعلم هذه الخطة',
    learningBody: 'تظهر الوتيرة بعد أسبوعين من إنفاقك الفعلي. حتى ذلك الحين تعتمد الأرقام على مبالغ معتادة.',
    planned: 'المخطط',
    daysLeftLabel: 'الأيام المتبقية',
    income: 'الدخل الشهري',
    saving: (p) => `الادخار ${p}`,
    debtFree: (m) => `خالٍ من الديون ${m}`,
    split: { spending: 'الإنفاق', debt: 'الدين', saving: 'الادخار' },
    splitLabel: 'كيف يُوزَّع دخلك',
    over: (a) => `أعلى من الدخل بمقدار ${a}`,
    paceLabel: 'الإنفاق مقابل وتيرة منتظمة؛ الخط يمثل اليوم',
  },
  ledger: {
    empty: 'لا شيء مخطط',
    allPaid: (n) => `كلها مدفوعة (${n})`,
    progress: (d, t) => `${d} من ${t} تمّت`,
    next: (d) => `التالي يوم ${d}`,
    overLine: (name, a) => `${name} تجاوز بمقدار ${a}`,
    ahead: 'أسرع من الوتيرة',
    moves: (d) => `يُحوَّل يوم ${d}`,
    movesThisMonth: 'يُحوَّل هذا الشهر',
    moved: 'تم التحويل',
    onTrack: 'على المسار',
    behind: (n) => `${n} متأخرة`,
    left: 'متبقي',
    over: 'زيادة',
    done: 'تم',
    toMove: 'للتحويل',
    of: (a) => `من ${a}`,
    share: (p) => `${p} من الدخل`,
    held: (m, t) => `${m} من ${t} أشهر`,
    changeUp: (p) => `▲ ${p}% عن الشهر الماضي`,
    changeDown: (p) => `▼ ${p}% عن الشهر الماضي`,
    count: {
      bills: (n) => arPlural(n, F.bill),
      subscriptions: (n) => arPlural(n, F.subscription),
      debts: (n) => arCount(n, 'debt'),
      everyday: (n) => arPlural(n, F.category),
      goals: (n) => arPlural(n, F.goal),
      grow: (n) => arPlural(n, F.line),
    },
    estimated: (n) => `${n} تقديرية`,
    flagged: 'تحتاج مراجعة',
    open: (name) => `افتح ${name}`,
  },
}
