'use client'

import { useT } from '@/lib/i18n'

export function AddDebtNewFormFooter({
  isCreditCard,
  canSubmit,
  onSubmit,
}: {
  isCreditCard: boolean
  canSubmit: boolean
  onSubmit: () => void
}) {
  const t = useT()
  return (
    <div className="shrink-0 pt-4">
      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="w-full py-3.5 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50"
      >
        {isCreditCard ? t.addDebt.buttonSubmitCreditCard : t.addDebt.buttonSubmit}
      </button>
    </div>
  )
}
