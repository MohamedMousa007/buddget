import type { GoalCategory } from '@/lib/store/types'

/** Display catalogues that used to be English-only. Stored values stay as saved; these are what the user reads. */
export interface CatalogCopy {
  goalNames: Record<GoalCategory, string>
  creditCardGoalName: string
  goalPocketName: (goalName: string) => string
}

export const catalogCopyEn: CatalogCopy = {
  goalNames: {
    emergency_fund: 'Emergency Fund',
    house: 'House Down Payment',
    car: 'New Car',
    vacation: 'Vacation',
    education: 'Education',
    wedding: 'Wedding',
    phone_device: 'Phone / Device',
    family_support: 'Family Support',
    sadaqah_charity: 'Sadaqah',
    gift: 'Gift',
    investment: 'Investments',
    debt_freedom: 'Debt Freedom',
    quality_of_life: 'Quality of Life',
    spending_control: 'Spending Control',
    retirement: 'Retirement',
    business: 'Business',
    custom: 'My Goal',
  },
  creditCardGoalName: 'Credit card',
  goalPocketName: (n) => `${n} pocket`,
}

export const catalogCopyAr: CatalogCopy = {
  goalNames: {
    emergency_fund: 'صندوق الطوارئ',
    house: 'دفعة مقدمة لمنزل',
    car: 'سيارة جديدة',
    vacation: 'إجازة',
    education: 'التعليم',
    wedding: 'الزواج',
    phone_device: 'هاتف / جهاز',
    family_support: 'دعم الأسرة',
    sadaqah_charity: 'صدقة',
    gift: 'هدية',
    investment: 'الاستثمار',
    debt_freedom: 'التحرر من الديون',
    quality_of_life: 'جودة الحياة',
    spending_control: 'ضبط الإنفاق',
    retirement: 'التقاعد',
    business: 'مشروع',
    custom: 'هدفي',
  },
  creditCardGoalName: 'بطاقة ائتمان',
  goalPocketName: (n) => `جيب ${n}`,
}
