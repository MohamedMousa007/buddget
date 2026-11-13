/** Page-level copy for the Budget page: alerts, toasts, menu and the unplanned-spend card. Amounts arrive pre-formatted. */
export interface BudgetPageCopy {
  menu: { plans: string; newBudget: string }
  bufferMoved: (amount: string) => string
  bufferNoFree: string
  grouped: string
  planNames: { fresh: string; copyOf: (name: string) => string }
  loading: string
}

export const budgetPageCopyEn: BudgetPageCopy = {
  menu: { plans: 'Your budgets', newBudget: 'New budget' },
  bufferMoved: (amount) => `${amount} moved to your buffer`,
  bufferNoFree: 'No free money to move this cycle',
  grouped: 'Your lines are grouped into blocks',
  planNames: { fresh: 'New budget', copyOf: (name) => `${name} copy` },
  loading: 'Loading your budget',
}

export const budgetPageCopyAr: BudgetPageCopy = {
  menu: { plans: 'ميزانياتك', newBudget: 'ميزانية جديدة' },
  bufferMoved: (amount) => `تم نقل ${amount} إلى الاحتياطي`,
  bufferNoFree: 'لا يوجد مبلغ حر لنقله في هذه الدورة',
  grouped: 'تم تجميع بنودك في أقسام',
  planNames: { fresh: 'ميزانية جديدة', copyOf: (name) => `نسخة من ${name}` },
  loading: 'جارٍ تحميل ميزانيتك',
}
