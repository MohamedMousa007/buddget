import type { FinanceStore } from '@/lib/store/types'
import {
  buildSystemPrompt,
  buildVoiceExtractPrompt,
  sendToGemini,
  type AIResponse,
} from '@/lib/ai/gemini'
import { buildPlanRowsForPrompt } from '@/lib/ai/budgetPlannerAi'

/** `chat`/`voice` = full brain; `voiceExtract` = lean tier-1 adds-only extractor. */
export type AiCommandMode = 'chat' | 'voice' | 'voiceExtract'

/** The slice of `useMonthlyStats()` the live-data block needs. */
export interface AiCommandStats {
  totalIncome: number
  totalSpentExcludingSavings: number
  totalExpenseBudget: number
  remaining: number
  savingsTotal: number
  debtRemainingTotal: number
  daysLeft: number
  leftToSpend: number
  suggestedDaily: number
  projectedSpend: number
  paceStatus: string
  categorySpending: Record<string, number>
  categoryBudgetCaps: Record<string, number>
}

const round = (n: number) => Math.round(n)

/** The LIVE_APP_DATA block fed to the model so `query` answers use real numbers. */
export function buildLiveDataBlock(
  store: FinanceStore,
  stats: AiCommandStats,
  monthFilter: string,
  screen?: string,
): string {
  const byCategory = Object.entries(stats.categorySpending)
    .filter(([, spent]) => spent > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, spent]) => {
      const cap = stats.categoryBudgetCaps[cat]
      return cap ? `${cat} ${round(spent)}/${round(cap)}` : `${cat} ${round(spent)}`
    })
    .join(', ')
  return [
    ...(screen ? [`User is currently on screen: ${screen}`] : []),
    `Billing month: ${monthFilter}`,
    `Base currency: ${store.settings.baseCurrency}`,
    `Monthly income (estimated): ${stats.totalIncome}`,
    `Spent this month (expense categories, excl. Savings): ${stats.totalSpentExcludingSavings}`,
    `Budget for expenses (excl. Savings allocation): ${stats.totalExpenseBudget}`,
    `Remaining vs expense budget: ${stats.remaining}`,
    `Savings total (holdings + legacy Savings-tagged expenses this month): ${stats.savingsTotal}`,
    `Debt remaining (approx): ${stats.debtRemainingTotal}`,
    `Days left in month: ${stats.daysLeft}`,
    `Left to spend: ${round(stats.leftToSpend)} (safe daily: ${round(stats.suggestedDaily)})`,
    `Pace: ${stats.paceStatus} (projected month spend ${round(stats.projectedSpend)})`,
    `Spent by category (spent/budget): ${byCategory || '(nothing yet)'}`,
  ].join('\n')
}

export interface RunAiCommandArgs {
  store: FinanceStore
  stats: AiCommandStats
  monthFilter: string
  text: string
  /** `chat` = full prompt + history; `voice` = full single-shot; `voiceExtract` = lean tier-1. */
  mode: AiCommandMode
  history?: { role: string; content: string }[]
  signal?: AbortSignal
  /** Route the user is looking at, so answers can refer to it. */
  screen?: string
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
  screen,
}: RunAiCommandArgs): Promise<AIResponse> {
  // Tier-1: lean adds-only extractor — no live data, no history, smallest budget.
  if (mode === 'voiceExtract') {
    const prompt = buildVoiceExtractPrompt(
      store.settings.baseCurrency,
      store.paymentMethods,
      store.debts,
      store.incomeSources,
      store.savingsAccounts,
    )
    return sendToGemini(prompt, text, [], {
      signal,
      // Output is billed as generated, not as the cap — 768 just guards against
      // JSON truncation when one utterance lists several transactions.
      maxOutputTokens: 768,
      maxAttempts: 2,
      backoffMs: 800,
    })
  }

  const liveDataBlock = buildLiveDataBlock(store, stats, monthFilter, screen)

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
      ? { signal, maxOutputTokens: 1024, maxAttempts: 2, backoffMs: 800 }
      : { signal },
  )
}
