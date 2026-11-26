'use client'

import { useState } from 'react'
import { Gem } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { Button } from '@/components/ui/button'
import { AmountHero } from '@/components/ui/AmountHero'
import { AmountTextInput } from '@/components/ui/AmountTextInput'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { OptionSheet } from '@/components/ui/OptionSheet'
import { PickerRow } from '@/components/ui/PickerRow'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useActionToast } from '@/components/ui/ActionToast'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { SheetBody, SheetFooter, tint } from '@/components/features/savings-v3/MoneySheetParts'
import { MoneySourceField, type MoneySource } from '@/components/features/savings-v3/MoneySourceField'
import { useAssetPurchaseSources } from '@/components/features/savings-v3/useAssetPurchaseSources'
import { useAssetPrices } from '@/hooks/useAssetPrices'
import { applyAssetPurchase, assetPayCurrency, planAssetPurchase } from '@/lib/savings/assetPurchase'
import { goldToGrams, valueGold, type GoldUnit } from '@/lib/savings/holdingValuation'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { useFlowLtCopy } from '@/lib/i18n/flowLtCopy'
import { useGoalsLtCopy } from '@/lib/i18n/goalsLtCopy'
import { manualOccurredAt } from '@/lib/time/occurredAt'
import { formatWhole as fmtNum } from '@/lib/utils/formatters'
import { localTodayISO } from '@/lib/utils/localDate'
import type { GoldKarat } from '@/lib/store/types'

const KARATS = ['24', '21', '18'] as const
const UNITS: GoldUnit[] = ['grams', 'pounds', 'ounces']
const GOLD = 'var(--color-brand-gold)'

export interface GoldFormSheetProps {
  open: boolean
  onClose: () => void
  onDone?: () => void
}

/**
 * Add gold (Light touch): the amount with its unit inline (grams, gold pounds or ounces, saved as grams), the karat,
 * where the money came from (an account, a pocket, or outside buddget), what was paid and when. Writes go through
 * `applyAssetPurchase`: the grams and the money row that paid for them, linked so they are deleted together.
 */
export function GoldFormSheet({ open, onClose, onDone }: GoldFormSheetProps) {
  const a = useT().savingsForms.asset
  const lt = useGoalsLtCopy()
  const g = lt.gold
  const refusals = lt.assetBuy.refusals
  const timeLabel = useFlowLtCopy().expense.time
  const showToast = useActionToast()
  const { lookup } = useAssetPrices()

  const [amount, setAmount] = useState('')
  const [unit, setUnit] = useState<GoldUnit>('grams')
  const [karat, setKarat] = useState<GoldKarat>(21)
  // An account with no id follows the primary tracked account.
  const [source, setSource] = useState<MoneySource>({ kind: 'account' })
  const [paid, setPaid] = useState('')
  const [date, setDate] = useState(localTodayISO)
  const [clock, setClock] = useState('')
  const [unitOpen, setUnitOpen] = useState(false)
  const { store, accounts, pockets, effective } = useAssetPurchaseSources(source)

  const qty = parseFloat(amount) || 0
  const grams = goldToGrams(qty, unit)
  const paidNum = parseFloat(paid) || 0
  const worth = valueGold(grams, karat, lookup, 'EGP').value
  const outside = effective.kind === 'outside'
  const payCurrency = assetPayCurrency(store, effective)
  const plan = planAssetPurchase(store, { source: effective, paid: paidNum, currency: payCurrency, priced: worth != null })
  const refusal = plan.action === 'refuse' ? plan.reason : null
  const canSubmit = qty > 0 && !refusal

  const submit = () => {
    if (!canSubmit) return
    const failed = applyAssetPurchase(useFinanceStore.getState(), {
      source: effective, paid: outside ? 0 : paidNum, currency: payCurrency, priced: worth != null, units: grams,
      holding: { assetType: 'gold', name: `${karat}k gold`, karat, quantity: grams, goldUnit: unit, currency: 'EGP' },
      date, occurredAt: manualOccurredAt(date, clock),
    })
    if (failed) return showToast(refusals[failed])
    ;(onDone ?? onClose)()
  }

  if (!open) return null

  const line = worth == null ? g.priceRefreshing : `${unit === 'grams' || qty <= 0 ? '' : g.gramsLead(fmtNum(grams))}${g.worth(fmtNum(worth))}`
  const note = outside ? g.noteOutside : effective.kind === 'pocket' ? g.notePocket : g.noteBudget
  // An empty paid amount only disables the button; every other refusal is said once the amount is typed.
  const alert = qty > 0 && refusal && refusal !== 'no_paid' ? refusals[refusal] : null

  return (
    <ModalShell open={open} onBackdropClick={onClose} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={onClose}>
          <V3SheetHeader.Title>{a.titles.gold}</V3SheetHeader.Title>
        </V3SheetHeader>

        <SheetBody className="space-y-3 pt-0">
          <AmountHero
            value={amount}
            onChange={setAmount}
            unit={g.unitShort[unit]}
            unitKind="unit"
            onUnitClick={() => setUnitOpen(true)}
            aria-label={a.howMuch}
            top={
              <span aria-hidden className="flex size-[52px] items-center justify-center rounded-2xl" style={{ background: tint(GOLD, 18), color: GOLD }}>
                <Gem className="size-6" />
              </span>
            }
            line={line}
          />

          <SegmentedControl<(typeof KARATS)[number]>
            ariaLabel={g.karatAria}
            value={String(karat) as (typeof KARATS)[number]}
            onChange={(k) => setKarat(Number(k) as GoldKarat)}
            options={KARATS.map((k) => ({ value: k, label: `${k}k` }))}
          />

          <div>
            <MoneySourceField
              value={effective}
              onChange={setSource}
              paymentMethods={accounts.map((v) => v.method)}
              accounts={accounts}
              accountLook="row"
              pockets={pockets}
              labels={{ from: g.paidFrom, fromPocket: g.paidFrom, outsideValue: g.outsideValue }}
              after={
                <>
                  {!outside ? (
                    <PickerRow
                      label={g.paid}
                      value={
                        <AmountTextInput
                          aria-label={g.paid}
                          grouped
                          value={paid}
                          onChange={setPaid}
                          currency={payCurrency}
                          placeholder="0"
                          className="w-full min-w-0 bg-transparent text-end font-mono-numbers text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)] outline-none placeholder:text-[var(--color-brand-text-muted)]"
                        />
                      }
                    />
                  ) : null}
                  <PickerRow
                    label={g.boughtOn}
                    value={<DatePickerField look="pill" value={date} onChange={setDate} time={{ value: clock, onChange: setClock, label: timeLabel, defaultNow: true }} />}
                  />
                </>
              }
            />
            {alert ? (
              <p role="alert" className="mt-2 px-1 text-[0.8125rem] text-[var(--color-brand-amber)]">{alert}</p>
            ) : (
              <p className="mt-2 px-1 text-xs text-[var(--color-brand-text-secondary)]">{note}</p>
            )}
          </div>
        </SheetBody>

        <SheetFooter safeArea>
          <Button size="cta-block" onClick={submit} disabled={!canSubmit} className="font-semibold">
            {g.cta(qty > 0 ? amount : '0', g.unitShort[unit], karat)}
          </Button>
        </SheetFooter>
      </div>

      <OptionSheet<GoldUnit>
        open={unitOpen}
        onClose={() => setUnitOpen(false)}
        title={g.unitTitle}
        subtitle={g.unitSub}
        options={UNITS.map((u) => ({ value: u, title: g.units[u], subtitle: g.unitHints[u] || undefined }))}
        value={unit}
        onChange={setUnit}
      />
    </ModalShell>
  )
}
