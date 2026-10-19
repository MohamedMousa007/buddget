import type { BudgetBlock } from '@/lib/store/types'
import type { BuildTemplate } from '@/lib/budget/templates'

/** Copy for the manual builder. Money arrives pre-formatted. */
export interface BudgetBuilderCopy {
  title: string
  subtitle: (name: string) => string
  saveDraft: string
  back: string
  close: string
  blockOf: (n: number, total: number) => string
  linkedNote: string
  stepLabel: (block: string, state: 'done' | 'current' | 'todo') => string
  blockHints: Record<BudgetBlock, string>
  capsule: { left: string; balanced: string; over: string; notPlanned: (pct: string) => string; overBy: (pct: string) => string; toBuffer: string }
  found: string
  foundEmpty: string
  linkedFromPage: string
  due: (day: string) => string
  noDue: string
  remove: (name: string) => string
  amountOf: (name: string) => string
  addLine: (block: string) => string
  next: string
  previous: string
  finish: string
  empty: string
  start: { title: string; sub: string; blank: string; templates: Record<BuildTemplate, { name: string; sub: string }> }
  needIncome: string
  readyToast: string
}

const hintsEn: Record<BudgetBlock, string> = {
  bills: 'Rent, utilities, phone, insurance',
  subscriptions: 'Filled from your subscriptions',
  debts: 'Filled from your debts',
  everyday: 'Groceries, transport, fun',
  safety: 'Money set aside for surprises',
  goals: 'Filled from your goals',
  grow: 'Investing, giving, buffer',
}

export const budgetBuilderCopyEn: BudgetBuilderCopy = {
  title: 'Build your plan',
  subtitle: (name) => `${name} · manual`,
  saveDraft: 'Save draft',
  back: 'Back',
  close: 'Close builder',
  blockOf: (n, total) => `Block ${n} of ${total}`,
  linkedNote: 'Subscriptions, Debts and Goals are filled from your linked pages',
  stepLabel: (block, state) => `${block}, ${state === 'done' ? 'done' : state === 'current' ? 'current' : 'to do'}`,
  blockHints: hintsEn,
  capsule: {
    left: 'Left to assign',
    balanced: 'Every dirham has a place',
    over: 'Over-assigned',
    notPlanned: (pct) => `${pct} not planned`,
    overBy: (pct) => `${pct} over income`,
    toBuffer: 'Send to buffer',
  },
  found: 'Found for you · tap to add',
  foundEmpty: 'Nothing found here. Add a line yourself.',
  linkedFromPage: 'Linked',
  due: (day) => `Due ${day}`,
  noDue: 'Set due day',
  remove: (name) => `Remove ${name}`,
  amountOf: (name) => `${name} amount`,
  addLine: (block) => `Add to ${block}`,
  next: 'Next block',
  previous: 'Back',
  finish: 'Review & activate',
  empty: 'No lines yet in this block.',
  start: {
    title: 'Start from',
    sub: 'Fill every block at once, then adjust. Or start empty.',
    blank: 'Empty',
    templates: {
      mine: { name: 'From my numbers', sub: 'Your income, bills and last 3 months of spending' },
      essentials: { name: 'Essentials first', sub: 'Needs covered, the rest split evenly' },
      debt: { name: 'Debt crusher', sub: 'Spare money aimed at your costliest debt' },
      saver: { name: 'Saver', sub: 'Save hard, spend what is left' },
    },
  },
  needIncome: 'Add your income under Flow first. Templates are sized on it.',
  readyToast: 'Plan ready',
}

export const budgetBuilderCopyAr: BudgetBuilderCopy = {
  title: 'ابنِ خطتك',
  subtitle: (name) => `${name} · يدوي`,
  saveDraft: 'حفظ كمسودة',
  back: 'رجوع',
  close: 'إغلاق المنشئ',
  blockOf: (n, total) => `القسم ${n} من ${total}`,
  linkedNote: 'الاشتراكات والديون والأهداف تُملأ من صفحاتها',
  stepLabel: (block, state) => `${block}، ${state === 'done' ? 'تم' : state === 'current' ? 'الحالي' : 'قادم'}`,
  blockHints: {
    bills: 'الإيجار والمرافق والهاتف والتأمين',
    subscriptions: 'تُملأ من اشتراكاتك',
    debts: 'تُملأ من ديونك',
    everyday: 'البقالة والمواصلات والترفيه',
    safety: 'مبلغ للطوارئ',
    goals: 'تُملأ من أهدافك',
    grow: 'الاستثمار والعطاء والاحتياطي',
  },
  capsule: {
    left: 'المتبقي للتوزيع',
    balanced: 'كل درهم له مكان',
    over: 'تجاوزت الدخل',
    notPlanned: (pct) => `${pct} غير مخطط`,
    overBy: (pct) => `${pct} فوق الدخل`,
    toBuffer: 'أرسله إلى الاحتياطي',
  },
  found: 'وجدناها لك · اضغط للإضافة',
  foundEmpty: 'لا شيء هنا. أضف بندًا بنفسك.',
  linkedFromPage: 'مرتبط',
  due: (day) => `يستحق ${day}`,
  noDue: 'حدد يوم الاستحقاق',
  remove: (name) => `حذف ${name}`,
  amountOf: (name) => `مبلغ ${name}`,
  addLine: (block) => `أضف إلى ${block}`,
  next: 'القسم التالي',
  previous: 'رجوع',
  finish: 'مراجعة وتفعيل',
  empty: 'لا بنود في هذا القسم بعد.',
  start: {
    title: 'ابدأ من',
    sub: 'املأ كل الأقسام دفعة واحدة ثم عدّل. أو ابدأ فارغًا.',
    blank: 'فارغ',
    templates: {
      mine: { name: 'من أرقامي', sub: 'دخلك وفواتيرك وإنفاق آخر 3 أشهر' },
      essentials: { name: 'الأساسيات أولًا', sub: 'تغطية الاحتياجات وتقسيم الباقي' },
      debt: { name: 'سحق الديون', sub: 'الفائض يذهب لأغلى دين' },
      saver: { name: 'مدّخر', sub: 'ادخر بقوة وأنفق ما تبقى' },
    },
  },
  needIncome: 'أضف دخلك من صفحة التدفق أولًا. القوالب تعتمد عليه.',
  readyToast: 'الخطة جاهزة',
}
