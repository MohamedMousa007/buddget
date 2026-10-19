import type { RejectReason } from '@/lib/budget/ops'
import { budgetChromeCopyAr, budgetChromeCopyEn } from '@/lib/i18n/budgetPage/chromeCopy'
import { budgetStudioCopyAr, budgetStudioCopyEn } from '@/lib/i18n/budgetPage/studioCopy'
import type { BudgetBlock } from '@/lib/store/types'
import type { ToolContext } from '@/lib/buddgy/tools/types'

const EN = {
  adjustBudget: 'Adjust budget',
  switchPlan: (name: string) => `Switch to ${name}`,
  deletePlan: (name: string) => `Delete ${name}`,
  skipped: 'Skipped',
  locked: 'Locked',
  unlocked: 'Unlocked',
  removed: 'Removed',
  renamed: 'Renamed',
  block: 'Block',
  plan: 'Plan',
  planned: 'Planned',
  leftToAssign: 'Left to assign',
  savingsRate: 'Savings rate',
  lines: 'Lines',
  undoable: 'You can undo this right after.',
  becomesActive: (name: string) => `${name} becomes the active plan.`,
  noActive: 'No plan will be active.',
  stale: 'The budget changed since this was proposed. Ask again.',
  planGone: 'That plan no longer exists.',
  reasons: {
    unknown: 'line not found',
    locked: 'line is locked',
    linked: 'line is linked to debts, goals or subscriptions',
    invalid: 'not a valid change',
    duplicate: 'name already used',
  } satisfies Record<RejectReason, string>,
}

const AR: typeof EN = {
  adjustBudget: 'تعديل الميزانية',
  switchPlan: (name) => `التبديل إلى ${name}`,
  deletePlan: (name) => `حذف ${name}`,
  skipped: 'تم تخطيه',
  locked: 'مقفل',
  unlocked: 'غير مقفل',
  removed: 'محذوف',
  renamed: 'إعادة تسمية',
  block: 'القسم',
  plan: 'الخطة',
  planned: 'المخطط',
  leftToAssign: 'المتبقي للتوزيع',
  savingsRate: 'نسبة الادخار',
  lines: 'البنود',
  undoable: 'يمكنك التراجع عن هذا الحذف مباشرة بعد تنفيذه.',
  becomesActive: (name) => `تصبح ${name} الخطة النشطة.`,
  noActive: 'لن تكون هناك خطة نشطة.',
  stale: 'تغيّرت الميزانية منذ هذا الاقتراح. اطلب التعديل مرة أخرى.',
  planGone: 'هذه الخطة لم تعد موجودة.',
  reasons: {
    unknown: 'البند غير موجود',
    locked: 'البند مقفل',
    linked: 'البند مرتبط بالديون أو الأهداف أو الاشتراكات',
    invalid: 'تغيير غير صالح',
    duplicate: 'الاسم مستخدم بالفعل',
  },
}

export const budgetLabels = (locale: ToolContext['locale']) => (locale === 'ar' ? AR : EN)

export const blockName = (locale: ToolContext['locale'], block: BudgetBlock): string =>
  (locale === 'ar' ? budgetChromeCopyAr : budgetChromeCopyEn).blocks[block].name

export const balanceCopy = (locale: ToolContext['locale']) => (locale === 'ar' ? budgetStudioCopyAr : budgetStudioCopyEn).adjust
