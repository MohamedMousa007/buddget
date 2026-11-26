'use client'

import { useState } from 'react'
import { ArrowDownLeft, Gem } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AmountHero } from '@/components/ui/AmountHero'
import { AmountTextInput } from '@/components/ui/AmountTextInput'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { OptionSheet } from '@/components/ui/OptionSheet'
import { PickerRow } from '@/components/ui/PickerRow'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { SheetBody, SheetFooter, tint } from '@/components/features/savings-v3/MoneySheetParts'
import { useAssetPrices } from '@/hooks/useAssetPrices'
import { goldToGrams, valueGold, type GoldUnit } from '@/lib/savings/holdingValuation'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { useGoalsLtCopy } from '@/lib/i18n/goalsLtCopy'
import { formatWhole as fmtNum } from '@/lib/utils/formatters'
import { localTodayISO } from '@/lib/utils/localDate'
import type { GoldKarat } from '@/lib/store/types'

type Source = 'budget' | 'had'
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
 * where the money came from (this month or outside buddget), what was paid and when.
 */
export function GoldFormSheet({ open, onClose, onDone }: GoldFormSheetProps) {
  const a = useT().savingsForms.asset
  const g = useGoalsLtCopy().gold
  const addHolding = useFinanceStore((s) => s.addInvestmentHolding)
  const baseCurrency = useFinanceStore((s) => s.settings.baseCurrency)
  const { lookup } = useAssetPrices()

  const [amount, setAmount] = useState('')
  const [unit, setUnit] = useState<GoldUnit>('grams')
  const [karat, setKarat] = useState<GoldKarat>(21)
  const [source, setSource] = useState<Source>('budget')
  const [paid, setPaid] = useState('')
  const [date, setDate] = useState(localTodayISO)
  const [sheet, setSheet] = useState<'unit' | 'source' | null>(null)

  const qty = parseFloat(amount) || 0
  const grams = goldToGrams(qty, unit)
  const paidNum = parseFloat(paid) || 0
  const worth = qty > 0 ? valueGold(grams, karat, lookup, 'EGP').value : null
  const outside = source === 'had'
  const canSubmit = qty > 0 && (outside || paidNum > 0)

  const submit = () => {
    if (!canSubmit) return
    addHolding({
      assetType: 'gold', name: `${karat}k gold`, karat, quantity: grams, goldUnit: unit, currency: 'EGP',
      purchaseDate: date || undefined,
      unitCost: !outside && grams > 0 ? paidNum / grams : undefined,
      costBasisCurrency: baseCurrency,
    })
    ;(onDone ?? onClose)()
  }

  if (!open) return null

  const line = qty <= 0 ? '' : worth == null ? g.priceRefreshing : `${unit === 'grams' ? '' : g.gramsLead(fmtNum(grams))}${g.worth(fmtNum(worth))}`

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
            onUnitClick={() => setSheet('unit')}
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
            <Card padding="none" divide className="overflow-hidden">
              <PickerRow label={g.paidFrom} value={outside ? g.outside : g.thisMonth} onClick={() => setSheet('source')} />
              {!outside ? (
                <PickerRow
                  label={g.paid}
                  value={
                    <AmountTextInput
                      aria-label={g.paid}
                      value={paid}
                      onChange={setPaid}
                      currency="EGP"
                      placeholder="0"
                      className="w-full min-w-0 bg-transparent text-end font-mono-numbers text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)] outline-none placeholder:text-[var(--color-brand-text-muted)]"
                    />
                  }
                />
              ) : null}
              <PickerRow label={g.boughtOn} value={<DatePickerField look="pill" value={date} onChange={setDate} />} />
            </Card>
            <p className="mt-2 px-1 text-xs text-[var(--color-brand-text-secondary)]">{outside ? g.noteOutside : g.noteBudget}</p>
          </div>
        </SheetBody>

        <SheetFooter safeArea>
          <Button size="cta-block" onClick={submit} disabled={!canSubmit} className="font-semibold">
            {qty > 0 ? g.cta(amount, g.unitShort[unit], karat) : a.addInvestment}
          </Button>
        </SheetFooter>
      </div>

      <OptionSheet<GoldUnit>
        open={sheet === 'unit'}
        onClose={() => setSheet(null)}
        title={g.unitTitle}
        subtitle={g.unitSub}
        options={UNITS.map((u) => ({ value: u, title: g.units[u], subtitle: g.unitHints[u] || undefined }))}
        value={unit}
        onChange={setUnit}
      />
      <OptionSheet<Source>
        open={sheet === 'source'}
        onClose={() => setSheet(null)}
        title={g.paidFromTitle}
        options={[
          { value: 'budget', title: g.thisMonth, subtitle: g.thisMonthSub, icon: <ArrowDownLeft /> },
          { value: 'had', title: g.outside, subtitle: g.outsideSub, icon: <Gem />, tone: GOLD },
        ]}
        value={source}
        onChange={setSource}
      />
    </ModalShell>
  )
}
