/** Pinned emoji + label for Budget Planner "Add category" (no generic "Other"). */
export interface BudgetPlannerPresetCategory {
  icon: string
  label: string
}

export const PREDEFINED_BUDGET_CATEGORIES: BudgetPlannerPresetCategory[] = [
  { icon: '🏠', label: 'Rent' },
  { icon: '🚗', label: 'Transport' },
  { icon: '🍕', label: 'Food' },
  { icon: '🛒', label: 'Groceries' },
  { icon: '🍔', label: 'Dining Out' },
  { icon: '☕', label: 'Coffee' },
  { icon: '💡', label: 'Utilities' },
  { icon: '📱', label: 'Subscriptions' },
  { icon: '💊', label: 'Healthcare' },
  { icon: '📚', label: 'Education' },
  { icon: '👗', label: 'Clothing' },
  { icon: '💪', label: 'Gym & Fitness' },
  { icon: '✈️', label: 'Travel' },
  { icon: '🔧', label: 'Car Maintenance' },
  { icon: '🛡️', label: 'Insurance' },
  { icon: '🎁', label: 'Gifts & Occasions' },
  { icon: '👶', label: 'Kids & Family' },
  { icon: '🐾', label: 'Pets' },
  { icon: '🧴', label: 'Personal Care' },
  { icon: '🔨', label: 'Home Maintenance' },
  { icon: '💼', label: 'Business & Work' },
  { icon: '📈', label: 'Investments' },
  { icon: '💸', label: 'Remittance' },
  { icon: '💳', label: 'Debt' },
  { icon: '💰', label: 'Savings' },
  { icon: '🤲', label: 'Charity & Donations' },
  { icon: '📡', label: 'Phone & Internet' },
  { icon: '🎮', label: 'Gaming' },
  { icon: '📖', label: 'Books & Media' },
  { icon: '🎨', label: 'Hobbies' },
  { icon: '🧾', label: 'Taxes' },
  { icon: '🎬', label: 'Entertainment' },
  { icon: '🎵', label: 'Music' },
  { icon: '🏖️', label: 'Vacation' },
  { icon: '🏥', label: 'Medical' },
  { icon: '🚌', label: 'Public Transport' },
  { icon: '⛽', label: 'Fuel' },
  { icon: '🎯', label: 'Goals' },
  { icon: '🏦', label: 'Banking Fees' },
  { icon: '🍼', label: 'Baby Expenses' },
]

const PRESET_LABELS_LOWER = new Set(
  PREDEFINED_BUDGET_CATEGORIES.map((p) => p.label.trim().toLowerCase())
)

export function isPredefinedCategoryName(name: string): boolean {
  return PRESET_LABELS_LOWER.has(name.trim().toLowerCase())
}

export function presetForCategoryName(name: string): BudgetPlannerPresetCategory | undefined {
  const key = name.trim().toLowerCase()
  return PREDEFINED_BUDGET_CATEGORIES.find((p) => p.label.toLowerCase() === key)
}

export function categoryNameAlreadyInPlan(name: string, categories: { name: string }[]): boolean {
  const key = name.trim().toLowerCase()
  if (!key) return false
  return categories.some((c) => c.name.trim().toLowerCase() === key)
}

/** Semicolon-separated list for AI / preset prompts. */
export function predefinedBudgetCategoryLabelsForPrompt(): string {
  return PREDEFINED_BUDGET_CATEGORIES.map((p) => `${p.icon} ${p.label}`).join('; ')
}

export const EMOJI_PICKER_GROUPS: { title: string; emojis: string[] }[] = [
  { title: 'Home & Bills', emojis: ['🏠', '💡', '💧', '📱', '🔑'] },
  { title: 'Food', emojis: ['🍕', '🛒', '☕', '🍔', '🥗'] },
  { title: 'Transport', emojis: ['🚗', '⛽', '🚌', '✈️', '🚲'] },
  { title: 'Health', emojis: ['💊', '🏥', '💪', '🧴'] },
  { title: 'Entertainment', emojis: ['🎮', '🎬', '🎵', '📚', '🏖️'] },
  { title: 'Savings & Money', emojis: ['💰', '💳', '🏦', '📈', '🎯'] },
  { title: 'Other', emojis: ['📦', '🛍️', '🎁', '👗', '🐾'] },
]
