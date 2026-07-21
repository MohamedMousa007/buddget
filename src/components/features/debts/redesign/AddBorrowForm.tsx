'use client'

import { useState } from 'react'
import { ChevronDown, Lock } from 'lucide-react'
import type { AddDebtHook } from '@/hooks/useAddDebtSheet'
import type { Currency, GoldKarat } from '@/lib/store/types'
import { CurrencySheet } from '@/components/ui/CurrencySheet'
import { AmountField } from '@/components/ui/AmountField'
import { PaymentMethodPicker } from '@/components/features/payments/PaymentMethodPicker'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { currencyFlag } from '@/lib/constants/currencyMeta'
import { format, addMonths } from 'date-fns'

const MICRO = 'font-semibold text-[10px] tracking-[0.08em] uppercase text-[var(--color-brand-text-muted)]'
const FIELD = 'h-12 w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3.5 text-[15px] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] outline-none'

// Demo gold prices (EGP/g) — wire to the live gold-price source in the store.
const GOLD_PRICE: Record<GoldKarat, number> = { 24: 4600, 22: 4210, 21: 4025, 18: 3450 }
export function AddBorrowForm({ d, locked = false }: { d: AddDebtHook; locked?: boolean }) {
  const [curOpen, setCurOpen] = useState(false)
  const stats = useMonthlyStats()
  const isGold = d.receivedVia === 'gold'
  const grams = parseFloat(d.startingBalance)
  const goldValue = isGold && !Number.isNaN(grams) ? grams * GOLD_PRICE[d.goldKarat] : null

  // Live payoff-goal preview + gentle income-strain hint.
  const goalPreview = (() => {
    const total = parseFloat(d.startingBalance)
    if (!d.goalEnabled || !d.goalMonth || Number.isNaN(total) || total <= 0) return null
    const now = new Date()
    const target = new Date(`${d.goalMonth}-01T00:00:00`)
    const months = Math.max(1, (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()))
    const periods = d.goalCadence === 'weekly' ? Math.max(1, Math.round(months * 4.345)) : months
    return Math.round((total / periods) * 100) / 100
  })()
  const monthlyPay = goalPreview != null ? (d.goalCadence === 'weekly' ? goalPreview * 4.345 : goalPreview) : null
  const strain = monthlyPay != null && stats.totalIncome > 0 ? monthlyPay / stats.totalIncome : null

  return (
    <div className="flex flex-col gap-[18px] pt-1">
      {/* Direction (locked in Edit) */}
      <div>
        <div className={`${MICRO} mb-2 flex items-center gap-1.5`}>Direction {locked ? <Lock className="h-3 w-3" /> : null}</div>
        <div className="flex gap-2">
          {([
            { v: 'i_owe', label: 'I owe', c: '#E50914' },
            { v: 'they_owe', label: 'Owed to me', c: '#1DB954' },
          ] as const).map((o) => {
            const on = d.direction === o.v
            if (locked && !on) return null
            return (
              <button
                key={o.v}
                type="button"
                disabled={locked}
                onClick={() => d.setDirection(o.v)}
                className="h-11 flex-1 rounded-xl border text-[14px] font-semibold transition-colors disabled:opacity-100"
                style={on ? { background: `${o.c}1f`, borderColor: `${o.c}80`, color: o.c } : { background: 'var(--color-brand-elevated)', borderColor: 'var(--color-brand-border)', color: 'var(--color-brand-text-muted)' }}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Person + name */}
      <div>
        <div className={`${MICRO} mb-2`}>Person</div>
        <input value={d.person} onChange={(e) => d.setPerson(e.target.value)} placeholder="e.g. Ahmed" className={FIELD} />
      </div>
      <div>
        <div className={`${MICRO} mb-2`}>What is it for</div>
        <input value={d.name} onChange={(e) => d.setName(e.target.value)} placeholder="e.g. Rent help" className={FIELD} />
      </div>

      {/* Gold-backed toggle */}
      <div className="flex items-center justify-between rounded-[16px] border border-[#F5C84233] bg-[#F5C8420d] px-4 py-3.5">
        <div>
          <span className="block text-sm font-bold text-[var(--color-brand-text-primary)]">Gold-backed</span>
          <span className="mt-0.5 block text-[12px] text-[var(--color-brand-text-muted)]">Track in grams at today&apos;s price</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isGold}
          onClick={() => d.applyDebtReceivedVia(isGold ? 'cash' : 'gold')}
          className="flex h-7 w-[46px] shrink-0 rounded-full p-[3px] transition-colors"
          style={{ background: isGold ? '#F5C842' : 'var(--color-brand-border)', justifyContent: isGold ? 'flex-end' : 'flex-start' }}
        >
          <span className="block h-[22px] w-[22px] rounded-full bg-white" />
        </button>
      </div>

      {isGold ? (
        <>
          <div>
            <div className={`${MICRO} mb-2`}>Karat</div>
            <div className="flex gap-2">
              {([24, 21, 18] as GoldKarat[]).map((k) => {
                const on = d.goldKarat === k
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => d.setGoldKarat(k)}
                    className="h-11 flex-1 rounded-xl border text-[14px] font-bold transition-colors"
                    style={on ? { background: '#F5C84222', borderColor: '#F5C84288', color: '#F5C842' } : { background: 'var(--color-brand-elevated)', borderColor: 'var(--color-brand-border)', color: 'var(--color-brand-text-muted)' }}
                  >
                    {k}K
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <div className={`${MICRO} mb-2`}>Grams</div>
            <AmountField value={d.startingBalance} onChange={d.setStartingBalance} mode="decimal" placeholder="e.g. 12.5" />
            {goldValue != null ? (
              <p className="mt-2 px-0.5 font-mono-numbers text-[12px] text-[#F5C842]">≈ {goldValue.toLocaleString()} EGP at {GOLD_PRICE[d.goldKarat].toLocaleString()}/g</p>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <div>
            <div className={`${MICRO} mb-2`}>Amount</div>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1"><AmountField value={d.startingBalance} onChange={d.setStartingBalance} mode="decimal" placeholder="0" /></div>
              <button type="button" onClick={() => setCurOpen(true)} className="flex h-[52px] shrink-0 items-center gap-1.5 rounded-[14px] border border-[#26262f] bg-[#16161f] px-3">
                <span className="text-[18px] leading-none">{currencyFlag(d.currency as Currency)}</span>
                <span className="font-mono-numbers text-[14px] font-bold text-[var(--color-brand-text-primary)]">{d.currency}</span>
                <ChevronDown className="h-4 w-4 text-[var(--color-brand-text-muted)]" />
              </button>
            </div>
            <CurrencySheet open={curOpen} value={d.currency as Currency} base={d.settings.baseCurrency} onSelect={(c) => { d.setCurrency(c as Currency); setCurOpen(false) }} onClose={() => setCurOpen(false)} />
          </div>
          {/* Received via = the payment-method card carousel (§5) */}
          <PaymentMethodPicker label={d.direction === 'i_owe' ? 'Received via' : 'Given via'} value={d.paymentMethodId} onChange={d.setPaymentMethodId} paymentMethods={d.paymentMethods} />
        </>
      )}

      {/* Payoff goal (borrow-only, i-owe) */}
      {d.direction === 'i_owe' ? (
        <div className="rounded-[16px] border border-[#F5C84233] bg-[#F5C8420d] p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="block text-sm font-bold text-[var(--color-brand-text-primary)]">Set a payoff goal</span>
              <span className="mt-0.5 block text-[12px] text-[var(--color-brand-text-muted)]">Plan a clear-by date</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={d.goalEnabled}
              onClick={() => d.setGoalEnabled(!d.goalEnabled)}
              className="flex h-7 w-[46px] shrink-0 rounded-full p-[3px] transition-colors"
              style={{ background: d.goalEnabled ? '#F5C842' : 'var(--color-brand-border)', justifyContent: d.goalEnabled ? 'flex-end' : 'flex-start' }}
            >
              <span className="block h-[22px] w-[22px] rounded-full bg-white" />
            </button>
          </div>
          {d.goalEnabled ? (
            <div className="mt-3 flex flex-col gap-3">
              <div>
                <div className={`${MICRO} mb-2`}>Clear by</div>
                <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                  {[3, 6, 9, 12].map((m) => {
                    const val = format(addMonths(new Date(), m), 'yyyy-MM')
                    const on = d.goalMonth === val
                    return (
                      <button key={m} type="button" onClick={() => d.setGoalMonth(val)} className="h-10 shrink-0 rounded-full border px-3.5 text-[13px] font-semibold" style={on ? { background: '#F5C84222', borderColor: '#F5C84288', color: '#F5C842' } : { borderColor: 'var(--color-brand-border)', color: 'var(--color-brand-text-secondary)' }}>
                        {format(addMonths(new Date(), m), 'MMM yyyy')}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <div className={`${MICRO} mb-2`}>Cadence</div>
                <div className="flex gap-2">
                  {(['monthly', 'weekly'] as const).map((c) => {
                    const on = d.goalCadence === c
                    return (
                      <button key={c} type="button" onClick={() => d.setGoalCadence(c)} className="h-10 flex-1 rounded-xl border text-[13px] font-semibold capitalize" style={on ? { background: '#F5C84222', borderColor: '#F5C84288', color: '#F5C842' } : { borderColor: 'var(--color-brand-border)', color: 'var(--color-brand-text-secondary)' }}>
                        {c}
                      </button>
                    )
                  })}
                </div>
              </div>
              {goalPreview != null ? (
                <div className="rounded-[12px] bg-[#F5C8420d] px-3.5 py-2.5">
                  <p className="font-mono-numbers text-[14px] font-bold text-[#F5C842]">You&apos;d pay ≈ {goalPreview.toLocaleString()} {d.currency} / {d.goalCadence === 'weekly' ? 'week' : 'month'}</p>
                  {strain != null ? (
                    <p className={`mt-1 text-[12px] ${strain > 0.35 ? 'text-[#FFB13D]' : 'text-[var(--color-brand-text-muted)]'}`}>
                      {strain > 0.35 ? `That's ${Math.round(strain * 100)}% of your monthly income — heavy.` : 'Comfortable against your income.'}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
