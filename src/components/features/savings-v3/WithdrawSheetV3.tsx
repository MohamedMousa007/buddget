'use client'

import { useMemo, useState } from 'react'
import { Plus, ShoppingCart, CreditCard, Gem, TrendingUp, ArrowRight, X, Coins, Bitcoin, LineChart } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { reconcileDebtSchedule } from '@/lib/debts/recurringDebtDueHandlers'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useDebtTabData } from '@/hooks/useDebtTabData'
import { useAssetPrices } from '@/hooks/useAssetPrices'
import { valueInvestmentHolding } from '@/lib/savings/holdingValuation'
import { convertCurrency, tryConvertWithGold } from '@/lib/utils/currency'
import { debtPaymentForWithdrawal } from '@/lib/debts/withdrawalPayment'
import { investTopUpPatch } from '@/lib/savings/investTopUp'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { AccountLegRow, AmountCurrencyRow, PocketRadioList, tint } from '@/components/features/savings-v3/MoneySheetParts'
import { useLegAccount } from '@/components/features/savings-v3/useLegAccount'
import { formatWhole as fmtNum } from '@/lib/utils/formatters'
import { localTodayISO } from '@/lib/utils/localDate'
import { micro } from '@/lib/ui/microLabelStyle'
import { useT } from '@/lib/i18n'
import { pocketDisplayName } from '@/lib/savings/pocketIdentity'
import { useActionToast } from '@/components/ui/ActionToast'
import type { PocketVM } from '@/components/features/savings-v3/types'
import type { Currency, InvestmentAssetType, SavingsWithdrawalPurpose } from '@/lib/store/types'
import { IconButton } from '@/components/ui/IconButton'
import { Button } from '@/components/ui/button'
import { FieldButton } from '@/components/ui/FieldButton'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { OptionChip } from '@/components/ui/OptionChip'

const INVEST_CLASSES: Array<{ type: InvestmentAssetType; label: string; icon: React.ReactNode }> = [
  { type: 'gold', label: 'Gold', icon: <Coins size={15} /> },
  { type: 'crypto', label: 'Crypto', icon: <Bitcoin size={15} /> },
  { type: 'stock', label: 'Stocks & funds', icon: <LineChart size={15} /> },
]

type Reason = SavingsWithdrawalPurpose // 'income' | 'transfer' | 'debt' | 'spend'
type Purpose = Reason | 'move'

const PURPOSES: Array<{ key: Purpose; color: string; icon: React.ReactNode }> = [
  { key: 'spend', color: 'var(--color-brand-red)', icon: <ShoppingCart size={18} /> },
  { key: 'debt', color: 'var(--cat-debt-fg)', icon: <CreditCard size={18} /> },
  { key: 'transfer', color: 'var(--color-brand-gold)', icon: <Gem size={18} /> },
  { key: 'income', color: 'var(--color-brand-green)', icon: <TrendingUp size={18} /> },
  { key: 'move', color: 'var(--color-cat-5)', icon: <ArrowRight size={18} /> },
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
  const updateHolding = useFinanceStore((s) => s.updateInvestmentHolding)
  const holdings = useFinanceStore((s) => s.investmentHoldings)
  const debts = useFinanceStore((s) => s.debts)
  const exchangeRates = useFinanceStore((s) => s.exchangeRates)
  const goldPricePerGram = useFinanceStore((s) => s.goldPricePerGram)
  const goldPriceAvailable = useFinanceStore((s) => s.goldPriceAvailable)
  const baseCurrency = useFinanceStore((s) => s.settings.baseCurrency)
  const { lookup } = useAssetPrices()
  const debtData = useDebtTabData()

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

  const submit = () => {
    if (!from || amountNum <= 0) return
    if (moveOn) {
      if (!moveToId) return
      if (!transfer(from.account.id, moveToId, amountInPocket, note.trim() || undefined)) return showToast(t.moveFailed)
    } else if (reason === 'debt') {
      const debt = debts.find((d) => d.id === debtId)
      if (!debt) return
      const noteTrim = note.trim() || undefined
      const { amountPaid, amountInBase } = debtPaymentForWithdrawal({ debt, amount: amountNum, currency, base: baseCurrency, rates: exchangeRates, goldPricePerGram, goldAvailable: goldPriceAvailable !== false })
      if (!(amountPaid > 0)) return showToast(t.moveFailed)
      if (!withdraw(from.account.id, amountNum, currency, noteTrim, 'debt')) return showToast(t.moveFailed)
      addDebtPayment({ debtId: debt.id, date: localTodayISO(), amountPaid, paymentCurrency: debt.currency, amountInPrimary: amountInBase, notes: noteTrim, fundedFromSavings: true })
      reconcileDebtSchedule(debt.id, { amount: amountPaid, currency: debt.currency })
    } else if (reason === 'transfer') {
      if (!assetClass) return
      const target = topupByClass.get(assetClass)
      if (!target) return
      // Holdings are EGP-denominated regardless of base currency — pivot on EGP.
      const amountEgp = convertCurrency(amountNum, currency, 'EGP', exchangeRates)
      const qtyAdd = amountEgp / target.unitEgp
      const existing = useFinanceStore.getState().investmentHoldings.find((h) => h.id === target.id)
      if (!existing || qtyAdd <= 0) return
      if (!withdraw(from.account.id, amountNum, currency, note.trim() || undefined, 'transfer')) return showToast(t.moveFailed)
      updateHolding(target.id, investTopUpPatch(existing, qtyAdd, amountEgp, 'EGP', exchangeRates))
    } else if (reason) {
      if (!withdraw(from.account.id, amountNum, currency, note.trim() || undefined, reason, reason === 'income' ? { toAccountId: leg.accountId } : undefined)) return showToast(t.moveFailed)
    }
    onClose()
  }

  const ctaLabel = (() => {
    if (!from) return t.choosePocket
    const verb = { spend: t.verbSpend, debt: t.verbPay, transfer: t.verbInvest, income: t.verbIncome, move: t.verbMove }[purpose]
    return t.withdrawCta(verb, amountNum > 0 ? fmtNum(amountNum) : '', pocketDisplayName(from.account, sf.systemNames))
  })()

  const canSubmit =
    !!from &&
    amountNum > 0 &&
    free + 0.001 >= amountInPocket &&
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

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-3 pt-2">
          <div>
            <p style={micro} className="mb-2">{t.from}</p>
            <PocketRadioList pockets={pockets} value={fromId} onChange={pickFrom} label={t.from} />
          </div>

          <AmountCurrencyRow
            amount={amount} onAmount={setAmount} currency={currency} onCurrency={setCurrency}
            amountLabel={t.amount} currencyLabel={t.currency}
          />

          <div>
            <p style={micro} className="mb-2">{t.purpose}</p>
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
          </div>

          {!moveOn && reason === 'debt' && (
            <div>
              <p style={micro} className="mb-2">{t.whichDebt}</p>
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
            </div>
          )}

          {/* Which asset? (screen 08) */}
          {!moveOn && reason === 'transfer' && (
            <Card padding="sm">
              <p className="mb-2 text-[13px] font-bold text-[var(--color-brand-text-primary)]">{t.whichAsset}</p>
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
                        <span className="block text-[12.5px] font-semibold text-[var(--color-brand-text-primary)]">{c.label}</span>
                        <span className="block text-[10px] text-[var(--color-brand-text-muted)]">{target ? t.addToAsset(target.name) : t.addOneFirst}</span>
                      </span>
                    </SelectableCard>
                  )
                })}
              </div>
            </Card>
          )}

          {moveOn && (
            <div>
              <p style={micro} className="mb-2">{t.moveTo}</p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {pockets.filter((p) => p.account.id !== fromId).map((p) => (
                  <OptionChip key={p.account.id} selected={moveToId === p.account.id} onClick={() => setMoveToId(p.account.id)}>
                    {pocketDisplayName(p.account, sf.systemNames)}
                  </OptionChip>
                ))}
              </div>
            </div>
          )}

          {!moveOn && reason === 'income' ? <AccountLegRow leg={leg} label={t.toAccount} /> : null}

          {noteOpen ? (
            <div className="relative">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.notePlaceholder}
                size="brand" className="pe-12" />
              <IconButton onClick={() => { setNote(''); setNoteOpen(false) }} aria-label={t.clearNote} size="sm"
                className="absolute end-2 top-1/2 -translate-y-1/2"><X size={16} /></IconButton>
            </div>
          ) : (
            <Button variant="link" size="sm" onClick={() => setNoteOpen(true)} className="font-semibold no-underline hover:underline">
              <Plus size={14} /> {t.note}
            </Button>
          )}
        </div>

        <div className="px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">
          <Button size="cta-block" onClick={submit} disabled={!canSubmit} className="font-semibold">
            {ctaLabel}
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}
