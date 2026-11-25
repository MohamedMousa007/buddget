'use client'

import { AlertTriangle, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { IconButton } from '@/components/ui/IconButton'
import { useT } from '@/lib/i18n'

/**
 * Accounts' error notice for a currency with no rate today: says what failed and what it means for the totals, and
 * can be dismissed. `PromptBanner` needs a confirm action and `StatusPill` is the app-wide offline state, so neither fits.
 */
export function RateAlert({ currencies, onDismiss }: { currencies: string[]; onDismiss: () => void }) {
  const all = useT()
  if (currencies.length === 0) return null
  return (
    <Card role="alert" padding="none" className="flex items-start gap-2.5 border-[color-mix(in_oklab,var(--color-brand-red)_35%,transparent)] bg-[var(--color-brand-red-soft)] py-3 pe-1.5 ps-3.5">
      <AlertTriangle aria-hidden className="mt-0.5 size-[18px] shrink-0 text-[var(--color-brand-red)]" />
      <p className="min-w-0 flex-1 text-[0.84375rem] font-medium text-[var(--color-brand-text-primary)] [text-wrap:pretty]">
        {all.accountsPage.rateMissing(currencies.join(', '))}
      </p>
      <span className="-my-2.5">
        <IconButton variant="ghost" size="md" aria-label={all.common.dismiss} onClick={onDismiss}>
          <X className="size-4" strokeWidth={2} />
        </IconButton>
      </span>
    </Card>
  )
}
