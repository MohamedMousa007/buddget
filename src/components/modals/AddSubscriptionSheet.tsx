'use client'

import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { Input } from '@/components/ui/input'
import { AddSubscriptionConfigureView } from '@/components/modals/AddSubscriptionConfigureView'
import { SubscriptionCatalogGrid } from '@/components/features/subscriptions/SubscriptionCatalogGrid'
import { useAddSubscriptionForm } from '@/hooks/useAddSubscriptionForm'
import { useT } from '@/lib/i18n'
import type { Subscription } from '@/lib/store/types'
import { cn } from '@/lib/utils'

const selectClass = cn(
  'w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 py-2 text-sm text-[var(--color-brand-text-primary)]'
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

  const headerTitle =
    form.step === 1 && form.showCatalog
      ? t.subscriptions.addSubscription
      : form.pickedBrand && form.pickedBrand !== 'custom'
        ? form.pickedBrand.name
        : editing
          ? t.subscriptions.editSubscription
          : t.subscriptions.addSubscription

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
              className="mb-2 ms-6 text-sm text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)]"
            >
              {t.common.back}
            </button>
          ) : null}
          <AddSubscriptionConfigureView
            form={form}
            t={{ subscriptions: t.subscriptions, goals: t.goals }}
            selectClass={selectClass}
          />
          <div className="flex gap-3 px-6 pb-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-[var(--color-brand-border)] text-sm font-medium text-[var(--color-brand-text-secondary)]"
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              onClick={form.submit}
              className="flex-1 py-3 rounded-xl bg-[var(--color-brand-red)] text-sm font-medium text-[var(--color-brand-text-primary)]"
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
    <ModalShell open={open} onBackdropClick={onClose} dragToClose>
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
