'use client'

import { useState } from 'react'
import { parseISO } from 'date-fns'
import { ChevronDown, Landmark, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AddDebtHook } from '@/hooks/useAddDebtSheet'
import { AmountHero } from '@/components/ui/AmountHero'
import { OptionSheet } from '@/components/ui/OptionSheet'
import { PickerRow } from '@/components/ui/PickerRow'
import { SettingsSwitchRow } from '@/components/features/settings/SettingsSwitchRow'
import { NoteRow } from '@/components/features/savings-v3/MoneySheetParts'
import { MethodPickerRow } from '@/components/features/debts/lt/MethodPickerRow'
import { SheetGroup } from '@/components/features/debts/lt/SheetParts'
import { isOwedToUser } from '@/lib/debts/debtDirection'
import { formatFlex } from '@/lib/utils/formatters'
import { useLocale, useT } from '@/lib/i18n'
import { formatLocalized } from '@/lib/i18n/dateFormat'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'
import { useLightTouchCopy } from '@/lib/i18n/lightTouchCopy'

/** "Car loan · CIB": the debt's name, then the lender when it has one of its own. */
export function payDebtTitle(debt: { name?: string; person?: string; creditor?: string; installmentProviderName?: string }): string {
  const name = (debt.name || debt.person || '').trim()
  const lender = (debt.creditor || debt.installmentProviderName || '').trim()
  return lender && lender.toLowerCase() !== name.toLowerCase() ? `${name} · ${lender}` : name
}

/**
 * Record a payment (Light touch `debtpay`): icon tile, the signed amount, what is left after it, then Debt · Paid from ·
 * Repeat. Money back from someone (`repaid`) reads "Ahmed paid you back", "For Zooba on Oct 27 · 400 of 400", keeps the
 * currency fixed and shows only Into; Repeat and the note sit behind a quiet "More options".
 */
export function PayDebtForm({ d }: { d: AddDebtHook }) {
  const dict = useT()
  const t = dict.debts
  const c = useDebtsSubsLtCopy().pay
  const ordinal = useLightTouchCopy().dayOfMonth.ordinal
  const debt = d.selectedDebt
  const receiving = debt ? isOwedToUser(debt) : false
  const tone = receiving ? 'var(--color-brand-green)' : 'var(--color-brand-primary)'
  const Icon = receiving ? Undo2 : Landmark
  const paid = parseFloat(d.paymentAmount)
  const sameUnit = debt ? d.paymentCurrency === (debt.isGold ? 'XAU' : debt.currency) : false
  const after = Math.max(0, d.selectedRemaining - (sameUnit && paid > 0 ? paid : 0))
  const unit = debt?.isGold ? ' g' : ''
  const { locale } = useLocale()
  const [more, setMore] = useState(false)
  const [pickDebt, setPickDebt] = useState(false)
  // The debts this payment can go to (the "Which debt?" picker, mockup debtpay): the open ones you owe.
  const otherDebts = d.payableRows.filter((r) => !isOwedToUser(r.debt))
  const showExtras = !receiving || more || d.paymentScheduleMode === 'recurring' || d.paymentNotes !== ''
  const what = debt?.description?.trim()
  const since = debt?.startDate ? formatLocalized(parseISO(debt.startDate.slice(0, 10)), 'MMM d', locale) : ''
  const thisOf = c.ofTotal(`${formatFlex(sameUnit && paid > 0 ? paid : 0)}${unit}`, `${formatFlex(d.selectedRemaining)}${unit}`)

  return (
    <div className="flex flex-col gap-4 pt-1">
      <AmountHero
        value={d.paymentAmount}
        onChange={(v) => { d.setPaymentAmount(v); d.setPaymentRateError('') }}
        currency={d.paymentCurrency}
        onCurrencyChange={receiving ? undefined : (code) => { d.setPaymentCurrency(code); d.setPaymentRateError('') }}
        includeGold={debt?.isGold}
        base={d.settings.baseCurrency}
        sign={receiving ? '+' : '−'}
        aria-label={t.fAmount}
        top={
          <span aria-hidden className="flex size-[52px] items-center justify-center rounded-2xl [&_svg]:size-6" style={{ background: `color-mix(in oklab, ${tone} 14%, transparent)`, color: tone }}>
            <Icon />
          </span>
        }
        line={d.paymentPreview() ?? ''}
        className="px-0 pb-0"
      />
      {debt ? (
        <div className="-mt-1 text-center">
          <p dir="auto" className="text-[1.0625rem] font-semibold text-[var(--color-brand-text-primary)]">{receiving ? c.paidBack(debt.person || debt.name) : payDebtTitle(debt)}</p>
          <p dir="auto" className="mt-0.5 font-mono-numbers text-[0.8125rem] text-[var(--color-brand-text-secondary)]">
            {receiving
              ? [what && since ? c.forOn(what, since) : '', thisOf].filter(Boolean).join(' · ')
              : c.left(`${formatFlex(d.selectedRemaining)}${unit}`, `${formatFlex(after)}${unit}`)}
          </p>
        </div>
      ) : null}
      {d.paymentRateError ? <p role="alert" className="text-center text-xs text-[var(--color-brand-red)]">{d.paymentRateError}</p> : null}

      <SheetGroup>
        {receiving && !d.isPayDebtFlow ? null : (
          <PickerRow
            label={c.debt}
            onClick={d.isPayDebtFlow ? d.backToPayDebtList : !receiving && otherDebts.length > 1 ? () => setPickDebt(true) : undefined}
            value={<span dir="auto" className="truncate">{debt ? (receiving ? debt.name || debt.person : payDebtTitle(debt)) : ''}</span>}
          />
        )}
        <MethodPickerRow label={receiving ? c.into : c.paidFrom} value={d.paymentMethodId} onChange={d.setPaymentMethodId} paymentMethods={d.paymentMethods} accountsOnly={receiving} />
        {showExtras ? (
          <SettingsSwitchRow
            label={c.repeat}
            hint={c.repeatHint(ordinal(Number(d.paymentDate.slice(8, 10))))}
            checked={d.paymentScheduleMode === 'recurring'}
            onChange={(on) => d.setPaymentScheduleMode(on ? 'recurring' : 'one_time')}
          />
        ) : null}
      </SheetGroup>

      {showExtras ? (
        <NoteRow value={d.paymentNotes} onChange={d.setPaymentNotes} placeholder={c.note} />
      ) : (
        <Button variant="ghost" size="touch" onClick={() => setMore(true)} aria-expanded={false} className="-mt-2 self-center text-[0.8125rem] font-semibold text-[var(--color-brand-text-secondary)]">
          {c.more}
          <ChevronDown aria-hidden />
        </Button>
      )}
      <OptionSheet
        open={pickDebt}
        onClose={() => setPickDebt(false)}
        title={c.debt}
        value={debt?.id ?? null}
        onChange={(id) => { d.selectDebtForPayFlow(id); setPickDebt(false) }}
        options={otherDebts.map((r) => ({ value: r.debt.id, title: payDebtTitle(r.debt), subtitle: c.leftOnly(`${formatFlex(r.remaining)}${r.debt.isGold ? ' g' : ''} ${r.debt.isGold ? '' : r.debt.currency}`.trim()) }))}
        zIndexClassName="z-[110]"
      />
    </div>
  )
}
