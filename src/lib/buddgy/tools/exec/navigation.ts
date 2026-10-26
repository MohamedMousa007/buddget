import { defineTools } from '@/lib/buddgy/tools/define'
import { refOf, resolveByRefOrName } from '@/lib/buddgy/tools/refs'
import { navigationSpecs, SCREEN_ROUTES, SHEETS, OPENABLE_SETTINGS } from '@/lib/buddgy/tools/specs/navigation'
import { fin, ui } from '@/lib/buddgy/tools/stores'
import type { ToolEntry } from '@/lib/buddgy/tools/types'
import { num, parseIsoDate, text } from '@/lib/buddgy/tools/writeKit'
import { selectActivePlan } from '@/lib/budget/activePlan'
import { planRowNames } from '@/lib/budget/budgetPlans'
import { EXPENSE_ENTRY_CATEGORIES, FIAT_CURRENCIES } from '@/lib/constants/finance'
import { navigate } from '@/lib/navigation/navigate'
import { SETTING_BY_ID, type SettingAction } from '@/lib/settings/registry'
import type { IncomeSourceType, PaymentMethodType } from '@/lib/store/types'
import type { ExpensePrefill, PaydayPrefill, PmPrefill } from '@/lib/store/useSettingsStore'

type Nav = NonNullable<ToolEntry['nav']>
type NavResult = ReturnType<Nav>

const INCOME_TYPES: readonly IncomeSourceType[] = ['salary', 'bonus', 'side_hustle', 'rental', 'investment', 'savings', 'debt', 'gift', 'refund', 'other']
const METHOD_TYPES: readonly PaymentMethodType[] = ['debit_card', 'credit_card', 'prepaid_card', 'wallet', 'bnpl', 'other']
const SETTING_MODAL: Partial<Record<SettingAction, string>> = { household: 'householdRent', lifestyle: 'lifestyle' }

const refused = (message: string): NavResult => ({ ok: false, message })
const opened = (what: string): NavResult => ({ ok: true, message: `Opened ${what}.` })

const open_screen: Nav = (args) => {
  const screen = (Object.keys(SCREEN_ROUTES) as (keyof typeof SCREEN_ROUTES)[]).find((k) => k === args.screen)
  if (!screen) return refused(`Unknown screen. Use one of: ${Object.keys(SCREEN_ROUTES).join(', ')}.`)
  navigate(SCREEN_ROUTES[screen])
  return opened(screen)
}

const start_budget_setup: Nav = () => {
  ui().requestBudgetStudio()
  navigate('/budget-setup')
  return opened('the budget setup')
}

const open_setting: Nav = (args) => {
  const id = OPENABLE_SETTINGS.find((s) => s === args.setting)
  if (!id) return refused('That setting cannot be opened from chat.')
  const entry = SETTING_BY_ID[id]
  const modal = entry.action ? SETTING_MODAL[entry.action] : undefined
  if (modal) ui().setActiveModal(modal)
  else if (entry.action && entry.action !== 'household' && entry.action !== 'lifestyle') {
    navigate('/settings')
    ui().openSettingsSheet(entry.action)
  } else {
    ui().setSettingsFocusId(id)
    navigate(entry.route)
  }
  return opened(id)
}

function categoryOf(input: unknown): string | null {
  const wanted = text(input, 60)?.toLowerCase()
  if (!wanted) return null
  const s = fin()
  const plan = selectActivePlan(s.budgetPlans, s.activeBudgetPlanId)
  return [...EXPENSE_ENTRY_CATEGORIES, ...(plan ? planRowNames(plan) : [])].find((c) => c.toLowerCase() === wanted) ?? null
}

const optionList = (names: string[]) => (names.length ? ` Options: ${names.join(', ')}.` : '')

const open_sheet: Nav = (args) => {
  const sheet = SHEETS.find((k) => k === args.sheet)
  if (!sheet) return refused(`Unknown sheet. Use one of: ${SHEETS.join(', ')}.`)
  const s = fin()
  const amount = args.amount === undefined ? undefined : num(args.amount)
  if (args.amount !== undefined && (amount === undefined || amount <= 0)) return refused('The amount must be above zero.')
  const currency = args.currency === undefined ? undefined : FIAT_CURRENCIES.find((c) => c === text(args.currency, 8)?.toUpperCase())
  if (args.currency !== undefined && !currency) return refused('Unknown currency code.')
  const name = text(args.name, 80)

  let method: { id: string; name: string } | undefined
  if (args.method !== undefined) {
    const hit = resolveByRefOrName(s.paymentMethods, args.method, (m) => m.name)
    if (hit.kind !== 'one') {
      const pool = hit.kind === 'many' ? hit.items : s.paymentMethods
      return refused(`${hit.kind === 'many' ? 'Several payment methods match.' : 'No payment method matches.'}${optionList(pool.map((m) => m.name))}`)
    }
    method = hit.item
  }

  switch (sheet) {
    case 'add_expense': {
      const date = args.date === undefined ? undefined : parseIsoDate(args.date)
      if (args.date !== undefined && !date) return refused('The date must be a real date like 2026-10-19.')
      const category = args.category === undefined ? undefined : categoryOf(args.category)
      if (args.category !== undefined && !category) return refused(`Unknown category.${optionList([...EXPENSE_ENTRY_CATEGORIES])}`)
      const prefill: ExpensePrefill = {
        ...(date ? { date } : {}),
        ...(name ? { description: name } : {}),
        ...(amount !== undefined ? { amount: String(amount) } : {}),
        ...(currency ? { currency } : {}),
        ...(category ? { category } : {}),
        ...(method ? { paymentMethod: method.name } : {}),
        ...(text(args.notes, 200) ? { notes: text(args.notes, 200) } : {}),
      }
      ui().openAddExpenseWithPrefill(prefill)
      return opened('the add expense form')
    }
    case 'add_payment_method': {
      if (!name) return refused('A payment method needs a name.')
      const last4 = text(args.last4, 4) ?? ''
      if (last4 && !/^\d{4}$/.test(last4)) return refused('last4 must be exactly four digits.')
      const type = args.type === undefined ? undefined : METHOD_TYPES.find((t) => t === text(args.type, 20)?.toLowerCase())
      if (args.type !== undefined && !type) return refused(`Unknown type.${optionList([...METHOD_TYPES])}`)
      const prefill: PmPrefill = { name, last4, ...(type ? { type } : {}) }
      ui().openAddPaymentMethodWithPrefill(prefill)
      return opened('the add payment method form')
    }
    case 'new_payday': {
      const sourceType = args.type === undefined ? undefined : INCOME_TYPES.find((t) => t === text(args.type, 20)?.toLowerCase())
      if (args.type !== undefined && !sourceType) return refused(`Unknown income type.${optionList([...INCOME_TYPES])}`)
      const day = args.day === undefined ? undefined : num(args.day)
      if (args.day !== undefined && (day === undefined || !Number.isInteger(day) || day < 1 || day > 31)) return refused('The day must be 1 to 31.')
      const prefill: PaydayPrefill = {
        ...(name ? { name } : {}),
        ...(amount !== undefined ? { amount } : {}),
        ...(currency ? { currency } : {}),
        ...(sourceType ? { sourceType } : {}),
        ...(day !== undefined ? { dayOfMonth: day } : {}),
        ...(method ? { paymentMethodId: method.id } : {}),
      }
      ui().openNewPayday(prefill)
      return opened('the new payday form')
    }
    case 'assign_income': {
      if (args.ref === undefined) {
        ui().openAssignIncome({ eventId: null })
        return opened('the assign income sheet')
      }
      const hit = resolveByRefOrName(s.incomeEvents, args.ref, (e) => e.name)
      if (hit.kind !== 'one') return refused(`${hit.kind === 'many' ? 'Several income entries match.' : 'No income entry matches.'} Find it with the income tools first.`)
      ui().openAssignIncome({ eventId: hit.item.id })
      return opened(`the assign income sheet for ${hit.item.name}`)
    }
    case 'add_debt': {
      const family = args.family === 'personal' || args.family === 'installment' ? args.family : undefined
      ui().openDebtSheetNew(family)
      return opened('the add debt form')
    }
    case 'pay_debt':
      ui().openPayDebtSheet()
      return opened('the pay debt sheet')
    case 'record_debt_payment': {
      const hit = resolveByRefOrName(s.debts, args.ref, (d) => d.name)
      if (hit.kind !== 'one') {
        const pool = hit.kind === 'many' ? hit.items : s.debts
        return refused(`${hit.kind === 'many' ? 'Several debts match.' : 'No debt matches.'}${optionList(pool.slice(0, 15).map((d) => `${d.name} (${refOf(d.id)})`))}`)
      }
      ui().openDebtSheetRecordPayment(hit.item.id)
      return opened(`the record payment form for ${hit.item.name}`)
    }
  }
}

export const navigationTools = defineTools(navigationSpecs, { open_screen, open_setting, open_sheet, start_budget_setup })
