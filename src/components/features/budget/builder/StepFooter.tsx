'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface StepFooterProps {
  /** Omit on the first page. */
  back?: { label: string; onClick: () => void }
  next: { label: string; onClick: () => void; disabled?: boolean; loading?: boolean; final?: boolean }
}

/** Back + forward pair that ends every step page: Back is compact, the forward action takes the row. */
export function StepFooter({ back, next }: StepFooterProps) {
  return (
    <div className="flex gap-2">
      {back ? (
        <Button size="cta" variant="outline" aria-label={back.label} onClick={back.onClick}>
          <ChevronLeft className="rtl:rotate-180" aria-hidden />
          <span className="max-[380px]:sr-only">{back.label}</span>
        </Button>
      ) : null}
      <Button size="cta" className="min-w-0 flex-1" disabled={next.disabled} loading={next.loading} onClick={next.onClick}>
        {next.label}
        {next.final ? null : <ChevronRight className="rtl:rotate-180" aria-hidden />}
      </Button>
    </div>
  )
}
