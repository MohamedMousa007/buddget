'use client'

import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ModalSheetDragHandle({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'w-10 h-1 bg-[var(--color-brand-border)] rounded-full mx-auto mb-4 lg:hidden',
        className
      )}
    />
  )
}

export interface ModalSheetHeaderProps {
  title: string
  onClose: () => void
  /** Margin below the title row (debt sheet historically used tighter spacing). */
  titleRowClassName?: string
}

export function ModalSheetHeader({ title, onClose, titleRowClassName = 'mb-6' }: ModalSheetHeaderProps) {
  return (
    <>
      <ModalSheetDragHandle />
      <div className={cn('flex items-center justify-between', titleRowClassName)}>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-[var(--color-brand-elevated)] transition-colors"
        >
          <X className="w-5 h-5 text-[var(--color-brand-text-muted)]" />
        </button>
      </div>
    </>
  )
}
