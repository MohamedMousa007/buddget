'use client'

import { useEffect, useRef } from 'react'
import { Lock } from 'lucide-react'
import type { AddDebtHook } from '@/hooks/useAddDebtSheet'
import type { Currency, GoldKarat } from '@/lib/store/types'
import { CurrencyField } from '@/components/ui/CurrencyField'
import { Input } from '@/components/ui/input'
import { AmountField } from '@/components/ui/AmountField'
import { Switch } from '@/components/ui/switch'
import { PaymentMethodPicker } from '@/components/features/payments/PaymentMethodPicker'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { goalAmountPerPayment, goalPaymentCount, type GoalFrequency, type GoalUnit } from '@/lib/debts/borrowGoal'
import { useT } from '@/lib/i18n'
import { soft } from './heroCardShared'

const MICRO = 'font-semibold text-[0.625rem] tracking-[0.08em] uppercase text-[var(--color-brand-text-muted)]'

// Demo gold prices (EGP/g) — wire to the live gold-price source in the store.
const GOLD_PRICE: Record<GoldKarat, number> = { 24: 4600, 22: 4210, 21: 4025, 18: 3450 }
export function AddBorrowForm({ d, locked = false }: { d: AddDebtHook; locked?: boolean }) {
  const dict = useT()
  const t = dict.debts
  const stats = useMonthlyStats()
  const isGold = d.receivedVia === 'gold'
  const grams = parseFloat(d.startingBalance)
  const goldValue = isGold && !Number.isNaN(grams) ? grams * GOLD_PRICE[d.goldKarat] : null

  const goalRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (d.goalIntent) goalRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [d.goalIntent])

  const FREQS: { v: GoalFrequency; label: string; per: string }[] = [
    { v: 'weekly', label: t.fWeekly, per: t.fPerWeek },
    { v: 'monthly', label: t.fMonthly, per: t.fPerMonth },
    { v: 'quarterly', label: t.fQuarterly, per: t.fPerQuarter },
    { v: 'annually', label: t.fAnnually, per: t.fPerYear },
  ]
  const PAYMENTS_PER_MONTH: Record<GoalFrequency, number> = { weekly: 4.345, monthly: 1, quarterly: 1 / 3, annually: 1 / 12 }

  // Live payoff-goal preview + gentle income-strain hint.
  const goalSpan = parseFloat(d.goalDuration)
  const goalTotal = parseFloat(d.startingBalance)
  const goalValid = d.goalEnabled && goalSpan > 0 && goalTotal > 0
  const goalPreview = goalValid ? goalAmountPerPayment(goalTotal, goalSpan, d.goalUnit, d.goalCadence) : null
  const goalCount = goalValid ? goalPaymentCount(goalSpan, d.goalUnit, d.goalCadence) : 0
  const monthlyPay = goalPreview != null ? goalPreview * PAYMENTS_PER_MONTH[d.goalCadence] : null
  const strain = monthlyPay != null && stats.totalIncome > 0 ? monthlyPay / stats.totalIncome : null

  return (
    <div className="flex flex-col gap-[18px] pt-1">
      {/* Direction (locked in Edit) */}
      <div>
        <div className={`${MICRO} mb-2 flex items-center gap-1.5`}>{t.fDirection} {locked ? <Lock className="h-3 w-3" /> : null}</div>
        <SegmentedControl
          ariaLabel={t.fDirection}
          value={d.direction}
          onChange={d.setDirection}
          options={[
            { value: 'i_owe' as const, label: t.iOwe },
            { value: 'they_owe' as const, label: t.owedToMe },
          ].filter((o) => !locked || o.value === d.direction)}
        />
      </div>

      {/* Person + name */}
      <div>
        <div className={`${MICRO} mb-2`}>{t.fPerson}</div>
        <Input size="brand" value={d.person} onChange={(e) => d.setPerson(e.target.value)} placeholder={t.fPersonPh} />
      </div>
      <div>
        <div className={`${MICRO} mb-2`}>{t.fWhatFor}</div>
        <Input size="brand" value={d.name} onChange={(e) => d.setName(e.target.value)} placeholder={t.fWhatForPh} />
      </div>

      {d.currencyLocked ? <p className="px-0.5 text-[0.75rem] text-[var(--color-brand-text-muted)]">{dict.moneyFlows.debtLocked}</p> : null}

      {/* Gold-backed toggle */}
      <div className="flex items-center justify-between rounded-[16px] border border-[var(--color-brand-gold)]/20 bg-[var(--color-brand-gold)]/5 px-4 py-3.5">
        <div>
          <span className="block text-sm font-bold text-[var(--color-brand-text-primary)]">{t.fGoldBacked}</span>
          <span className="mt-0.5 block text-[0.75rem] text-[var(--color-brand-text-muted)]">{t.fGoldHint}</span>
        </div>
        <Switch
          size="touch"
          aria-label={t.fGoldBacked}
          checked={isGold}
          disabled={d.currencyLocked}
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
            <AmountField value={d.startingBalance} onChange={d.setStartingBalance} mode="decimal" decimalsFor="XAU" aria-label={t.fGrams} placeholder={t.fGramsPh} />
            {goldValue != null ? (
              <p className="mt-2 px-0.5 font-mono-numbers text-[0.75rem] text-[var(--color-brand-gold)]">{t.fGoldValue(goldValue.toLocaleString(), GOLD_PRICE[d.goldKarat].toLocaleString())}</p>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <div>
            <div className={`${MICRO} mb-2`}>{t.fAmount}</div>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1"><AmountField value={d.startingBalance} onChange={d.setStartingBalance} mode="decimal" decimalsFor={d.currency} aria-label={t.fAmount} placeholder="0" /></div>
              <CurrencyField
                compact
                value={d.currency}
                onChange={(c) => d.setCurrency(c as unknown as Currency)}
                disabled={d.currencyLocked}
                className="h-[52px] w-24 shrink-0 rounded-[14px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3"
              />
            </div>
          </div>
          {/* Received via = the payment-method card carousel (§5) */}
          <PaymentMethodPicker label={d.direction === 'i_owe' ? t.fReceivedVia : t.fGivenVia} value={d.paymentMethodId} onChange={d.setPaymentMethodId} paymentMethods={d.paymentMethods} />
        </>
      )}

      {/* Payoff goal — same-height card for both directions so the sheet never jumps */}
      <div ref={goalRef} className="rounded-[16px] border border-[var(--color-brand-gold)]/20 bg-[var(--color-brand-gold)]/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="block text-sm font-bold text-[var(--color-brand-text-primary)]">{t.fPayoffGoal}</span>
            <span className="mt-0.5 block text-[0.75rem] text-[var(--color-brand-text-muted)]">{d.direction === 'i_owe' ? t.fPayoffGoalHint : t.fOwedGoalNote}</span>
          </div>
          <Switch
            size="touch"
            aria-label={t.fPayoffGoal}
            checked={d.direction === 'i_owe' && d.goalEnabled}
            disabled={d.direction !== 'i_owe'}
            onCheckedChange={d.setGoalEnabled}
            className="data-checked:bg-[var(--color-brand-gold)]"
          />
        </div>
        {d.direction === 'i_owe' && d.goalEnabled ? (
          <div className="mt-3 flex flex-col gap-3">
            <div>
              <div className={`${MICRO} mb-2`}>{t.fDuration}</div>
              <div className="grid grid-cols-2 gap-3">
                <AmountField value={d.goalDuration} onChange={d.setGoalDuration} mode="integer" aria-label={t.fDuration} placeholder="12" />
                <SegmentedControl<GoalUnit>
                  size="field"
                  ariaLabel={t.fDuration}
                  value={d.goalUnit}
                  onChange={d.setGoalUnit}
                  options={[
                    { value: 'months', label: t.fUnitMonths },
                    { value: 'years', label: t.fUnitYears },
                  ]}
                />
              </div>
            </div>
            <div>
              <div className={`${MICRO} mb-2`}>{t.fFrequency}</div>
              <SegmentedControl<GoalFrequency>
                ariaLabel={t.fFrequency}
                value={d.goalCadence}
                onChange={d.setGoalCadence}
                options={FREQS.map((f) => ({ value: f.v, label: f.label }))}
              />
            </div>
            {goalPreview != null ? (
              <div className="rounded-[12px] bg-[var(--color-brand-gold)]/5 px-3.5 py-2.5">
                <p className="font-mono-numbers text-[0.875rem] font-bold text-[var(--color-brand-gold)]">
                  {t.fYoudPay(goalPreview.toLocaleString(), d.currency, FREQS.find((f) => f.v === d.goalCadence)!.per)} · {t.fPaymentsCount(goalCount)}
                </p>
                {strain != null ? (
                  <p className={`mt-1 text-[0.75rem] ${strain > 0.35 ? 'text-[var(--color-brand-amber)]' : 'text-[var(--color-brand-text-muted)]'}`}>
                    {strain > 0.35 ? t.fStrainHeavy(Math.round(strain * 100)) : t.fStrainOk}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
