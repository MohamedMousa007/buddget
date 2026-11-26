'use client'

import type { ReactNode } from 'react'
import { IconButton } from '@/components/ui/IconButton'
import { cn } from '@/lib/utils'

/**
 * A Buddgy chat header action: the same 32px circle as before, inside a real 44px button box. The negative margin
 * gives the extra 6px a side back, so the header's spacing and height are unchanged; the whole box takes the tap and
 * measures 44x44 (the overlay alone left the drawn box at 32x32).
 */
export function ChatHeaderButton({ label, onClick, tone = 'tinted', children }: {
  label: string
  onClick: () => void
  tone?: 'tinted' | 'ghost'
  children: ReactNode
}) {
  return (
    <IconButton onClick={onClick} aria-label={label} variant="ghost" size="md" shape="round" className="group/chat-btn -m-1.5 hover:bg-transparent">
      <span
        aria-hidden
        className={cn(
          'flex size-8 items-center justify-center rounded-full transition-colors',
          tone === 'tinted'
            ? 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-primary)] group-hover/chat-btn:bg-[var(--color-brand-sunken)]'
            : 'text-[var(--color-brand-text-secondary)] group-hover/chat-btn:bg-[var(--color-brand-elevated)] group-hover/chat-btn:text-[var(--color-brand-text-primary)]',
        )}
      >
        {children}
      </span>
    </IconButton>
  )
}
