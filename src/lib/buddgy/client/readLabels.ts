import type { BuddgyLocale } from '@/lib/buddgy/protocol'

const EN: Record<string, string> = {
  get_summary: 'Month summary',
  search_expenses: 'Expenses',
  spend_breakdown: 'Spending breakdown',
  list_income: 'Income',
  list_debts: 'Debts',
  list_subscriptions: 'Subscriptions',
  list_goals: 'Goals',
  list_savings: 'Savings',
  get_net_worth: 'Net worth',
  get_budget: 'Budget',
  list_budget_plans: 'Budgets',
  list_payment_methods: 'Payment methods',
  get_settings: 'Settings',
  get_profile: 'Profile',
  get_memories: 'Memory',
}

const AR: Record<string, string> = {
  get_summary: 'ملخص الشهر',
  search_expenses: 'المصروفات',
  spend_breakdown: 'تفصيل الإنفاق',
  list_income: 'الدخل',
  list_debts: 'الديون',
  list_subscriptions: 'الاشتراكات',
  list_goals: 'الأهداف',
  list_savings: 'المدخرات',
  get_net_worth: 'صافي الثروة',
  get_budget: 'الميزانية',
  list_budget_plans: 'الميزانيات',
  list_payment_methods: 'طرق الدفع',
  get_settings: 'الإعدادات',
  get_profile: 'الملف الشخصي',
  get_memories: 'الذاكرة',
}

export function readLabel(tool: string, locale: BuddgyLocale): string {
  return (locale === 'ar' ? AR : EN)[tool] ?? tool.replace(/^(get|list)_/, '').replace(/_/g, ' ')
}
