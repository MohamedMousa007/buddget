/** Copy for the plan deck, the activation sheet and the plan history screen. Money and dates arrive pre-formatted. */
export interface BudgetDeckCopy {
  deck: {
    title: string
    intent: { balanced: string; saver: string; debt_crusher: string; custom: string }
    active: string
    activeSince: (month: string) => string
    ready: string
    draft: string
    archived: string
    income: string
    savingsRate: string
    lines: (n: number) => string
    newPlan: string
    newPlanSub: string
    setActive: string
    duplicate: string
    history: string
    more: string
    rename: string
    delete: string
    renamePlaceholder: string
    alreadyActive: (name: string) => string
    deleteTitle: (name: string) => string
    deleteBody: string
    deleteConfirm: string
    cardLabel: (name: string, state: string) => string
    open: string
    close: string
  }
  activate: {
    title: (name: string) => string
    activeNow: string
    rows: { savingsRate: string; everyday: string; extraPayoff: string }
    pointsMore: (n: string) => string
    pointsLess: (n: string) => string
    moreToSpend: (amount: string) => string
    lessToSpend: (amount: string) => string
    more: (amount: string) => string
    less: (amount: string) => string
    same: string
    noteTitle: string
    noteBody: (month: string) => string
    hint: string
    confirm: string
    cancel: string
    done: (name: string) => string
    undo: string
  }
  compare: {
    title: string
    a: string
    b: string
    total: string
    blocks: string
    differs: string
    onlyIn: (name: string) => string
    match: string
    close: string
    action: string
  }
  history: {
    title: string
    back: string
    readOnly: string
    intro: string
    current: string
    past: string
    appliesToEvery: string
    monthsCovers: string
    monthsCovered: string
    onward: (month: string) => string
    untilYouSwitch: string
    dayOf: (day: number, total: number) => string
    switched: (date: string) => string
    switchedSub: (from: string, to: string) => string
    firstPlan: (date: string) => string
    range: (from: string, to: string) => string
    duplicate: string
    view: string
    onPlan: string
    kept: (percent: number) => string
    over: (amount: string) => string
    empty: string
    emptySub: string
  }
}

export const budgetDeckCopyEn: BudgetDeckCopy = {
  deck: {
    title: 'Your budgets',
    intent: { balanced: 'Balanced', saver: 'Saver', debt_crusher: 'Debt crusher', custom: 'Custom' },
    active: 'Active',
    activeSince: (m) => `Active since ${m}`,
    ready: 'Ready',
    draft: 'Draft',
    archived: 'Archived',
    income: 'Income',
    savingsRate: 'Savings rate',
    lines: (n) => (n === 1 ? '1 line' : `${n} lines`),
    newPlan: 'New plan',
    newPlanSub: 'Start fresh, with a template, or copy one',
    setActive: 'Set active',
    duplicate: 'Duplicate',
    history: 'History',
    more: 'More',
    rename: 'Rename',
    delete: 'Delete',
    renamePlaceholder: 'Budget name',
    alreadyActive: (name) => `${name} applies to every month until you switch`,
    deleteTitle: (name) => `Delete ${name}?`,
    deleteBody: 'This budget and its lines are removed. This cannot be undone.',
    deleteConfirm: 'Delete',
    cardLabel: (name, state) => `${name}, ${state}`,
    open: 'Show your budgets',
    close: 'Hide your budgets',
  },
  activate: {
    title: (name) => `Make ${name} your active plan?`,
    activeNow: 'Active now',
    rows: { savingsRate: 'Savings rate', everyday: 'Everyday spending', extraPayoff: 'Extra payoff each month' },
    pointsMore: (n) => `${n} points more`,
    pointsLess: (n) => `${n} points less`,
    moreToSpend: (a) => `${a} more to spend`,
    lessToSpend: (a) => `${a} less to spend`,
    more: (a) => `${a} more`,
    less: (a) => `${a} less`,
    same: 'No change',
    noteTitle: 'What changes',
    noteBody: (month) => `It takes over ${month} and every month after. Earlier months stay with the plans that were active then.`,
    hint: 'You can switch back anytime. Every switch is saved in Plan history.',
    confirm: 'Make active',
    cancel: 'Cancel',
    done: (name) => `${name} is now active`,
    undo: 'Undo',
  },
  compare: {
    title: 'Compare budgets',
    a: 'Budget A',
    b: 'Budget B',
    total: 'Planned total',
    blocks: 'By block',
    differs: 'What differs',
    onlyIn: (name) => `Only in ${name}`,
    match: 'These two budgets have the same lines and amounts.',
    close: 'Close',
    action: 'Compare',
  },
  history: {
    title: 'Plan history',
    back: 'Back to Budget',
    readOnly: 'Read only',
    intro: 'Each month uses the plan that was active then. Past months never change.',
    current: 'Current',
    past: 'Past',
    appliesToEvery: 'Applies to every month',
    monthsCovers: 'Months it covers',
    monthsCovered: 'Months it covered',
    onward: (m) => `${m} onward`,
    untilYouSwitch: 'Until you switch',
    dayOf: (d, n) => `Day ${d} of ${n}`,
    switched: (date) => `Switched on ${date}`,
    switchedSub: (from, to) => `${from} to ${to}`,
    firstPlan: (date) => `First plan created ${date}`,
    range: (from, to) => `${from} to ${to}`,
    duplicate: 'Duplicate',
    view: 'View',
    onPlan: 'On plan',
    kept: (p) => `Under plan by ${p}%`,
    over: (a) => `Over by ${a}`,
    empty: 'No history yet',
    emptySub: 'Your first switch between budgets is recorded here.',
  },
}

export const budgetDeckCopyAr: BudgetDeckCopy = {
  deck: {
    title: 'ميزانياتك',
    intent: { balanced: 'متوازنة', saver: 'ادخار', debt_crusher: 'سداد الديون', custom: 'مخصصة' },
    active: 'نشطة',
    activeSince: (m) => `نشطة منذ ${m}`,
    ready: 'جاهزة',
    draft: 'مسودة',
    archived: 'مؤرشفة',
    income: 'الدخل',
    savingsRate: 'معدل الادخار',
    lines: (n) => (n === 1 ? 'بند واحد' : n === 2 ? 'بندان' : n <= 10 ? `${n} بنود` : `${n} بندًا`),
    newPlan: 'خطة جديدة',
    newPlanSub: 'ابدأ من الصفر أو من قالب أو انسخ خطة',
    setActive: 'تعيين كنشطة',
    duplicate: 'نسخ',
    history: 'السجل',
    more: 'المزيد',
    rename: 'إعادة تسمية',
    delete: 'حذف',
    renamePlaceholder: 'اسم الميزانية',
    alreadyActive: (name) => `${name} تُطبَّق على كل شهر حتى تبدّلها`,
    deleteTitle: (name) => `حذف ${name}؟`,
    deleteBody: 'سيتم حذف هذه الميزانية وبنودها. لا يمكن التراجع.',
    deleteConfirm: 'حذف',
    cardLabel: (name, state) => `${name}، ${state}`,
    open: 'إظهار ميزانياتك',
    close: 'إخفاء ميزانياتك',
  },
  activate: {
    title: (name) => `هل تجعل ${name} خطتك النشطة؟`,
    activeNow: 'النشطة الآن',
    rows: { savingsRate: 'معدل الادخار', everyday: 'الإنفاق اليومي', extraPayoff: 'سداد إضافي شهرياً' },
    pointsMore: (n) => `أعلى بـ ${n} نقطة`,
    pointsLess: (n) => `أقل بـ ${n} نقطة`,
    moreToSpend: (a) => `${a} إضافية للإنفاق`,
    lessToSpend: (a) => `${a} أقل للإنفاق`,
    more: (a) => `${a} أكثر`,
    less: (a) => `${a} أقل`,
    same: 'لا تغيير',
    noteTitle: 'ما الذي يتغير',
    noteBody: (month) => `تتولى ${month} وكل شهر بعده. تبقى الأشهر السابقة مع الخطط التي كانت نشطة حينها.`,
    hint: 'يمكنك الرجوع في أي وقت. يُحفظ كل تبديل في سجل الخطط.',
    confirm: 'تعيين كنشطة',
    cancel: 'إلغاء',
    done: (name) => `${name} هي الآن النشطة`,
    undo: 'تراجع',
  },
  compare: {
    title: 'مقارنة الميزانيات',
    a: 'الميزانية أ',
    b: 'الميزانية ب',
    total: 'الإجمالي المخطط',
    blocks: 'حسب القسم',
    differs: 'ما الذي يختلف',
    onlyIn: (name) => `فقط في ${name}`,
    match: 'الميزانيتان متطابقتان في البنود والمبالغ.',
    close: 'إغلاق',
    action: 'مقارنة',
  },
  history: {
    title: 'سجل الخطط',
    back: 'العودة إلى الميزانية',
    readOnly: 'للقراءة فقط',
    intro: 'كل شهر يستخدم الخطة التي كانت نشطة حينها. الأشهر السابقة لا تتغير أبداً.',
    current: 'الحالية',
    past: 'سابقة',
    appliesToEvery: 'تُطبَّق على كل شهر',
    monthsCovers: 'الأشهر التي تغطيها',
    monthsCovered: 'الأشهر التي غطتها',
    onward: (m) => `من ${m} فصاعداً`,
    untilYouSwitch: 'حتى تبدّل',
    dayOf: (d, n) => `اليوم ${d} من ${n}`,
    switched: (date) => `تم التبديل في ${date}`,
    switchedSub: (from, to) => `من ${from} إلى ${to}`,
    firstPlan: (date) => `أُنشئت أول خطة في ${date}`,
    range: (from, to) => `من ${from} إلى ${to}`,
    duplicate: 'نسخ',
    view: 'عرض',
    onPlan: 'ضمن الخطة',
    kept: (p) => `أقل من الخطة بـ ${p}%`,
    over: (a) => `تجاوز بـ ${a}`,
    empty: 'لا يوجد سجل بعد',
    emptySub: 'يُسجَّل هنا أول تبديل بين الميزانيات.',
  },
}
