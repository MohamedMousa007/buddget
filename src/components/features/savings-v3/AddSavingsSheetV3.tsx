'use client'

import { useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { useDiscardPrompt } from '@/components/features/savings-v3/useDiscardPrompt'
import { AmountHero } from '@/components/ui/AmountHero'
import { Button } from '@/components/ui/button'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { HEADER_PILL } from '@/components/ui/PillButton'
import { useActionToast } from '@/components/ui/ActionToast'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { NoteRow, PocketPickerField, PocketTile, SheetBody, SheetFooter } from '@/components/features/savings-v3/MoneySheetParts'
import { MoneySourceField, type MoneySource } from '@/components/features/savings-v3/MoneySourceField'
import { AddHoldingSheet } from '@/components/features/savings-v3/AddHoldingSheet'
import { useLegAccount } from '@/components/features/savings-v3/useLegAccount'
import { useDepositGuard } from '@/components/features/savings-v3/useDepositGuard'
import type { PocketVM } from '@/components/features/savings-v3/types'
import { pocketCurrency, selectedPocket } from '@/components/features/savings-v3/selectedPocket'
import { accountTitle } from '@/components/features/accounts/accountDisplay'
import { formatWhole as fmtNum } from '@/lib/utils/formatters'
import { useT } from '@/lib/i18n'
import { useGoalsLtCopy } from '@/lib/i18n/goalsLtCopy'
import { pocketDisplayName } from '@/lib/savings/pocketIdentity'
import { applyPocketDeposit } from '@/lib/savings/moneySourceDeposit'
import { localTodayISO } from '@/lib/utils/localDate'
import { manualOccurredAt } from '@/lib/time/occurredAt'
import { useFlowLtCopy } from '@/lib/i18n/flowLtCopy'
import type { Currency } from '@/lib/store/types'

export interface AddSavingsSheetV3Props {
  open: boolean
  onClose: () => void
  pockets: PocketVM[]
  /** Preselects this pocket; otherwise the first one is selected. */
  defaultAccountId?: string | null
  leftToSpend: number
}

/**
 * Add money into a pocket: the pocket's own icon over the amount, then Into and where the money comes from (an
 * account, another pocket, or outside buddget). Each source maps to one store write (see `applyPocketDeposit`).
 */
export function AddSavingsSheetV3({ open, onClose, pockets, defaultAccountId }: AddSavingsSheetV3Props) {
  const t = useT().wealthSheets.money
  const sf = useT().savingsForms
  const c = useGoalsLtCopy().money
  const showToast = useActionToast()
  const baseCurrency = useFinanceStore((s) => s.settings.baseCurrency)

  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => localTodayISO())
  const [clock, setClock] = useState('')
  const timeLabel = useFlowLtCopy().expense.time
  const [selectedId, setSelectedId] = useState<string | null>(defaultAccountId ?? pockets[0]?.account.id ?? null)
  const [currency, setCurrency] = useState<Currency>(
    () => pockets.find((p) => p.account.id === selectedId)?.account.currency ?? baseCurrency,
  )
  const [addingPocket, setAddingPocket] = useState(false)
  // An account with no id follows the pocket's default source (the account holding it first).
  const [source, setSource] = useState<MoneySource>({ kind: 'account' })
  const pickPocket = (id: string | null, created?: Currency) => {
    setSelectedId(id)
    const cur = pocketCurrency(pockets, id, created)
    if (cur) setCurrency(cur)
    // A pocket cannot fund itself: picking the source pocket as the target resets the source.
    if (source.kind === 'pocket' && source.id === id) setSource({ kind: 'account' })
  }
  const [note, setNote] = useState('')
  const discard = useDiscardPrompt(amount.trim() !== '' || note.trim() !== '', onClose)

  const amountNum = parseFloat(amount) || 0
  const selected = selectedPocket(pockets, selectedId, defaultAccountId)
  const leg = useLegAccount(selected?.account, selected?.account.currency ?? currency, true)
  const guard = useDepositGuard(selected?.account)
  const effective: MoneySource = source.kind === 'account' ? { kind: 'account', id: source.id ?? leg.accountId ?? undefined } : source
  const fromPocket = effective.kind === 'pocket' ? pockets.find((p) => p.account.id === effective.id)?.account : undefined

  const refusal = effective.kind === 'pocket'
    ? null
    : guard.refusalFor({ amount: amountNum, currency, mode: effective.kind === 'outside' ? 'declare' : 'allocate', fromAccountId: effective.id ?? null })
  const pocketShort = fromPocket && fromPocket.currency === currency && amountNum > fromPocket.currentBalance
  const canSubmit = amountNum > 0 && !!selected && !refusal && !pocketShort && (effective.kind !== 'pocket' || (!!fromPocket && fromPocket.id !== selected.account.id))

  const sourceLine = (() => {
    if (effective.kind === 'outside') return c.srcOutside
    if (effective.kind === 'pocket') return fromPocket ? c.srcPocket(pocketDisplayName(fromPocket, sf.systemNames)) : ''
    const method = leg.views.find((v) => v.method.id === effective.id)?.method
    if (!method) return ''
    return guard.holder && method.id === guard.holder.id ? c.srcHeld : c.srcAccount(accountTitle(method))
  })()
  const before = selected?.account.currentBalance ?? 0
  const sameUnit = selected && selected.account.currency === currency
  const line = selected ? (
    <>
      <span className="block text-[1.0625rem] font-semibold text-[var(--color-brand-text-primary)]" dir="auto">
        {c.intoTitle(pocketDisplayName(selected.account, sf.systemNames))}
      </span>
      <span className="mt-1 block">
        {sameUnit ? <span className="font-mono-numbers">{c.change(fmtNum(before), fmtNum(before + amountNum))}</span> : null}
        {sameUnit && sourceLine ? ' · ' : null}
        {sourceLine}
      </span>
    </>
  ) : ''

  const submit = () => {
    if (!selected || !canSubmit) return
    const ok = applyPocketDeposit(useFinanceStore.getState(), {
      pocketId: selected.account.id,
      amount: amountNum,
      currency,
      source: effective,
      note: note.trim() || undefined,
      date: date !== localTodayISO() ? date : undefined,
      occurredAt: manualOccurredAt(date, clock),
    })
    if (!ok) return showToast(t.moveFailed)
    onClose()
  }

  if (!open) return null

  return (
    <>
    <ModalShell open={open} onBackdropClick={onClose} scrollChild>
      {discard.prompt}
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={discard.close} leading={<DatePickerField look="pill" className={HEADER_PILL} value={date} onChange={setDate} time={{ value: clock, onChange: setClock, label: timeLabel, defaultNow: true }} />}>
          <span className="sr-only"><V3SheetHeader.Title>{c.title}</V3SheetHeader.Title></span>
        </V3SheetHeader>

        <SheetBody className="space-y-3 pt-0">
          <AmountHero
            value={amount}
            onChange={setAmount}
            currency={currency}
            onCurrencyChange={(code) => setCurrency(code as Currency)}
            base={baseCurrency}
            sign="+"
            top={selected ? <PocketTile account={selected.account} className="size-[52px] rounded-2xl" iconClassName="size-6" /> : undefined}
            line={line}
            className="px-0"
          />

          <MoneySourceField
            value={effective}
            onChange={setSource}
            paymentMethods={leg.views.map((v) => v.method)}
            pockets={pockets}
            excludePocketIds={selected ? [selected.account.id] : undefined}
          >
            <PocketPickerField look="row" pockets={pockets} value={selected?.account.id ?? null} onChange={pickPocket} label={c.into} onAdd={() => setAddingPocket(true)} />
          </MoneySourceField>

          {refusal ? (
            <p role="alert" className="text-[0.8125rem] text-[var(--color-brand-amber)]">
              {guard.message(refusal, effective.id)}{refusal === 'no_account_leg' ? ` ${t.noAccountLegHint}` : ''}
            </p>
          ) : pocketShort && fromPocket ? (
            <p role="alert" className="text-[0.8125rem] text-[var(--color-brand-amber)]">
              {c.overPocket(pocketDisplayName(fromPocket, sf.systemNames), fmtNum(fromPocket.currentBalance))}
            </p>
          ) : null}

          <NoteRow value={note} onChange={setNote} placeholder={c.addNote} />
        </SheetBody>

        <SheetFooter safeArea>
          <Button size="cta-block" onClick={submit} disabled={!canSubmit} className="font-semibold">
            {selected ? c.addCta : t.choosePocket}
          </Button>
        </SheetFooter>
      </div>
    </ModalShell>
    {/* A sibling sheet above this one, so the typed amount survives creating a pocket. */}
    <AddHoldingSheet open={addingPocket} pocketOnly onClose={() => setAddingPocket(false)} onPocketCreated={pickPocket} />
    </>
  )
}
