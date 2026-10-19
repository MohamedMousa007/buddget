import type { ToolEntry } from '@/lib/buddgy/tools/types'
import { budgetTools } from '@/lib/buddgy/tools/exec/budget'
import { debtsTools } from '@/lib/buddgy/tools/exec/debts'
import { expensesTools } from '@/lib/buddgy/tools/exec/expenses'
import { goalsTools } from '@/lib/buddgy/tools/exec/goals'
import { incomeTools } from '@/lib/buddgy/tools/exec/income'
import { memoryTools } from '@/lib/buddgy/tools/exec/memory'
import { navigationTools } from '@/lib/buddgy/tools/exec/navigation'
import { paymentsTools } from '@/lib/buddgy/tools/exec/payments'
import { profileTools } from '@/lib/buddgy/tools/exec/profile'
import { reportsTools } from '@/lib/buddgy/tools/exec/reports'
import { savingsTools } from '@/lib/buddgy/tools/exec/savings'
import { settingsTools } from '@/lib/buddgy/tools/exec/settings'
import { subscriptionsTools } from '@/lib/buddgy/tools/exec/subscriptions'

const ALL: ToolEntry[] = [
  ...reportsTools,
  ...expensesTools,
  ...incomeTools,
  ...debtsTools,
  ...subscriptionsTools,
  ...goalsTools,
  ...savingsTools,
  ...budgetTools,
  ...paymentsTools,
  ...settingsTools,
  ...profileTools,
  ...memoryTools,
  ...navigationTools,
]

export const TOOLS: ReadonlyMap<string, ToolEntry> = new Map(ALL.map((t) => [t.spec.name, t]))
