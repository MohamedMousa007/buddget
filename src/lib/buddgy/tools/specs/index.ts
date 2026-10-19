import type { ToolSpec } from '@/lib/buddgy/tools/spec'
import { budgetSpecs } from '@/lib/buddgy/tools/specs/budget'
import { debtsSpecs } from '@/lib/buddgy/tools/specs/debts'
import { expensesSpecs } from '@/lib/buddgy/tools/specs/expenses'
import { goalsSpecs } from '@/lib/buddgy/tools/specs/goals'
import { incomeSpecs } from '@/lib/buddgy/tools/specs/income'
import { memorySpecs } from '@/lib/buddgy/tools/specs/memory'
import { navigationSpecs } from '@/lib/buddgy/tools/specs/navigation'
import { paymentsSpecs } from '@/lib/buddgy/tools/specs/payments'
import { profileSpecs } from '@/lib/buddgy/tools/specs/profile'
import { reportsSpecs } from '@/lib/buddgy/tools/specs/reports'
import { savingsSpecs } from '@/lib/buddgy/tools/specs/savings'
import { settingsSpecs } from '@/lib/buddgy/tools/specs/settings'
import { subscriptionsSpecs } from '@/lib/buddgy/tools/specs/subscriptions'

/** Order is the order the model sees; keep reads first so the cheap path is the obvious one. */
export const ALL_SPECS: ToolSpec[] = [
  ...reportsSpecs,
  ...expensesSpecs,
  ...incomeSpecs,
  ...debtsSpecs,
  ...subscriptionsSpecs,
  ...goalsSpecs,
  ...savingsSpecs,
  ...budgetSpecs,
  ...paymentsSpecs,
  ...settingsSpecs,
  ...profileSpecs,
  ...memorySpecs,
  ...navigationSpecs,
]

export const SPEC_BY_NAME: ReadonlyMap<string, ToolSpec> = new Map(ALL_SPECS.map((s) => [s.name, s]))
