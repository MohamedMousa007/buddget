'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Check, Send, X, Loader2 } from 'lucide-react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useShallow } from 'zustand/react/shallow'
import {
  sendBuddgyPlanBuilderChat,
  buildPlanRowsForPrompt,
  type BuddgyPlannerThreadMessage,
} from '@/lib/ai/budgetPlannerAi'
import type { BudgetPlannerContextPayload } from '@/lib/ai/buddgyBudgetPlannerPrompt'
import { PREDEFINED_BUDGET_CATEGORIES } from '@/lib/budget/budgetPlannerPresets'
import { calculateMonthlyIncome } from '@/lib/utils/calculations'
import {
  buildAIActionHandlerContext,
  executeActionItem,
  validateActionItem,
} from '@/lib/ai/aiActionHandlers'
import type { AIResponse } from '@/lib/ai/gemini'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  aiResponse?: AIResponse
  confirmed?: boolean
}

export interface BuddgyAiChatProps {
  planId: string
  onClose: () => void
}

const OPENER =
  "Hi! I'm Buddgy, your budget buddy. Tell me about your lifestyle and I'll build a personalized monthly budget plan for you. What's your monthly income?"

/**
 * Inline Buddgy AI chat for budget setup — sends messages in budget-planner mode,
 * applies replace_budget_plan with user confirmation.
 */
export function BuddgyAiChat({ planId, onClose }: BuddgyAiChatProps) {
  const store = useFinanceStore()
  const { settings, incomeSources, exchangeRates, budgetPlans } = useFinanceStore(
    useShallow((s) => ({
      settings: s.settings,
      incomeSources: s.incomeSources,
      exchangeRates: s.exchangeRates,
      budgetPlans: s.budgetPlans,
    }))
  )

  const activePlan = useMemo(
    () => budgetPlans.find((p) => p.id === planId),
    [budgetPlans, planId]
  )

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'opener', role: 'assistant', content: OPENER },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const buildContext = useCallback((): BudgetPlannerContextPayload => {
    const plan = activePlan
    const income = calculateMonthlyIncome(incomeSources, settings.baseCurrency, exchangeRates)
    return {
      builderMode: true,
      activePlanId: planId,
      primaryCurrency: settings.baseCurrency,
      secondaryCurrency: settings.secondaryCurrency ?? null,
      incomeSummary: `${settings.baseCurrency} ${income.toFixed(0)}/month`,
      country: store.profile?.country ?? '',
      city: store.profile?.city ?? '',
      existingPlanSummary: plan ? buildPlanRowsForPrompt(plan, settings.baseCurrency, exchangeRates) : '[]',
      predefinedCategoryLabels: PREDEFINED_BUDGET_CATEGORIES.map((c) => `${c.icon} ${c.label}`).join(', '),
    }
  }, [activePlan, exchangeRates, incomeSources, planId, settings, store.profile])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setIsLoading(true)

    try {
      const thread: BuddgyPlannerThreadMessage[] = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: text },
      ]

      const aiResponse = await sendBuddgyPlanBuilderChat({
        openerText: OPENER,
        thread,
        contextPayload: buildContext(),
      })

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: aiResponse.message,
          aiResponse,
          confirmed: false,
        },
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: err instanceof Error ? err.message : 'Something went wrong, try again.',
        },
      ])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }, [buildContext, input, isLoading, messages])

  const handleConfirm = useCallback(
    (msgId: string) => {
      const msg = messages.find((m) => m.id === msgId)
      if (!msg?.aiResponse) return

      const ctx = buildAIActionHandlerContext(store)
      const toApply = msg.aiResponse.actions.filter(
        (a) => a.action !== 'query' && a.action !== 'unclear'
      )
      if (toApply.length === 0) return

      for (const { action, data } of toApply) {
        const err = validateActionItem(ctx, action, data as Record<string, unknown>)
        if (err) {
          setMessages((prev) => [
            ...prev,
            { id: `note-${Date.now()}`, role: 'assistant', content: err },
          ])
          return
        }
      }

      for (const { action, data } of toApply) {
        executeActionItem(ctx, action, data as Record<string, unknown>)
      }

      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, confirmed: true } : m)))
    },
    [messages, store]
  )

  const hasActions = (msg: ChatMessage) =>
    msg.aiResponse?.actions?.some((a) => a.action !== 'query' && a.action !== 'unclear') ?? false

  return (
    <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] flex flex-col overflow-hidden" style={{ maxHeight: 'min(520px, 70vh)' }}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[var(--color-brand-border)] px-4 py-3">
        <div className="rounded-full bg-[var(--color-brand-red)]/10 p-1.5">
          <Bot className="h-4 w-4 text-[var(--color-brand-red)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">Buddgy</p>
          <p className="text-[10px] text-[var(--color-brand-text-muted)]">Your budget buddy</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)]"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-[var(--color-brand-red)] text-white'
                : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-primary)]'
            }`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.role === 'assistant' && hasActions(msg) && !msg.confirmed && (
                <button
                  type="button"
                  onClick={() => handleConfirm(msg.id)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-brand-green)]/15 px-3 py-1.5 text-xs font-medium text-[var(--color-brand-green)] hover:bg-[var(--color-brand-green)]/25 transition-colors"
                >
                  <Check className="h-3.5 w-3.5" />
                  Apply changes
                </button>
              )}
              {msg.confirmed && (
                <p className="mt-1.5 text-[10px] text-[var(--color-brand-green)] flex items-center gap-1">
                  <Check className="h-3 w-3" /> Applied
                </p>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-xl bg-[var(--color-brand-elevated)] px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--color-brand-text-muted)]" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-[var(--color-brand-border)] px-3 py-2.5 flex gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() } }}
          placeholder="Type a message..."
          disabled={isLoading}
          className="flex-1 min-w-0 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 py-2 text-sm text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-red)]/40 disabled:opacity-60"
          autoFocus
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!input.trim() || isLoading}
          className="shrink-0 rounded-xl bg-[var(--color-brand-red)] p-2.5 text-white hover:bg-[var(--color-brand-red-hover)] disabled:opacity-40 transition-colors"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
