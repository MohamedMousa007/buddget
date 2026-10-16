'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { IconButton } from '@/components/ui/IconButton'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { AmountCurrencyRow, PocketRadioList } from '@/components/features/savings-v3/MoneySheetParts'
import type { PocketVM } from '@/components/features/savings-v3/types'
import { formatWhole as fmtNum } from '@/lib/utils/formatters'
import { micro } from '@/lib/ui/microLabelStyle'
import { useT } from '@/lib/i18n'
import type { Currency } from '@/lib/store/types'

export interface AddSavingsSheetV3Props {
  open: boolean
  onClose: () => void
  pockets: PocketVM[]
  /** Preselects this pocket; otherwise the first one is selected. */
  defaultAccountId?: string | null
  leftToSpend: number
}

export function AddSavingsSheetV3({ open, onClose, pockets, defaultAccountId }: AddSavingsSheetV3Props) {
  const t = useT().wealthSheets.money
  const deposit = useFinanceStore((s) => s.depositToSavings)
  const baseCurrency = useFinanceStore((s) => s.settings.baseCurrency)

  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>(baseCurrency)
  const [selectedId, setSelectedId] = useState<string | null>(defaultAccountId ?? pockets[0]?.account.id ?? null)
  const [source, setSource] = useState<'budget' | 'had'>('budget')
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')

  const amountNum = parseFloat(amount) || 0
  const selected = pockets.find((p) => p.account.id === selectedId)
  const canSubmit = amountNum > 0 && !!selected

  const submit = () => {
    if (!selected || amountNum <= 0) return
    deposit(selected.account.id, amountNum, currency, note.trim() || undefined, {
      mode: source === 'budget' ? 'allocate' : 'declare',
    })
    onClose()
  }

  if (!open) return null

  return (
    <ModalShell open={open} onBackdropClick={onClose} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={onClose}>
          <V3SheetHeader.Title>{t.addTitle}</V3SheetHeader.Title>
          <V3SheetHeader.Subtitle>{t.addSub}</V3SheetHeader.Subtitle>
        </V3SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-3 pt-2">
          <div>
            <p style={micro} className="mb-2">{t.into}</p>
            <PocketRadioList pockets={pockets} value={selectedId} onChange={setSelectedId} label={t.into} />
          </div>

          <AmountCurrencyRow
            amount={amount} onAmount={setAmount} currency={currency} onCurrency={setCurrency}
            amountLabel={t.amount} currencyLabel={t.currency}
          />

          <div>
            <p style={micro} className="mb-2">{t.whereFrom}</p>
            <SegmentedControl
              ariaLabel={t.whereFrom}
              value={source}
              onChange={setSource}
              options={[
                { value: 'budget', label: t.thisMonth },
                { value: 'had', label: t.outside },
              ]}
            />
            <p className="mt-2 text-xs text-[var(--color-brand-text-muted)]">{source === 'budget' ? t.tipThisMonth : t.tipOutside}</p>
          </div>

          {noteOpen ? (
            <div className="relative">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.notePlaceholder} size="brand" className="pe-12" />
              <IconButton onClick={() => { setNote(''); setNoteOpen(false) }} aria-label={t.clearNote} size="sm" className="absolute end-2 top-1/2 -translate-y-1/2">
                <X size={16} />
              </IconButton>
            </div>
          ) : (
            <Button variant="link" size="sm" onClick={() => setNoteOpen(true)} className="font-semibold no-underline hover:underline">
              <Plus size={14} /> {t.note}
            </Button>
          )}
        </div>

        <div className="px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">
          <Button size="cta-block" onClick={submit} disabled={!canSubmit} className="font-semibold">
            {selected ? t.addCta(amountNum > 0 ? fmtNum(amountNum) : '', selected.account.name) : t.choosePocket}
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}
