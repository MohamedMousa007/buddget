import { useLocale } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/types'
import type { PreviewEntity, ProposalPattern } from '@/lib/buddgy/tools/proposal'

type StatusTone = 'brand' | 'positive' | 'warn' | 'neutral'

/** Words on the Buddgy action cards. The primary button always names the result. */
export interface BuddgyCardCopy {
  /** Undefined where nothing more specific than the chat's own approve label fits. */
  primary: (a: { tool: string; pattern: ProposalPattern; entity?: PreviewEntity; count?: number; amount?: string }) => string | undefined
  keep: string
  guessed: string
  change: (label: string, value: string) => string
  after: { undone: string; dismissed: string; stale: string; failed: string; tryAgain: string }
  batch: { list: string; note: string; nothing: string; edit: (name: string) => string; remove: (name: string) => string; payFor: (name: string) => string }
  payWith: { label: string; needed: string; guess: string; cash: string; other: string; otherAria: string; ending: (name: string, last4: string) => string }
  category: { label: string; more: string }
  date: { label: string; today: string; yesterday: string; pick: string }
  account: { label: string }
  move: { from: string; to: string; balances: string }
  question: { stillNeed: string; save: string }
  status: Record<string, { from: string; to: string; fromTone: StatusTone; toTone: StatusTone }>
  open: (target: string) => string
}

const en: BuddgyCardCopy = {
  primary: ({ tool, pattern, entity, count = 0, amount }) => {
    if (pattern === 'batch') return count === 0 ? 'Nothing to add' : `Add ${count} ${count === 1 ? 'expense' : 'expenses'}`
    if (pattern === 'move') return amount ? `Move ${amount}` : 'Move money'
    const byTool: Record<string, string> = {
      add_expense: 'Add expense',
      add_income: 'Add income',
      mark_payday_received: 'Log payday',
      add_to_goal: 'Add to goal',
      record_debt_payment: 'Record payment',
      deposit_to_savings: 'Add to savings',
      mark_subscription_paid: 'Mark paid',
      resume_subscription: 'Resume',
      achieve_goal: 'Mark achieved',
      activate_budget_plan: 'Use this plan',
      cancel_subscription: 'Yes, cancel it',
      clear_debt: 'Yes, mark it paid off',
      forget_memory: 'Yes, forget it',
    }
    if (byTool[tool]) return byTool[tool]
    if (pattern === 'create') {
      const byEntity: Record<PreviewEntity, string> = {
        card: 'Add card', account: 'Add account', debt: 'Add debt', plan: 'Add plan', subscription: 'Add subscription',
        goal: 'Add goal', income: 'Add income', holding: 'Add holding', memory: 'Remember this',
      }
      return entity ? byEntity[entity] : undefined
    }
    return undefined
  },
  keep: 'Keep it',
  guessed: 'guessed',
  change: (label, value) => `${label}: ${value}. Change`,
  after: {
    undone: 'Nothing was kept.',
    dismissed: 'Ask me again whenever you like.',
    stale: 'The card waited too long. Ask me again.',
    failed: 'Nothing was changed.',
    tryAgain: 'Try again',
  },
  batch: {
    list: 'Expenses to add',
    note: 'All of them are added, and undone, together.',
    nothing: 'Nothing left to add.',
    edit: (name) => `Edit ${name}`,
    remove: (name) => `Remove ${name}`,
    payFor: (name) => `Paid with? for ${name}`,
  },
  payWith: {
    label: 'Paid with?',
    needed: 'Needed to add it',
    guess: 'Ringed: my best guess.',
    cash: 'Cash',
    other: 'Other',
    otherAria: 'Other payment method, opens the picker',
    ending: (name, last4) => `${name} ending ${last4}`,
  },
  category: { label: 'Category', more: 'More' },
  date: { label: 'When?', today: 'Today', yesterday: 'Yesterday', pick: 'Pick a date' },
  account: { label: 'Which account?' },
  move: { from: 'From', to: 'To', balances: 'Balances now, then after the move.' },
  question: { stillNeed: 'One thing I still need', save: 'Continue' },
  status: {
    resume_subscription: { from: 'Cancelled', to: 'Active', fromTone: 'neutral', toTone: 'positive' },
    achieve_goal: { from: 'In progress', to: 'Achieved', fromTone: 'brand', toTone: 'positive' },
    activate_budget_plan: { from: 'Not in use', to: 'Active', fromTone: 'neutral', toTone: 'positive' },
  },
  open: (target) => `Open ${target}`,
}

const ar: BuddgyCardCopy = {
  primary: ({ tool, pattern, entity, count = 0, amount }) => {
    if (pattern === 'batch') return count === 0 ? 'لا شيء للإضافة' : count === 1 ? 'أضِف مصروفًا واحدًا' : `أضِف ${count} مصروفات`
    if (pattern === 'move') return amount ? `انقل ${amount}` : 'انقل المبلغ'
    const byTool: Record<string, string> = {
      add_expense: 'أضِف المصروف',
      add_income: 'أضِف الدخل',
      mark_payday_received: 'سجّل يوم القبض',
      add_to_goal: 'أضِف للهدف',
      record_debt_payment: 'سجّل الدفعة',
      deposit_to_savings: 'أضِف للمدخرات',
      mark_subscription_paid: 'تم الدفع',
      resume_subscription: 'استئناف',
      achieve_goal: 'تم تحقيقه',
      activate_budget_plan: 'استخدم هذه الخطة',
      cancel_subscription: 'نعم، ألغِه',
      clear_debt: 'نعم، تم سداده',
      forget_memory: 'نعم، انسَه',
    }
    if (byTool[tool]) return byTool[tool]
    if (pattern === 'create') {
      const byEntity: Record<PreviewEntity, string> = {
        card: 'أضِف البطاقة', account: 'أضِف الحساب', debt: 'أضِف الدين', plan: 'أضِف الخطة', subscription: 'أضِف الاشتراك',
        goal: 'أضِف الهدف', income: 'أضِف الدخل', holding: 'أضِف الاستثمار', memory: 'تذكّر هذا',
      }
      return entity ? byEntity[entity] : undefined
    }
    return undefined
  },
  keep: 'خليه',
  guessed: 'تخمين',
  change: (label, value) => `${label}: ${value}. تغيير`,
  after: {
    undone: 'لم يتم الاحتفاظ بشيء.',
    dismissed: 'اسألني تاني في أي وقت.',
    stale: 'الكارت استنى كتير. اسألني تاني.',
    failed: 'لم يتغير شيء.',
    tryAgain: 'حاول تاني',
  },
  batch: {
    list: 'مصروفات للإضافة',
    note: 'تُضاف كلها معًا، ويُتراجع عنها معًا.',
    nothing: 'لا يوجد شيء للإضافة.',
    edit: (name) => `تعديل ${name}`,
    remove: (name) => `إزالة ${name}`,
    payFor: (name) => `دفعت ${name} بإيه؟`,
  },
  payWith: {
    label: 'دفعت بإيه؟',
    needed: 'مطلوب للإضافة',
    guess: 'المحدد: أفضل تخمين عندي.',
    cash: 'كاش',
    other: 'غير ذلك',
    otherAria: 'طريقة دفع أخرى، يفتح القائمة',
    ending: (name, last4) => `${name} المنتهية بـ ${last4}`,
  },
  category: { label: 'الفئة', more: 'المزيد' },
  date: { label: 'إمتى؟', today: 'النهارده', yesterday: 'امبارح', pick: 'اختر تاريخ' },
  account: { label: 'أي حساب؟' },
  move: { from: 'من', to: 'إلى', balances: 'الرصيد الآن، ثم بعد النقل.' },
  question: { stillNeed: 'حاجة واحدة لسه محتاجها', save: 'متابعة' },
  status: {
    resume_subscription: { from: 'ملغي', to: 'نشط', fromTone: 'neutral', toTone: 'positive' },
    achieve_goal: { from: 'جارٍ', to: 'تحقق', fromTone: 'brand', toTone: 'positive' },
    activate_budget_plan: { from: 'غير مستخدمة', to: 'نشطة', fromTone: 'neutral', toTone: 'positive' },
  },
  open: (target) => `افتح ${target}`,
}

export const buddgyCardCopy: Record<Locale, BuddgyCardCopy> = { en, ar }

export function useBuddgyCardCopy(): BuddgyCardCopy {
  return buddgyCardCopy[useLocale().locale]
}
