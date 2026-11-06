'use client'

import type { ComponentProps } from 'react'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'

/** Buddgy on a soft teal tile: the face that guides every screen of the journey. */
export function BuddgyHead({ mood = 'happy', size = 60 }: { mood?: ComponentProps<typeof BuddgyIcon>['mood']; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-text-primary)]"
      style={{ width: size, height: size, borderRadius: size * 0.33 }}
    >
      <BuddgyIcon mood={mood} size={Math.round(size * 0.63)} alive />
    </span>
  )
}

export const stepTitle = 'text-[26px] font-bold leading-[1.15] tracking-[-0.025em] text-[var(--color-brand-text-primary)] text-balance'
export const stepLead = 'mt-2.5 text-[0.9375rem] leading-[1.45] text-[var(--color-brand-text-secondary)] text-balance'
