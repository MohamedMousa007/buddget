import { SETTINGS_REGISTRY } from '@/lib/settings/registry'
import { int, num, obj, oneOf, str, type ToolSpec } from '@/lib/buddgy/tools/spec'

export const SCREEN_ROUTES = {
  flow: '/flow',
  paydays: '/paydays',
  budget: '/budget-setup',
  budget_history: '/budget-history',
  wealth: '/wealth',
  debts: '/debts',
  subscriptions: '/subscriptions',
  goals: '/goals',
  reports: '/reports',
  notifications: '/notifications',
  settings: '/settings',
} as const

export const SHEETS = [
  'add_expense',
  'add_payment_method',
  'new_payday',
  'assign_income',
  'add_debt',
  'pay_debt',
  'record_debt_payment',
] as const

/** Everything the settings registry lists except destructive entries. */
export const OPENABLE_SETTINGS = SETTINGS_REGISTRY.filter((s) => s.kind !== 'danger').map((s) => s.id)

export const navigationSpecs: ToolSpec[] = [
  {
    name: 'open_screen',
    domain: 'navigation',
    kind: 'nav',
    description: 'Take the user to an app screen.',
    params: obj({ screen: oneOf(Object.keys(SCREEN_ROUTES)) }, ['screen']),
  },
  {
    name: 'open_setting',
    domain: 'navigation',
    kind: 'nav',
    description: 'Take the user to a setting, for anything change_setting cannot do.',
    params: obj({ setting: oneOf(OPENABLE_SETTINGS) }, ['setting']),
  },
  {
    name: 'open_sheet',
    domain: 'navigation',
    kind: 'nav',
    description: 'Open an entry form, optionally prefilled, for the user to finish.',
    params: obj(
      {
        sheet: oneOf([...SHEETS]),
        name: str('expense description, card name or payday name'),
        amount: num(),
        currency: str('ISO code'),
        category: str('expense category'),
        date: str('YYYY-MM-DD'),
        method: str('payment method ref or exact name'),
        notes: str(),
        last4: str('card last 4 digits'),
        type: str('payment method type or income type'),
        day: int('payday day of month'),
        family: oneOf(['personal', 'installment'], 'debt form'),
        ref: str('debt ref or name (record_debt_payment); income event ref (assign_income)'),
      },
      ['sheet'],
    ),
  },
]
