'use client'

import { useMemo, useState } from 'react'
import { Calendar, Plus, ShoppingCart, CreditCard, Gem, TrendingUp, ArrowRight, X, Coins, Bitcoin, LineChart } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { AmountField } from '@/components/ui/AmountField'
import { CurrencyField } from '@/components/ui/CurrencyField'
import { Input } from '@/components/ui/input'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useDebtTabData } from '@/hooks/useDebtTabData'
import { useAssetPrices } from '@/hooks/useAssetPrices'
import { valueInvestmentHolding } from '@/lib/savings/holdingValuation'
import { convertCurrency } from '@/lib/utils/currency'
import { moneyToGoldGrams } from '@/lib/utils/calculations'
import { SavingsAccountIcon } from '@/components/features/savings/SavingsAccountIcon'
import { pocketColor } from '@/lib/savings/pocketIdentity'
import type { PocketVM } from '@/components/features/savings-v3/PocketsCarousel'
import type { Currency, InvestmentAssetType, SavingsWithdrawalPurpose } from '@/lib/store/types'

const INVEST_CLASSES: Array<{ type: InvestmentAssetType; label: string; icon: React.ReactNode }> = [
  { type: 'gold', label: 'Gold', icon: <Coins size={15} /> },
  { type: 'crypto', label: 'Crypto', icon: <Bitcoin size={15} /> },
  { type: 'stock', label: 'Stocks & funds', icon: <LineChart size={15} /> },
]

const micro: React.CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-brand-text-muted)' }
const fmtNum = (n: number) => Math.round(n).toLocaleString('en-US')

type Reason = SavingsWithdrawalPurpose // 'income' | 'transfer' | 'debt' | 'spend'

const REASONS: Array<{ key: Reason; color: string; title: string; sub: string; verb: string; icon: React.ReactNode }> = [
  { key: 'spend', color: '#FF6B6B', title: 'Spending', sub: 'Counts as an expense', verb: 'Spend', icon: <ShoppingCart size={18} /> },
  { key: 'debt', color: '#E50914', title: 'Pay a debt', sub: 'Lowers what you owe', verb: 'Pay', icon: <CreditCard size={18} /> },
  { key: 'transfer', color: '#F5C842', title: 'Investment', sub: 'Buys an asset', verb: 'Invest', icon: <Gem size={18} /> },
  { key: 'income', color: '#35D46F', title: 'Income', sub: 'Back into this month', verb: 'Add as income', icon: <TrendingUp size={18} /> },
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
  const withdraw = useFinanceStore((s) => s.withdrawFromSavings)
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
  const [currency, setCurrency] = useState<Currency>(baseCurrency)
  const [reason, setReason] = useState<Reason | null>('spend')
  const [moveOn, setMoveOn] = useState(false)
  const [moveToId, setMoveToId] = useState<string | null>(null)
  const [debtId, setDebtId] = useState<string | null>(null)
  const [assetClass, setAssetClass] = useState<InvestmentAssetType | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')

  const fromId = defaultAccountId ?? pockets[0]?.account.id ?? null
  const from = pockets.find((p) => p.account.id === fromId)
  const amountNum = parseFloat(amount) || 0
  const free = from ? Math.max(0, from.account.currentBalance) : 0
  // Guard against the sheet currency differing from the pocket's — compare like for like.
  const amountInPocket = from ? convertCurrency(amountNum, currency, from.account.currency, exchangeRates) : amountNum

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
      transfer(from.account.id, moveToId, amountNum, note.trim() || undefined)
    } else if (reason === 'debt') {
      const debt = debts.find((d) => d.id === debtId)
      if (!debt) return
      const noteTrim = note.trim() || undefined
      withdraw(from.account.id, amountNum, currency, noteTrim, 'debt')
      const amountInBase = convertCurrency(amountNum, currency, baseCurrency, exchangeRates)
      const amountPaid = debt.isGold
        ? goldPriceAvailable !== false
          ? moneyToGoldGrams(amountInBase, goldPricePerGram, debt.goldKarat)
          : 0
        : convertCurrency(amountNum, currency, debt.currency, exchangeRates)
      if (amountPaid > 0) {
        addDebtPayment({ debtId: debt.id, date: new Date().toISOString().slice(0, 10), amountPaid, paymentCurrency: debt.currency, notes: noteTrim, fundedFromSavings: true })
      }
    } else if (reason === 'transfer') {
      if (!assetClass) return
      const target = topupByClass.get(assetClass)
      if (!target) return
      // Holdings are EGP-denominated regardless of base currency — pivot on EGP.
      const amountEgp = convertCurrency(amountNum, currency, 'EGP', exchangeRates)
      const qtyAdd = amountEgp / target.unitEgp
      const existing = holdings.find((h) => h.id === target.id)
      if (!existing || qtyAdd <= 0) return
      withdraw(from.account.id, amountNum, currency, note.trim() || undefined, 'transfer')
      updateHolding(target.id, { quantity: existing.quantity + qtyAdd })
    } else if (reason) {
      withdraw(from.account.id, amountNum, currency, note.trim() || undefined, reason)
    }
    onClose()
  }

  const ctaLabel = useMemo(() => {
    const amt = amountNum > 0 ? `${fmtNum(amountNum)} ${currency}` : ''
    if (moveOn) return `Move ${amt}`.trim()
    const verb = REASONS.find((r) => r.key === reason)?.verb ?? 'Withdraw'
    return `${verb} ${amt}`.trim()
  }, [moveOn, reason, amountNum, currency])

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
    <ModalShell open={open} onBackdropClick={onClose}>
      <div className="flex flex-col" style={{ height: '78vh' }}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-[22px] font-bold text-[var(--color-brand-text-primary)]">Withdraw</h2>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-brand-border)] px-3 py-1.5 text-sm text-[var(--color-brand-text-secondary)]">
              <Calendar size={14} /> Today
            </span>
            <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label style={micro}>Amount</label>
              <AmountField value={amount} onChange={setAmount} currency={currency} placeholder="0.00"
                className="mt-2 h-14 rounded-2xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-2xl font-mono-numbers font-bold text-[var(--color-brand-text-primary)] px-4" />
            </div>
            <div style={{ width: 104 }}>
              <label style={micro}>Currency</label>
              <CurrencyField value={currency} onChange={(c) => setCurrency(c as unknown as Currency)}
                className="mt-2 h-14 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-4 font-mono-numbers text-[15px] font-semibold text-[var(--color-brand-text-primary)] w-full" />
            </div>
          </div>

          {from && (
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `rgba(${hexToRgb(pocketColor(from.account))},.14)`, color: pocketColor(from.account) }}>
                <SavingsAccountIcon account={from.account} className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--color-brand-text-primary)]">{from.account.name}</p>
                <p className="truncate font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">
                  Free {fmtNum(free)} of {fmtNum(from.account.currentBalance)} {from.account.currency}
                </p>
              </div>
            </div>
          )}

          {/* Reason 2x2 */}
          <div>
            <label style={micro}>Reason</label>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              {REASONS.map((r) => {
                const on = !moveOn && reason === r.key
                return (
                  <button key={r.key} type="button" onClick={() => { setMoveOn(false); setReason(r.key); setDebtId(null); setAssetClass(null) }}
                    className="flex items-center gap-3 rounded-2xl p-3 text-left"
                    style={{ minHeight: 62, border: on ? `1px solid rgba(${hexToRgb(r.color)},.5)` : '1px solid var(--color-brand-border)', background: on ? `rgba(${hexToRgb(r.color)},.06)` : 'var(--color-brand-elevated)' }}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: `rgba(${hexToRgb(r.color)},.14)`, color: r.color }}>{r.icon}</span>
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-semibold text-[var(--color-brand-text-primary)]">{r.title}</p>
                      <p className="text-[10px] text-[var(--color-brand-text-muted)]">{r.sub}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Which debt? (screen 07) */}
          {!moveOn && reason === 'debt' && (
            <div className="rounded-2xl border border-[var(--color-brand-border)] p-3">
              <p className="mb-2 text-[13px] font-bold text-[var(--color-brand-text-primary)]">Which debt?</p>
              {debtChips.length === 0 ? (
                <p className="text-xs text-[var(--color-brand-text-muted)]">No open debts to pay.</p>
              ) : (
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {debtChips.map((d) => {
                    const on = debtId === d.id
                    return (
                      <button key={d.id} type="button" onClick={() => setDebtId(d.id)}
                        className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-left"
                        style={{ border: on ? '1px solid rgba(229,9,20,.5)' : '1px solid var(--color-brand-border)', background: on ? 'rgba(229,9,20,.08)' : 'var(--color-brand-elevated)' }}>
                        <CreditCard size={15} style={{ color: '#E50914' }} />
                        <span>
                          <span className="block text-[12.5px] font-semibold text-[var(--color-brand-text-primary)]">{d.name}</span>
                          <span className="block font-mono-numbers text-[10px] text-[var(--color-brand-text-muted)]">{fmtNum(d.left)} left</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Which asset? (screen 08) */}
          {!moveOn && reason === 'transfer' && (
            <div className="rounded-2xl border border-[var(--color-brand-border)] p-3">
              <p className="mb-2 text-[13px] font-bold text-[var(--color-brand-text-primary)]">Which asset?</p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {INVEST_CLASSES.map((c) => {
                  const target = topupByClass.get(c.type)
                  const on = assetClass === c.type
                  return (
                    <button key={c.type} type="button"
                      onClick={() => { if (target) setAssetClass(c.type); else onNeedAsset?.(c.type) }}
                      className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-left"
                      style={{ border: on ? '1px solid rgba(245,200,66,.5)' : '1px solid var(--color-brand-border)', background: on ? 'rgba(245,200,66,.08)' : 'var(--color-brand-elevated)' }}>
                      <span style={{ color: '#F5C842' }}>{c.icon}</span>
                      <span>
                        <span className="block text-[12.5px] font-semibold text-[var(--color-brand-text-primary)]">{c.label}</span>
                        <span className="block text-[10px] text-[var(--color-brand-text-muted)]">{target ? `Add to ${target.name}` : 'Add one first'}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* OR + move */}
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-[var(--color-brand-border)]" />
            <span style={{ ...micro, letterSpacing: '.12em' }}>Or</span>
            <span className="h-px flex-1 bg-[var(--color-brand-border)]" />
          </div>
          <button type="button" onClick={() => { setMoveOn(true); setReason(null); setDebtId(null); setAssetClass(null) }}
            className="flex w-full items-center gap-3 rounded-2xl p-3 text-left"
            style={{ border: moveOn ? '1px solid rgba(126,174,249,.5)' : '1px solid var(--color-brand-border)', background: moveOn ? 'rgba(126,174,249,.06)' : 'var(--color-brand-elevated)' }}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(126,174,249,.14)', color: '#7EAEF9' }}><ArrowRight size={18} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[var(--color-brand-text-primary)]">Move to another pocket</p>
              <p className="text-[10px] text-[var(--color-brand-text-muted)]">
                {!moveOn ? 'Stays inside your savings' : moveToId ? `Going to ${pockets.find((p) => p.account.id === moveToId)?.account.name}` : 'Pick a pocket below'}
              </p>
            </div>
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full" style={{ border: moveOn ? undefined : '1.5px solid var(--color-brand-border)', background: moveOn ? '#7EAEF9' : 'transparent' }}>
              {moveOn && <span className="h-2.5 w-2.5 rounded-full bg-white" />}
            </span>
          </button>

          {moveOn && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {pockets.filter((p) => p.account.id !== fromId).map((p) => (
                <button key={p.account.id} type="button" onClick={() => setMoveToId(p.account.id)}
                  className="shrink-0 rounded-xl px-3 py-2 text-xs font-medium"
                  style={{ border: moveToId === p.account.id ? '1px solid rgba(126,174,249,.5)' : '1px solid var(--color-brand-border)', background: moveToId === p.account.id ? 'rgba(126,174,249,.1)' : 'var(--color-brand-elevated)', color: 'var(--color-brand-text-primary)' }}>
                  {p.account.name}
                </button>
              ))}
            </div>
          )}

          {noteOpen ? (
            <div className="relative">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was it for?"
                className="h-[46px] rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] pr-10" />
              <button type="button" onClick={() => { setNote(''); setNoteOpen(false) }} aria-label="Clear note"
                className="absolute end-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center text-[var(--color-brand-text-muted)]"><X size={16} /></button>
            </div>
          ) : (
            <button type="button" onClick={() => setNoteOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: '#E50914' }}>
              <Plus size={14} /> Add note
            </button>
          )}
        </div>

        <div className="px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">
          <button type="button" onClick={submit} disabled={!canSubmit} className="w-full"
            style={{ height: 52, borderRadius: 14, fontWeight: 600, fontSize: 15, background: canSubmit ? '#E50914' : 'var(--color-brand-elevated)', color: canSubmit ? '#fff' : 'var(--color-brand-text-muted)', cursor: canSubmit ? 'pointer' : 'default' }}>
            {ctaLabel || 'Withdraw'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`
}
