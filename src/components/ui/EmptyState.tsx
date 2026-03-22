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
      className={`flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4 ${className}`}
      role="status"
    >
      {icon != null ? <div className="text-4xl mb-4" aria-hidden>{icon}</div> : null}
      <p className="text-lg font-medium text-white mb-1">{title}</p>
      {description ? (
        <p className="text-sm text-[var(--color-brand-text-muted)] max-w-sm mb-6">{description}</p>
      ) : null}
      {action}
    </div>
  )
}
