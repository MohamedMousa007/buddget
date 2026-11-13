'use client'

import { toLatinDigits } from '@/lib/utils/formatters'
import { useState } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { Plus } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { AmountField } from '@/components/ui/AmountField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { OptionChip } from '@/components/ui/OptionChip'
import { Switch } from '@/components/ui/switch'
import { LineIcon } from '@/components/features/budget/LineIcon'
import { TintedTile } from '@/components/features/budget/TintedTile'
import { useBudgetSheetsCopy } from '@/components/features/budget/useSheetsCopy'
import { BLOCK_EXPENSE_CATEGORIES, BLOCK_META } from '@/lib/budget/blocks'
import type { BudgetBlock, BudgetPlanCategory } from '@/lib/store/types'

export interface AddLineSuggestion {
  name: string
  amount: number
  icon: string
}

export interface AddLineSheetProps {
  open: boolean
  block: BudgetBlock
  suggestions: AddLineSuggestion[]
  onClose: () => void
  onAdd: (line: Omit<BudgetPlanCategory, 'id' | 'subcategories'>) => void
  /** When set, a second button saves the line and keeps the sheet open for the next one. */
  addAnotherLabel?: string
}

const BLOCK_ICONS: Record<BudgetBlock, string[]> = {
  bills: ['house', 'zap', 'droplets', 'wifi', 'smartphone', 'car', 'heart-pulse', 'graduation-cap', 'baby', 'receipt'],
  subscriptions: ['rotate-cw-clock', 'clapperboard', 'smartphone', 'wifi', 'dumbbell', 'graduation-cap'],
  debts: ['landmark', 'credit-card', 'banknote', 'receipt'],
  everyday: ['shopping-basket', 'utensils-crossed', 'fuel', 'bus', 'shopping-bag', 'heart-pulse', 'gift', 'clapperboard', 'package', 'plane'],
  safety: ['shield-check', 'landmark', 'coins'],
  goals: ['target', 'plane', 'house', 'car', 'gift', 'graduation-cap', 'baby'],
  grow: ['sprout', 'trending-up', 'coins', 'landmark', 'briefcase'],
}

const DEFAULT_ESSENTIAL: Partial<Record<BudgetBlock, boolean>> = { bills: true, debts: true, safety: true }

export function AddLineSheet(props: AddLineSheetProps) {
  const { open, block, onClose } = props
  return (
    <ModalShell open={open} onBackdropClick={onClose} padContent>
      {open ? <AddLineForm key={block} {...props} /> : null}
    </ModalShell>
  )
}

export function AddLineForm({ block, suggestions, onClose, onAdd, addAnotherLabel }: AddLineSheetProps) {
  const baseCurrency = useFinanceStore((s) => s.settings.baseCurrency)
  const c = useBudgetSheetsCopy()
  const icons = BLOCK_ICONS[block]
  const meta = BLOCK_META[block]
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [icon, setIcon] = useState(icons[0])
  const [dueDay, setDueDay] = useState('')
  const [essential, setEssential] = useState(!!DEFAULT_ESSENTIAL[block])

  const value = Number(amount)
  const canAdd = name.trim().length > 0 && Number.isFinite(value) && value > 0

  const pick = (s: AddLineSuggestion) => {
    setName(s.name)
    setAmount(String(s.amount))
    setIcon(s.icon)
  }

  const add = (keepOpen = false) => {
    if (!canAdd) return
    const day = Number(dueDay)
    onAdd({
      name: name.trim(),
      icon,
      amount: value,
      block,
      linkType: 'none',
      isSavings: block === 'safety' || block === 'goals',
      essential,
      dueDay: block === 'bills' && day >= 1 && day <= 31 ? Math.floor(day) : null,
      expenseCategories: BLOCK_EXPENSE_CATEGORIES[block],
    })
    if (keepOpen) {
      setName('')
      setAmount('')
      setDueDay('')
    } else onClose()
  }

  return (
    <div className="flex flex-col gap-4 pt-1">
      <V3SheetHeader title={c.add.title(c.blocks[block])} onClose={onClose} />

      {suggestions.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-[var(--color-brand-text-secondary)]">{c.add.suggestions}</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {suggestions.map((s) => (
              <OptionChip key={s.name} size="md" selected={name === s.name} onClick={() => pick(s)}>
                <LineIcon name={s.icon} />
                {s.name}
              </OptionChip>
            ))}
          </div>
        </div>
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-[var(--color-brand-text-secondary)]">{c.add.name}</span>
        <Input size="brand" value={name} onChange={(e) => setName(e.target.value)} placeholder={c.add.namePlaceholder} />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-[var(--color-brand-text-secondary)]">{c.add.amount}</span>
        <AmountField value={amount} onChange={setAmount} decimalsFor={baseCurrency} label={c.add.amount} />
      </div>

      {block === 'bills' ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-[var(--color-brand-text-secondary)]">{c.add.dueDay}</span>
          <Input
            size="brand"
            inputMode="numeric"
            value={dueDay}
            onChange={(e) => setDueDay(toLatinDigits(e.target.value).replace(/\D/g, '').slice(0, 2))}
            placeholder="1-31"
          />
        </label>
      ) : null}

      {block === 'bills' || block === 'everyday' ? (
        <div className="flex min-h-[52px] items-center gap-3">
          <span className="flex-1 text-[0.90625rem] font-semibold text-[var(--color-brand-text-primary)]">{c.add.essential}</span>
          <Switch size="touch" checked={essential} onCheckedChange={setEssential} aria-label={c.add.essential} />
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-[var(--color-brand-text-secondary)]">{c.add.icon}</p>
        <div className="flex flex-wrap gap-2">
          {icons.map((key) => (
            <OptionChip
              key={key}
              size="segment"
              selected={icon === key}
              aria-label={key}
              onClick={() => setIcon(key)}
              className="size-11 flex-none px-0"
            >
              <TintedTile cat={meta.cat} size="sm" className="size-8 rounded-lg">
                <LineIcon name={key} />
              </TintedTile>
            </OptionChip>
          ))}
        </div>
      </div>

      <Button type="button" size="cta-block" disabled={!canAdd} onClick={() => add()}>
        <Plus aria-hidden />
        {c.add.add}
      </Button>
      {addAnotherLabel ? (
        <Button type="button" size="touch" variant="outline" className="w-full" disabled={!canAdd} onClick={() => add(true)}>
          {addAnotherLabel}
        </Button>
      ) : null}
    </div>
  )
}
