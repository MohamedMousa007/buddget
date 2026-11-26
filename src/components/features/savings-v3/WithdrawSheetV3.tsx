'use client'

import { defaultWithdrawSource } from '@/lib/savings/withdrawSource'
import { balanceEpsilon } from '@/lib/savings/balanceMath'
import { useMemo, useState } from 'react'
import { ArrowLeftRight, Bitcoin, Briefcase, Coins, Landmark, LineChart, Receipt, TrendingUp } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { Card } from '@/components/ui/card'
import { reconcileDebtSchedule } from '@/lib/debts/recurringDebtDueHandlers'
import { overpaysDebt } from '@/lib/debts/overpaysDebt'
import { useSubmitOnce } from '@/hooks/useSubmitOnce'
import { newClientId, useFinanceStore } from '@/lib/store/useFinanceStore'
import { useDebtTabData } from '@/hooks/useDebtTabData'
import { useAssetPrices } from '@/hooks/useAssetPrices'
import { valueInvestmentHolding } from '@/lib/savings/holdingValuation'
import { convertCurrency, tryConvertWithGold } from '@/lib/utils/currency'
import { debtPaymentForWithdrawal } from '@/lib/debts/withdrawalPayment'
import { investTopUpPatch } from '@/lib/savings/investTopUp'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { LabeledBlock, NoteRow, PocketPickerField, PocketTile, SheetBody, SheetFooter } from '@/components/features/savings-v3/MoneySheetParts'
import { AmountHero } from '@/components/ui/AmountHero'
import { PickerRow } from '@/components/ui/PickerRow'
import { OptionSheet, type OptionSheetOption } from '@/components/ui/OptionSheet'
import { accountTitle } from '@/components/features/accounts/accountDisplay'
import { useGoalsLtCopy } from '@/lib/i18n/goalsLtCopy'
import { useLegAccount } from '@/components/features/savings-v3/useLegAccount'
import { formatWhole as fmtNum } from '@/lib/utils/formatters'
import { localTodayISO } from '@/lib/utils/localDate'
import { manualOccurredAt } from '@/lib/time/occurredAt'
import { useDiscardPrompt } from '@/components/features/savings-v3/useDiscardPrompt'
import { useT } from '@/lib/i18n'
import { pocketDisplayName } from '@/lib/savings/pocketIdentity'
import { incomeDestination } from '@/lib/savings/withdrawDestination'
import { isTracked } from '@/lib/accounts/kinds'
import { useActionToast } from '@/components/ui/ActionToast'
import type { PocketVM } from '@/components/features/savings-v3/types'
import type { Currency, InvestmentAssetType, SavingsWithdrawalPurpose } from '@/lib/store/types'
import { Button } from '@/components/ui/button'
import { SettingsSwitchRow } from '@/components/features/settings/SettingsSwitchRow'
import { EXPENSE_CATEGORY_GRID } from '@/lib/constants/categoryGrid'
import { DEFAULT_CASH_ID } from '@/lib/store/migrations/v17_uuid_remap'
import { OptionChip } from '@/components/ui/OptionChip'

const INVEST_CLASSES: Array<{ type: InvestmentAssetType; label: 'assetGold' | 'assetCrypto' | 'assetStocks'; icon: React.ReactNode }> = [
  { type: 'gold', label: 'assetGold', icon: <Coins size={15} /> },
  { type: 'crypto', label: 'assetCrypto', icon: <Bitcoin size={15} /> },
  { type: 'stock', label: 'assetStocks', icon: <LineChart size={15} /> },
]

type Reason = SavingsWithdrawalPurpose // 'income' | 'transfer' | 'debt' | 'spend'
type Purpose = Reason | 'move'

const PURPOSES: Array<{ key: Purpose; color: string; icon: React.ReactNode }> = [
  { key: 'spend', color: 'var(--color-brand-primary)', icon: <Receipt /> },
  { key: 'debt', color: 'var(--color-brand-amber)', icon: <Landmark /> },
  { key: 'transfer', color: 'var(--color-brand-green)', icon: <TrendingUp /> },
  { key: 'income', color: 'var(--color-brand-green)', icon: <Briefcase /> },
  { key: 'move', color: 'var(--color-brand-text-secondary)', icon: <ArrowLeftRight /> },
]

/** The "To" choice that keeps income in the account holding the pocket. */
const HOLDER = '__holder'

export interface WithdrawSheetV3Props {
  open: boolean
  onClose: () => void
  pockets: PocketVM[]
  defaultAccountId?: string | null
  /** Fallback when a chosen asset class has no existing holding to top up. */
  onNeedAsset?: (type: InvestmentAssetType) => void
}

export function WithdrawSheetV3({ open, onClose, pockets, defaultAccountId, onNeedAsset }: WithdrawSheetV3Props) {
  const t = useT().wealthSheets.money
  const sf = useT().savingsForms
  const lt = useGoalsLtCopy()
  const withdraw = useFinanceStore((s) => s.withdrawFromSavings)
  const showToast = useActionToast()
  const transfer = useFinanceStore((s) => s.transferBetweenPockets)
  const addDebtPayment = useFinanceStore((s) => s.addDebtPayment)
  const addExpense = useFinanceStore((s) => s.addExpense)
  const categoryLabels = useT().expenseForm.categoryLabels
  const updateHolding = useFinanceStore((s) => s.updateInvestmentHolding)
  const holdings = useFinanceStore((s) => s.investmentHoldings)
  const debts = useFinanceStore((s) => s.debts)
  const exchangeRates = useFinanceStore((s) => s.exchangeRates)
  const goldPricePerGram = useFinanceStore((s) => s.goldPricePerGram)
  const goldPriceAvailable = useFinanceStore((s) => s.goldPriceAvailable)
  const baseCurrency = useFinanceStore((s) => s.settings.baseCurrency)
  const { lookup } = useAssetPrices()
  const debtData = useDebtTabData()
  const submitOnce = useSubmitOnce(open)

  const [amount, setAmount] = useState('')
  const [fromId, setFromId] = useState<string | null>(() => defaultWithdrawSource(pockets, defaultAccountId))
  const [currency, setCurrency] = useState<Currency>(
    () => pockets.find((p) => p.account.id === fromId)?.account.currency ?? baseCurrency,
  )
  const pickFrom = (id: string) => {
    setFromId(id)
    if (moveToId === id) setMoveToId(null)
    setAwayFromHolder(false)
    const c = pockets.find((p) => p.account.id === id)?.account.currency
    if (c) setCurrency(c)
  }
  const [purpose, setPurpose] = useState<Purpose>('spend')
  const [sheet, setSheet] = useState<'for' | 'debt' | 'asset' | 'to' | null>(null)
  const [moveToId, setMoveToId] = useState<string | null>(null)
  const [debtId, setDebtId] = useState<string | null>(null)
  const [assetClass, setAssetClass] = useState<InvestmentAssetType | null>(null)
  const [note, setNote] = useState('')
  const [logExpense, setLogExpense] = useState(false)
  const [awayFromHolder, setAwayFromHolder] = useState(false)
  const [expenseCategory, setExpenseCategory] = useState('Other')
  const discard = useDiscardPrompt(amount.trim() !== '' || note.trim() !== '', onClose)

  const moveOn = purpose === 'move'
  const reason: Reason | null = moveOn ? null : purpose
  const from = pockets.find((p) => p.account.id === fromId)
  const amountNum = parseFloat(amount) || 0
  const free = from ? Math.max(0, from.account.currentBalance) : 0
  // Guard against the sheet currency differing from the pocket's — compare like for like.
  const amountInPocket = from
    ? (tryConvertWithGold(amountNum, currency, from.account.currency, exchangeRates, baseCurrency, { pricePerGram: goldPricePerGram, available: goldPriceAvailable !== false }) ?? Infinity)
    : amountNum

  const legCurrency = from?.account.currency === 'XAU' ? baseCurrency : (from?.account.currency ?? currency)
  const leg = useLegAccount(from?.account, legCurrency)
  // Only a tracked, counted holder makes the pocket an earmark; otherwise the pocket is counted on its own and keeps the usual account leg.
  const holderName = useFinanceStore((s) => s.paymentMethods.find((m) => m.id === from?.account.heldInPaymentMethodId && isTracked(m) && !m.excluded)?.name)

  // Active debts, flattened across the three families (screen 07).
  const debtChips = useMemo(
    () => [
      ...debtData.borrow.map((b) => ({ id: b.id, name: b.name, left: b.remaining, currency: b.currency })),
      ...debtData.cards.map((c) => ({ id: c.id, name: c.bank, left: c.outstanding, currency: c.currency })),
      ...debtData.installments.map((i) => ({ id: i.id, name: i.item, left: i.remaining, currency: i.currency })),
    ],
    [debtData],
  )

  // For each asset class, the priceable holding we'd top up (largest by live value) and its
  // per-unit EGP value — so a money amount maps to a quantity to add (screen 08, "Add to it").
  const topupByClass = useMemo(() => {
    const out = new Map<InvestmentAssetType, { id: string; name: string; unitEgp: number }>()
    for (const cls of ['gold', 'crypto', 'stock'] as InvestmentAssetType[]) {
      let best: { id: string; name: string; unitEgp: number; total: number } | null = null
      for (const h of holdings.filter((x) => x.assetType === cls)) {
        const unit = valueInvestmentHolding({ ...h, quantity: 1 }, lookup).value
        const total = valueInvestmentHolding(h, lookup).value
        if (unit == null || unit <= 0 || total == null) continue
        if (!best || total > best.total) best = { id: h.id, name: h.name, unitEgp: unit, total }
      }
      if (best) out.set(cls, { id: best.id, name: best.name, unitEgp: best.unitEgp })
    }
    return out
  }, [holdings, lookup])

  // True once the money moved; false when a check refused it, so the guard can re-arm.
  const commit = (from: PocketVM): boolean => {
    const txId = newClientId()
    // One instant for every row this withdrawal writes (no time pill here: the current time).
    const day = localTodayISO()
    const occurredAt = manualOccurredAt(day)
    if (moveOn) {
      if (!moveToId) return false
      if (!transfer(from.account.id, moveToId, amountInPocket, note.trim() || undefined, day, occurredAt)) { showToast(t.moveFailed); return false }
    } else if (reason === 'debt') {
      const debt = debts.find((d) => d.id === debtId)
      if (!debt) return false
      const noteTrim = note.trim() || undefined
      const { amountPaid, amountInBase, exceeds } = debtPaymentForWithdrawal({ debt, amount: amountNum, currency, base: baseCurrency, rates: exchangeRates, goldPricePerGram, goldAvailable: goldPriceAvailable !== false, left: debtChips.find((d) => d.id === debt.id)?.left })
      if (!(amountPaid > 0) || exceeds || overpaysDebt(useFinanceStore.getState(), { debtId: debt.id, amountPaid })) { showToast(t.moveFailed); return false }
      if (!withdraw(from.account.id, amountNum, currency, noteTrim, 'debt', { txId, date: day, occurredAt })) { showToast(t.moveFailed); return false }
      addDebtPayment({ debtId: debt.id, date: day, occurredAt, amountPaid, paymentCurrency: debt.currency, amountInPrimary: amountInBase, notes: noteTrim, fundedFromSavings: true, fundedFromSavingsTxId: txId })
      reconcileDebtSchedule(debt.id, { amount: amountPaid, currency: debt.currency })
    } else if (reason === 'transfer') {
      if (!assetClass) return false
      const target = topupByClass.get(assetClass)
      if (!target) return false
      // Holdings are EGP-denominated regardless of base currency — pivot on EGP.
      const amountEgp = convertCurrency(amountNum, currency, 'EGP', exchangeRates)
      const qtyAdd = amountEgp / target.unitEgp
      const existing = useFinanceStore.getState().investmentHoldings.find((h) => h.id === target.id)
      if (!existing || qtyAdd <= 0) return false
      if (!withdraw(from.account.id, amountNum, currency, note.trim() || undefined, 'transfer', { date: day, occurredAt })) { showToast(t.moveFailed); return false }
      updateHolding(target.id, investTopUpPatch(existing, qtyAdd, amountEgp, 'EGP', exchangeRates))
    } else if (reason) {
      const spendAndLog = reason === 'spend' && logExpense
      const opts = { date: day, occurredAt, ...(reason === 'income' ? { toAccountId: incomeDestination(holderName ? from.account : undefined, awayFromHolder ? leg.accountId : null, leg.accountId) } : spendAndLog ? { txId } : {}) }
      if (!withdraw(from.account.id, amountNum, currency, note.trim() || undefined, reason, opts)) { showToast(t.moveFailed); return false }
      if (spendAndLog) {
        addExpense({
          date: day, occurredAt, description: note.trim() || pocketDisplayName(from.account, sf.systemNames), category: expenseCategory,
          amount: amountNum, currency, paymentMethodId: DEFAULT_CASH_ID, isRecurring: false, fundedFromSavingsTxId: txId,
        })
      }
    }
    onClose()
    return true
  }

  const submit = () => {
    if (!from || !canSubmit || !submitOnce.claim()) return
    if (!commit(from)) submitOnce.release()
  }

  const debtOverpay = (() => {
    const debt = reason === 'debt' ? debts.find((d) => d.id === debtId) : undefined
    return !!debt && debtPaymentForWithdrawal({ debt, amount: amountNum, currency, base: baseCurrency, rates: exchangeRates, goldPricePerGram, goldAvailable: goldPriceAvailable !== false, left: debtChips.find((d) => d.id === debt.id)?.left }).exceeds
  })()

  const overPocket = !!from && amountNum > 0 && free + balanceEpsilon(from.account.currency) < amountInPocket
  const canSubmit =
    !debtOverpay &&
    !!from &&
    amountNum > 0 &&
    !overPocket &&
    (moveOn
      ? !!moveToId
      : reason === 'debt'
        ? !!debtId
        : reason === 'transfer'
          ? !!assetClass && topupByClass.has(assetClass)
          : !!reason)

  const w = lt.withdraw
  const purposeOptions: OptionSheetOption<Purpose>[] = PURPOSES.map((p) => ({
    value: p.key,
    title: t[p.key === 'transfer' ? 'invest' : p.key],
    subtitle: t[`${p.key === 'transfer' ? 'invest' : p.key}Sub` as 'spendSub'],
    icon: p.icon,
    tone: p.color,
  }))
  const pickPurpose = (k: Purpose) => { setPurpose(k); setDebtId(null); setAssetClass(null); setMoveToId(null); setAwayFromHolder(false) }
  const debt = debtChips.find((d) => d.id === debtId)
  const asset = INVEST_CLASSES.find((c) => c.type === assetClass)
  const toAccount = leg.views.find((v) => v.method.id === leg.accountId)?.method
  const showTo = reason === 'income' && leg.views.length > 0 && (!!holderName || !!leg.accountId)
  const toValue = holderName && !awayFromHolder ? t.staysIn(holderName) : toAccount ? accountTitle(toAccount) : ''
  const toOptions: OptionSheetOption<string>[] = [
    ...(holderName ? [{ value: HOLDER, title: t.staysIn(holderName) }] : []),
    ...leg.views.map((v) => ({ value: v.method.id, title: accountTitle(v.method) })),
  ]
  const fromName = from ? pocketDisplayName(from.account, sf.systemNames) : ''
  const after = from && Number.isFinite(amountInPocket) ? Math.max(0, from.account.currentBalance - amountInPocket) : null

  if (!open) return null

  return (
    <ModalShell open={open} onBackdropClick={onClose} scrollChild>
      {discard.prompt}
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={discard.close}>
          <V3SheetHeader.Title size="compact">{t.withdrawTitle}</V3SheetHeader.Title>
          <V3SheetHeader.Subtitle>{t.withdrawSub}</V3SheetHeader.Subtitle>
        </V3SheetHeader>

        <SheetBody className="space-y-3 pt-0">
          <AmountHero
            value={amount}
            onChange={setAmount}
            currency={currency}
            onCurrencyChange={(c) => setCurrency(c as Currency)}
            base={baseCurrency}
            aria-label={t.amount}
            top={from ? <PocketTile account={from.account} className="size-[52px] rounded-2xl" iconClassName="size-6" /> : undefined}
            line={from && after !== null ? w.goesFrom(fromName, fmtNum(from.account.currentBalance), fmtNum(after)) : ''}
          />

          <Card padding="none" divide className="overflow-hidden">
            <PocketPickerField look="row" pockets={pockets} value={fromId} onChange={pickFrom} label={t.from} />
            <PickerRow label={w.forLabel} value={purposeOptions.find((o) => o.value === purpose)?.title} onClick={() => setSheet('for')} />
            {reason === 'debt' ? (
              <PickerRow
                label={w.debtLabel}
                value={debt ? w.debtValue(debt.name, fmtNum(debt.left)) : <span className="text-[var(--color-brand-text-muted)]">{debtChips.length ? t.pickDebt : t.noDebts}</span>}
                onClick={debtChips.length ? () => setSheet('debt') : undefined}
              />
            ) : null}
            {reason === 'transfer' ? (
              <PickerRow
                label={w.assetLabel}
                value={asset ? t[asset.label] : <span className="text-[var(--color-brand-text-muted)]">{t.whichAsset}</span>}
                onClick={() => setSheet('asset')}
              />
            ) : null}
            {moveOn ? (
              <PocketPickerField look="row" pockets={pockets.filter((p) => p.account.id !== fromId)} value={moveToId} onChange={setMoveToId} label={w.intoLabel} />
            ) : null}
            {showTo ? <PickerRow label={w.toLabel} value={toValue} onClick={() => setSheet('to')} /> : null}
          </Card>

          {reason === 'spend' && (
            <>
              {holderName && <p className="px-1 text-xs text-[var(--color-brand-text-muted)]">{t.heldSpendHint(holderName)}</p>}
              <SettingsSwitchRow label={t.logExpense} hint={t.logExpenseHint} checked={logExpense} onChange={setLogExpense} />
              {logExpense && (
                <LabeledBlock label={t.expenseCategory}>
                  <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                    {EXPENSE_CATEGORY_GRID.filter((c) => !c.nonspend).map((c) => (
                      <OptionChip key={c.id} selected={expenseCategory === c.id} onClick={() => setExpenseCategory(c.id)}>
                        {categoryLabels[c.id] ?? c.id}
                      </OptionChip>
                    ))}
                  </div>
                </LabeledBlock>
              )}
            </>
          )}

          {overPocket && from ? (
            <p role="alert" className="text-[0.8125rem] text-[var(--color-brand-amber)]">
              {lt.money.overPocket(fromName, fmtNum(from.account.currentBalance))}
            </p>
          ) : null}

          <NoteRow value={note} onChange={setNote} placeholder={w.addNote} />
        </SheetBody>

        <SheetFooter safeArea>
          <Button size="cta-block" onClick={submit} disabled={!canSubmit} className="font-semibold">
            {from ? w.cta(amountNum > 0 ? fmtNum(amountNum) : '') : t.choosePocket}
          </Button>
        </SheetFooter>
      </div>

      <OptionSheet<Purpose> open={sheet === 'for'} onClose={() => setSheet(null)} title={t.purpose} options={purposeOptions} value={purpose} onChange={pickPurpose} />
      <OptionSheet<string>
        open={sheet === 'debt'}
        onClose={() => setSheet(null)}
        title={t.whichDebt}
        options={debtChips.map((d) => ({ value: d.id, title: d.name, subtitle: t.left(fmtNum(d.left)) }))}
        value={debtId}
        onChange={setDebtId}
      />
      <OptionSheet<InvestmentAssetType>
        open={sheet === 'asset'}
        onClose={() => setSheet(null)}
        title={t.whichAsset}
        options={INVEST_CLASSES.map((c) => {
          const target = topupByClass.get(c.type)
          return { value: c.type, title: t[c.label], subtitle: target ? t.addToAsset(target.name) : t.addOneFirst, icon: c.icon, tone: 'var(--color-brand-gold)' }
        })}
        value={assetClass}
        onChange={(v) => { if (topupByClass.has(v)) setAssetClass(v); else onNeedAsset?.(v) }}
      />
      <OptionSheet<string>
        open={sheet === 'to'}
        onClose={() => setSheet(null)}
        title={t.toAccount}
        options={toOptions}
        value={holderName && !awayFromHolder ? HOLDER : leg.accountId}
        onChange={(v) => {
          if (v === HOLDER) return setAwayFromHolder(false)
          setAwayFromHolder(true)
          leg.setAccountId(v)
        }}
      />
    </ModalShell>
  )
}
