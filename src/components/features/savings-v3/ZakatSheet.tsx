'use client'

import { useMemo, useState } from 'react'
import { Coins, Settings } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PickerRow } from '@/components/ui/PickerRow'
import { PickerSheet } from '@/components/ui/PickerSheet'
import { AmountHero } from '@/components/ui/AmountHero'
import { PromptBanner } from '@/components/ui/PromptBanner'
import { SettingsSwitchRow } from '@/components/features/settings/SettingsSwitchRow'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { useActionToast } from '@/components/ui/ActionToast'
import { markZakatPaid, undoZakatPaid } from '@/lib/savings/zakatPaid'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { SheetBody, SheetFooter, tint } from '@/components/features/savings-v3/MoneySheetParts'
import { ZakatSettingsSheet } from '@/components/features/savings-v3/ZakatSettingsSheet'
import { formatWhole as fmtNum } from '@/lib/utils/formatters'
import { localTodayISO } from '@/lib/utils/localDate'
import { formatLocalized } from '@/lib/i18n/dateFormat'
import { parseDateOnly } from '@/lib/time/calendarDays'
import { navigate } from '@/lib/navigation/navigate'
import { effectiveNisabBasis, patchZakatConfig } from '@/lib/savings/zakatBasis'
import { hasLegacyZakat, legacyZakatFigure, withoutLegacyZakat } from '@/lib/savings/zakatLegacy'
import { parseZakatLine } from '@/lib/savings/zakatLineInput'
import { firstNisabDay, type ZakatSources, type ZakatYear } from '@/lib/savings/zakatYear'
import type { ZakatConfig } from '@/lib/store/types'
import { useLocale, useT } from '@/lib/i18n'
import { useGoalsLtCopy } from '@/lib/i18n/goalsLtCopy'
import { useZakatCopy } from '@/lib/i18n/zakatCopy'

export interface ZakatSheetProps {
  open: boolean
  onClose: () => void
  sources: ZakatSources
  /** The one-year evaluation the Wealth tile also shows. */
  year: ZakatYear
  hawlDate: string
}

const GOLD = 'var(--color-brand-gold)'
const MINUS = '−'
const GROW = '[&>span:first-child]:w-auto [&>span:first-child]:flex-1'

/**
 * Zakat (Light touch): what is due, then what counts. Every line is live and opens Wealth or Debts; the only typed
 * inputs are what the app cannot know (worn jewellery, doubtful receivables, trade goods). The one-year rule decides
 * whether the figure is an estimate, due now, or not due yet. The gear holds the nisab basis, stocks and the year start.
 */
export function ZakatSheet({ open, onClose, sources, year, hawlDate }: ZakatSheetProps) {
  const updateProfile = useFinanceStore((s) => s.updateProfile)
  const cfg = useFinanceStore((s) => s.profile.zakatConfig) ?? undefined
  const t = useT().wealthSheets.zakat
  const sf = useT().savingsForms.zakat
  const z = useGoalsLtCopy().zakat
  const zc = useZakatCopy()
  const { locale } = useLocale()
  const unit = useFinanceStore((s) => s.settings.baseCurrency)
  const confirmDialog = useConfirm()
  const showToast = useActionToast()
  const [settings, setSettings] = useState(false)
  const [tradeOpen, setTradeOpen] = useState(false)
  const [tradeDraft, setTradeDraft] = useState('')

  const today = localTodayISO()
  const firstDay = useMemo(
    () => (year.state === 'notYet' ? firstNisabDay(sources, cfg, year.yearStart, today) : null),
    [year.state, year.yearStart, sources, cfg, today],
  )
  const { base, result } = year
  const legacy = hasLegacyZakat(cfg) ? legacyZakatFigure(cfg, base) : null

  const save = (patch: Partial<ZakatConfig>) => updateProfile({ zakatConfig: patchZakatConfig(useFinanceStore.getState().profile.zakatConfig, patch) })
  const toggleIn = (list: string[] | undefined, id: string, on: boolean) => {
    const rest = (list ?? []).filter((x) => x !== id)
    return on ? [...rest, id] : rest
  }
  const dismissLegacy = () => {
    const cur = useFinanceStore.getState().profile.zakatConfig
    if (cur) updateProfile({ zakatConfig: withoutLegacyZakat(cur) })
  }

  const holdsForTrading = cfg?.holdsForTrading ?? false
  const trade = cfg?.tradeGoodsValue ?? 0
  const showsDue = year.state === 'estimate' || year.state === 'dueNow'

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
  const openTrade = () => { setTradeDraft(trade > 0 ? String(trade) : ''); setTradeOpen(true) }
  const saveTrade = () => {
    const v = parseZakatLine(tradeDraft)
    save({ tradeGoodsValue: v != null && v > 0 ? v : null })
    setTradeOpen(false)
  }

  if (!open) return null

  const money = (n: number) => <span className="font-mono-numbers">{fmtNum(n)}</span>
  const countedGrams = base.goldHoldings.filter((h) => !h.worn).reduce((s, h) => s + h.grams, 0)
  const goldLabel = base.wornGoldGrams > 0
    ? zc.goldCounted(fmtNum(countedGrams), fmtNum(base.wornGoldGrams))
    : countedGrams > 0 ? z.gold(fmtNum(countedGrams)) : sf.gold
  const lines = [
    { key: 'cash', label: z.cash, value: money(base.cashAndSavings), path: '/wealth' },
    { key: 'gold', label: goldLabel, value: money(base.goldValue), path: '/wealth' },
    ...(base.cryptoValue > 0 ? [{ key: 'crypto', label: z.crypto, value: money(base.cryptoValue), path: '/wealth' }] : []),
    { key: 'stocks', label: z.stocks(holdsForTrading ? 100 : 30), value: money(base.stocksValue), path: '/wealth' },
    ...(base.receivableDebts.length > 0 ? [{ key: 'receivables', label: zc.receivables, value: money(base.receivables), path: '/debts' }] : []),
  ]
  const status = year.state === 'estimate' ? zc.estimate(hawlDate) : year.state === 'dueNow' ? zc.dueNow : null

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
          {legacy != null ? (
            <PromptBanner title={zc.legacyTitle} description={zc.legacyBody(`${fmtNum(legacy)} ${unit}`)} confirmLabel={zc.gotIt} onConfirm={dismissLegacy} />
          ) : null}

          <div className="flex flex-col items-center px-5 pb-4 pt-2 text-center">
            <span aria-hidden className="flex size-[52px] items-center justify-center rounded-2xl" style={{ background: tint(GOLD, 18), color: GOLD }}>
              <Coins className="size-6" />
            </span>
            <p dir="ltr" className="mt-3 flex items-baseline justify-center gap-1.5">
              <span className="font-mono-numbers text-[2.5rem] font-semibold leading-none tracking-[-0.04em] text-[var(--color-brand-text-primary)]">
                {showsDue ? fmtNum(result.zakat) : '0'}
              </span>
              <span dir="auto" className="text-[1.0625rem] font-semibold text-[var(--color-brand-text-muted)]">{showsDue ? z.due(unit) : z.notDue}</span>
            </p>
            {status ? <p dir="auto" className="mt-2 text-[0.8125rem] font-semibold text-[var(--color-brand-text-primary)]">{status}</p> : null}
            <p dir="auto" className="mt-1 font-mono-numbers text-[0.8125rem] text-[var(--color-brand-text-secondary)]">
              {showsDue
                ? z.dueLine(fmtNum(result.zakatable), fmtNum(result.nisab))
                : year.state === 'notYet' ? zc.notYet : sf.underLine(fmtNum(result.gap), unit)}
            </p>
            {firstDay ? (
              <Button variant="outline" className="mt-3 min-h-11" onClick={() => save({ yearStartDate: firstDay })}>
                {zc.setYearStart(formatLocalized(parseDateOnly(firstDay), 'd MMM yyyy', locale))}
              </Button>
            ) : null}
          </div>

          <div>
            <p className="mb-2 ms-1 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">{sf.whatCounts}</p>
            <Card padding="none" divide className="overflow-hidden">
              {lines.map((l) => (
                <PickerRow key={l.key} label={l.label} value={l.value} onClick={go(l.path)} className={GROW} />
              ))}
              <PickerRow label={zc.tradeGoods} value={trade > 0 ? money(trade) : zc.tradeGoodsAdd} onClick={openTrade} className={GROW} />
              <PickerRow
                label={z.debts}
                value={<span className="font-mono-numbers">{base.debtsDueThisYear > 0 ? MINUS : ''}{fmtNum(base.debtsDueThisYear)}</span>}
                onClick={go('/debts')}
                className={GROW}
              />
              <PickerRow label={z.zakatable} value={<span className="font-mono-numbers font-semibold">{fmtNum(result.zakatable)}</span>} className={GROW} />
            </Card>
            <p className="mt-2 px-1 text-xs text-[var(--color-brand-text-secondary)]">{z.footnote}</p>
            <p className="mt-1 px-1 text-xs text-[var(--color-brand-text-muted)]">
              {zc.pastNote}{year.noHistoryCount > 0 ? ` ${zc.noHistory}` : ''}
            </p>
          </div>

          {base.goldHoldings.length > 0 || base.receivableDebts.length > 0 ? (
            <div>
              <p className="mb-2 ms-1 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">{zc.onlyForZakat}</p>
              <Card padding="none" divide className="overflow-hidden">
                {base.goldHoldings.map((h) => (
                  <SettingsSwitchRow
                    key={h.id}
                    label={zc.worn}
                    hint={zc.wornHint(h.name, fmtNum(h.grams))}
                    checked={h.worn}
                    onChange={(on) => save({ jewelleryHoldingIds: toggleIn(useFinanceStore.getState().profile.zakatConfig?.jewelleryHoldingIds, h.id, on) })}
                  />
                ))}
                {base.receivableDebts.map((d) => (
                  <SettingsSwitchRow
                    key={d.id}
                    label={zc.likelyRepaid}
                    hint={zc.likelyRepaidHint(d.name, `${fmtNum(d.value)} ${unit}`)}
                    checked={d.counted}
                    onChange={(on) => save({ doubtfulDebtIds: toggleIn(useFinanceStore.getState().profile.zakatConfig?.doubtfulDebtIds, d.id, !on) })}
                  />
                ))}
              </Card>
            </div>
          ) : null}
        </SheetBody>

        <SheetFooter safeArea>
          {showsDue ? (
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
      <PickerSheet
        open={tradeOpen}
        onClose={() => setTradeOpen(false)}
        title={zc.tradeGoods}
        footer={<Button size="cta-block" onClick={saveTrade}>{z.done}</Button>}
      >
        <AmountHero value={tradeDraft} onChange={setTradeDraft} currency={unit} line={zc.tradeGoodsLine} aria-label={zc.tradeGoods} />
      </PickerSheet>
    </ModalShell>
  )
}
