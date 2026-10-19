import type { BudgetBlock } from '@/lib/store/types'

/**
 * Copy for the Budget v2 line, add-line and plan-list sheets.
 * Amounts arrive pre-formatted: this file never formats a number.
 */
export interface BudgetSheetsCopy {
  common: { save: string; cancel: string; close: string }
  blocks: Record<BudgetBlock, string>
  line: {
    amountLabel: string
    ofIncome: (pct: string) => string
    whyTitle: string
    confidenceHigh: string
    confidenceEstimated: string
    essential: string
    essentialSub: string
    lock: string
    lockSub: string
    dueDay: string
    dueDayValue: (n: number) => string
    linkedNote: string
    updateToLive: (amount: string) => string
    countsCategories: string
    noCategories: string
    deleteLine: string
    deleteTitle: (name: string) => string
    deleteBody: string
    deleteConfirm: string
    nameLabel: string
  }
  add: {
    title: (block: string) => string
    name: string
    namePlaceholder: string
    amount: string
    dueDay: string
    essential: string
    suggestions: string
    icon: string
    add: string
  }
  plans: {
    title: string
    lines: (n: number) => string
    active: string
    draft: string
    archived: string
    setActive: string
    rename: string
    duplicate: string
    delete: string
    new: string
    empty: string
    renamePlaceholder: string
    deleteTitle: (name: string) => string
    deleteBody: string
    deleteConfirm: string
    more: (name: string) => string
  }
}

export const budgetSheetsCopyEn: BudgetSheetsCopy = {
  common: { save: 'Save', cancel: 'Cancel', close: 'Close' },
  blocks: {
    bills: 'Bills',
    subscriptions: 'Subscriptions',
    debts: 'Debts',
    everyday: 'Everyday',
    safety: 'Safety net',
    goals: 'Goals',
    grow: 'Grow',
  },
  line: {
    amountLabel: 'Monthly amount',
    ofIncome: (pct) => `${pct} of income`,
    whyTitle: 'Why Buddgy sized it',
    confidenceHigh: 'High',
    confidenceEstimated: 'Estimated',
    essential: 'Essential',
    essentialSub: 'Counts toward your safety-net target',
    lock: 'Lock from Buddgy',
    lockSub: 'Buddgy will not change this amount',
    dueDay: 'Due day',
    dueDayValue: (n) => `Day ${n}`,
    linkedNote: 'This amount follows live data. Change it where it comes from.',
    updateToLive: (amount) => `Update to live value, ${amount}`,
    countsCategories: 'Counts these ledger categories',
    noCategories: 'Matched by the line name',
    deleteLine: 'Delete line',
    deleteTitle: (name) => `Delete ${name}?`,
    deleteBody: 'The line leaves this budget. Your transactions stay as they are.',
    deleteConfirm: 'Delete',
    nameLabel: 'Name',
  },
  add: {
    title: (block) => `Add to ${block}`,
    name: 'Name',
    namePlaceholder: 'e.g. Internet',
    amount: 'Monthly amount',
    dueDay: 'Due day',
    essential: 'Essential',
    suggestions: 'Quick picks',
    icon: 'Icon',
    add: 'Add line',
  },
  plans: {
    title: 'Your budgets',
    lines: (n) => (n === 1 ? '1 line' : `${n} lines`),
    active: 'Active',
    draft: 'Draft',
    archived: 'Archived',
    setActive: 'Make active',
    rename: 'Rename',
    duplicate: 'Duplicate',
    delete: 'Delete',
    new: 'New budget',
    empty: 'No budgets yet.',
    renamePlaceholder: 'Budget name',
    deleteTitle: (name) => `Delete ${name}?`,
    deleteBody: 'This budget and its lines are removed. This cannot be undone.',
    deleteConfirm: 'Delete',
    more: (name) => `Actions for ${name}`,
  },
}

export const budgetSheetsCopyAr: BudgetSheetsCopy = {
  common: { save: 'حفظ', cancel: 'إلغاء', close: 'إغلاق' },
  blocks: {
    bills: 'الفواتير',
    subscriptions: 'الاشتراكات',
    debts: 'الديون',
    everyday: 'اليومي',
    safety: 'شبكة الأمان',
    goals: 'الأهداف',
    grow: 'النمو',
  },
  line: {
    amountLabel: 'المبلغ الشهري',
    ofIncome: (pct) => `${pct} من الدخل`,
    whyTitle: 'لماذا حدد بادجي هذا المبلغ',
    confidenceHigh: 'عالية',
    confidenceEstimated: 'تقديرية',
    essential: 'أساسي',
    essentialSub: 'يُحتسب ضمن هدف شبكة الأمان',
    lock: 'قفل أمام بادجي',
    lockSub: 'لن يغيّر بادجي هذا المبلغ',
    dueDay: 'يوم الاستحقاق',
    dueDayValue: (n) => `اليوم ${n}`,
    linkedNote: 'هذا المبلغ مرتبط ببيانات حيّة. عدّله من مصدره.',
    updateToLive: (amount) => `التحديث إلى القيمة الحالية، ${amount}`,
    countsCategories: 'يحتسب فئات دفتر المعاملات التالية',
    noCategories: 'يُطابَق باسم البند',
    deleteLine: 'حذف البند',
    deleteTitle: (name) => `حذف ${name}؟`,
    deleteBody: 'سيُزال البند من هذه الميزانية. تبقى معاملاتك كما هي.',
    deleteConfirm: 'حذف',
    nameLabel: 'الاسم',
  },
  add: {
    title: (block) => `إضافة إلى ${block}`,
    name: 'الاسم',
    namePlaceholder: 'مثال: الإنترنت',
    amount: 'المبلغ الشهري',
    dueDay: 'يوم الاستحقاق',
    essential: 'أساسي',
    suggestions: 'اختيارات سريعة',
    icon: 'الأيقونة',
    add: 'إضافة بند',
  },
  plans: {
    title: 'ميزانياتك',
    lines: (n) => (n === 1 ? 'بند واحد' : n === 2 ? 'بندان' : n <= 10 ? `${n} بنود` : `${n} بندًا`),
    active: 'نشطة',
    draft: 'مسودة',
    archived: 'مؤرشفة',
    setActive: 'تعيين كنشطة',
    rename: 'إعادة تسمية',
    duplicate: 'تكرار',
    delete: 'حذف',
    new: 'ميزانية جديدة',
    empty: 'لا توجد ميزانيات بعد.',
    renamePlaceholder: 'اسم الميزانية',
    deleteTitle: (name) => `حذف ${name}؟`,
    deleteBody: 'ستُحذف هذه الميزانية وبنودها. لا يمكن التراجع عن ذلك.',
    deleteConfirm: 'حذف',
    more: (name) => `إجراءات ${name}`,
  },
}
