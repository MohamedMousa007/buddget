'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore, type ExpensePrefill } from '@/lib/store/useSettingsStore'
import { type AIResponse } from '@/lib/ai/gemini'
import { runAiCommand } from '@/lib/ai/runAiCommand'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import {
  buildAIActionHandlerContext,
  executeActionItem,
  getField,
  validateActionItem,
} from '@/lib/ai/aiActionHandlers'
import { useAuth } from '@/components/auth/AuthProvider'
import { useT } from '@/lib/i18n'

/** Single row in the AI assistant transcript. */
export interface AIChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  aiResponse?: AIResponse
  confirmed?: boolean
}

const AI_CHAT_HISTORY_MAX_MESSAGES = 5

export function useAIChat() {
  const store = useFinanceStore()
  const { activeModal, setActiveModal, openAddExpenseWithPrefill, monthFilter, aiChatSeed, clearAiChatSeed } =
    useSettingsStore()
  const stats = useMonthlyStats()
  const { user, openAuthModal } = useAuth()
  const t = useT()
  const pathname = usePathname()
  const supabaseConfigured = useMemo(() => isSupabaseConfigured(), [])
  const isOpen = activeModal === 'aiChat'

  const guardMutations = useCallback(() => {
    if (!supabaseConfigured) return true
    if (user) return true
    openAuthModal(
      pathname,
      t.ai.guardSignIn
    )
    return false
  }, [openAuthModal, pathname, supabaseConfigured, t, user])

  const [messages, setMessages] = useState<AIChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Voice "Open in chat" hands off the transcript: pre-fill the composer once.
  useEffect(() => {
    if (isOpen && aiChatSeed) {
      setInput(aiChatSeed)
      clearAiChatSeed()
    }
  }, [isOpen, aiChatSeed, clearAiChatSeed])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveModal(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, setActiveModal])

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input
    setInput('')
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: 'user', content: userMessage },
    ])
    setIsLoading(true)

    try {
      const history = messages.slice(-AI_CHAT_HISTORY_MAX_MESSAGES).map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const response = await runAiCommand({
        store,
        stats,
        monthFilter,
        text: userMessage,
        mode: 'chat',
        history,
      })

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.message,
          aiResponse: response,
          confirmed: false,
        },
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content:
            err instanceof Error && err.message.startsWith('This is Google')
              ? err.message
              : `Hmm, something didn't go as planned. ${err instanceof Error ? err.message : 'Give it another try in a moment 😊'}`,
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, messages, monthFilter, stats, store])

  const pushAssistantNote = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-note`, role: 'assistant', content: text },
    ])
  }, [])

  const handleConfirm = useCallback(
    (messageId: string) => {
      const message = messages.find((m) => m.id === messageId)
      if (!message?.aiResponse) return
      if (!guardMutations()) return

      const ctx = buildAIActionHandlerContext(store)

      const toApply = message.aiResponse.actions.filter(
        (a) => a.action !== 'query' && a.action !== 'unclear'
      )
      if (toApply.length === 0) return

      for (const { action, data } of toApply) {
        const err = validateActionItem(ctx, action, data as Record<string, unknown>)
        if (err) {
          pushAssistantNote(err)
          return
        }
      }

      for (const { action, data } of toApply) {
        executeActionItem(ctx, action, data as Record<string, unknown>)
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, confirmed: true } : m))
      )
    },
    [guardMutations, messages, pushAssistantNote, store]
  )

  const handleEdit = useCallback(
    (message: AIChatMessage) => {
      if (!message.aiResponse) return
      if (!guardMutations()) return

      const forEdit =
        message.aiResponse.actions.find((a) => a.action === 'add_expense') ||
        message.aiResponse.actions.find((a) => a.action === 'add_debt_payment') ||
        message.aiResponse.actions[0]

      const d = forEdit.data as Record<string, unknown>
      const prefill: ExpensePrefill = {
        date: String(getField(d, 'date') || new Date().toISOString().slice(0, 10)),
        description: String(getField(d, 'description') || ''),
        amount: String(Number(getField(d, 'amount')) || ''),
        currency: String(getField(d, 'currency') || store.settings.baseCurrency),
        category: String(getField(d, 'category') || 'Other'),
        paymentMethod: String(getField(d, 'paymentMethod', 'payment_method') || ''),
      }

      if (forEdit.action === 'add_debt_payment') {
        const personOrName = String(getField(d, 'debtName', 'debt_name', 'person', 'name') || '')
        prefill.description = `Debt payment – ${personOrName}`
        prefill.category = 'Debt'
      }

      openAddExpenseWithPrefill(prefill)
    },
    [guardMutations, openAddExpenseWithPrefill, store.settings.baseCurrency]
  )

  const lastUserContentBefore = useCallback(
    (assistantMessageId: string): string | null => {
      const idx = messages.findIndex((m) => m.id === assistantMessageId)
      if (idx <= 0) return null
      for (let i = idx - 1; i >= 0; i--) {
        if (messages[i].role === 'user') return messages[i].content
      }
      return null
    },
    [messages]
  )

  return {
    isOpen,
    close: () => setActiveModal(null),
    messages,
    input,
    setInput,
    isLoading,
    handleSend,
    handleConfirm,
    handleEdit,
    messagesEndRef,
    lastUserContentBefore,
    baseCurrency: store.settings.baseCurrency,
  }
}
