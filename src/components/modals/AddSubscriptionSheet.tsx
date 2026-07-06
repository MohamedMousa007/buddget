'use client'

import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { Input } from '@/components/ui/input'
import { AddSubscriptionConfigureView } from '@/components/modals/AddSubscriptionConfigureView'
import { SubscriptionBrandIcon } from '@/components/features/subscriptions/SubscriptionBrandIcon'
import { SubscriptionCatalogGrid } from '@/components/features/subscriptions/SubscriptionCatalogGrid'
import { useAddSubscriptionForm } from '@/hooks/useAddSubscriptionForm'
import { useT } from '@/lib/i18n'
import type { Subscription } from '@/lib/store/types'
import { cn } from '@/lib/utils'

const selectClass = cn(
  'h-8 w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 text-sm text-[var(--color-brand-text-primary)]'
)

function AddSubscriptionSheetInner({
  editing,
  onClose,
}: {
  editing: Subscription | null
  onClose: () => void
}) {
  const t = useT()
  const form = useAddSubscriptionForm(editing, onClose)

  const headerTitle = editing ? t.subscriptions.editSubscription : t.subscriptions.addSubscription

  const catalogBrand =
    form.pickedBrand && form.pickedBrand !== 'custom' ? form.pickedBrand : null

  return (
    <>
      <ModalSheetHeader title={headerTitle} onClose={onClose} />
      {form.step === 1 && form.showCatalog ? (
        <div className="px-6 pb-6 space-y-4 max-h-[72vh] overflow-y-auto">
          <Input
            value={form.search}
            onChange={(e) => form.setSearch(e.target.value)}
            placeholder={t.subscriptions.searchPlaceholder}
            className={cn(selectClass, 'placeholder:text-[var(--color-brand-text-muted)]')}
          />
          <SubscriptionCatalogGrid
            brands={form.availableBrands}
            onPick={form.pickBrand}
            onCustom={() => form.pickBrand('custom')}
          />
        </div>
      ) : (
        <>
          {form.step === 2 && form.showCatalog && !editing ? (
            <button
              type="button"
              onClick={() => form.setStep(1)}
              className="mb-2 text-sm text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)]"
            >
              {t.common.back}
            </button>
          ) : null}
          {form.step === 2 && catalogBrand ? (
            <div className="flex items-center gap-3 pb-2">
              <SubscriptionBrandIcon
                brandKey={catalogBrand.key}
                color={catalogBrand.color}
                emoji={catalogBrand.emoji}
                initial={catalogBrand.initial}
                size="md"
              />
              <span className="text-lg font-semibold text-[var(--color-brand-text-primary)]">
                {catalogBrand.name}
              </span>
            </div>
          ) : null}
          <AddSubscriptionConfigureView
            form={form}
            t={{ subscriptions: t.subscriptions, goals: t.goals }}
            selectClass={selectClass}
          />
          <div className="flex gap-3 pb-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              onClick={form.submit}
              disabled={!form.canSubmit}
              className="flex-1 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {form.isEdit ? t.subscriptions.saveEdit : t.subscriptions.saveAdd}
            </button>
          </div>
        </>
      )}
    </>
  )
}

export type AddSubscriptionSheetProps = {
  open: boolean
  onClose: () => void
  editing: Subscription | null
  /** Increment when opening add (not edit) so the form resets between opens. */
  instanceKey: number
}

/**
 * Catalog → configure sheet for new subscriptions; edit opens configure only.
 */
export function AddSubscriptionSheet({ open, onClose, editing, instanceKey }: AddSubscriptionSheetProps) {
  if (!open) return null
  return (
    <ModalShell open={open} onBackdropClick={onClose} padContent>
      <div className="pt-1">
        <AddSubscriptionSheetInner
          key={`${editing?.id ?? 'new'}-${instanceKey}`}
          editing={editing}
          onClose={onClose}
        />
      </div>
    </ModalShell>
  )
}
