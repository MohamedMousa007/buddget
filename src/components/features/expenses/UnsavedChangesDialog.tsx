'use client'

import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Scrim } from '@/components/ui/Scrim'
import { useLocale, useT } from '@/lib/i18n'
import { useFlowLtCopy } from '@/lib/i18n/flowLtCopy'

/**
 * "Save your changes?" over an edited money sheet (expense, income): Save, Discard, or Keep editing. Leaving with edits
 * by the close button, a backdrop tap, Escape or Android back opens it; the sheet decides what each answer does.
 */
export function UnsavedChangesDialog({ open, body, saveLabel, onSave, onDiscard, onKeep }: { open: boolean; body: string; saveLabel?: string; onSave: () => void; onDiscard: () => void; onKeep: () => void }) {
  const t = useT()
  const lt = useFlowLtCopy()
  const { locale } = useLocale()
  const ar = locale === 'ar'
  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <div dir={ar ? 'rtl' : 'ltr'} className="fixed inset-0 z-[125] flex items-center justify-center p-7" style={{ animation: 'efFade .16s ease' }}>
      <Scrim label={t.common.close} onClick={onKeep} tone="heavy" blur={false} />
      <Card
        padding="none"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-title"
        className="relative w-full max-w-72 px-5 pb-5 pt-6 text-start"
        style={{
          boxShadow: '0 24px 60px -12px rgba(0,0,0,.4)',
          animation: 'efPop .22s cubic-bezier(.22,1,.36,1)',
          fontFamily: ar ? 'var(--font-sans-ar)' : 'var(--font-sans)',
        }}
      >
        <div id="unsaved-title" className="text-lg font-semibold text-[var(--color-brand-text-primary)]">{t.expenseForm.confirmTitle}</div>
        <div className="mt-2 text-sm font-normal leading-[1.45] text-[var(--color-brand-text-muted)]">{body}</div>
        <div className="mt-5 flex flex-col gap-2.5">
          <Button type="button" onClick={onSave} size="cta" className="text-base font-semibold">
            {saveLabel ?? t.expenseForm.saveChanges}
          </Button>
          <Button
            type="button"
            onClick={onDiscard}
            variant="outline"
            size="cta"
            className="bg-transparent text-base font-semibold text-[var(--color-brand-red)] hover:bg-[var(--color-brand-elevated)]"
          >
            {t.expenseForm.discardChanges}
          </Button>
          <Button type="button" variant="ghost" size="cta" className="text-base font-semibold" onClick={onKeep}>
            {lt.expense.keepEditing}
          </Button>
        </div>
      </Card>
    </div>,
    document.body,
  )
}
