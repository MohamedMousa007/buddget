'use client'

import { balanceEpsilon } from '@/lib/savings/balanceMath'
import { useMemo, useState } from 'react'
import { ShoppingCart, CreditCard, Gem, TrendingUp, ArrowRight, Coins, Bitcoin, LineChart } from 'lucide-react'
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
import { AccountLegRow, AmountCurrencyRow, LabeledBlock, NoteField, PocketRadioList, SheetBody, SheetFooter, tint } from '@/components/features/savings-v3/MoneySheetParts'
import { useLegAccount } from '@/components/features/savings-v3/useLegAccount'
import { formatWhole as fmtNum } from '@/lib/utils/formatters'
import { localTodayISO } from '@/lib/utils/localDate'
import { useT } from '@/lib/i18n'
import { pocketDisplayName } from '@/lib/savings/pocketIdentity'
import { useActionToast } from '@/components/ui/ActionToast'
import type { PocketVM } from '@/components/features/savings-v3/types'
import type { Currency, InvestmentAssetType, SavingsWithdrawalPurpose } from '@/lib/store/types'
import { Button } from '@/components/ui/button'
import { SettingsSwitchRow } from '@/components/features/settings/SettingsSwitchRow'
import { EXPENSE_CATEGORY_GRID } from '@/lib/constants/categoryGrid'
import { DEFAULT_CASH_ID } from '@/lib/store/migrations/v17_uuid_remap'
import { FieldButton } from '@/components/ui/FieldButton'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { OptionChip } from '@/components/ui/OptionChip'

const INVEST_CLASSES: Array<{ type: InvestmentAssetType; label: 'assetGold' | 'assetCrypto' | 'assetStocks'; icon: React.ReactNode }> = [
  { type: 'gold', label: 'assetGold', icon: <Coins size={15} /> },
  { type: 'crypto', label: 'assetCrypto', icon: <Bitcoin size={15} /> },
  { type: 'stock', label: 'assetStocks', icon: <LineChart size={15} /> },
]

type Reason = SavingsWithdrawalPurpose // 'income' | 'transfer' | 'debt' | 'spend'
type Purpose = Reason | 'move'

const PURPOSES: Array<{ key: Purpose; color: string; icon: React.ReactNode }> = [
  { key: 'spend', color: 'var(--color-brand-red)', icon: <ShoppingCart size={18} /> },
  { key: 'debt', color: 'var(--cat-debt-fg)', icon: <CreditCard size={18} /> },
  { key: 'transfer', color: 'var(--color-brand-gold)', icon: <Gem size={18} /> },
  { key: 'income', color: 'var(--color-brand-green)', icon: <TrendingUp size={18} /> },
  { key: 'move', color: 'var(--color-cat-5)', icon: <ArrowRight size={18} className="rtl:rotate-180" /> },
]

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
  const [fromId, setFromId] = useState<string | null>(defaultAccountId ?? pockets[0]?.account.id ?? null)
  const [currency, setCurrency] = useState<Currency>(
    () => pockets.find((p) => p.account.id === fromId)?.account.currency ?? baseCurrency,
  )
  const pickFrom = (id: string) => {
    setFromId(id)
    if (moveToId === id) setMoveToId(null)
    const c = pockets.find((p) => p.account.id === id)?.account.currency
    if (c) setCurrency(c)
  }
  const [purpose, setPurpose] = useState<Purpose>('spend')
  const [debtOpen, setDebtOpen] = useState(false)
  const [moveToId, setMoveToId] = useState<string | null>(null)
  const [debtId, setDebtId] = useState<string | null>(null)
  const [assetClass, setAssetClass] = useState<InvestmentAssetType | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const [logExpense, setLogExpense] = useState(false)
  const [expenseCategory, setExpenseCategory] = useState('Other')

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
    if (moveOn) {
      if (!moveToId) return false
      if (!transfer(from.account.id, moveToId, amountInPocket, note.trim() || undefined)) { showToast(t.moveFailed); return false }
    } else if (reason === 'debt') {
      const debt = debts.find((d) => d.id === debtId)
      if (!debt) return false
      const noteTrim = note.trim() || undefined
      const { amountPaid, amountInBase, exceeds } = debtPaymentForWithdrawal({ debt, amount: amountNum, currency, base: baseCurrency, rates: exchangeRates, goldPricePerGram, goldAvailable: goldPriceAvailable !== false, left: debtChips.find((d) => d.id === debt.id)?.left })
      if (!(amountPaid > 0) || exceeds || overpaysDebt(useFinanceStore.getState(), { debtId: debt.id, amountPaid })) { showToast(t.moveFailed); return false }
      if (!withdraw(from.account.id, amountNum, currency, noteTrim, 'debt', { txId })) { showToast(t.moveFailed); return false }
      addDebtPayment({ debtId: debt.id, date: localTodayISO(), amountPaid, paymentCurrency: debt.currency, amountInPrimary: amountInBase, notes: noteTrim, fundedFromSavings: true, fundedFromSavingsTxId: txId })
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
      if (!withdraw(from.account.id, amountNum, currency, note.trim() || undefined, 'transfer')) { showToast(t.moveFailed); return false }
      updateHolding(target.id, investTopUpPatch(existing, qtyAdd, amountEgp, 'EGP', exchangeRates))
    } else if (reason) {
      const spendAndLog = reason === 'spend' && logExpense
      const opts = reason === 'income' ? { toAccountId: leg.accountId } : spendAndLog ? { txId } : undefined
      if (!withdraw(from.account.id, amountNum, currency, note.trim() || undefined, reason, opts)) { showToast(t.moveFailed); return false }
      if (spendAndLog) {
        addExpense({
          date: localTodayISO(), description: note.trim() || pocketDisplayName(from.account, sf.systemNames), category: expenseCategory,
          amount: amountNum, currency, paymentMethodId: DEFAULT_CASH_ID, isRecurring: false, fundedFromSavingsTxId: txId,
        })
      }
    }
    onClose()
    return true
  }

  const submit = () => {
    if (!from || amountNum <= 0 || !submitOnce.claim()) return
    if (!commit(from)) submitOnce.release()
  }

  const ctaLabel = (() => {
    if (!from) return t.choosePocket
    const verb = { spend: t.verbSpend, debt: t.verbPay, transfer: t.verbInvest, income: t.verbIncome, move: t.verbMove }[purpose]
    return t.withdrawCta(verb, amountNum > 0 ? fmtNum(amountNum) : '', pocketDisplayName(from.account, sf.systemNames))
  })()

  const debtOverpay = (() => {
    const debt = reason === 'debt' ? debts.find((d) => d.id === debtId) : undefined
    return !!debt && debtPaymentForWithdrawal({ debt, amount: amountNum, currency, base: baseCurrency, rates: exchangeRates, goldPricePerGram, goldAvailable: goldPriceAvailable !== false, left: debtChips.find((d) => d.id === debt.id)?.left }).exceeds
  })()

  const canSubmit =
    !debtOverpay &&
    !!from &&
    amountNum > 0 &&
    free + balanceEpsilon(from.account.currency) >= amountInPocket &&
    (moveOn
      ? !!moveToId
      : reason === 'debt'
        ? !!debtId
        : reason === 'transfer'
          ? !!assetClass && topupByClass.has(assetClass)
          : !!reason)

  if (!open) return null

  return (
    <ModalShell open={open} onBackdropClick={onClose} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={onClose}>
          <V3SheetHeader.Title>{t.withdrawTitle}</V3SheetHeader.Title>
          <V3SheetHeader.Subtitle>{t.withdrawSub}</V3SheetHeader.Subtitle>
        </V3SheetHeader>

        <SheetBody>
          <LabeledBlock label={t.from}>
            <PocketRadioList pockets={pockets} value={fromId} onChange={pickFrom} label={t.from} />
          </LabeledBlock>

          <AmountCurrencyRow
            amount={amount} onAmount={setAmount} currency={currency} onCurrency={setCurrency}
            amountLabel={t.amount} currencyLabel={t.currency}
          />

          <LabeledBlock label={t.purpose}>
            <div role="radiogroup" aria-label={t.purpose} className="space-y-2">
              {PURPOSES.map((p) => (
                <SelectableCard key={p.key} selected={purpose === p.key} onClick={() => { setPurpose(p.key); setDebtId(null); setDebtOpen(false); setAssetClass(null); setMoveToId(null) }}>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ background: tint(p.color, 14), color: p.color }}>{p.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{t[p.key === 'transfer' ? 'invest' : p.key]}</p>
                    <p className="text-xs text-[var(--color-brand-text-muted)]">{t[`${p.key === 'transfer' ? 'invest' : p.key}Sub` as 'spendSub']}</p>
                  </div>
                </SelectableCard>
              ))}
            </div>
          </LabeledBlock>

          {!moveOn && reason === 'debt' && (
            <LabeledBlock label={t.whichDebt}>
              {debtChips.length === 0 ? (
                <p className="text-xs text-[var(--color-brand-text-muted)]">{t.noDebts}</p>
              ) : (
                <>
                  <FieldButton
                    icon={<CreditCard size={16} className="text-[var(--cat-debt-fg)]" />}
                    value={debtChips.find((d) => d.id === debtId)?.name}
                    placeholder={t.pickDebt}
                    aria-expanded={debtOpen}
                    onClick={() => setDebtOpen((o) => !o)}
                  />
                  {debtOpen && (
                    <div role="radiogroup" aria-label={t.whichDebt} className="mt-2 space-y-2">
                      {debtChips.map((d) => (
                        <SelectableCard key={d.id} layout="list" selected={debtId === d.id} onClick={() => { setDebtId(d.id); setDebtOpen(false) }}>
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--color-brand-text-primary)]">{d.name}</span>
                          <span className="font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">{t.left(fmtNum(d.left))}</span>
                        </SelectableCard>
                      ))}
                    </div>
                  )}
                </>
              )}
            </LabeledBlock>
          )}

          {/* Which asset? (screen 08) */}
          {!moveOn && reason === 'transfer' && (
            <Card padding="sm">
              <p className="mb-2 text-[0.8125rem] font-bold text-[var(--color-brand-text-primary)]">{t.whichAsset}</p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {INVEST_CLASSES.map((c) => {
                  const target = topupByClass.get(c.type)
                  const on = assetClass === c.type
                  return (
                    <SelectableCard key={c.type} layout="list" selected={on}
                      onClick={() => { if (target) setAssetClass(c.type); else onNeedAsset?.(c.type) }}
                      className="w-auto shrink-0 gap-2 px-3 py-2">
                      <span className="text-[var(--color-brand-gold)]">{c.icon}</span>
                      <span>
                        <span className="block text-[0.78125rem] font-semibold text-[var(--color-brand-text-primary)]">{t[c.label]}</span>
                        <span className="block text-[0.625rem] text-[var(--color-brand-text-muted)]">{target ? t.addToAsset(target.name) : t.addOneFirst}</span>
                      </span>
                    </SelectableCard>
                  )
                })}
              </div>
            </Card>
          )}

          {moveOn && (
            <LabeledBlock label={t.moveTo}>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {pockets.filter((p) => p.account.id !== fromId).map((p) => (
                  <OptionChip key={p.account.id} selected={moveToId === p.account.id} onClick={() => setMoveToId(p.account.id)}>
                    {pocketDisplayName(p.account, sf.systemNames)}
                  </OptionChip>
                ))}
              </div>
            </LabeledBlock>
          )}

          {!moveOn && reason === 'spend' && (
            <>
              <SettingsSwitchRow label={t.logExpense} hint={t.logExpenseHint} checked={logExpense} onChange={setLogExpense} />
              {logExpense && (
                <LabeledBlock label={t.expenseCategory}>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar">
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

          {!moveOn && reason === 'income' ? <AccountLegRow leg={leg} label={t.toAccount} /> : null}

          <NoteField open={noteOpen} onOpen={() => setNoteOpen(true)} onClose={() => setNoteOpen(false)} value={note} onChange={setNote}
            labels={{ add: t.note, placeholder: t.notePlaceholder, clear: t.clearNote }} />
        </SheetBody>

        <SheetFooter safeArea>
          <Button size="cta-block" onClick={submit} disabled={!canSubmit} className="font-semibold">
            {ctaLabel}
          </Button>
        </SheetFooter>
      </div>
    </ModalShell>
  )
}
