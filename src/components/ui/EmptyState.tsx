'use client'

import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-8 sm:py-12 text-center px-4 ${className}`}
      role="status"
    >
      {icon != null ? <div className="text-3xl mb-3" aria-hidden>{icon}</div> : null}
      <p className="text-base font-medium text-[var(--color-brand-text-primary)] mb-1">{title}</p>
      {description ? (
        <p className="text-sm text-[var(--color-brand-text-muted)] max-w-sm mb-4">{description}</p>
      ) : null}
      {action}
    </div>
  )
}
