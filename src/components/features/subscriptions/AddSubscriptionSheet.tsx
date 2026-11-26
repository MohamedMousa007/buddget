'use client'

import { Button } from '@/components/ui/button'
import { useAddSubscriptionForm } from '@/hooks/useAddSubscriptionForm'
import { useT } from '@/lib/i18n'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'
import type { Subscription } from '@/lib/store/types'
import { AddCatalogStep } from './AddCatalogStep'
import { AddConfigureStep } from './AddConfigureStep'
import { SheetFrame } from './SheetFrame'

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
  const lt = useDebtsSubsLtCopy().subs
  const ui = t.subscriptions.ui
  const form = useAddSubscriptionForm(editing, onClose, seedBrandKey)
  const { draft } = form
  const named = [draft.name, draft.planName].filter(Boolean).join(' ')

  const title = form.isEdit
    ? ui.detail.edit
    : form.step === 1
      ? t.subscriptions.addSubscription
      : lt.addTitle
  const cta = form.isEdit ? ui.add.saveNamed(named || draft.name) : lt.addCta(draft.name || t.subscriptions.addSubscription)

  const footer =
    form.step === 2 ? (
      <Button size="cta-block" disabled={!form.canSubmit} onClick={form.submit}>
        {cta}
      </Button>
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
