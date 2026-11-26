'use client'

import { inlineMoney } from '@/components/features/budget/chromeFormat'
import { useCategoryLabel } from '@/hooks/useCategoryLabel'
import { useState } from 'react'
import { Calendar, RefreshCw, Trash2 } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { AmountHero } from '@/components/ui/AmountHero'
import { Button } from '@/components/ui/button'
import { DayOfMonthSheet } from '@/components/ui/DayOfMonthSheet'
import { OptionSheet } from '@/components/ui/OptionSheet'
import { Pill } from '@/components/ui/PillButton'
import { PickerRow } from '@/components/ui/PickerRow'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { SettingsSwitchRow } from '@/components/features/settings/SettingsSwitchRow'
import { SheetGroup } from '@/components/features/debts/lt/SheetParts'
import { LineIcon } from '@/components/features/budget/LineIcon'
import { TintedTile } from '@/components/features/budget/TintedTile'
import { useBudgetSheetsCopy } from '@/components/features/budget/useSheetsCopy'
import { EXPENSE_ENTRY_CATEGORIES } from '@/lib/constants/finance'
import { BLOCK_META } from '@/lib/budget/blocks'
import { lineEditDirty, lineEditPatch } from '@/lib/budget/lineEdit'
import type { LineView, PlanView } from '@/lib/budget/planView.types'
import type { BudgetPlanCategory } from '@/lib/store/types'
import { formatFlex } from '@/lib/utils/formatters'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'
import { useLightTouchCopy } from '@/lib/i18n/lightTouchCopy'

export interface LineSheetProps {
  open: boolean
  line: LineView | null
  view: PlanView
  onClose: () => void
  onSave: (patch: Partial<BudgetPlanCategory>) => void
  onDelete: (lineId: string) => void
  onSyncLive: (lineId: string) => void
}

/** Edit one plan line. Remounts per line so the form state is seeded from it. */
export function LineSheet(props: LineSheetProps) {
  const { open, line, onClose } = props
  return (
    <ModalShell open={open && !!line} onBackdropClick={onClose} scrollChild>
      {line ? <LineForm key={line.line.id} {...props} line={line} /> : null}
    </ModalShell>
  )
}

/**
 * The budget line (Light touch `s_line`): icon, name and block in the header with a bin, the monthly amount and its share
 * of income, Buddgy's sizing note, then Essential · Lock · Due day (a 1–31 grid) · Spending from (categories, several).
 */
function LineForm({
  line: lv,
  view,
  onClose,
  onSave,
  onDelete,
  onSyncLive,
}: LineSheetProps & { line: LineView }) {
  const c = useBudgetSheetsCopy()
  const lt = useDebtsSubsLtCopy().line
  const ordinal = useLightTouchCopy().dayOfMonth.ordinal
  const catLabel = useCategoryLabel()
  const confirm = useConfirm()
  const { line } = lv
  const linked = !!line.linkType && line.linkType !== 'none'
  const shown = Math.round(lv.amount * 100) / 100
  const [amount, setAmount] = useState(String(shown))
  const [essential, setEssential] = useState(!!line.essential)
  const [locked, setLocked] = useState(!!line.locked)
  const initialDue = lv.dueDay ?? line.dueDay ?? null
  const [dueDay, setDueDay] = useState<number | null>(initialDue)
  const [categories, setCategories] = useState<string[]>(line.expenseCategories ?? [])
  const [sheet, setSheet] = useState<'due' | 'cats' | null>(null)

  const meta = BLOCK_META[lv.block]
  const parsed = Number(amount)
  const value = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
  const pct = view.income > 0 ? Math.round((value / view.income) * 100) : 0
  const liveDiffers = linked && lv.liveAmount !== null && Math.round(lv.liveAmount) !== Math.round(lv.amount)
  const catsChanged = categories.join('|') !== (line.expenseCategories ?? []).join('|')
  const dirty = lineEditDirty(
    { amount: shown, essential: !!line.essential, locked: !!line.locked, dueDay: initialDue, categories: line.expenseCategories ?? [] },
    { amount: value, essential, locked, dueDay, categories },
    linked,
  )

  const save = () => {
    const patch = lineEditPatch({ shown, value, base: view.base, linked, essential, locked, isBill: lv.block === 'bills', dueDay })
    onSave(catsChanged ? { ...patch, expenseCategories: categories } : patch)
    onClose()
  }

  const remove = async () => {
    const ok = await confirm({
      title: c.line.deleteTitle(line.name),
      body: c.line.deleteBody,
      confirmLabel: c.line.deleteConfirm,
      cancelLabel: c.common.cancel,
      destructive: true,
    })
    if (!ok) return
    onDelete(line.id)
    onClose()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <V3SheetHeader
        onClose={onClose}
        leading={<TintedTile cat={meta.cat}><LineIcon name={line.icon} /></TintedTile>}
        actions={<V3SheetHeader.Action tone="danger" icon={<Trash2 />} label={c.line.deleteLine} onClick={remove} />}
      >
        <V3SheetHeader.Title size="compact">{catLabel(line.name)}</V3SheetHeader.Title>
        <V3SheetHeader.Subtitle>{lt.subtitle(c.blocks[lv.block])}</V3SheetHeader.Subtitle>
      </V3SheetHeader>

      <div className="native-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4">
        {linked ? (
          <div className="flex flex-col items-center pt-2 text-center">
            <p className="font-mono-numbers text-[2.5rem] font-semibold leading-none tracking-[-0.04em] text-[var(--color-brand-text-primary)]">
              {formatFlex(shown)} <span className="text-base font-medium text-[var(--color-brand-text-muted)]">{view.base} {lt.perMonth}</span>
            </p>
            <p className="mt-2 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{lt.ofIncome(pct)}</p>
            <p className="mt-1 text-xs text-[var(--color-brand-text-muted)]">{c.line.linkedNote}</p>
          </div>
        ) : (
          <AmountHero
            value={amount}
            onChange={setAmount}
            currency={view.base}
            unit={`${view.base} ${lt.perMonth}`}
            line={lt.ofIncome(pct)}
            aria-label={c.line.amountLabel}
            className="px-0 pb-0"
          />
        )}
        {liveDiffers && lv.liveAmount !== null ? (
          <Button type="button" variant="outline" size="touch" onClick={() => onSyncLive(line.id)}>
            <RefreshCw aria-hidden />
            <span className="font-mono-numbers">{c.line.updateToLive(inlineMoney(lv.liveAmount, view.base))}</span>
          </Button>
        ) : null}

        {line.rationale ? (
          <div className="flex items-start gap-3 rounded-2xl bg-[var(--color-brand-primary-soft)] p-3">
            <BuddgyIcon mood="happy" size={24} className="shrink-0 text-[var(--color-brand-primary-ink)]" />
            <p className="min-w-0 flex-1 text-[0.8125rem] leading-snug text-[var(--color-brand-text-primary)]">
              {line.rationale}
              {line.confidence ? <b className="font-semibold"> {line.confidence === 'high' ? c.line.confidenceHigh : c.line.confidenceEstimated}.</b> : null}
            </p>
          </div>
        ) : null}

        <SheetGroup note={lt.spendingNote}>
          <SettingsSwitchRow label={c.line.essential} hint={c.line.essentialSub} checked={essential} onChange={setEssential} />
          <SettingsSwitchRow label={c.line.lock} hint={c.line.lockSub} checked={locked} onChange={setLocked} />
          {lv.block === 'bills' ? (
            <PickerRow
              label={lt.dueDay}
              chevron={false}
              onClick={() => setSheet('due')}
              value={<Pill icon={<Calendar />}>{dueDay === null ? lt.noDueDay : ordinal(dueDay)}</Pill>}
            />
          ) : null}
          <PickerRow
            label={lt.spendingFrom}
            onClick={() => setSheet('cats')}
            value={<span dir="auto" className="truncate">{categories.length ? categories.map((x) => catLabel(x)).join(', ') : lt.none}</span>}
          />
        </SheetGroup>
      </div>

      <div className="sheet-cta shrink-0 border-t border-[var(--color-brand-border)] px-5 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3">
        <Button type="button" size="cta-block" onClick={save} disabled={!dirty}>{c.common.save}</Button>
      </div>

      <DayOfMonthSheet open={sheet === 'due'} value={dueDay} onChange={setDueDay} onClose={() => setSheet(null)} title={lt.dueDayTitle} zIndexClassName="z-[110]" />
      <OptionSheet
        multiple
        open={sheet === 'cats'}
        onClose={() => setSheet(null)}
        title={lt.spendingFromTitle}
        value={categories}
        onChange={setCategories}
        options={[...new Set([...EXPENSE_ENTRY_CATEGORIES, ...categories])].map((x) => ({ value: x, title: catLabel(x) }))}
        zIndexClassName="z-[110]"
      />
    </div>
  )
}
