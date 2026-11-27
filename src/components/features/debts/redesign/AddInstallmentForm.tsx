'use client'

import { useState } from 'react'
import { parseISO } from 'date-fns'
import { Car, Laptop, Package, Pencil, Refrigerator, Repeat, Smartphone, Sofa, type LucideIcon } from 'lucide-react'
import { OptionChip } from '@/components/ui/OptionChip'
import { useDebtsV9Copy } from '@/lib/i18n/debtsV9Copy'
import type { AddDebtHook } from '@/hooks/useAddDebtSheet'
import type { Currency, InstallmentItemType } from '@/lib/store/types'
import { IconPickerSheet } from '@/components/features/goals/IconPickerSheet'
import { GOAL_ICON_SET, isGoalIconKey } from '@/lib/goals/goalVisual'
import { AmountHero } from '@/components/ui/AmountHero'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { NumberPickerSheet } from '@/components/ui/NumberPickerSheet'
import { OptionSheet } from '@/components/ui/OptionSheet'
import { Pill } from '@/components/ui/PillButton'
import { PickerRow } from '@/components/ui/PickerRow'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { MethodPickerRow } from '@/components/features/debts/lt/MethodPickerRow'
import { SheetGroup } from '@/components/features/debts/lt/SheetParts'
import { InstallmentProviderPickerSheet } from './InstallmentProviderPickerSheet'
import { ProviderBadge } from './ProviderBadge'
import { coarseProvider } from '@/lib/constants/installmentProviders'
import { addByFrequency } from '@/lib/debts/installmentSchedule'
import { totalFromPer, type PlanFrequency } from '@/lib/debts/installmentPlan'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { formatFlex } from '@/lib/utils/formatters'
import { useLocale, useT } from '@/lib/i18n'
import { formatLocalized } from '@/lib/i18n/dateFormat'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'

type PlanMode = 'total' | 'per'
/** Item types for the tile, stored on the plan (`Debt.installmentItemType`); Other can carry its own icon. */
const ITEMS: { key: InstallmentItemType; Icon: LucideIcon; tone: string }[] = [
  { key: 'phone', Icon: Smartphone, tone: 'shopping' },
  { key: 'laptop', Icon: Laptop, tone: 'education' },
  { key: 'appliance', Icon: Refrigerator, tone: 'utilities' },
  { key: 'furniture', Icon: Sofa, tone: 'rent' },
  { key: 'car', Icon: Car, tone: 'transport' },
  { key: 'other', Icon: Package, tone: 'neutral' },
]
const PAYMENT_PRESETS = [3, 6, 9, 12, 18, 24, 36, 60] as const
const EVERY: PlanFrequency[] = ['weekly', 'monthly', 'quarterly']

/** New / edit installment (Light touch `s_install`): amount hero, Total · Per payment, Item → Paid with, then the plan. */
export function AddInstallmentForm({ d, locked = false }: { d: AddDebtHook; locked?: boolean }) {
  const dict = useT()
  const t = dict.debts
  const all = useDebtsSubsLtCopy()
  const c = all.install
  const { locale } = useLocale()
  const setActiveModal = useSettingsStore((s) => s.setActiveModal)
  const [sheet, setSheet] = useState<'provider' | 'count' | 'every' | 'icon' | null>(null)
  const [mode, setMode] = useState<PlanMode>('total')
  const [perStr, setPerStr] = useState('')
  const v9 = useDebtsV9Copy().install
  // A legacy plan stored no item type: it shows as Other until one is picked.
  const item: InstallmentItemType = d.installmentItemType ?? (d.isEditFlow ? 'other' : 'phone')
  const picked = ITEMS.find((x) => x.key === item)!
  const ownIcon = item === 'other' && isGoalIconKey(d.installmentItemIcon) ? GOAL_ICON_SET[d.installmentItemIcon] : undefined
  const TileIcon = ownIcon ?? picked.Icon
  const tile = (
    <span aria-hidden className="flex size-16 items-center justify-center rounded-[19px] [&_svg]:size-7" style={{ background: `var(--cat-${picked.tone}-bg)`, color: `var(--cat-${picked.tone}-fg)` }}>
      <TileIcon />
    </span>
  )

  const frequency = d.installmentFrequency as PlanFrequency
  const count = Math.max(1, parseInt(d.installmentCount, 10) || 12)
  const total = parseFloat(d.startingBalance)
  const per = total > 0 ? Math.round((total / count) * 100) / 100 : 0

  const switchMode = (next: PlanMode) => {
    if (next === 'per') setPerStr(per > 0 ? String(per) : '')
    setMode(next)
  }
  const pushTotal = (p: string, n: number) => {
    const v = parseFloat(p)
    d.setStartingBalance(v > 0 && n > 0 ? String(totalFromPer(v, n)) : '')
  }
  const changePer = (v: string) => { setPerStr(v); pushTotal(v, count) }
  const changeCount = (n: number) => {
    d.setInstallmentCount(String(n))
    if (mode === 'per') pushTotal(perStr, n)
  }

  const line = mode === 'total' ? c.perLine(per > 0 ? formatFlex(per) : '—') : c.totalLine(total > 0 ? formatFlex(total) : '—')
  const last = d.installmentStartDate ? addByFrequency(parseISO(d.installmentStartDate), frequency, count - 1) : null
  const planNote = per > 0
    ? `${c.planNote(count, formatFlex(per))}${last ? ` · ${formatLocalized(last, 'MMM yyyy', locale)}` : ''}`
    : undefined

  const providerName = d.installmentProvider === 'credit_card'
    ? (d.creditCardDebts.find((x) => x.id === d.linkedCreditCardDebtId)?.name ?? t.debtTypeCreditCard)
    : d.installmentProviderName

  return (
    <div className="flex flex-col gap-4 pt-1">
      {/* The Add goal C top (round 9): item type chips, then the item tile and its name above the amount. */}
      <div className="hide-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {ITEMS.map(({ key, Icon }) => {
          const ChipIcon = key === 'other' && ownIcon ? ownIcon : Icon
          return (
          <OptionChip key={key} size="sm" surface="card" selected={item === key} onClick={() => d.setInstallmentItemType(key)} className="shrink-0">
            <ChipIcon aria-hidden />
            {v9.items[key]}
          </OptionChip>
          )
        })}
      </div>
      <AmountHero
        top={
          <div className="flex w-full flex-col items-center">
            {/* The Add goal C tile: the icon can be changed only for Other. */}
            {item === 'other' ? (
              <button data-raw-button-ok="the editable icon tile of the Add goal C top"
                type="button"
                onClick={() => setSheet('icon')}
                aria-label={v9.iconAriaOther}
                className="relative flex size-16 items-center justify-center rounded-[19px]"
              >
                {tile}
                <span aria-hidden className="absolute -bottom-1 -end-1 flex size-6 items-center justify-center rounded-full border-2 border-[var(--color-brand-card)] bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]">
                  <Pencil className="size-3" />
                </span>
              </button>
            ) : tile}
            <input
              value={d.installmentItemName}
              onChange={(e) => d.setInstallmentItemName(e.target.value)}
              placeholder={v9.namePh}
              aria-label={v9.nameAria}
              dir="auto"
              className="mt-3 h-11 w-full bg-transparent text-center text-[1.0625rem] font-semibold text-[var(--color-brand-text-primary)] outline-none placeholder:text-[var(--color-brand-text-muted)]"
            />
          </div>
        }
        value={mode === 'total' ? d.startingBalance : perStr}
        onChange={mode === 'total' ? d.setStartingBalance : changePer}
        currency={d.currency}
        onCurrencyChange={d.currencyLocked ? undefined : (code) => d.setCurrency(code as Currency)}
        base={d.settings.baseCurrency}
        line={line}
        aria-label={mode === 'total' ? t.fTotalAmount : t.fPerPayment}
        className="px-0 pb-0"
      />
      {d.currencyLocked ? <p className="-mt-2 text-center text-xs text-[var(--color-brand-text-muted)]">{dict.moneyFlows.debtLocked}</p> : null}

      <SegmentedControl<PlanMode>
        ariaLabel={t.fModeAria}
        value={mode}
        onChange={switchMode}
        options={[
          { value: 'total', label: c.total },
          { value: 'per', label: c.per },
        ]}
      />

      <SheetGroup note={c.paidWithNote}>
        <PickerRow
          label={c.provider}
          onClick={locked ? undefined : () => setSheet('provider')}
          value={providerName ? (
            <>
              {d.installmentProvider !== 'credit_card' ? <ProviderBadge slug={d.installmentProviderSlug} name={providerName} size={24} /> : null}
              <span dir="auto" className="truncate">{providerName}</span>
            </>
          ) : <span className="text-[var(--color-brand-text-muted)]">{c.chooseProvider}</span>}
        />
        <PickerRow label={c.starts} value={<DatePickerField look="pill" value={d.installmentStartDate} onChange={d.setInstallmentStartDate} />} />
        <MethodPickerRow label={c.paidWith} value={d.installmentPaidWith || (d.isEditFlow ? '' : d.paymentMethodId)} onChange={d.setInstallmentPaidWith} paymentMethods={d.paymentMethods} />
      </SheetGroup>

      <SheetGroup label={c.plan} note={planNote}>
        <PickerRow label={c.payments} value={<Pill>{count}</Pill>} chevron={false} onClick={() => setSheet('count')} />
        <PickerRow
          label={all.borrow.every}
          value={<Pill icon={<Repeat />}>{all.borrow.everyValue[d.installmentFrequency] ?? all.borrow.everyValue.monthly}</Pill>}
          chevron={false}
          onClick={() => setSheet('every')}
        />
      </SheetGroup>

      <InstallmentProviderPickerSheet
        open={sheet === 'provider'}
        valueSlug={d.installmentProviderSlug}
        valueCardId={d.installmentProvider === 'credit_card' ? d.linkedCreditCardDebtId : undefined}
        creditCards={d.creditCardDebts
          .map((cd) => {
            const pm = d.paymentMethods.find((m) => m.id === cd.linkedPaymentMethodId)
            return pm ? { debtId: cd.id, pm } : null
          })
          .filter((x): x is { debtId: string; pm: (typeof d.paymentMethods)[number] } => x !== null)}
        onPickBrand={(slug, name) => { d.setInstallmentProvider(coarseProvider(slug)); d.setInstallmentProviderName(name); d.setInstallmentProviderSlug(slug); d.setLinkedCreditCardDebtId('') }}
        onPickCard={(cardId, name) => { d.setInstallmentProvider('credit_card'); d.setInstallmentProviderName(name); d.setInstallmentProviderSlug(undefined); d.setLinkedCreditCardDebtId(cardId) }}
        onCustom={(name) => { d.setInstallmentProvider('other'); d.setInstallmentProviderName(name); d.setInstallmentProviderSlug(undefined); d.setLinkedCreditCardDebtId('') }}
        onAddCreditCard={() => setActiveModal('addCreditCard')}
        onClose={() => setSheet(null)}
      />
      <IconPickerSheet
        open={sheet === 'icon'}
        value={isGoalIconKey(d.installmentItemIcon) ? d.installmentItemIcon : null}
        onChange={d.setInstallmentItemIcon}
        onClose={() => setSheet(null)}
        subtitle={v9.iconSub}
        note={v9.iconNote}
      />
      <NumberPickerSheet
        open={sheet === 'count'}
        onClose={() => setSheet(null)}
        title={c.paymentsTitle}
        value={count}
        presets={PAYMENT_PRESETS}
        unit={c.paymentsUnit}
        onChange={changeCount}
        zIndexClassName="z-[110]"
      />
      <OptionSheet
        open={sheet === 'every'}
        onClose={() => setSheet(null)}
        title={all.borrow.everyTitle}
        value={frequency}
        onChange={(f) => d.setInstallmentFrequency(f)}
        options={EVERY.map((f) => ({ value: f, title: all.borrow.everyValue[f as 'weekly' | 'monthly' | 'quarterly'] }))}
        zIndexClassName="z-[110]"
      />
    </div>
  )
}
