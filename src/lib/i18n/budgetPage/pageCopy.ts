/** Page-level copy for the Budget page: alerts, toasts, menu and the unplanned-spend card. Amounts arrive pre-formatted. */
export interface BudgetPageCopy {
  unassigned: { title: (amount: string) => string; body: string; cta: string }
  menu: { plans: string; newBudget: string }
  needIncome: { title: string; body: string; ok: string }
  starterBuilt: string
  bufferMoved: (amount: string) => string
  grouped: string
  planNames: { starter: string; fresh: string; copyOf: (name: string) => string }
  loading: string
}

export const budgetPageCopyEn: BudgetPageCopy = {
  unassigned: {
    title: (amount) => `${amount} spent outside your plan`,
    body: 'These purchases have no line yet.',
    cta: 'Add a line',
  },
  menu: { plans: 'Your budgets', newBudget: 'New budget' },
  needIncome: {
    title: 'Add your income first',
    body: 'A starter plan is sized on your income. Add it under Flow, then come back.',
    ok: 'OK',
  },
  starterBuilt: 'Your starter plan is ready. Check each block and adjust.',
  bufferMoved: (amount) => `${amount} moved to your buffer`,
  grouped: 'Your lines are grouped into blocks',
  planNames: { starter: 'My plan', fresh: 'New budget', copyOf: (name) => `${name} copy` },
  loading: 'Loading your budget',
}

export const budgetPageCopyAr: BudgetPageCopy = {
  unassigned: {
    title: (amount) => `${amount} أُنفقت خارج خطتك`,
    body: 'هذه المشتريات ليس لها بند بعد.',
    cta: 'أضف بنداً',
  },
  menu: { plans: 'ميزانياتك', newBudget: 'ميزانية جديدة' },
  needIncome: {
    title: 'أضف دخلك أولاً',
    body: 'الخطة المبدئية تُبنى على دخلك. أضفه من صفحة التدفق ثم عد إلى هنا.',
    ok: 'حسناً',
  },
  starterBuilt: 'خطتك المبدئية جاهزة. راجع كل قسم وعدّل ما يلزم.',
  bufferMoved: (amount) => `تم نقل ${amount} إلى الاحتياطي`,
  grouped: 'تم تجميع بنودك في أقسام',
  planNames: { starter: 'خطتي', fresh: 'ميزانية جديدة', copyOf: (name) => `نسخة من ${name}` },
  loading: 'جارٍ تحميل ميزانيتك',
}
