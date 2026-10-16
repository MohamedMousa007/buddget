'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import type { AddDebtHook } from '@/hooks/useAddDebtSheet'
import type { Currency, GoldKarat } from '@/lib/store/types'
import { CurrencySheet } from '@/components/ui/CurrencySheet'
import { AmountField } from '@/components/ui/AmountField'
import { Switch } from '@/components/ui/switch'
import { PaymentMethodPicker } from '@/components/features/payments/PaymentMethodPicker'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { currencyFlag } from '@/lib/constants/currencyMeta'
import { format, addMonths } from 'date-fns'
import { Button } from '@/components/ui/button'
import { OptionChip } from '@/components/ui/OptionChip'
import { FieldButton } from '@/components/ui/FieldButton'
import { useT } from '@/lib/i18n'
import { soft } from './heroCardShared'

const MICRO = 'font-semibold text-[10px] tracking-[0.08em] uppercase text-[var(--color-brand-text-muted)]'
const FIELD = 'h-12 w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3.5 text-[15px] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] outline-none'

// Demo gold prices (EGP/g) — wire to the live gold-price source in the store.
const GOLD_PRICE: Record<GoldKarat, number> = { 24: 4600, 22: 4210, 21: 4025, 18: 3450 }
export function AddBorrowForm({ d, locked = false }: { d: AddDebtHook; locked?: boolean }) {
  const t = useT().debts
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
        <div className={`${MICRO} mb-2 flex items-center gap-1.5`}>{t.fDirection} {locked ? <Lock className="h-3 w-3" /> : null}</div>
        <div className="flex gap-2">
          {([
            { v: 'i_owe', label: t.iOwe, c: 'var(--color-brand-red)' },
            { v: 'they_owe', label: t.owedToMe, c: 'var(--color-brand-green)' },
          ] as const).map((o) => {
            const on = d.direction === o.v
            if (locked && !on) return null
            return (
              <Button
                key={o.v}
                disabled={locked}
                onClick={() => d.setDirection(o.v)}
                className="flex-1"
                style={on ? { background: soft(o.c, 12), borderColor: soft(o.c, 50), color: o.c } : { background: 'var(--color-brand-elevated)', borderColor: 'var(--color-brand-border)', color: 'var(--color-brand-text-muted)' }}
                variant="outline"
                size="touch"
              >
                {o.label}
              </Button>
            )
          })}
        </div>
      </div>

      {/* Person + name */}
      <div>
        <div className={`${MICRO} mb-2`}>{t.fPerson}</div>
        <input value={d.person} onChange={(e) => d.setPerson(e.target.value)} placeholder={t.fPersonPh} className={FIELD} />
      </div>
      <div>
        <div className={`${MICRO} mb-2`}>{t.fWhatFor}</div>
        <input value={d.name} onChange={(e) => d.setName(e.target.value)} placeholder={t.fWhatForPh} className={FIELD} />
      </div>

      {/* Gold-backed toggle */}
      <div className="flex items-center justify-between rounded-[16px] border border-[var(--color-brand-gold)]/20 bg-[var(--color-brand-gold)]/5 px-4 py-3.5">
        <div>
          <span className="block text-sm font-bold text-[var(--color-brand-text-primary)]">{t.fGoldBacked}</span>
          <span className="mt-0.5 block text-[12px] text-[var(--color-brand-text-muted)]">{t.fGoldHint}</span>
        </div>
        <Switch
          size="touch"
          aria-label={t.fGoldBacked}
          checked={isGold}
          onCheckedChange={(on) => d.applyDebtReceivedVia(on ? 'gold' : 'cash')}
          className="data-checked:bg-[var(--color-brand-gold)]"
        />
      </div>

      {isGold ? (
        <>
          <div>
            <div className={`${MICRO} mb-2`}>{t.fKarat}</div>
            <div className="flex gap-2">
              {([24, 21, 18] as GoldKarat[]).map((k) => {
                const on = d.goldKarat === k
                return (
                  <Button
                    key={k}
                    onClick={() => d.setGoldKarat(k)}
                    className="flex-1"
                    style={on ? { background: soft('var(--color-brand-gold)', 14), borderColor: soft('var(--color-brand-gold)', 55), color: 'var(--color-brand-gold)' } : { background: 'var(--color-brand-elevated)', borderColor: 'var(--color-brand-border)', color: 'var(--color-brand-text-muted)' }}
                    variant="outline"
                    size="touch"
                  >
                    {k}K
                  </Button>
                )
              })}
            </div>
          </div>
          <div>
            <div className={`${MICRO} mb-2`}>{t.fGrams}</div>
            <AmountField value={d.startingBalance} onChange={d.setStartingBalance} mode="decimal" placeholder={t.fGramsPh} />
            {goldValue != null ? (
              <p className="mt-2 px-0.5 font-mono-numbers text-[12px] text-[var(--color-brand-gold)]">{t.fGoldValue(goldValue.toLocaleString(), GOLD_PRICE[d.goldKarat].toLocaleString())}</p>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <div>
            <div className={`${MICRO} mb-2`}>{t.fAmount}</div>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1"><AmountField value={d.startingBalance} onChange={d.setStartingBalance} mode="decimal" placeholder="0" /></div>
              <FieldButton
                size="lg"
                onClick={() => setCurOpen(true)}
                className="w-auto shrink-0 gap-1.5 bg-[var(--color-brand-elevated)] px-3"
                valueClassName="font-mono-numbers text-[14px] font-bold"
                value={d.currency}
                icon={<span className="text-[18px] leading-none">{currencyFlag(d.currency as Currency)}</span>}
              />
            </div>
            <CurrencySheet open={curOpen} value={d.currency as Currency} base={d.settings.baseCurrency} onSelect={(c) => { d.setCurrency(c as Currency); setCurOpen(false) }} onClose={() => setCurOpen(false)} />
          </div>
          {/* Received via = the payment-method card carousel (§5) */}
          <PaymentMethodPicker label={d.direction === 'i_owe' ? t.fReceivedVia : t.fGivenVia} value={d.paymentMethodId} onChange={d.setPaymentMethodId} paymentMethods={d.paymentMethods} />
        </>
      )}

      {/* Payoff goal (borrow-only, i-owe) */}
      {d.direction === 'i_owe' ? (
        <div className="rounded-[16px] border border-[var(--color-brand-gold)]/20 bg-[var(--color-brand-gold)]/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="block text-sm font-bold text-[var(--color-brand-text-primary)]">{t.fPayoffGoal}</span>
              <span className="mt-0.5 block text-[12px] text-[var(--color-brand-text-muted)]">{t.fPayoffGoalHint}</span>
            </div>
            <Switch
              size="touch"
              aria-label={t.fPayoffGoal}
              checked={d.goalEnabled}
              onCheckedChange={d.setGoalEnabled}
              className="data-checked:bg-[var(--color-brand-gold)]"
            />
          </div>
          {d.goalEnabled ? (
            <div className="mt-3 flex flex-col gap-3">
              <div>
                <div className={`${MICRO} mb-2`}>{t.fClearBy}</div>
                <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                  {[3, 6, 9, 12].map((m) => {
                    const val = format(addMonths(new Date(), m), 'yyyy-MM')
                    const on = d.goalMonth === val
                    return (
                      <OptionChip key={m} selected={on} onClick={() => d.setGoalMonth(val)} className="h-10 text-[13px]">
                        {format(addMonths(new Date(), m), 'MMM yyyy')}
                      </OptionChip>
                    )
                  })}
                </div>
              </div>
              <div>
                <div className={`${MICRO} mb-2`}>{t.fCadence}</div>
                <div className="flex gap-2">
                  {(['monthly', 'weekly'] as const).map((c) => {
                    const on = d.goalCadence === c
                    return (
                      <OptionChip key={c} size="segment" selected={on} onClick={() => d.setGoalCadence(c)} className="h-10 text-[13px] ">
                        {c === 'weekly' ? t.fWeekly : t.fMonthly}
                      </OptionChip>
                    )
                  })}
                </div>
              </div>
              {goalPreview != null ? (
                <div className="rounded-[12px] bg-[var(--color-brand-gold)]/5 px-3.5 py-2.5">
                  <p className="font-mono-numbers text-[14px] font-bold text-[var(--color-brand-gold)]">{t.fYoudPay(goalPreview.toLocaleString(), d.currency, d.goalCadence === 'weekly' ? t.fPerWeek : t.fPerMonth)}</p>
                  {strain != null ? (
                    <p className={`mt-1 text-[12px] ${strain > 0.35 ? 'text-[var(--color-brand-amber)]' : 'text-[var(--color-brand-text-muted)]'}`}>
                      {strain > 0.35 ? t.fStrainHeavy(Math.round(strain * 100)) : t.fStrainOk}
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
