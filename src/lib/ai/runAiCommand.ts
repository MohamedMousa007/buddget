import type { FinanceStore } from '@/lib/store/types'
import { selectActivePlan } from '@/lib/budget/activePlan'
import {
  buildSystemPrompt,
  buildVoiceExtractPrompt,
  sendToGemini,
  type AIResponse,
  type SendToGeminiOptions,
  type ThinkingLevel,
} from '@/lib/ai/gemini'
import { classifyVoiceIntent } from '@/lib/voice/classifyVoiceIntent'
import { runLookup, type LookupQuery } from '@/lib/ai/buddgyLookup'
import { buildMemoryBlock } from '@/lib/ai/buddgyMemory'
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
  netCashFlow: number
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
    `Left to spend (budget minus spent): ${round(stats.leftToSpend)} (safe daily: ${round(stats.suggestedDaily)})`,
    `Net cash flow (income minus spend, savings and unfunded savings target): ${round(stats.netCashFlow)}`,
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
  /** Facts the user asked Buddgy to remember. */
  notes?: string[]
  /** Streams the reply's message as it is written (chat). */
  onText?: (message: string) => void
}

/** Planning asks for real reasoning; a question a little; logging none. */
const PLANNING_RE =
  /\b(plan|budget|strategy|rebuild|payoff|pay off|emergency fund|save for|invest|should i|advice|optimi[sz]e|compare)\b|خطة|ميزانية|انصحني|استثمر/i

export function thinkingFor(text: string): ThinkingLevel {
  if (PLANNING_RE.test(text)) return 'medium'
  return classifyVoiceIntent(text) === 'complex' ? 'low' : 'minimal'
}

const MAX_LOOKUPS = 2

/**
 * Single entry point for turning a natural-language utterance into an `AIResponse`.
 * Shared by the AI chat (full prompt + conversation history) and voice (lean prompt,
 * no history, fewer/faster retries, abortable). Keeps prompt-building in one place so
 * the two surfaces never drift.
 *
 * A `lookup` reply is resolved against the on-device store and the question is
 * re-asked with the result (at most {@link MAX_LOOKUPS} hops). `remember` actions
 * are lifted into `notes` so they never reach the confirm card.
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
  notes = [],
  onText,
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
      tier: 'fast',
      thinking: 'minimal',
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
          const activePlan = selectActivePlan(store.budgetPlans, store.activeBudgetPlanId)
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
    buildMemoryBlock(store, notes),
  )

  const thinking = thinkingFor(text)
  const options: SendToGeminiOptions = mode === 'voice'
    ? { signal, thinking, maxOutputTokens: 2048, maxAttempts: 2, backoffMs: 800 }
    // Thinking tokens count against the cap, so reasoning turns get more room.
    : { signal, thinking, onText, maxOutputTokens: thinking === 'medium' ? 4096 : 2048 }

  let message = text
  let response = await sendToGemini(systemPrompt, message, mode === 'voice' ? [] : history, options)
  for (let hop = 0; hop < MAX_LOOKUPS; hop++) {
    const lookups = response.actions.filter((a) => a.action === 'lookup')
    if (!lookups.length) break
    const results = lookups.map((a) => runLookup(store, a.data as LookupQuery)).join('\n\n')
    message = `${text}\n\nLOOKUP_RESULT (the user's own data — answer from it; do not look it up again):\n${results}`
    response = await sendToGemini(systemPrompt, message, mode === 'voice' ? [] : history, options)
  }

  const learned = response.actions
    .filter((a) => a.action === 'remember' && typeof a.data.note === 'string')
    .map((a) => String(a.data.note))
  const actions = response.actions.filter((a) => a.action !== 'remember' && a.action !== 'lookup')
  return {
    ...response,
    actions: actions.length ? actions : [{ action: 'query', data: {} }],
    notes: learned,
  }
}
