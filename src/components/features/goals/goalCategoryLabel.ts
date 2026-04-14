import type { Dictionary } from '@/lib/i18n/types'
import type { GoalCategory } from '@/lib/store/types'

/** Maps goal category to `goals` dictionary key for label. */
export function goalCategoryLabelKey(category: GoalCategory): keyof Dictionary['goals'] {
  const m: Record<GoalCategory, keyof Dictionary['goals']> = {
    emergency_fund: 'categoryEmergencyFund',
    house: 'categoryHouse',
    car: 'categoryCar',
    vacation: 'categoryVacation',
    education: 'categoryEducation',
    wedding: 'categoryWedding',
    phone_device: 'categoryPhoneDevice',
    family_support: 'categoryFamilySupport',
    sadaqah_charity: 'categorySadaqahCharity',
    gift: 'categoryGift',
    investment: 'categoryInvestment',
    debt_freedom: 'categoryDebtFreedom',
    quality_of_life: 'categoryQualityOfLife',
    spending_control: 'categorySpendingControl',
    retirement: 'categoryRetirement',
    custom: 'categoryCustom',
  }
  return m[category]
}
