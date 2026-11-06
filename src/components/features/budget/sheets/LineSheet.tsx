'use client'

import { useCategoryLabel } from '@/hooks/useCategoryLabel'
import { useState } from 'react'
import { Check, Minus, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { AmountField } from '@/components/ui/AmountField'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { Switch } from '@/components/ui/switch'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { LineIcon } from '@/components/features/budget/LineIcon'
import { TintedTile } from '@/components/features/budget/TintedTile'
import { useBudgetSheetsCopy } from '@/components/features/budget/useSheetsCopy'
import { BLOCK_META } from '@/lib/budget/blocks'
import { lineEditPatch } from '@/lib/budget/lineEdit'
import type { LineView, PlanView } from '@/lib/budget/planView.types'
import type { BudgetPlanCategory } from '@/lib/store/types'
import { formatCurrency } from '@/lib/utils/formatters'

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
    <ModalShell open={open && !!line} onBackdropClick={onClose} padContent>
      {line ? <LineForm key={line.line.id} {...props} line={line} /> : null}
    </ModalShell>
  )
}

function LineForm({
  line: lv,
  view,
  onClose,
  onSave,
  onDelete,
  onSyncLive,
}: LineSheetProps & { line: LineView }) {
  const c = useBudgetSheetsCopy()
  const catLabel = useCategoryLabel()
  const confirm = useConfirm()
  const { line } = lv
  const linked = !!line.linkType && line.linkType !== 'none'
  const shown = Math.round(lv.amount * 100) / 100
  const [amount, setAmount] = useState(String(shown))
  const [essential, setEssential] = useState(!!line.essential)
  const [locked, setLocked] = useState(!!line.locked)
  const [dueDay, setDueDay] = useState<number | null>(lv.dueDay ?? line.dueDay ?? null)

  const meta = BLOCK_META[lv.block]
  const parsed = Number(amount)
  const value = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
  const pct = view.income > 0 ? Math.round((value / view.income) * 100) : 0
  const liveDiffers = linked && lv.liveAmount !== null && Math.round(lv.liveAmount) !== Math.round(lv.amount)
  const categories = line.expenseCategories ?? []

  const save = () => {
    onSave(lineEditPatch({ shown, value, base: view.base, linked, essential, locked, isBill: lv.block === 'bills', dueDay }))
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
    <div className="flex flex-col gap-4 pt-1">
      <div className="flex items-center gap-3">
        <TintedTile cat={meta.cat}>
          <LineIcon name={line.icon} />
        </TintedTile>
        <div className="min-w-0 flex-1">
          <V3SheetHeader title={catLabel(line.name)} onClose={onClose} />
          <p className="-mt-0.5 text-xs text-[var(--color-brand-text-muted)]">{c.blocks[lv.block]}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-[var(--color-brand-text-secondary)]">{c.line.amountLabel}</span>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <AmountField
              value={amount}
              onChange={setAmount}
              currency={view.base}
              label={c.line.amountLabel}
              disabled={linked}
            />
          </div>
          <span className="font-mono-numbers text-sm font-semibold text-[var(--color-brand-text-secondary)]">
            {c.line.ofIncome(`${pct}%`)}
          </span>
        </div>
        {linked ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-[var(--color-brand-text-muted)]">{c.line.linkedNote}</p>
            {liveDiffers && lv.liveAmount !== null ? (
              <Button
                type="button"
                variant="outline"
                size="touch"
                onClick={() => onSyncLive(line.id)}
              >
                <RefreshCw aria-hidden />
                <span className="font-mono-numbers">{c.line.updateToLive(formatCurrency(lv.liveAmount, view.base, false))}</span>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {line.rationale ? (
        <div className="flex items-start gap-3 rounded-2xl bg-[var(--color-brand-primary-soft)] p-3">
          <BuddgyIcon mood="happy" size={28} className="shrink-0 text-[var(--color-brand-primary-ink)]" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex items-center gap-2">
              <span className="text-[0.6875rem] font-bold uppercase tracking-wide text-[var(--color-brand-primary-ink)]">
                {c.line.whyTitle}
              </span>
              {line.confidence ? (
                <span className="inline-flex h-5 items-center rounded-full bg-[var(--color-brand-card)] px-2 text-[0.6875rem] font-semibold text-[var(--color-brand-text-secondary)]">
                  {line.confidence === 'high' ? c.line.confidenceHigh : c.line.confidenceEstimated}
                </span>
              ) : null}
            </span>
            <p className="text-[0.8125rem] leading-snug text-[var(--color-brand-text-primary)]">{line.rationale}</p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col">
        <ToggleRow title={c.line.essential} sub={c.line.essentialSub} checked={essential} onChange={setEssential} />
        <ToggleRow title={c.line.lock} sub={c.line.lockSub} checked={locked} onChange={setLocked} />
        {lv.block === 'bills' ? (
          <div className="flex min-h-[52px] items-center gap-3">
            <span className="flex-1 text-[0.90625rem] font-semibold text-[var(--color-brand-text-primary)]">{c.line.dueDay}</span>
            <IconButton
              variant="outlined"
              aria-label={`${c.line.dueDay} -`}
              disabled={dueDay === null || dueDay <= 1}
              onClick={() => setDueDay((d) => Math.max(1, (d ?? 2) - 1))}
              className="size-9 rounded-full"
            >
              <Minus className="size-4" aria-hidden />
            </IconButton>
            <span className="font-mono-numbers min-w-16 text-center text-sm font-semibold">
              {dueDay === null ? '-' : c.line.dueDayValue(dueDay)}
            </span>
            <IconButton
              variant="outlined"
              aria-label={`${c.line.dueDay} +`}
              disabled={dueDay !== null && dueDay >= 31}
              onClick={() => setDueDay((d) => Math.min(31, (d ?? 0) + 1))}
              className="size-9 rounded-full"
            >
              <Plus className="size-4" aria-hidden />
            </IconButton>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-[var(--color-brand-text-secondary)]">{c.line.countsCategories}</p>
        {categories.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <span
                key={cat}
                className="inline-flex h-9 items-center rounded-full border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 text-[0.8125rem] font-semibold text-[var(--color-brand-text-secondary)]"
              >
                {cat}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--color-brand-text-muted)]">{c.line.noCategories}</p>
        )}
      </div>

      <div className="flex flex-col gap-2 pt-1">
        <Button type="button" size="cta-block" onClick={save}>
          <Check aria-hidden />
          {c.common.save}
        </Button>
        <Button type="button" variant="destructive" size="touch" className="w-full" onClick={remove}>
          <Trash2 aria-hidden />
          {c.line.deleteLine}
        </Button>
      </div>
    </div>
  )
}

function ToggleRow({
  title,
  sub,
  checked,
  onChange,
}: {
  title: string
  sub: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div className="flex min-h-[52px] items-center gap-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[0.90625rem] font-semibold text-[var(--color-brand-text-primary)]">{title}</span>
        <span className="text-xs text-[var(--color-brand-text-muted)]">{sub}</span>
      </div>
      <Switch size="touch" checked={checked} onCheckedChange={onChange} aria-label={title} />
    </div>
  )
}
