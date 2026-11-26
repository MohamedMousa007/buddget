'use client'

import { useEffect, useRef, useState } from 'react'
import { Repeat } from 'lucide-react'
import type { AddDebtHook } from '@/hooks/useAddDebtSheet'
import type { Currency, GoldKarat } from '@/lib/store/types'
import { AmountHero } from '@/components/ui/AmountHero'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { NumberPickerSheet } from '@/components/ui/NumberPickerSheet'
import { OptionSheet } from '@/components/ui/OptionSheet'
import { Pill } from '@/components/ui/PillButton'
import { PickerRow } from '@/components/ui/PickerRow'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SettingsSwitchRow } from '@/components/features/settings/SettingsSwitchRow'
import { accountTitle } from '@/components/features/accounts/accountDisplay'
import { MethodPickerRow } from '@/components/features/debts/lt/MethodPickerRow'
import { SheetGroup, TextRow } from '@/components/features/debts/lt/SheetParts'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { goalAmountPerPayment, goalPaymentCount } from '@/lib/debts/borrowGoal'
import { goldGramsToMoney } from '@/lib/utils/calculations'
import { formatFlex, formatWhole } from '@/lib/utils/formatters'
import { useLocale, useT } from '@/lib/i18n'
import { formatLocalized } from '@/lib/i18n/dateFormat'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'
import { useFlowLtCopy } from '@/lib/i18n/flowLtCopy'

type Every = 'weekly' | 'monthly' | 'quarterly' | 'annually'
const KARATS: GoldKarat[] = [24, 21, 18]
const OVER_PRESETS = [3, 6, 9, 12, 18, 24, 36, 48] as const

/** New / edit borrow (Light touch `s_borrow`): amount hero, I owe · Owed to me, the details group, then the pay-off plan. */
export function AddBorrowForm({ d, locked = false }: { d: AddDebtHook; locked?: boolean }) {
  const dict = useT()
  const legacy = dict.debts
  const c = useDebtsSubsLtCopy().borrow
  const timeLabel = useFlowLtCopy().expense.time
  const { locale } = useLocale()
  const gpg = useFinanceStore((s) => s.goldPricePerGram)
  const goldOk = useFinanceStore((s) => s.goldPriceAvailable !== false) && gpg > 0
  const base = d.settings.baseCurrency
  const [sheet, setSheet] = useState<'karat' | 'over' | 'every' | null>(null)

  const isGold = d.receivedVia === 'gold'
  const owe = d.direction === 'i_owe'
  const amount = parseFloat(d.startingBalance)
  const amountText = amount > 0 ? formatFlex(amount) : '0'
  const who = d.person.trim()
  const perGram = (k: GoldKarat) => goldGramsToMoney(1, gpg, k)

  const line = isGold
    ? goldOk
      ? c.goldLine(`${formatWhole(goldGramsToMoney(amount > 0 ? amount : 0, gpg, d.goldKarat))} ${base}`, formatWhole(perGram(d.goldKarat)), d.goldKarat)
      : c.goldUnavailable
    : owe ? c.youOwe(who || c.them) : c.owesYou(who || c.they)

  // A plan stored in years shows (and, once changed, saves) as months; the cadence is shown as stored.
  const span = Math.max(1, parseFloat(d.goalDuration) || 12)
  const months = d.goalUnit === 'years' ? Math.round(span * 12) : Math.round(span)
  const every: Every = d.goalCadence
  const planOn = owe && d.goalEnabled
  const per = planOn && amount > 0 ? goalAmountPerPayment(amount, months, 'months', every) : null
  const count = planOn ? goalPaymentCount(months, 'months', every) : 0

  const planRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (d.goalIntent) planRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [d.goalIntent])

  const account = d.principalAccount ? accountTitle(d.principalAccount) : ''
  const matchDate = d.principalMatch ? formatLocalized(new Date(`${d.principalMatch.date}T12:00:00`), 'd MMM', locale) : null

  return (
    <div className="flex flex-col gap-4 pt-1">
      <AmountHero
        value={d.startingBalance}
        onChange={d.setStartingBalance}
        currency={isGold ? 'XAU' : d.currency}
        onCurrencyChange={!isGold && !d.currencyLocked ? (code) => d.setCurrency(code as Currency) : undefined}
        unit={isGold ? `g · ${d.goldKarat}k` : undefined}
        onUnitClick={isGold && !d.currencyLocked ? () => setSheet('karat') : undefined}
        unitKind={isGold ? 'unit' : 'currency'}
        base={base}
        line={line}
        aria-label={isGold ? legacy.fGrams : legacy.fAmount}
        className="px-0 pb-0"
      />

      <SegmentedControl
        ariaLabel={legacy.fDirection}
        value={d.direction}
        onChange={d.setDirection}
        options={[
          { value: 'i_owe' as const, label: c.iOwe },
          { value: 'they_owe' as const, label: c.owedToMe },
        ].filter((o) => !locked || o.value === d.direction)}
      />

      <SheetGroup>
        <TextRow label={c.person} value={d.person} onChange={d.setPerson} placeholder={c.personPh} />
        <TextRow label={c.forLabel} value={d.name} onChange={d.setName} placeholder={c.forPh} />
        <PickerRow label={c.date} value={<DatePickerField look="pill" value={d.installmentStartDate} onChange={d.setInstallmentStartDate} time={{ value: d.borrowTime, onChange: d.setBorrowTime, label: timeLabel, defaultNow: !d.isEditFlow }} />} />
        {!isGold ? (
          <MethodPickerRow label={owe ? c.receivedIn : c.paidFrom} value={d.paymentMethodId} onChange={d.setPaymentMethodId} paymentMethods={d.paymentMethods} />
        ) : null}
        {!isGold && d.principalAccount && matchDate ? (
          <SettingsSwitchRow
            label={owe ? legacy.fPrincipalMatchIn(matchDate) : legacy.fPrincipalMatchOut(matchDate)}
            checked={d.principalLinked}
            onChange={d.setPrincipalLinked}
          />
        ) : null}
        {!isGold && d.principalAccount && !d.principalLinked ? (
          <SettingsSwitchRow
            label={owe ? c.arrivedIn(account) : c.leftAccount(account)}
            hint={owe ? c.adds(amountText) : c.takes(amountText)}
            checked={d.principalMoved}
            onChange={d.setPrincipalMoved}
          />
        ) : null}
        <SettingsSwitchRow
          label={c.gold}
          hint={c.goldHelp}
          checked={isGold}
          disabled={d.currencyLocked}
          onChange={(on) => d.applyDebtReceivedVia(on ? 'gold' : 'cash')}
        />
      </SheetGroup>
      {d.currencyLocked ? <p className="-mt-2 px-1 text-xs text-[var(--color-brand-text-muted)]">{dict.moneyFlows.debtLocked}</p> : null}

      {owe ? (
        <div ref={planRef}>
          <SheetGroup label={c.plan} note={per != null ? c.planNote(`${formatFlex(per)}${isGold ? ' g' : ''}`, every, count) : undefined}>
            <SettingsSwitchRow label={c.planSwitch} checked={d.goalEnabled} onChange={d.setGoalEnabled} />
            {d.goalEnabled ? (
              <>
                <PickerRow label={c.over} value={<Pill>{c.months(months)}</Pill>} chevron={false} onClick={() => setSheet('over')} />
                <PickerRow label={c.every} value={<Pill icon={<Repeat />}>{c.everyValue[every]}</Pill>} chevron={false} onClick={() => setSheet('every')} />
              </>
            ) : null}
          </SheetGroup>
        </div>
      ) : null}

      <OptionSheet
        open={sheet === 'karat'}
        onClose={() => setSheet(null)}
        title={c.karatTitle}
        subtitle={c.karatSub}
        value={String(d.goldKarat)}
        onChange={(k) => d.setGoldKarat(Number(k) as GoldKarat)}
        options={KARATS.map((k) => ({ value: String(k), title: `${k}k`, subtitle: goldOk ? c.karatSubtitle(`${formatWhole(perGram(k))} ${base}`) : undefined }))}
        zIndexClassName="z-[110]"
      />
      <NumberPickerSheet
        open={sheet === 'over'}
        onClose={() => setSheet(null)}
        title={c.overTitle}
        value={months}
        presets={OVER_PRESETS}
        unit={c.monthsUnit}
        onChange={(n) => { d.setGoalUnit('months'); d.setGoalDuration(String(n)) }}
        zIndexClassName="z-[110]"
      />
      <OptionSheet
        open={sheet === 'every'}
        onClose={() => setSheet(null)}
        title={c.everyTitle}
        value={every}
        onChange={(e) => d.setGoalCadence(e)}
        options={(['weekly', 'monthly', 'quarterly', 'annually'] as const).map((e) => ({ value: e, title: c.everyValue[e] }))}
        zIndexClassName="z-[110]"
      />
    </div>
  )
}
