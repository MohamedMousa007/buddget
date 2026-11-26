'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { OptionSheet } from '@/components/ui/OptionSheet'
import { PickerRow } from '@/components/ui/PickerRow'
import { PickerSheet } from '@/components/ui/PickerSheet'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { effectiveNisabBasis, withNisabBasis } from '@/lib/savings/zakatBasis'
import { useGoalsLtCopy } from '@/lib/i18n/goalsLtCopy'
import { formatWhole as fmtNum } from '@/lib/utils/formatters'
import type { ZakatConfig } from '@/lib/store/types'

type Basis = 'gold' | 'silver'
type Hold = 'long' | 'trade'

export interface ZakatSettingsSheetProps {
  open: boolean
  onClose: () => void
  /** Today's nisab on each basis, in `unit`. */
  goldNisab: number
  silverNisab: number
  unit: string
  /** The year start the app works out (the zakat date one lunar year back), shown until the user picks their own. */
  derivedStart: string
}

/** Zakat settings behind the gear: the nisab basis, how stocks are held, and the personal zakat year start. Saves on each pick. */
export function ZakatSettingsSheet({ open, onClose, goldNisab, silverNisab, unit, derivedStart }: ZakatSettingsSheetProps) {
  const z = useGoalsLtCopy().zakat
  const cfg = useFinanceStore((s) => s.profile.zakatConfig)
  const updateProfile = useFinanceStore((s) => s.updateProfile)
  const [sheet, setSheet] = useState<'basis' | 'stocks' | null>(null)

  const basis = effectiveNisabBasis(cfg)
  const trading = cfg?.holdsForTrading ?? false
  // Read the latest config at save time, so a change made elsewhere meanwhile is kept.
  const save = (patch: Partial<ZakatConfig>) => {
    const cur = useFinanceStore.getState().profile.zakatConfig
    updateProfile({ zakatConfig: { holdsForTrading: false, ...cur, nisabBasis: effectiveNisabBasis(cur), ...patch } })
  }
  const money = (n: number) => `${fmtNum(n)} ${unit}`

  return (
    <>
      <PickerSheet
        open={open}
        onClose={onClose}
        title={z.settings}
        zIndexClassName="z-[110]"
        footer={<Button size="cta-block" onClick={onClose}>{z.done}</Button>}
      >
        <div>
          <Card padding="none" divide className="overflow-hidden">
            <PickerRow label={z.nisabBasis} value={basis === 'gold' ? z.goldOpt : z.silverOpt} onClick={() => setSheet('basis')} />
            <PickerRow label={z.stocksHeld} value={trading ? z.trading : z.longTerm} onClick={() => setSheet('stocks')} />
            <PickerRow
              label={z.yearStarts}
              value={<DatePickerField look="pill" withYear value={cfg?.yearStartDate ?? derivedStart} onChange={(v) => save({ yearStartDate: v || null })} />}
            />
          </Card>
          <p className="mt-2 px-1 text-xs text-[var(--color-brand-text-secondary)]">{z.yearNote}</p>
        </div>
      </PickerSheet>

      <OptionSheet<Basis>
        open={sheet === 'basis'}
        onClose={() => setSheet(null)}
        title={z.nisabBasis}
        subtitle={z.nisabSub}
        zIndexClassName="z-[120]"
        options={[
          { value: 'gold', title: z.goldOpt, subtitle: z.todayValue(money(goldNisab)), tone: 'var(--color-brand-gold)' },
          { value: 'silver', title: z.silverOpt, subtitle: z.silverLower(money(silverNisab)) },
        ]}
        value={basis}
        onChange={(v) => updateProfile({ zakatConfig: withNisabBasis(useFinanceStore.getState().profile.zakatConfig, v) })}
      />
      <OptionSheet<Hold>
        open={sheet === 'stocks'}
        onClose={() => setSheet(null)}
        title={z.stocksTitle}
        zIndexClassName="z-[120]"
        options={[
          { value: 'long', title: z.longTerm, subtitle: z.longTermSub },
          { value: 'trade', title: z.trading, subtitle: z.tradingSub },
        ]}
        value={trading ? 'trade' : 'long'}
        onChange={(v) => save({ holdsForTrading: v === 'trade' })}
      />
    </>
  )
}
