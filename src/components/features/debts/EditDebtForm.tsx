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
import { useT } from '@/lib/i18n'

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
  const t = useT()

  return (
    <div className="p-6">
      <ModalSheetHeader title={`${t.common.edit} balance`} onClose={onClose} />

      <div className="space-y-4">
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelName}</Label>
          <Input
            value={f.name}
            onChange={(e) => f.setName(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
          />
        </div>

        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelPerson}</Label>
          <Input
            value={f.person}
            onChange={(e) => f.setPerson(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
          />
        </div>

        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelDescription}</Label>
          <Input
            placeholder={t.addDebt.placeholderDescription}
            value={f.description}
            onChange={(e) => f.setDescription(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white placeholder:text-[var(--color-brand-text-muted)]"
          />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelGold}</Label>
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
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelCurrency}</Label>
            <DebtFiatCurrencySelect
              value={f.currency}
              onChange={f.setCurrency}
              className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
            />
          </div>
        )}

        {f.isGold && (
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelGoldPurity}</Label>
            <select
              value={f.goldKarat}
              onChange={(e) => f.setGoldKarat(parseInt(e.target.value, 10) as GoldKarat)}
              className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
            >
              <option value="24">{t.goldPurity.k24}</option>
              <option value="22">{t.goldPurity.k22}</option>
              <option value="21">{t.goldPurity.k21}</option>
              <option value="18">{t.goldPurity.k18}</option>
            </select>
          </div>
        )}

        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelNotes}</Label>
          <Textarea
            value={f.notes}
            onChange={(e) => f.setNotes(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white min-h-[60px]"
          />
        </div>

        <p className="text-xs text-[var(--color-brand-text-muted)]">
          Starting amount ({debt.isGold ? `${debt.startingBalance}g` : `${debt.currency} ${debt.startingBalance}`})
          can&apos;t be changed — delete and recreate the balance if needed.
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
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={() => f.handleSave(onClose)}
            disabled={!f.name || !f.person}
            className="flex-1 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {t.common.save}
          </button>
        </div>
      </div>
    </div>
  )
}
