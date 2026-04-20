'use client'

import { useT } from '@/lib/i18n'

export function AddDebtNewFormFooter({
  isCreditCard,
  canSubmit,
  onCancel,
  onSubmit,
}: {
  isCreditCard: boolean
  canSubmit: boolean
  onCancel: () => void
  onSubmit: () => void
}) {
  const t = useT()
  return (
    <div className="flex gap-3 pt-2">
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 py-3 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
      >
        {t.common.cancel}
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        data-tutorial-id="debt-modal:save"
        className="flex-1 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50"
      >
        {isCreditCard ? t.addDebt.buttonSubmitCreditCard : t.addDebt.buttonSubmit}
      </button>
    </div>
  )
}
