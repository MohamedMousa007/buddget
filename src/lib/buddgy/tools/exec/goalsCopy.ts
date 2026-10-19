import type { BuddgyLocale } from '@/lib/buddgy/protocol'
import { getServerDictionary } from '@/lib/i18n/getServerDictionary'
import { goalCategoryLabelKey } from '@/components/features/goals/goalCategoryLabel'
import type { GoalCategory, GoalFundingMode } from '@/lib/store/types'

interface Labels {
  addGoal: string
  changeGoal: string
  fundGoal: string
  achieveGoal: string
  deleteGoal: string
  name: string
  target: string
  saved: string
  category: string
  date: string
  funding: string
  share: string
  monthly: string
  amount: string
  source: string
  pocket: string
  modes: Record<GoalFundingMode, string>
  sources: { allocate: string; declare: string }
  allocateEffect: (amount: string) => string
  declareEffect: string
  newPocket: (name: string) => string
  willAchieve: string
  keepPocket: string
  noPocket: string
  duplicate: string
  limit: string
}

const EN: Labels = {
  addGoal: 'New goal',
  changeGoal: 'Change goal',
  fundGoal: 'Add money to goal',
  achieveGoal: 'Mark goal achieved',
  deleteGoal: 'Delete goal',
  name: 'Name',
  target: 'Target',
  saved: 'Saved',
  category: 'Category',
  date: 'Target date',
  funding: 'Funding',
  share: 'Share of savings',
  monthly: 'Monthly amount',
  amount: 'Amount',
  source: 'Money from',
  pocket: 'Pocket',
  modes: { share: 'A share of my savings', fixed: 'Fixed amount', manual: 'Manual' },
  sources: { allocate: 'This month’s budget', declare: 'Money I already had' },
  allocateEffect: (a) => `Left to spend drops by ${a}.`,
  declareEffect: 'Net worth rises. Left to spend does not change.',
  newPocket: (n) => `A pocket "${n}" is created to hold the savings.`,
  willAchieve: 'This reaches the target, so the goal counts as achieved.',
  keepPocket: 'Only the goal is removed. Its pocket and balance stay in Wealth.',
  noPocket: 'Only the goal is removed. Your accounts are not touched.',
  duplicate: 'You already have a goal with this name.',
  limit: 'Monthly limit',
}

const AR: Labels = {
  addGoal: 'هدف جديد',
  changeGoal: 'تعديل هدف',
  fundGoal: 'إضافة مال إلى هدف',
  achieveGoal: 'تحديد الهدف كمحقَّق',
  deleteGoal: 'حذف هدف',
  name: 'الاسم',
  target: 'المبلغ المستهدف',
  saved: 'المدخَّر',
  category: 'الفئة',
  date: 'تاريخ الهدف',
  funding: 'طريقة التمويل',
  share: 'نسبة من الادخار',
  monthly: 'المبلغ الشهري',
  amount: 'المبلغ',
  source: 'مصدر المال',
  pocket: 'المحفظة',
  modes: { share: 'نسبة من ادخاري', fixed: 'مبلغ ثابت', manual: 'يدوي' },
  sources: { allocate: 'ميزانية هذا الشهر', declare: 'مال كان معي من قبل' },
  allocateEffect: (a) => `يقلّ المتبقي للصرف بمقدار ${a}.`,
  declareEffect: 'ترتفع ثروتك الصافية ولا يتغيّر المتبقي للصرف.',
  newPocket: (n) => `سيتم إنشاء محفظة "${n}" لحفظ المدخرات.`,
  willAchieve: 'بهذا يتحقق المبلغ المستهدف فيُعدّ الهدف محقَّقًا.',
  keepPocket: 'يُحذف الهدف فقط. تبقى محفظته ورصيدها في الثروة.',
  noPocket: 'يُحذف الهدف فقط. حساباتك لا تتأثر.',
  duplicate: 'لديك هدف بهذا الاسم بالفعل.',
  limit: 'الحد الشهري',
}

export const goalLabels = (locale: BuddgyLocale): Labels => (locale === 'ar' ? AR : EN)

export const goalCategoryName = (locale: BuddgyLocale, category: GoalCategory): string =>
  getServerDictionary(locale).goals[goalCategoryLabelKey(category)] as string
