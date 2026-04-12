'use client'

import { useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FiatCurrencySelect } from '@/components/ui/FiatCurrencySelect'
import type { Currency } from '@/lib/store/types'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { useT } from '@/lib/i18n'

export interface AddSavingsAccountSheetProps {
  open: boolean
  onClose: () => void
}

/**
 * Create a new savings account (zero balance; fund via Add to savings).
 */
export function AddSavingsAccountSheet({ open, onClose }: AddSavingsAccountSheetProps) {
  const t = useT()
  const settings = useFinanceStore((s) => s.settings)
  const addSavingsAccount = useFinanceStore((s) => s.addSavingsAccount)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('💰')
  const [currency, setCurrency] = useState<Currency>(settings.baseCurrency)
  const [target, setTarget] = useState('')

  const submit = () => {
    if (!name.trim()) return
    const tgt = parseFloat(target)
    addSavingsAccount({
      name: name.trim(),
      emoji: emoji.trim() || '💰',
      currency: clampFiatToAllowed(settings, currency),
      targetAmount: Number.isFinite(tgt) && tgt > 0 ? tgt : undefined,
    })
    setName('')
    setEmoji('💰')
    setCurrency(settings.baseCurrency)
    setTarget('')
    onClose()
  }

  if (!open) return null

  return (
    <ModalShell open={open} onBackdropClick={onClose}>
      <div className="p-6 max-h-[90vh] overflow-y-auto">
        <ModalSheetHeader title={t.savings.addAccount} onClose={onClose} />
        <div className="mt-4 space-y-3">
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.savings.labelName}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 h-10 rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">Emoji</Label>
              <Input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                className="mt-1 h-10 rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]"
              />
            </div>
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">
                {t.savings.labelCurrency}
              </Label>
              <FiatCurrencySelect
                value={currency}
                onChange={setCurrency}
                className="mt-1 h-10 w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-2 text-sm"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">
              Goal (optional)
            </Label>
            <Input
              type="number"
              step="0.01"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="mt-1 h-10 rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] font-mono-numbers"
            />
          </div>
          <button
            type="button"
            onClick={submit}
            className="w-full rounded-xl bg-[var(--color-brand-red)] py-3 text-sm font-semibold text-white"
          >
            {t.savings.createAccountButton}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
