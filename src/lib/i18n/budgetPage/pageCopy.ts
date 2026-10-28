/** Page-level copy for the Budget page: alerts, toasts, menu and the unplanned-spend card. Amounts arrive pre-formatted. */
export interface BudgetPageCopy {
  unassigned: { title: (amount: string) => string; body: string; cta: string }
  menu: { plans: string; newBudget: string }
  bufferMoved: (amount: string) => string
  grouped: string
  planNames: { fresh: string; copyOf: (name: string) => string }
  loading: string
}

export const budgetPageCopyEn: BudgetPageCopy = {
  unassigned: {
    title: (amount) => `${amount} spent outside your plan`,
    body: 'These purchases have no line yet.',
    cta: 'Add a line',
  },
  menu: { plans: 'Your budgets', newBudget: 'New budget' },
  bufferMoved: (amount) => `${amount} moved to your buffer`,
  grouped: 'Your lines are grouped into blocks',
  planNames: { fresh: 'New budget', copyOf: (name) => `${name} copy` },
  loading: 'Loading your budget',
}

export const budgetPageCopyAr: BudgetPageCopy = {
  unassigned: {
    title: (amount) => `${amount} أُنفقت خارج خطتك`,
    body: 'هذه المشتريات ليس لها بند بعد.',
    cta: 'أضف بنداً',
  },
  menu: { plans: 'ميزانياتك', newBudget: 'ميزانية جديدة' },
  bufferMoved: (amount) => `تم نقل ${amount} إلى الاحتياطي`,
  grouped: 'تم تجميع بنودك في أقسام',
  planNames: { fresh: 'ميزانية جديدة', copyOf: (name) => `نسخة من ${name}` },
  loading: 'جارٍ تحميل ميزانيتك',
}
