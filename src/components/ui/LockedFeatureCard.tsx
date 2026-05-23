'use client'

import { Lock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { FeatureDependency } from '@/lib/features/dependencies'

const DEPENDENCY_CTA: Record<FeatureDependency, { label: string; href: string }> = {
  income: { label: 'Add income source', href: '/income' },
  budget_plan: { label: 'Set up budget', href: '/budget-setup' },
  payment_method: { label: 'Add payment method', href: '/settings' },
  debt: { label: 'Add a debt', href: '/debts' },
  savings: { label: 'Add savings account', href: '/savings' },
  goal: { label: 'Add a goal', href: '/goals' },
}

interface Props {
  title: string
  dependency: FeatureDependency
  children?: React.ReactNode
  className?: string
}

/**
 * Wraps a blurred preview behind a glass overlay lock when a feature
 * dependency is not yet satisfied. Clicking anywhere navigates to the CTA.
 */
export function LockedFeatureCard({ title, dependency, children, className = '' }: Props) {
  const router = useRouter()
  const cta = DEPENDENCY_CTA[dependency]

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(cta.href)}
      onKeyDown={(e) => e.key === 'Enter' && router.push(cta.href)}
      className={`relative rounded-2xl overflow-hidden cursor-pointer group ${className}`}
    >
      {/* Blurred preview */}
      {children && (
        <div className="blur-sm opacity-40 pointer-events-none select-none" aria-hidden>
          {children}
        </div>
      )}

      {/* Glass overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--color-brand-card)]/80 backdrop-blur-sm rounded-2xl border border-[var(--color-brand-border)] p-6 text-center transition-colors group-hover:bg-[var(--color-brand-elevated)]/80">
        <div className="w-10 h-10 rounded-full bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] flex items-center justify-center">
          <Lock className="w-5 h-5 text-[var(--color-brand-text-muted)]" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">{title}</p>
          <p className="text-xs text-[var(--color-brand-text-muted)] mt-0.5">
            Required to unlock this feature
          </p>
        </div>
        <span className="px-4 py-1.5 rounded-lg bg-[var(--color-brand-red)] text-white text-xs font-medium">
          {cta.label}
        </span>
      </div>
    </div>
  )
}
