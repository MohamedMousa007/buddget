'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { X, Send, Bot, Check, Pencil } from 'lucide-react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore, type ExpensePrefill } from '@/lib/store/useSettingsStore'
import {
  buildSystemPrompt,
  sendToGemini,
  type AIResponse,
} from '@/lib/ai/gemini'
import { useMonthlyStats } from '@/lib/hooks/useMonthlyStats'
import { formatCurrency } from '@/lib/utils/formatters'
import { Input } from '@/components/ui/input'
import {
  buildAIActionHandlerContext,
  executeActionItem,
  getField,
  looksLikeMultipleIntents,
  validateActionItem,
} from '@/lib/ai/aiActionHandlers'
import { useAuth } from '@/components/auth/AuthProvider'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  aiResponse?: AIResponse
  confirmed?: boolean
}

/** Max prior chat messages sent to Gemini (user + assistant); keeps tokens down. Current send is appended separately. */
const AI_CHAT_HISTORY_MAX_MESSAGES = 5

export function AIChat() {
  const store = useFinanceStore()
  const { activeModal, setActiveModal, openAddExpenseWithPrefill, monthFilter } = useSettingsStore()
  const stats = useMonthlyStats()
  const { user, openAuthModal } = useAuth()
  const pathname = usePathname()
  const supabaseConfigured = useMemo(
    () =>
      !!(
        process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
      ),
    []
  )
  const isOpen = activeModal === 'aiChat'

  const guardMutations = () => {
    if (!supabaseConfigured) return true
    if (user) return true
    openAuthModal(
      pathname,
      'Sign in or create an account to save changes from the assistant.'
    )
    return false
  }

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveModal(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, setActiveModal])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input
    setInput('')
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: 'user', content: userMessage },
    ])
    setIsLoading(true)

    try {
      const liveDataBlock = [
        `Billing month: ${monthFilter}`,
        `Base currency: ${store.settings.baseCurrency}`,
        `Monthly income (estimated): ${stats.totalIncome}`,
        `Spent this month: ${stats.totalSpent}`,
        `Budget total: ${stats.totalBudget}`,
        `Remaining vs budget: ${stats.remaining}`,
        `Savings (holdings + this month category): ${stats.savingsTotal}`,
        `Debt remaining (approx): ${stats.debtRemainingTotal}`,
        `Days left in month: ${stats.daysLeft}`,
      ].join('\n')

      const systemPrompt = buildSystemPrompt(
        store.settings.baseCurrency,
        store.paymentMethods,
        store.debts,
        liveDataBlock
      )

      const history = messages.slice(-AI_CHAT_HISTORY_MAX_MESSAGES).map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const response = await sendToGemini(systemPrompt, userMessage, history)

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
              : `Sorry, I encountered an error. ${err instanceof Error ? err.message : 'Please try again.'}`,
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const pushAssistantNote = (text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-note`, role: 'assistant', content: text },
    ])
  }

  const handleConfirm = (messageId: string) => {
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
  }

  const handleEdit = (message: Message) => {
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
  }

  const lastUserContentBefore = (assistantMessageId: string): string | null => {
    const idx = messages.findIndex((m) => m.id === assistantMessageId)
    if (idx <= 0) return null
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return messages[i].content
    }
    return null
  }

  const renderConfirmationCard = (message: Message) => {
    if (!message.aiResponse) return null
    if (message.confirmed) return null

    const toShow = message.aiResponse.actions.filter(
      (a) => a.action !== 'query' && a.action !== 'unclear'
    )
    if (toShow.length === 0) return null

    const priorUser = lastUserContentBefore(message.id)
    const multiIntentHint =
      toShow.length === 1 &&
      priorUser &&
      looksLikeMultipleIntents(priorUser)

    return (
      <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
        {multiIntentHint ? (
          <p className="text-[11px] text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1.5">
            Your message looks like several requests. If something is missing after you save, try one item per message or confirm again after editing.
          </p>
        ) : null}
        {toShow.map((item, idx) => {
          const d = item.data as Record<string, unknown>
          const action = item.action
          return (
            <div key={idx} className="text-xs space-y-1 text-white/80 pb-2 border-b border-white/5 last:border-0 last:pb-0">
              {action === 'add_expense' && (
                <>
                  <p>📝 {String(getField(d, 'description') || 'Expense')}</p>
                  <p>📂 Category: {String(getField(d, 'category') || 'Other')}</p>
                  <p>
                    💰{' '}
                    {formatCurrency(
                      Number(getField(d, 'amount')) || 0,
                      String(getField(d, 'currency') || store.settings.baseCurrency)
                    )}
                  </p>
                  {getField(d, 'paymentMethod', 'payment_method') ? (
                    <p>💳 {String(getField(d, 'paymentMethod', 'payment_method'))}</p>
                  ) : null}
                </>
              )}

              {action === 'add_debt_payment' && (
                <>
                  <p>🏦 Debt payment to {String(getField(d, 'person', 'debtName', 'name') || '?')}</p>
                  <p>
                    💰{' '}
                    {formatCurrency(
                      Number(getField(d, 'amount')) || 0,
                      String(getField(d, 'currency') || store.settings.baseCurrency)
                    )}
                  </p>
                  {getField(d, 'paymentMethod', 'payment_method') ? (
                    <p>💳 {String(getField(d, 'paymentMethod', 'payment_method'))}</p>
                  ) : null}
                  <p className="text-[var(--color-brand-text-muted)]">Also recorded as Debt expense</p>
                </>
              )}

              {action === 'add_income' && (
                <>
                  <p>💵 {String(getField(d, 'name') || 'Income')}</p>
                  <p>
                    💰{' '}
                    {formatCurrency(
                      Number(getField(d, 'amount')) || 0,
                      String(getField(d, 'currency') || store.settings.baseCurrency)
                    )}
                  </p>
                  {getField(d, 'isRecurring', 'is_recurring') === false ? null : (
                    <p className="text-[var(--color-brand-text-muted)]">
                      🔄{' '}
                      {String(getField(d, 'recurringFrequency', 'recurring_frequency') || 'monthly')}
                      {String(getField(d, 'recurringFrequency', 'recurring_frequency') || 'monthly') === 'monthly' &&
                      getField(d, 'dayOfMonth', 'day_of_month') != null
                        ? ` · day ${String(getField(d, 'dayOfMonth', 'day_of_month'))}`
                        : null}
                    </p>
                  )}
                </>
              )}

              {action === 'add_payment_method' && (
                <>
                  <p>💳 {String(getField(d, 'name') || 'Payment method')}</p>
                  <p>Type: {String(getField(d, 'type') || 'other')}</p>
                </>
              )}

              {action === 'add_savings_holding' && (
                <>
                  <p>🏦 {String(getField(d, 'name') || 'Holding')}</p>
                  <p>
                    💰{' '}
                    {formatCurrency(
                      Number(getField(d, 'amount')) || 0,
                      String(getField(d, 'currency') || store.settings.baseCurrency)
                    )}
                  </p>
                  <p>
                    {String(getField(d, 'bucket') || 'liquid')} · {String(getField(d, 'subtype') || 'other')}
                  </p>
                </>
              )}

              {action === 'update_budget_category' && (
                <>
                  <p>📂 Category: {String(getField(d, 'category') || '?')}</p>
                  {getField(d, 'percentOfIncome', 'percent') != null &&
                  getField(d, 'percentOfIncome', 'percent') !== '' ? (
                    <p>📊 {String(getField(d, 'percentOfIncome', 'percent'))}% of income</p>
                  ) : (
                    <p>
                      💰{' '}
                      {formatCurrency(
                        Number(getField(d, 'budgetedAmount', 'amount')) || 0,
                        store.settings.baseCurrency
                      )}
                    </p>
                  )}
                </>
              )}
            </div>
          )
        })}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleConfirm(message.id)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--color-brand-green)] text-white text-xs font-medium"
          >
            <Check className="w-3 h-3" />
            Confirm & Save
          </button>
          <button
            type="button"
            onClick={() => handleEdit(message)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--color-brand-elevated)] text-white text-xs font-medium border border-white/10"
          >
            <Pencil className="w-3 h-3" />
            Edit
          </button>
        </div>
      </div>
    )
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveModal(null)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-chat-title"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-brand-card)] rounded-t-3xl border-t border-[var(--color-brand-border)] h-[80vh] flex flex-col lg:bottom-8 lg:right-8 lg:left-auto lg:top-auto lg:w-[400px] lg:h-[600px] lg:rounded-2xl lg:border"
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-brand-border)]">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-[var(--color-brand-red)]" aria-hidden />
                <h3 id="ai-chat-title" className="text-sm font-semibold text-white">
                  Buddget AI
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg hover:bg-[var(--color-brand-elevated)] transition-colors"
                aria-label="Close chat"
              >
                <X className="w-5 h-5 text-[var(--color-brand-text-muted)]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <Bot className="w-10 h-10 text-[var(--color-brand-text-muted)] mx-auto mb-3" aria-hidden />
                  <p className="text-sm text-[var(--color-brand-text-secondary)]">
                    Hi! I can help you add expenses, check your budget, or record debt payments.
                  </p>
                  <div className="mt-4 space-y-2">
                    {['I spent 45 on lunch via nol silver', 'Paid mom 2000 EGP', 'How much have I spent this month?'].map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setInput(suggestion)}
                        className="block w-full text-left px-3 py-2 rounded-lg bg-[var(--color-brand-elevated)] text-xs text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-border)] transition-colors"
                      >
                        &ldquo;{suggestion}&rdquo;
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      message.role === 'user'
                        ? 'bg-[var(--color-brand-red)] text-white'
                        : 'bg-[var(--color-brand-elevated)] text-white'
                    }`}
                  >
                    <p className={message.role === 'assistant' ? 'whitespace-pre-line' : undefined}>
                      {message.content}
                    </p>

                    {renderConfirmationCard(message)}

                    {message.confirmed && (
                      <p className="mt-2 text-xs text-[var(--color-brand-green)] flex items-center gap-1">
                        <Check className="w-3 h-3" aria-hidden /> Saved!
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-[var(--color-brand-elevated)] rounded-2xl px-4 py-3" aria-busy>
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-[var(--color-brand-text-muted)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-[var(--color-brand-text-muted)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-[var(--color-brand-text-muted)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-[var(--color-brand-border)]">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  className="flex-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white placeholder:text-[var(--color-brand-text-muted)] text-sm"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="p-2.5 rounded-lg bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white transition-colors disabled:opacity-50"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
