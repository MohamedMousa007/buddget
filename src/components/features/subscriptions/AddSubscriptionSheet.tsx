'use client'

import { Button } from '@/components/ui/button'
import { useAddSubscriptionForm } from '@/hooks/useAddSubscriptionForm'
import { useLocale, useT } from '@/lib/i18n'
import type { Subscription } from '@/lib/store/types'
import { AddCatalogStep } from './AddCatalogStep'
import { AddConfigureStep } from './AddConfigureStep'
import { SheetFrame } from './SheetFrame'
import { currencyLabel } from './subscriptionLabels'
import { formatWhole } from '@/lib/utils/formatters'

function Inner({
  editing,
  seedBrandKey,
  onClose,
}: {
  editing: Subscription | null
  seedBrandKey: string | null
  onClose: () => void
}) {
  const t = useT()
  const { locale } = useLocale()
  const ui = t.subscriptions.ui
  const form = useAddSubscriptionForm(editing, onClose, seedBrandKey)
  const { draft } = form
  const named = [draft.name, draft.planName].filter(Boolean).join(' ')

  const title = form.isEdit
    ? ui.detail.edit
    : form.step === 1
      ? t.subscriptions.addSubscription
      : named
        ? ui.add.addNamed(named)
        : t.subscriptions.addSubscription
  const cta = form.isEdit ? ui.add.saveNamed(named || draft.name) : ui.add.addNamed(named || t.subscriptions.addSubscription)

  const footer =
    form.step === 2 ? (
      <>
        {!draft.trial ? (
          <div className="flex justify-between gap-2 text-[13px]">
            <span className="font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">
              {ui.add.impact(formatWhole(form.impact.monthly), currencyLabel(form.base, locale))}
            </span>
            <span className="font-mono-numbers text-[var(--color-brand-text-secondary)]">
              {ui.add.committedBecomes(formatWhole(form.impact.after))}
            </span>
          </div>
        ) : null}
        <Button size="cta-block" disabled={!form.canSubmit} onClick={form.submit}>
          {cta}
        </Button>
      </>
    ) : undefined

  return (
    <SheetFrame
      open
      onClose={onClose}
      title={title}
      onBack={!form.isEdit && form.step === 2 ? () => form.setStep(1) : undefined}
      footer={footer}
    >
      {form.step === 1 ? <AddCatalogStep form={form} /> : <AddConfigureStep form={form} />}
    </SheetFrame>
  )
}

export interface AddSubscriptionSheetProps {
  open: boolean
  onClose: () => void
  editing: Subscription | null
  /** A brand chosen before the sheet opened (first-run tile): start on the configure step. */
  seedBrandKey?: string | null
  /** Changes when add (not edit) is opened again, so the form resets. */
  instanceKey: number
}

/** Add (catalog → configure) and Edit (configure, prefilled) for one subscription. */
export function AddSubscriptionSheet({ open, onClose, editing, seedBrandKey = null, instanceKey }: AddSubscriptionSheetProps) {
  if (!open) return null
  return (
    <Inner
      key={`${editing?.id ?? seedBrandKey ?? 'new'}-${instanceKey}`}
      editing={editing}
      seedBrandKey={seedBrandKey}
      onClose={onClose}
    />
  )
}
