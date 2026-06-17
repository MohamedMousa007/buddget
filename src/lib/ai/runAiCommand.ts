import type { FinanceStore } from '@/lib/store/types'
import { buildSystemPrompt, sendToGemini, type AIResponse, type AiPromptMode } from '@/lib/ai/gemini'
import { buildPlanRowsForPrompt } from '@/lib/ai/budgetPlannerAi'

/** The slice of `useMonthlyStats()` the live-data block needs. */
export interface AiCommandStats {
  totalIncome: number
  totalSpentExcludingSavings: number
  totalExpenseBudget: number
  remaining: number
  savingsTotal: number
  debtRemainingTotal: number
  daysLeft: number
}

/** The 9-line LIVE_APP_DATA block fed to the model so `query` answers use real numbers. */
export function buildLiveDataBlock(
  store: FinanceStore,
  stats: AiCommandStats,
  monthFilter: string,
): string {
  return [
    `Billing month: ${monthFilter}`,
    `Base currency: ${store.settings.baseCurrency}`,
    `Monthly income (estimated): ${stats.totalIncome}`,
    `Spent this month (expense categories, excl. Savings): ${stats.totalSpentExcludingSavings}`,
    `Budget for expenses (excl. Savings allocation): ${stats.totalExpenseBudget}`,
    `Remaining vs expense budget: ${stats.remaining}`,
    `Savings total (holdings + legacy Savings-tagged expenses this month): ${stats.savingsTotal}`,
    `Debt remaining (approx): ${stats.debtRemainingTotal}`,
    `Days left in month: ${stats.daysLeft}`,
  ].join('\n')
}

export interface RunAiCommandArgs {
  store: FinanceStore
  stats: AiCommandStats
  monthFilter: string
  text: string
  /** `chat` = full prompt + history; `voice` = lean single-shot. */
  mode: AiPromptMode
  history?: { role: string; content: string }[]
  signal?: AbortSignal
}

/**
 * Single entry point for turning a natural-language utterance into an `AIResponse`.
 * Shared by the AI chat (full prompt + conversation history) and voice (lean prompt,
 * no history, fewer/faster retries, abortable). Keeps prompt-building in one place so
 * the two surfaces never drift.
 */
export async function runAiCommand({
  store,
  stats,
  monthFilter,
  text,
  mode,
  history = [],
  signal,
}: RunAiCommandArgs): Promise<AIResponse> {
  const liveDataBlock = buildLiveDataBlock(store, stats, monthFilter)

  // Voice omits the budget-plan rows entirely (token-lean); chat includes them so
  // it can do fine-grained plan-row edits.
  const budgetPlanContext =
    mode === 'chat'
      ? (() => {
          const activePlan =
            store.budgetPlans.find((p) => p.id === store.activeBudgetPlanId) ?? store.budgetPlans[0]
          return activePlan
            ? {
                planId: activePlan.id,
                planName: activePlan.name,
                categoryRows: buildPlanRowsForPrompt(
                  activePlan,
                  store.settings.baseCurrency,
                  store.exchangeRates,
                ),
              }
            : undefined
        })()
      : undefined

  const systemPrompt = buildSystemPrompt(
    store.settings.baseCurrency,
    store.paymentMethods,
    store.debts,
    liveDataBlock,
    budgetPlanContext,
    store.incomeSources,
    store.savingsAccounts,
    store.goals,
    mode,
  )

  return sendToGemini(
    systemPrompt,
    text,
    mode === 'voice' ? [] : history,
    mode === 'voice'
      ? { signal, maxOutputTokens: 768, maxAttempts: 2, backoffMs: 800 }
      : { signal },
  )
}
