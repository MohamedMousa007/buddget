'use client'

import { Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { DebtFiatCurrencySelect } from '@/components/ui/DebtFiatCurrencySelect'
import type { Debt, DebtCurrency, GoldKarat } from '@/lib/store/types'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useEditDebtForm } from '@/hooks/useEditDebtForm'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'

export function EditDebtForm({
  debt,
  isOpen,
  onClose,
}: {
  debt: Debt
  isOpen: boolean
  onClose: () => void
}) {
  useEscapeClose(isOpen, onClose)
  const f = useEditDebtForm(debt, isOpen)
  const settings = useFinanceStore((s) => s.settings)

  return (
    <div className="p-6">
      <ModalSheetHeader title="Edit Debt" onClose={onClose} />

      <div className="space-y-4">
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">Debt Name</Label>
          <Input
            value={f.name}
            onChange={(e) => f.setName(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
          />
        </div>

        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">Person</Label>
          <Input
            value={f.person}
            onChange={(e) => f.setPerson(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
          />
        </div>

        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">Description (optional)</Label>
          <Input
            placeholder="e.g. Gold jewelry, Wedding loan..."
            value={f.description}
            onChange={(e) => f.setDescription(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white placeholder:text-[var(--color-brand-text-muted)]"
          />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">Gold Debt?</Label>
          <Switch
            checked={f.isGold}
            onCheckedChange={(val) => {
              f.setIsGold(val)
              if (val) f.setCurrency('XAU')
              else f.setCurrency(settings.baseCurrency as DebtCurrency)
            }}
          />
        </div>

        {!f.isGold && (
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">Currency</Label>
            <DebtFiatCurrencySelect
              value={f.currency}
              onChange={f.setCurrency}
              className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
            />
          </div>
        )}

        {f.isGold && (
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">Karat</Label>
            <select
              value={f.goldKarat}
              onChange={(e) => f.setGoldKarat(parseInt(e.target.value, 10) as GoldKarat)}
              className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
            >
              <option value="24">24K (99.9%)</option>
              <option value="22">22K (91.7%)</option>
              <option value="21">21K (87.5%)</option>
              <option value="18">18K (75%)</option>
            </select>
          </div>
        )}

        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">Notes (optional)</Label>
          <Textarea
            value={f.notes}
            onChange={(e) => f.setNotes(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white min-h-[60px]"
          />
        </div>

        <p className="text-xs text-[var(--color-brand-text-muted)]">
          Starting balance ({debt.isGold ? `${debt.startingBalance}g` : `${debt.currency} ${debt.startingBalance}`})
          cannot be changed — delete and recreate the debt if needed.
        </p>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => f.handleDelete(onClose)}
            className="py-3 px-4 rounded-xl border border-red-900/50 text-sm text-[var(--color-brand-red)] hover:bg-red-900/20 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => f.handleSave(onClose)}
            disabled={!f.name || !f.person}
            className="flex-1 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
