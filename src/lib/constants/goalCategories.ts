export const GOAL_CATEGORIES = [
  { value: 'emergency_fund', emoji: '🛡️', label: 'Emergency fund' },
  { value: 'house', emoji: '🏠', label: 'House / Property' },
  { value: 'car', emoji: '🚗', label: 'Car' },
  { value: 'vacation', emoji: '✈️', label: 'Vacation' },
  { value: 'education', emoji: '📚', label: 'Education / Course' },
  { value: 'wedding', emoji: '💍', label: 'Wedding' },
  { value: 'phone_device', emoji: '📱', label: 'Phone / Device' },
  { value: 'family_support', emoji: '👨‍👩‍👧‍👦', label: 'Family support' },
  { value: 'sadaqah_charity', emoji: '🤲', label: 'Sadaqah / Charity' },
  { value: 'gift', emoji: '🎁', label: 'Gift for someone' },
  { value: 'investment', emoji: '📈', label: 'Build investments' },
  { value: 'debt_freedom', emoji: '🔓', label: 'Become debt-free' },
  { value: 'quality_of_life', emoji: '⭐', label: 'Quality life + savings' },
  { value: 'spending_control', emoji: '📉', label: 'Control spending' },
  { value: 'retirement', emoji: '🏖️', label: 'Retirement' },
  { value: 'custom', emoji: '✏️', label: 'Custom goal' },
] as const

export type GoalCategoryConst = (typeof GOAL_CATEGORIES)[number]['value']
