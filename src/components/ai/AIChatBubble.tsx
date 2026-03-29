'use client'

import { useState, useEffect } from 'react'
import { Bot } from 'lucide-react'
import { checkAIStatus } from '@/lib/ai/gemini'

interface AIChatBubbleProps {
  onClick: () => void
}

export function AIChatBubble({ onClick }: AIChatBubbleProps) {
  const [aiEnabled, setAiEnabled] = useState(false)

  useEffect(() => {
    checkAIStatus().then((status) => setAiEnabled(status.enabled))
  }, [])

  if (!aiEnabled) return null

  return (
    <button
      onClick={onClick}
      className="fixed bottom-24 end-6 lg:bottom-24 lg:end-8 z-40 w-12 h-12 rounded-full bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white shadow-lg hover:bg-[var(--color-brand-border)] transition-all duration-200 flex items-center justify-center cursor-pointer"
    >
      <Bot className="w-5 h-5" />
    </button>
  )
}
