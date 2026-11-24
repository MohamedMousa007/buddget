'use client'

import { useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useActionToast } from '@/components/ui/ActionToast'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { AccountLegRow, AmountCurrencyRow, LabeledBlock, NoteField, PocketPickerField, SheetBody, SheetFooter } from '@/components/features/savings-v3/MoneySheetParts'
import { AddHoldingSheet } from '@/components/features/savings-v3/AddHoldingSheet'
import { useLegAccount } from '@/components/features/savings-v3/useLegAccount'
import { useDepositGuard } from '@/components/features/savings-v3/useDepositGuard'
import type { PocketVM } from '@/components/features/savings-v3/types'
import { pocketCurrency, selectedPocket } from '@/components/features/savings-v3/selectedPocket'
import { accountTitle } from '@/components/features/accounts/accountDisplay'
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
  const pickPocket = (id: string | null, created?: Currency) => {
    setSelectedId(id)
    const c = pocketCurrency(pockets, id, created)
    if (c) setCurrency(c)
  }
  const [addingPocket, setAddingPocket] = useState(false)
  const [source, setSource] = useState<'budget' | 'had'>('budget')
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')

  const amountNum = parseFloat(amount) || 0
  const selected = selectedPocket(pockets, selectedId, defaultAccountId)
  const leg = useLegAccount(selected?.account, selected?.account.currency ?? currency, true)
  const guard = useDepositGuard(selected?.account)
  const mode = source === 'budget' ? 'allocate' : 'declare'
  const refusal = guard.refusalFor({ amount: amountNum, currency, mode, fromAccountId: leg.accountId })
  const canSubmit = amountNum > 0 && !!selected && !refusal
  // Another account funding a pocket held in an account: the money really moves between the two.
  const transferFrom = source === 'budget' && guard.holder && leg.accountId !== guard.holder.id
    ? leg.views.find((v) => v.method.id === leg.accountId)?.method
    : undefined

  const submit = () => {
    if (!selected || amountNum <= 0 || refusal) return
    const ok = deposit(selected.account.id, amountNum, currency, note.trim() || undefined, { mode, fromAccountId: leg.accountId })
    if (!ok) return showToast(t.moveFailed)
    onClose()
  }

  if (!open) return null

  return (
    <>
    <ModalShell open={open} onBackdropClick={onClose} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={onClose}>
          <V3SheetHeader.Title>{t.addTitle}</V3SheetHeader.Title>
          <V3SheetHeader.Subtitle>{t.addSub}</V3SheetHeader.Subtitle>
        </V3SheetHeader>

        <SheetBody>
          <LabeledBlock label={t.into}>
            <PocketPickerField pockets={pockets} value={selected?.account.id ?? null} onChange={pickPocket} label={t.into} onAdd={() => setAddingPocket(true)} />
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
          {transferFrom && guard.holder ? (
            <p className="text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{t.transferFromTo(accountTitle(transferFrom), accountTitle(guard.holder))}</p>
          ) : null}

          {refusal ? (
            <p role="alert" className="text-[0.8125rem] text-[var(--color-brand-amber)]">
              {guard.message(refusal, leg.accountId)}{refusal === 'no_account_leg' ? ` ${t.noAccountLegHint}` : ''}
            </p>
          ) : null}

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
    {/* A sibling sheet above this one, so the typed amount survives creating a pocket. */}
    <AddHoldingSheet open={addingPocket} pocketOnly onClose={() => setAddingPocket(false)} onPocketCreated={pickPocket} />
    </>
  )
}
