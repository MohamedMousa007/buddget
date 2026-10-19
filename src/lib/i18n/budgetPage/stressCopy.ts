import type { StressKind } from '@/lib/budget/stressTest'

/** Copy for the stress test sheet. Money arrives pre-formatted. */
export interface BudgetStressCopy {
  menu: string
  title: string
  intro: string
  kinds: Record<StressKind, string>
  pct: (n: number) => string
  income: string
  planned: string
  after: string
  fine: string
  deficit: (amount: string) => string
  trimsTitle: string
  trimLine: (name: string, from: string, to: string) => string
  holds: string
  short: (amount: string) => string
  note: string
}

export const budgetStressCopyEn: BudgetStressCopy = {
  menu: 'Stress test',
  title: 'Stress test your plan',
  intro: 'See what a bad month would do, and what Buddgy would give up first. Nothing is changed.',
  kinds: { income: 'Income drops', bills: 'Bills rise', everyday: 'Everyday costs rise' },
  pct: (n) => `${n}%`,
  income: 'Income',
  planned: 'Planned spending',
  after: 'Left after the shock',
  fine: 'Your plan absorbs this without changes.',
  deficit: (amount) => `${amount} short`,
  trimsTitle: 'What gets trimmed first',
  trimLine: (name, from, to) => `${name}: ${from} → ${to}`,
  holds: 'With those trims the plan holds.',
  short: (amount) => `Still ${amount} short after every trim. A bigger buffer or lower fixed costs would be needed.`,
  note: 'Locked and linked lines are never trimmed.',
}

export const budgetStressCopyAr: BudgetStressCopy = {
  menu: 'اختبار التحمّل',
  title: 'اختبر تحمّل خطتك',
  intro: 'شاهد ما يفعله شهر سيئ، وما سيتنازل عنه بادي أولًا. لا يتغير شيء.',
  kinds: { income: 'انخفاض الدخل', bills: 'ارتفاع الفواتير', everyday: 'ارتفاع المصاريف اليومية' },
  pct: (n) => `${n}%`,
  income: 'الدخل',
  planned: 'الإنفاق المخطط',
  after: 'المتبقي بعد الصدمة',
  fine: 'خطتك تستوعب هذا دون تغييرات.',
  deficit: (amount) => `عجز ${amount}`,
  trimsTitle: 'ما يُخفَّض أولًا',
  trimLine: (name, from, to) => `${name}: ${from} ← ${to}`,
  holds: 'مع هذه التخفيضات تصمد الخطة.',
  short: (amount) => `ما زال العجز ${amount} بعد كل التخفيضات. يلزم احتياطي أكبر أو تكاليف ثابتة أقل.`,
  note: 'البنود المقفلة والمرتبطة لا تُخفَّض أبدًا.',
}
