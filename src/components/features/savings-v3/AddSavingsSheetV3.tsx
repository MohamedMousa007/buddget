'use client'

import { useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useActionToast } from '@/components/ui/ActionToast'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { AccountLegRow, AmountCurrencyRow, LabeledBlock, NoteField, PocketRadioList, SheetBody, SheetFooter } from '@/components/features/savings-v3/MoneySheetParts'
import { useLegAccount } from '@/components/features/savings-v3/useLegAccount'
import type { PocketVM } from '@/components/features/savings-v3/types'
import { formatWhole as fmtNum } from '@/lib/utils/formatters'
import { useT } from '@/lib/i18n'
import { pocketDisplayName } from '@/lib/savings/pocketIdentity'
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
  const sf = useT().savingsForms
  const deposit = useFinanceStore((s) => s.depositToSavings)
  const showToast = useActionToast()
  const baseCurrency = useFinanceStore((s) => s.settings.baseCurrency)

  const [amount, setAmount] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(defaultAccountId ?? pockets[0]?.account.id ?? null)
  const [currency, setCurrency] = useState<Currency>(
    () => pockets.find((p) => p.account.id === selectedId)?.account.currency ?? baseCurrency,
  )
  const pickPocket = (id: string | null) => {
    setSelectedId(id)
    const c = pockets.find((p) => p.account.id === id)?.account.currency
    if (c) setCurrency(c)
  }
  const [source, setSource] = useState<'budget' | 'had'>('budget')
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')

  const amountNum = parseFloat(amount) || 0
  const selected = pockets.find((p) => p.account.id === selectedId)
  const canSubmit = amountNum > 0 && !!selected
  const leg = useLegAccount(selected?.account, selected?.account.currency ?? currency)

  const submit = () => {
    if (!selected || amountNum <= 0) return
    const ok = deposit(selected.account.id, amountNum, currency, note.trim() || undefined, {
      mode: source === 'budget' ? 'allocate' : 'declare',
      fromAccountId: leg.accountId,
    })
    if (!ok) return showToast(t.moveFailed)
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

        <SheetBody>
          <LabeledBlock label={t.into}>
            <PocketRadioList pockets={pockets} value={selectedId} onChange={pickPocket} label={t.into} />
          </LabeledBlock>

          <AmountCurrencyRow
            amount={amount} onAmount={setAmount} currency={currency} onCurrency={setCurrency}
            amountLabel={t.amount} currencyLabel={t.currency}
          />

          <LabeledBlock label={t.whereFrom}>
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
          </LabeledBlock>

          {source === 'budget' ? <AccountLegRow leg={leg} label={t.fromAccount} /> : null}

          <NoteField open={noteOpen} onOpen={() => setNoteOpen(true)} onClose={() => setNoteOpen(false)} value={note} onChange={setNote}
            labels={{ add: t.note, placeholder: t.notePlaceholder, clear: t.clearNote }} />
        </SheetBody>

        <SheetFooter safeArea>
          <Button size="cta-block" onClick={submit} disabled={!canSubmit} className="font-semibold">
            {selected ? t.addCta(amountNum > 0 ? fmtNum(amountNum) : '', pocketDisplayName(selected.account, sf.systemNames)) : t.choosePocket}
          </Button>
        </SheetFooter>
      </div>
    </ModalShell>
  )
}
