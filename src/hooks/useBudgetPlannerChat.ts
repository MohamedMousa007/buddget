'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import {
  buildBudgetPlannerChatSystemPrompt,
  buildBudgetPlannerContextBlock,
  sendBudgetPlannerChat,
} from '@/lib/ai/budgetPlannerAi'
import type { AIResponse } from '@/lib/ai/gemini'
import { executeActionItem, validateActionItem, buildAIActionHandlerContext } from '@/lib/ai/aiActionHandlers'
import { SYSTEM_RESTING_MESSAGE } from '@/lib/ai/generateWithFallback'
import type { BudgetPlan, Currency } from '@/lib/store/types'

const HISTORY_MAX = 8

export interface BudgetPlannerChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  aiResponse?: AIResponse
  /** True after user clicked Apply for this assistant message */
  suggestionApplied?: boolean
}

/**
 * Inline budget planner chat with plan context in every request; Apply runs `update_budget_plan_row` actions.
 */
export function useBudgetPlannerChat(plan: BudgetPlan | null, totalMonthlyIncome: number, baseCurrency: Currency) {
  const store = useFinanceStore()
  const [messages, setMessages] = useState<BudgetPlannerChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<BudgetPlannerChatMessage[]>([])
  messagesRef.current = messages

  useEffect(() => {
    setMessages([])
    messagesRef.current = []
    setInput('')
  }, [plan?.id])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const contextBlock =
    plan != null ? buildBudgetPlannerContextBlock(plan, totalMonthlyIncome, baseCurrency) : ''
  const systemPrompt = buildBudgetPlannerChatSystemPrompt(contextBlock)

  const handleSend = useCallback(async () => {
    if (!plan || !input.trim() || loading) return
    const userText = input.trim()
    setInput('')
    const snapshot = messagesRef.current
    const history = snapshot.slice(-HISTORY_MAX).map((m) => ({ role: m.role, content: m.content }))
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
      const ai = await sendBudgetPlannerChat(systemPrompt, userText, history)
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
  }, [plan, input, loading, systemPrompt])

  const applyFromMessage = useCallback(
    (messageId: string) => {
      const message = messagesRef.current.find((m) => m.id === messageId)
      if (!message?.aiResponse || !plan) return
      const ctx = buildAIActionHandlerContext(store)
      let did = false
      for (const item of message.aiResponse.actions) {
        if (item.action !== 'update_budget_plan_row') continue
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
    },
    [plan, store]
  )

  return {
    messages,
    input,
    setInput,
    loading,
    handleSend,
    applyFromMessage,
    scrollAnchorRef: endRef,
  }
}
