'use client'

import { Layers } from 'lucide-react'
import { PromptBanner } from '@/components/ui/PromptBanner'
import { useBudgetChromeCopy } from './useBudgetCopy'

export interface UpgradeBannerProps {
  lineCount: number
  onReview: () => void
  onLater: () => void
}

export function UpgradeBanner({ lineCount, onReview, onLater }: UpgradeBannerProps) {
  const c = useBudgetChromeCopy().upgrade
  return (
    <PromptBanner
      title={c.title(lineCount)}
      icon={<Layers className="size-[18px]" aria-hidden />}
      confirmLabel={c.review}
      onConfirm={onReview}
      dismissLabel={c.later}
      onDismiss={onLater}
    />
  )
}
