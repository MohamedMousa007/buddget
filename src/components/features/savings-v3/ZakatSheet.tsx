'use client'

import { useMemo, useState } from 'react'
import { Coins, Settings } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PickerRow } from '@/components/ui/PickerRow'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { useActionToast } from '@/components/ui/ActionToast'
import { markZakatPaid, undoZakatPaid } from '@/lib/savings/zakatPaid'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { computeZakat } from '@/lib/savings/zakat'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { SheetBody, SheetFooter, tint } from '@/components/features/savings-v3/MoneySheetParts'
import { ZakatSettingsSheet } from '@/components/features/savings-v3/ZakatSettingsSheet'
import { formatWhole as fmtNum } from '@/lib/utils/formatters'
import { localTodayISO } from '@/lib/utils/localDate'
import { navigate } from '@/lib/navigation/navigate'
import type { ZakatBase } from '@/lib/savings/zakatInputs'
import { effectiveNisabBasis } from '@/lib/savings/zakatBasis'
import { useT } from '@/lib/i18n'
import { useGoalsLtCopy } from '@/lib/i18n/goalsLtCopy'

export interface ZakatSheetProps {
  open: boolean
  onClose: () => void
  base: ZakatBase
  hawlDate: string
}

const GOLD = 'var(--color-brand-gold)'
const MINUS = '−'

/**
 * Zakat (Light touch): what is due, then what counts. Each line comes from Wealth or Debts and opens it; the gear holds
 * the nisab basis, how stocks are held and the personal zakat year. Lines saved by hand before this sheet still apply,
 * so the figure matches the Wealth page.
 */
export function ZakatSheet({ open, onClose, base, hawlDate }: ZakatSheetProps) {
  const updateProfile = useFinanceStore((s) => s.updateProfile)
  const cfg = useFinanceStore((s) => s.profile.zakatConfig) ?? undefined
  const goldGrams = useFinanceStore((s) => s.investmentHoldings.filter((h) => h.assetType === 'gold').reduce((sum, h) => sum + h.quantity, 0))
  const t = useT().wealthSheets.zakat
  const sf = useT().savingsForms.zakat
  const z = useGoalsLtCopy().zakat
  const unit = useFinanceStore((s) => s.settings.baseCurrency)
  const confirmDialog = useConfirm()
  const showToast = useActionToast()
  const [settings, setSettings] = useState(false)

  const nisabBasis = effectiveNisabBasis(cfg)
  const holdsForTrading = cfg?.holdsForTrading ?? false
  const ov = cfg?.lineOverrides ?? {}
  const val = (id: string, live: number) => (ov[id] != null ? ov[id] : live)
  const cash = val('cash', base.cashAndSavings)
  const gold = val('gold', base.goldValue)
  const crypto = val('crypto', base.cryptoValue)
  const stocks = val('stocks', base.stocksValue)
  const debts = val('debts', base.debtsDueThisYear)

  const result = useMemo(() => computeZakat({
    cashAndSavings: cash, goldValue: gold, cryptoValue: crypto, stocksValue: stocks,
    holdsForTrading, debtsDueThisYear: debts, nisabBasis,
    gold24kSellPerGram: base.gold24kSellPerGram, silverPerGram: base.silverPerGram,
    manualAmount: cfg?.manualAmount ?? null,
  }), [cash, gold, crypto, stocks, holdsForTrading, debts, nisabBasis, base, cfg?.manualAmount])

  const markPaid = async () => {
    const amount = fmtNum(result.zakat)
    if (!(await confirmDialog({ title: t.markPaidTitle, body: t.markPaidBody(amount, unit) }))) return
    const before = useFinanceStore.getState().profile.zakatConfig
    const paid = markZakatPaid({ holdsForTrading: false, ...before, nisabBasis: effectiveNisabBasis(before) }, localTodayISO(), new Date().toISOString())
    updateProfile({ zakatConfig: paid })
    onClose()
    showToast(t.markPaidToast, {
      undoLabel: t.undo,
      undo: () => {
        const cur = useFinanceStore.getState().profile.zakatConfig
        if (cur && before) useFinanceStore.getState().updateProfile({ zakatConfig: undoZakatPaid(cur, before) })
      },
    })
  }

  const go = (path: string) => () => { onClose(); navigate(path) }

  if (!open) return null

  const money = (n: number) => <span className="font-mono-numbers">{fmtNum(n)}</span>
  const lines = [
    { key: 'cash', label: z.cash, value: money(cash), path: '/wealth' },
    { key: 'gold', label: goldGrams > 0 ? z.gold(fmtNum(goldGrams)) : sf.gold, value: money(gold), path: '/wealth' },
    ...(crypto > 0 ? [{ key: 'crypto', label: z.crypto, value: money(crypto), path: '/wealth' }] : []),
    { key: 'stocks', label: z.stocks(holdsForTrading ? 100 : 30), value: money(stocks), path: '/wealth' },
    { key: 'debts', label: z.debts, value: <span className="font-mono-numbers">{debts > 0 ? MINUS : ''}{fmtNum(debts)}</span>, path: '/debts' },
  ]

  return (
    <ModalShell open={open} onBackdropClick={onClose} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader
          onClose={onClose}
          actions={<V3SheetHeader.Action icon={<Settings size={16} />} label={z.settings} onClick={() => setSettings(true)} />}
        >
          <V3SheetHeader.Title>{sf.title}</V3SheetHeader.Title>
          <V3SheetHeader.Subtitle>{z.yearEnds(hawlDate)}</V3SheetHeader.Subtitle>
        </V3SheetHeader>

        <SheetBody className="space-y-3 pt-0">
          <div className="flex flex-col items-center px-5 pb-4 pt-2 text-center">
            <span aria-hidden className="flex size-[52px] items-center justify-center rounded-2xl" style={{ background: tint(GOLD, 18), color: GOLD }}>
              <Coins className="size-6" />
            </span>
            <p dir="ltr" className="mt-3 flex items-baseline justify-center gap-1.5">
              <span className="font-mono-numbers text-[2.5rem] font-semibold leading-none tracking-[-0.04em] text-[var(--color-brand-text-primary)]">
                {result.due ? fmtNum(result.zakat) : '0'}
              </span>
              <span dir="auto" className="text-[1.0625rem] font-semibold text-[var(--color-brand-text-muted)]">{result.due ? z.due(unit) : z.notDue}</span>
            </p>
            <p dir="auto" className="mt-2 font-mono-numbers text-[0.8125rem] text-[var(--color-brand-text-secondary)]">
              {result.due ? z.dueLine(fmtNum(result.zakatable), fmtNum(result.nisab)) : sf.underLine(fmtNum(result.gap), unit)}
            </p>
          </div>

          <div>
            <p className="mb-2 ms-1 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">{sf.whatCounts}</p>
            <Card padding="none" divide className="overflow-hidden">
              {lines.map((l) => (
                <PickerRow key={l.key} label={l.label} value={l.value} onClick={go(l.path)} className="[&>span:first-child]:w-auto [&>span:first-child]:flex-1" />
              ))}
              <PickerRow
                label={z.zakatable}
                value={<span className="font-mono-numbers font-semibold">{fmtNum(result.zakatable)}</span>}
                className="[&>span:first-child]:w-auto [&>span:first-child]:flex-1"
              />
            </Card>
            <p className="mt-2 px-1 text-xs text-[var(--color-brand-text-secondary)]">{z.footnote}</p>
          </div>
        </SheetBody>

        <SheetFooter safeArea>
          {result.due ? (
            <Button size="cta-block" onClick={markPaid} className="font-semibold">{z.markPaid}</Button>
          ) : (
            <Button size="cta-block" variant="outline" onClick={onClose} className="font-semibold">{t.done}</Button>
          )}
        </SheetFooter>
      </div>
      <ZakatSettingsSheet
        open={settings}
        onClose={() => setSettings(false)}
        goldNisab={85 * base.gold24kSellPerGram}
        silverNisab={595 * base.silverPerGram}
        unit={unit}
      />
    </ModalShell>
  )
}
