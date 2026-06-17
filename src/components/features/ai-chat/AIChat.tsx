'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useAIChat } from '@/hooks/useAIChat'
import { AIChatHeader } from '@/components/features/ai-chat/AIChatHeader'
import { AIChatEmptyState } from '@/components/features/ai-chat/AIChatEmptyState'
import { AIChatMessageList } from '@/components/features/ai-chat/AIChatMessageList'
import { AIChatTypingIndicator } from '@/components/features/ai-chat/AIChatTypingIndicator'
import { AIChatComposer } from '@/components/features/ai-chat/AIChatComposer'

/**
 * Full-screen (mobile) / floating (desktop) Buddget AI assistant. Logic lives in `useAIChat`.
 */
export function AIChat() {
  const {
    isOpen,
    close,
    messages,
    input,
    setInput,
    isLoading,
    handleSend,
    handleConfirm,
    handleEdit,
    messagesEndRef,
    lastUserContentBefore,
    baseCurrency,
  } = useAIChat()

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-chat-title"
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            exit={{ y: '110%' }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-0 start-0 end-0 z-50 bg-[var(--color-brand-card)] rounded-t-[26px] border-t border-[var(--color-brand-border)] shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.7)] max-h-[80vh] flex flex-col lg:bottom-8 lg:end-8 lg:start-auto lg:top-auto lg:w-[400px] lg:h-[600px] lg:rounded-2xl lg:border"
          >
            <AIChatHeader onClose={close} />

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <AIChatEmptyState onPickSuggestion={setInput} />
              ) : (
                <AIChatMessageList
                  messages={messages}
                  baseCurrency={baseCurrency}
                  lastUserContentBefore={lastUserContentBefore}
                  onConfirm={handleConfirm}
                  onEdit={handleEdit}
                  scrollAnchorRef={messagesEndRef}
                />
              )}

              {isLoading ? <AIChatTypingIndicator /> : null}
            </div>

            <AIChatComposer
              value={input}
              onChange={setInput}
              onSend={() => void handleSend()}
              disabled={isLoading}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
