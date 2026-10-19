/** Copy for the month-close prompt. Money and the month name arrive pre-formatted. */
export interface BudgetCloseCopy {
  card: { title: (month: string) => string; body: string; cta: string }
  sheet: {
    title: (month: string) => string
    planned: string
    spent: string
    onPlan: string
    kept: (pct: string) => string
    over: (amount: string) => string
    ran: string
    overBy: (name: string, amount: string) => string
    fix: string
    raise: (name: string, months: number, to: string) => string
    lower: (name: string, avg: string, from: string, to: string) => string
    apply: string
    applied: string
    none: string
    done: string
    later: string
  }
}

export const budgetCloseCopyEn: BudgetCloseCopy = {
  card: {
    title: (month) => `${month} is done`,
    body: 'See how the plan held up and fix what keeps missing.',
    cta: 'Review',
  },
  sheet: {
    title: (month) => `Closing ${month}`,
    planned: 'Planned',
    spent: 'Spent',
    onPlan: 'Right on plan',
    kept: (pct) => `Under plan by ${pct}`,
    over: (amount) => `Over plan by ${amount}`,
    ran: 'Ran over',
    overBy: (name, amount) => `${name} +${amount}`,
    fix: 'Worth fixing',
    raise: (name, months, to) => `${name} went over ${months} months in a row. Raise it to ${to}?`,
    lower: (name, avg, from, to) => `${name} averages ${avg}, well under its ${from}. Lower it to ${to}?`,
    apply: 'Apply',
    applied: 'Applied',
    none: 'Nothing to change. The plan held up.',
    done: 'Done',
    later: 'Not now',
  },
}

export const budgetCloseCopyAr: BudgetCloseCopy = {
  card: {
    title: (month) => `انتهى ${month}`,
    body: 'اطلع على أداء الخطة وأصلح ما يتكرر تجاوزه.',
    cta: 'مراجعة',
  },
  sheet: {
    title: (month) => `إغلاق ${month}`,
    planned: 'المخطط',
    spent: 'المنفق',
    onPlan: 'مطابق للخطة',
    kept: (pct) => `أقل من الخطة بنسبة ${pct}`,
    over: (amount) => `أعلى من الخطة بمقدار ${amount}`,
    ran: 'تجاوزات',
    overBy: (name, amount) => `${name} +${amount}`,
    fix: 'يستحق التعديل',
    raise: (name, months, to) => `${name} تجاوز الحد ${months} أشهر متتالية. رفعه إلى ${to}؟`,
    lower: (name, avg, from, to) => `${name} متوسطه ${avg} وهو أقل بكثير من ${from}. خفضه إلى ${to}؟`,
    apply: 'تطبيق',
    applied: 'تم',
    none: 'لا شيء للتغيير. الخطة صمدت.',
    done: 'تم',
    later: 'لاحقًا',
  },
}
