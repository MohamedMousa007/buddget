'use client'

import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { cn } from '@/lib/utils'
import { useOnboardingCopy } from './useOnboardingCopy'

export interface JourneyFrameProps {
  /** 0-based position among the visible steps. */
  index: number
  total: number
  onBack?: () => void
  onSkip: () => void
  /** Full-width block between the header and the body (the reveal screens put their hero band here). */
  bleed?: ReactNode
  /** Fixed at the bottom: the primary action and its quieter alternative. */
  footer: ReactNode
  children: ReactNode
}

/** Back, a segmented progress bar and Skip on top; the step in the middle; the actions pinned below. */
export function JourneyFrame({ index, total, onBack, onSkip, bleed, footer, children }: JourneyFrameProps) {
  const c = useOnboardingCopy()
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col">
      <div className="flex min-h-14 flex-none items-center gap-1 px-1 pt-[env(safe-area-inset-top,0px)]">
        {onBack ? (
          <IconButton variant="ghost" aria-label={c.back} onClick={onBack}>
            <ChevronLeft className="rtl:rotate-180" />
          </IconButton>
        ) : (
          <span className="size-11" aria-hidden />
        )}
        <div className="flex min-w-0 flex-1 gap-[5px] px-2" role="img" aria-label={c.stepOf(index + 1, total)}>
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={cn('h-1 flex-1 rounded-full', i <= index ? 'bg-[var(--color-brand-primary)]' : 'bg-[var(--color-brand-sunken)]')}
            />
          ))}
        </div>
        <Button variant="ghost" size="touch" className="text-[var(--color-brand-text-secondary)]" onClick={onSkip}>
          {c.skip}
        </Button>
      </div>
      {bleed}
      <div className="flex min-h-0 flex-1 flex-col px-5 pb-4 pt-2">{children}</div>
      <div className="flex flex-none flex-col gap-1.5 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">{footer}</div>
    </div>
  )
}
