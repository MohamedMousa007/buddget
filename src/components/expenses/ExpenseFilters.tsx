'use client'

import { type ReactNode } from 'react'
import { format } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { Apple, CalendarClock, Check, CreditCard, DollarSign, LayoutGrid, Smartphone, Wallet, type LucideIcon } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useScrollLock } from '@/lib/ui/scrollLock'
import { CategoryIcon } from '@/components/dashboard/CategoryIcon'
import { IncomeTypeIcon, incomeTypeColors } from '@/components/features/income/IncomeTypeIcon'
import { AmountField } from '@/components/ui/AmountField'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { Button } from '@/components/ui/button'
import { OptionChip } from '@/components/ui/OptionChip'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { useExpenseFilterStore, AMOUNT_MAX, ONE_TIME_INCOME, type FlowSegment } from '@/lib/store/useExpenseFilterStore'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { RANGE_PRESETS, resolveRange, type RangePreset } from '@/lib/expenses/dateRange'
import { categoryChipColors } from '@/lib/expenses/categoryChip'
import { paymentTypeIcon } from '@/lib/constants/categoryGrid'
import { methodLabel } from '@/components/features/flow/useFlowLedger'
import { formatWhole } from '@/lib/utils/formatters'
import { useWeekStart } from '@/hooks/useWeekStart'
import { useDismissable } from '@/hooks/useDismissable'
import { useTypedAmount } from '@/hooks/useTypedAmount'
import { useT } from '@/lib/i18n'
import type { IncomeSourceType, PaymentMethod } from '@/lib/store/types'

export interface FilterCategoryOption {
  id: string
  label: string
}

/**
 * Bottom-sheet shell for the filters: scrolls up to 90% of the screen with the grabber on a
 * sticky card-coloured strip (rows pass under it) and an optional footer pinned below.
 */
export function FilterSheet({ open, onClose, children, footer }: { open: boolean; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const t = useT()
  // This sheet deliberately does NOT use ModalShell: it contains range sliders,
  // and ModalShell's drag-to-dismiss would capture the pointer drag on a thumb.
  // It still has to honour Android back and Escape.
  useDismissable(open, onClose)
  useScrollLock(open)
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/60"
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t.a11y.filters}
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            exit={{ y: '110%' }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-0 bottom-0 z-[60] flex max-h-[90dvh] flex-col overflow-hidden rounded-t-3xl bg-[var(--color-brand-card)] shadow-[var(--shadow-lg)] md:inset-x-auto md:start-1/2 md:w-[min(36rem,calc(100vw-2rem))] md:-translate-x-1/2 rtl:md:translate-x-1/2 lg:start-[calc(50%+var(--sidebar-w,11rem)/2)] lg:w-[min(36rem,calc(100vw-var(--sidebar-w,11rem)-2rem))]"
          >
            <div
              className="hide-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pt-2"
              style={{ paddingBottom: footer ? 16 : 'calc(20px + env(safe-area-inset-bottom, 0px))' }}
            >
              <div className="sticky -top-2 z-[3] -mx-4 -mt-2 mb-1 bg-[var(--color-brand-card)] py-2">
                <div className="mx-auto h-1 w-9 rounded-full bg-[var(--color-brand-border-strong)]" />
              </div>
              {children}
            </div>
            {footer ? (
              <div
                className="shrink-0 border-t border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 pt-3"
                style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}
              >
                {footer}
              </div>
            ) : null}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}

/** Section label: 11/700 caps with a 14px glyph, and an optional note on the end side. */
export function SectionHead({ icon: Icon, label, end }: { icon: LucideIcon; label: string; end?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">
        <Icon className="size-3.5" strokeWidth={2} aria-hidden />
        {label}
      </span>
      {end}
    </div>
  )
}

export const Divider = () => <div className="h-px bg-[var(--color-brand-border)]" />

const PRESET_KEYS: Record<RangePreset, 'today' | 'yesterday' | 'week' | 'month' | 'custom'> = {
  today: 'today', yesterday: 'yesterday', week: 'week', month: 'month', custom: 'custom',
}

/**
 * Date-range filter shared by every filter sheet: preset chips, and From / To only once
 * Custom is picked (editing either clamps the other so the range is never inverted).
 * `anyLabel` adds a leading "no limit" chip for lists that default to all time.
 */
export function DateRangeField({
  preset,
  from,
  to,
  onPreset,
  onRange,
  anyLabel,
}: {
  preset: RangePreset | 'any'
  from: string
  to: string
  onPreset: (p: RangePreset | 'any') => void
  onRange: (from: string, to: string) => void
  anyLabel?: string
}) {
  const t = useT()
  const label: Record<RangePreset, string> = {
    today: t.common.today,
    yesterday: t.common.yesterday,
    week: t.expenses.periodThisWeek,
    month: t.expenses.periodThisMonth,
    custom: t.expenses.periodCustom,
  }
  const chips: { key: RangePreset | 'any'; text: string }[] = [
    ...(anyLabel ? [{ key: 'any' as const, text: anyLabel }] : []),
    ...RANGE_PRESETS.map((p) => ({ key: PRESET_KEYS[p], text: label[p] })),
  ]
  return (
    <>
      <div role="radiogroup" aria-label={t.filters.dateRange} className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <OptionChip
            key={c.key}
            as="trigger"
            role="radio"
            aria-checked={preset === c.key}
            surface="elevated"
            size="sm"
            selected={preset === c.key}
            onClick={() => onPreset(c.key)}
          >
            {c.text}
          </OptionChip>
        ))}
      </div>
      {preset === 'custom' ? (
        <div className="grid grid-cols-2 gap-2.5">
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--color-brand-text-muted)]">{t.expenses.periodFrom}</span>
            {/* Clamp `to` forward: UnifiedDatePicker has no min/max, so nothing else stops an inverted range. */}
            <DatePickerField value={from} onChange={(v) => onRange(v, v > to ? v : to)} className="h-12 rounded-xl" />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--color-brand-text-muted)]">{t.expenses.periodTo}</span>
            <DatePickerField value={to} onChange={(v) => onRange(v < from ? v : from, v)} className="h-12 rounded-xl" />
          </label>
        </div>
      ) : null}
    </>
  )
}

/** Flow's period control: the shared date-range field bound to the expense filter store. */
function PeriodControl() {
  const monthFilter = useSettingsStore((s) => s.monthFilter)
  const monthStartDay = useFinanceStore((s) => s.settings.monthStartDay)
  const { range, setRangePreset, setCustomRange } = useExpenseFilterStore(
    useShallow((s) => ({ range: s.range, setRangePreset: s.setRangePreset, setCustomRange: s.setCustomRange })),
  )
  const weekStart = useWeekStart()
  const resolved = resolveRange(range, monthFilter, monthStartDay, new Date(), weekStart)
  const from = range.from ?? format(resolved.start, 'yyyy-MM-dd')
  const to = range.to ?? format(resolved.end, 'yyyy-MM-dd')
  return (
    <DateRangeField
      preset={range.preset}
      from={from}
      to={to}
      onPreset={(p) => (p === 'custom' ? setCustomRange(from, to) : p === 'any' ? undefined : setRangePreset(p))}
      onRange={setCustomRange}
    />
  )
}

/** One bound box: shows what is being typed ("2.") while it still means the stored bound. */
function AmountBound({ label, value, onChange, currency }: { label: string; value: number; onChange: (v: number) => void; currency: string }) {
  const [text, setText] = useTypedAmount(value, true)
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-[0.625rem] font-bold uppercase tracking-[0.05em] text-[var(--color-brand-text-muted)]">{label}</span>
      <span className="flex h-12 items-center gap-1.5 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 focus-within:border-[var(--color-brand-focus)] focus-within:ring-2 focus-within:ring-[var(--color-brand-focus)]">
        <AmountField
          bare
          className="min-w-0 flex-1 border-none bg-transparent text-start font-mono-numbers text-base font-bold text-[var(--color-brand-text-primary)] outline-none"
          value={text}
          decimalsFor={currency}
          aria-label={label}
          onChange={(v) => {
            setText(v)
            onChange(+v || 0)
          }}
        />
        <span className="text-xs text-[var(--color-brand-text-muted)]">{currency}</span>
      </span>
    </label>
  )
}

/** Two-thumb slider (step 50) over Minimum / Maximum boxes; both write the same store. */
function AmountRangeControl({ currency }: { currency: string }) {
  const t = useT()
  const { amtMin, amtMax, setAmtMin, setAmtMax } = useExpenseFilterStore(
    useShallow((s) => ({ amtMin: s.amtMin, amtMax: s.amtMax, setAmtMin: s.setAmtMin, setAmtMax: s.setAmtMax })),
  )
  const box = (label: string, value: number, onChange: (v: number) => void) => (
    <AmountBound label={label} value={value} onChange={onChange} currency={currency} />
  )
  return (
    <>
      <div className="relative mx-3 h-7">
        <div className="absolute -inset-x-3 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--color-brand-elevated)]" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--color-brand-primary)]"
          style={{ insetInlineStart: `${(amtMin / AMOUNT_MAX) * 100}%`, insetInlineEnd: `${100 - (amtMax / AMOUNT_MAX) * 100}%` }}
        />
        <input className="rng2" type="range" min={0} max={AMOUNT_MAX} step={50} value={amtMin} onChange={(e) => setAmtMin(+e.target.value)} aria-label={t.expenses.minimum} />
        <input className="rng2" type="range" min={0} max={AMOUNT_MAX} step={50} value={amtMax} onChange={(e) => setAmtMax(+e.target.value)} aria-label={t.expenses.maximum} />
      </div>
      <div className="flex gap-2.5">
        {box(t.expenses.minimum, amtMin, setAmtMin)}
        {box(t.expenses.maximum, amtMax, setAmtMax)}
      </div>
    </>
  )
}

/** The payment-method type glyph: card, Apple / Google Pay, bank, wallet, cash. */
function methodIcon(pm: PaymentMethod): LucideIcon {
  const name = pm.name.toLowerCase()
  if (name.includes('apple pay')) return Apple
  if (name.includes('google pay')) return Smartphone
  if (pm.type === 'wallet') return Wallet
  if (pm.type === 'credit_card' || pm.type === 'debit_card') return CreditCard
  return paymentTypeIcon(pm.type)
}

/**
 * A 2-up checkbox card: 32px icon chip with a 16px check badge on its top-end corner when
 * selected (the card's own fill + border carry the rest), then the label.
 */
function CheckCard({ selected, onClick, chip, chipStyle, label }: { selected: boolean; onClick: () => void; chip: ReactNode; chipStyle: React.CSSProperties; label: string }) {
  return (
    <div className="min-w-0">
      <SelectableCard as="checkbox" surface="elevated" selected={selected} onClick={onClick} className="w-full min-w-0 gap-2.5">
        <span className="relative flex size-8 shrink-0 items-center justify-center rounded-[10px]" style={chipStyle}>
          {chip}
          <span
            aria-hidden
            className="absolute -end-[5px] -top-[5px] flex size-4 items-center justify-center rounded-full bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)] shadow-[0_0_0_2px_var(--color-brand-elevated)] transition-opacity"
            style={{ opacity: selected ? 1 : 0 }}
          >
            <Check className="size-2.5" strokeWidth={4} />
          </span>
        </span>
        <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold text-[var(--color-brand-text-primary)]">{label}</span>
      </SelectableCard>
    </div>
  )
}

/**
 * Flow's all-filters sheet. Date range and amount first (the period sheet folded in), then
 * payment methods, then categories — or, on In, income types — last, because that is the
 * long list people scroll for. Direction is not a filter here: it is the page's segment.
 * One store (`useExpenseFilterStore`) backs this sheet, the chip row and the budget chips.
 */
export function ExpenseFilters({
  open,
  onClose,
  segment,
  categories,
  incomeTypes,
  resultCount,
  currency,
}: {
  open: boolean
  onClose: () => void
  segment: FlowSegment
  categories: FilterCategoryOption[]
  incomeTypes: FilterCategoryOption[]
  resultCount: number
  currency: string
}) {
  const t = useT()
  const paymentMethods = useFinanceStore((s) => s.paymentMethods)
  const { cats, methodsSel, incomeSel, amtMin, amtMax, toggleCat, toggleMethod, toggleIncomeType, reset } = useExpenseFilterStore(
    useShallow((s) => ({
      cats: s.cats,
      methodsSel: s.methods,
      incomeSel: s.incomeTypes,
      amtMin: s.amtMin,
      amtMax: s.amtMax,
      toggleCat: s.toggleCat,
      toggleMethod: s.toggleMethod,
      toggleIncomeType: s.toggleIncomeType,
      reset: s.reset,
    })),
  )
  const selectMulti = <span className="text-xs text-[var(--color-brand-text-muted)]">{t.expenses.selectMulti}</span>

  return (
    <FilterSheet
      open={open}
      onClose={onClose}
      footer={
        <Button size="cta-block" onClick={onClose}>
          {t.expenses.showResults.replace('{count}', String(resultCount))}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-[var(--color-brand-text-primary)]">{t.expenses.filtersTitle}</h3>
          <Button variant="link" size="touch" onClick={reset}>
            {t.expenses.resetAll}
          </Button>
        </div>

        <div className="flex flex-col gap-2.5">
          <SectionHead icon={CalendarClock} label={t.filters.dateRange} />
          <PeriodControl />
        </div>
        <Divider />

        <div className="flex flex-col gap-2.5">
          <SectionHead
            icon={DollarSign}
            label={t.expenses.amountRange}
            end={
              <span className="font-mono-numbers text-[0.8125rem] font-bold text-[var(--color-brand-primary-ink)]">
                {formatWhole(amtMin)} – {formatWhole(amtMax)} {currency}
              </span>
            }
          />
          <p className="-mt-1 text-[0.78125rem] text-[var(--color-brand-text-secondary)]">{t.filters.amountHelp}</p>
          <AmountRangeControl currency={currency} />
        </div>
        <Divider />

        <div className="flex flex-col gap-2.5">
          <SectionHead icon={CreditCard} label={t.filters.paymentMethod} end={selectMulti} />
          <div role="group" aria-label={t.filters.paymentMethod} className="grid grid-cols-2 gap-2">
            {paymentMethods.map((pm) => {
              const Icon = methodIcon(pm)
              return (
                <CheckCard
                  key={pm.id}
                  selected={methodsSel.includes(pm.id)}
                  onClick={() => toggleMethod(pm.id)}
                  chip={<Icon className="size-4" strokeWidth={1.75} />}
                  chipStyle={{ background: 'var(--color-brand-card)', color: 'var(--color-brand-text-secondary)' }}
                  label={methodLabel(pm) ?? pm.name}
                />
              )
            })}
          </div>
        </div>
        <Divider />

        {segment === 'in' ? (
          <div className="flex flex-col gap-2.5">
            <SectionHead icon={LayoutGrid} label={t.filters.incomeType} end={selectMulti} />
            <div role="group" aria-label={t.filters.incomeType} className="grid grid-cols-2 gap-2">
              {incomeTypes.map((it) => {
                const type = (it.id === ONE_TIME_INCOME ? 'other' : it.id) as IncomeSourceType
                const c = incomeTypeColors(type)
                return (
                  <CheckCard
                    key={it.id}
                    selected={incomeSel.includes(it.id)}
                    onClick={() => toggleIncomeType(it.id)}
                    chip={<IncomeTypeIcon type={type} className="size-4" />}
                    chipStyle={{ background: c.bg, color: c.fg }}
                    label={it.label}
                  />
                )
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <SectionHead icon={LayoutGrid} label={t.filters.category} end={selectMulti} />
            <div role="group" aria-label={t.filters.category} className="grid grid-cols-2 gap-2">
              {categories.map((c) => {
                const colors = categoryChipColors(c.id)
                return (
                  <CheckCard
                    key={c.id}
                    selected={cats.includes(c.id)}
                    onClick={() => toggleCat(c.id)}
                    chip={<CategoryIcon category={c.id} className="size-4" />}
                    chipStyle={{ background: colors.bg, color: colors.fg }}
                    label={c.label}
                  />
                )
              })}
            </div>
          </div>
        )}
      </div>
    </FilterSheet>
  )
}
