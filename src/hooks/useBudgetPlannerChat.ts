'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import {
  buildBudgetPlannerChatSystemPrompt,
  buildBudgetPlannerContextBlock,
  sendBudgetPlannerChat,
  sendBuddgyPlanBuilderChat,
} from '@/lib/ai/budgetPlannerAi'
import { buildBudgetPlannerContextPayload } from '@/lib/ai/buildBudgetPlannerContextPayload'
import type { AIResponse } from '@/lib/ai/gemini'
import { executeActionItem, validateActionItem, buildAIActionHandlerContext } from '@/lib/ai/aiActionHandlers'
import { SYSTEM_RESTING_MESSAGE } from '@/lib/ai/generateWithFallback'
import type { BudgetPlan, Currency } from '@/lib/store/types'

const HISTORY_MAX = 8
const SEND_DEBOUNCE_MS = 420

export interface BudgetPlannerChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  aiResponse?: AIResponse
  /** True after user clicked Apply for this assistant message */
  suggestionApplied?: boolean
}

export interface UseBudgetPlannerChatOptions {
  /** Called after a full plan replace is applied (scroll UI, etc.). */
  onReplacePlanApplied?: () => void
}

/**
 * Budget planner chat: tune mode (row updates) or Buddgy plan builder (guided flow).
 */
export function useBudgetPlannerChat(
  plan: BudgetPlan | null,
  totalMonthlyIncome: number,
  baseCurrency: Currency,
  exchangeRates: Record<string, number>,
  options: UseBudgetPlannerChatOptions = {}
) {
  const { onReplacePlanApplied } = options
  const store = useFinanceStore()
  const { incomeSources, settings, profile } = useFinanceStore(
    useShallow((s) => ({
      incomeSources: s.incomeSources,
      settings: s.settings,
      profile: s.profile,
    }))
  )

  const [messages, setMessages] = useState<BudgetPlannerChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [builderActive, setBuilderActive] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<BudgetPlannerChatMessage[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  messagesRef.current = messages

  useEffect(() => {
    setMessages([])
    messagesRef.current = []
    setInput('')
    setBuilderActive(false)
  }, [plan?.id])

  useEffect(() => {
    if (messages.length === 0) return
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const contextBlock =
    plan != null
      ? buildBudgetPlannerContextBlock(plan, totalMonthlyIncome, baseCurrency, exchangeRates)
      : ''
  const tuneSystemPrompt = buildBudgetPlannerChatSystemPrompt(contextBlock)

  const flushSend = useCallback(
    async (userText: string) => {
    if (!plan || !userText.trim() || loading) return
    setInput('')
    const snapshot = messagesRef.current
    const conversationHistory = snapshot
      .slice(-HISTORY_MAX)
      .map((m) => ({ role: m.role, content: m.content }))
    const userMsg: BudgetPlannerChatMessage = {
      id: `${Date.now()}-u`,
      role: 'user',
      content: userText,
    }
    const nextMsgs = [...snapshot, userMsg]
    messagesRef.current = nextMsgs
    setMessages(nextMsgs)
    setLoading(true)

    try {
      let ai: AIResponse
      if (builderActive) {
        const payload = buildBudgetPlannerContextPayload({
          plan,
          baseCurrency: settings.baseCurrency,
          secondaryCurrency: settings.secondaryCurrency,
          noIncomeDeclared: settings.noIncomeDeclared,
          incomeSources,
          exchangeRates,
          country: profile.country ?? '',
          city: profile.city ?? '',
          builderMode: true,
        })
        const opener = nextMsgs[0]?.role === 'assistant' ? nextMsgs[0].content : ''
        ai = await sendBuddgyPlanBuilderChat({
          openerText: opener,
          thread: nextMsgs.map((m) => ({ role: m.role, content: m.content })),
          contextPayload: payload,
        })
      } else {
        ai = await sendBudgetPlannerChat(tuneSystemPrompt, userText, conversationHistory)
      }
      setMessages((prev) => {
        const next = [
          ...prev,
          {
            id: `${Date.now()}-a`,
            role: 'assistant' as const,
            content: ai.message,
            aiResponse: ai,
          },
        ]
        messagesRef.current = next
        return next
      })
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message === SYSTEM_RESTING_MESSAGE
            ? SYSTEM_RESTING_MESSAGE
            : e.message
          : 'Something went wrong.'
      setMessages((prev) => {
        const next = [...prev, { id: `${Date.now()}-e`, role: 'assistant' as const, content: msg }]
        messagesRef.current = next
        return next
      })
    } finally {
      setLoading(false)
    }
  },
  [
      plan,
      loading,
      builderActive,
      tuneSystemPrompt,
      settings.baseCurrency,
      settings.secondaryCurrency,
      settings.noIncomeDeclared,
      incomeSources,
      exchangeRates,
      profile.country,
      profile.city,
    ]
  )

  const handleSend = useCallback(() => {
    const userText = input.trim()
    if (!userText) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      void flushSend(userText)
    }, SEND_DEBOUNCE_MS)
  }, [input, flushSend])

  const startBuilder = useCallback(
    (openingMessage: string) => {
      if (!plan) return
      setBuilderActive(true)
      const opener: BudgetPlannerChatMessage = {
        id: `${Date.now()}-b0`,
        role: 'assistant',
        content: openingMessage,
      }
      messagesRef.current = [opener]
      setMessages([opener])
    },
    [plan]
  )

  const stopBuilder = useCallback(() => {
    setBuilderActive(false)
    setMessages([])
    messagesRef.current = []
    setInput('')
  }, [])

  const applyFromMessage = useCallback(
    (messageId: string) => {
      const message = messagesRef.current.find((m) => m.id === messageId)
      if (!message?.aiResponse || !plan) return
      const ctx = buildAIActionHandlerContext(store)
      let did = false
      for (const item of message.aiResponse.actions) {
        if (item.action !== 'update_budget_plan_row' && item.action !== 'replace_budget_plan') continue
        const err = validateActionItem(ctx, item.action, item.data)
        if (err) continue
        const pid = String(item.data.planId ?? item.data.plan_id ?? '')
        if (pid !== plan.id) continue
        executeActionItem(ctx, item.action, item.data)
        did = true
      }
      if (!did) return
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === messageId ? { ...m, suggestionApplied: true } : m))
        messagesRef.current = next
        return next
      })
      onReplacePlanApplied?.()
    },
    [plan, store, onReplacePlanApplied]
  )

  return {
    messages,
    input,
    setInput,
    loading,
    handleSend,
    applyFromMessage,
    scrollAnchorRef: endRef,
    builderActive,
    startBuilder,
    stopBuilder,
  }
}
