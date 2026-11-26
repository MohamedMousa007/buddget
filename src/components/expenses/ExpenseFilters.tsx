'use client'

import { useRef, useState, type ReactNode } from 'react'
import { format } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { Apple, Calendar, Check, ChevronRight, CreditCard, Smartphone, Wallet, X, type LucideIcon } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useScrollLock } from '@/lib/ui/scrollLock'
import { CategoryIcon } from '@/components/dashboard/CategoryIcon'
import { IncomeTypeIcon, incomeTypeColors } from '@/components/features/income/IncomeTypeIcon'
import { AmountField } from '@/components/ui/AmountField'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { OptionSheet } from '@/components/ui/OptionSheet'
import { cardKindLabel } from '@/components/features/accounts/accountDisplay'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { categoryBudget } from '@/lib/flow/categoryBudget'
import { useFlowLtCopy } from '@/lib/i18n/flowLtCopy'
import { cn } from '@/lib/utils'
import { OptionChip } from '@/components/ui/OptionChip'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { useExpenseFilterStore, AMOUNT_MAX, ONE_TIME_INCOME, type FlowSegment } from '@/lib/store/useExpenseFilterStore'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { RANGE_PRESETS, resolveRange, type RangePreset } from '@/lib/expenses/dateRange'
import { categoryChipColors } from '@/lib/expenses/categoryChip'
import { filterablePaymentMethods } from '@/lib/accounts/kinds'
import { paymentTypeIcon } from '@/lib/constants/categoryGrid'
import { methodLabel } from '@/components/features/flow/useFlowLedger'
import { formatWhole } from '@/lib/utils/formatters'
import { useWeekStart } from '@/hooks/useWeekStart'
import { useDismissable } from '@/hooks/useDismissable'
import { useDialogFocus } from '@/hooks/useDialogFocus'
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
  const panelRef = useRef<HTMLDivElement>(null)
  useDialogFocus(open, panelRef, true)
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
            ref={panelRef}
            tabIndex={-1}
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

/**
 * Date-range filter shared by every filter sheet: preset chips, and From / To only once
 * Custom is picked (editing either clamps the other so the range is never inverted).
 * `anyLabel` adds a leading "no limit" chip for lists that default to all time. `presets` and `labels` swap in
 * another chip set (Flow's All time and Last month); `customIcon` puts a calendar on Custom. Defaults unchanged.
 */
export function DateRangeField({
  preset,
  from,
  to,
  onPreset,
  onRange,
  anyLabel,
  presets = RANGE_PRESETS,
  labels,
  customIcon = false,
}: {
  preset: RangePreset | 'any'
  from: string
  to: string
  onPreset: (p: RangePreset | 'any') => void
  onRange: (from: string, to: string) => void
  anyLabel?: string
  presets?: readonly RangePreset[]
  labels?: Partial<Record<RangePreset, string>>
  customIcon?: boolean
}) {
  const t = useT()
  const base: Partial<Record<RangePreset, string>> = {
    today: t.common.today,
    yesterday: t.common.yesterday,
    week: t.expenses.periodThisWeek,
    month: t.expenses.periodThisMonth,
    custom: t.expenses.periodCustom,
  }
  const label = { ...base, ...labels }
  const chips: { key: RangePreset | 'any'; text: string }[] = [
    ...(anyLabel ? [{ key: 'any' as const, text: anyLabel }] : []),
    ...presets.map((p) => ({ key: p, text: label[p] ?? p })),
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
            {customIcon && c.key === 'custom' ? <Calendar aria-hidden /> : null}
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

/** Flow's periods: every month by default, then the narrower ones. */
const FLOW_PRESETS: readonly RangePreset[] = ['all', 'today', 'week', 'month', 'lastMonth', 'custom']

/** Flow's period control: the shared date-range field bound to the expense filter store. */
function PeriodControl() {
  const monthFilter = useSettingsStore((s) => s.monthFilter)
  const monthStartDay = useFinanceStore((s) => s.settings.monthStartDay)
  const { range, setRangePreset, setCustomRange } = useExpenseFilterStore(
    useShallow((s) => ({ range: s.range, setRangePreset: s.setRangePreset, setCustomRange: s.setCustomRange })),
  )
  const lt = useFlowLtCopy()
  const weekStart = useWeekStart()
  // All time has no useful bounds to seed Custom with: start it on the current month.
  const seed = range.preset === 'all' ? { ...range, preset: 'month' as const } : range
  const resolved = resolveRange(seed, monthFilter, monthStartDay, new Date(), weekStart)
  const from = range.from ?? format(resolved.start, 'yyyy-MM-dd')
  const to = range.to ?? format(resolved.end, 'yyyy-MM-dd')
  return (
    <DateRangeField
      preset={range.preset}
      from={from}
      to={to}
      presets={FLOW_PRESETS}
      labels={{ all: lt.filters.allTime, lastMonth: lt.filters.lastMonth }}
      customIcon
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
      <span className="text-xs font-medium text-[var(--color-brand-text-secondary)]">{label}</span>
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

/** The 22px tick box at the end of a tile. */
function Tick({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-[22px] shrink-0 items-center justify-center rounded-[7px] border-2',
        on ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]' : 'border-[var(--color-brand-border-strong)]',
      )}
    >
      {on ? <Check className="size-3.5" strokeWidth={3} /> : null}
    </span>
  )
}

/** A 2-up checkbox tile: the tinted icon chip, the label with an optional line under it, and the tick box. */
function CheckCard({ selected, onClick, chip, chipStyle, label, sub, subTone }: { selected: boolean; onClick: () => void; chip: ReactNode; chipStyle: React.CSSProperties; label: string; sub?: string; subTone?: string }) {
  return (
    <div className="min-w-0">
      <SelectableCard as="checkbox" surface="elevated" selected={selected} onClick={onClick} className="min-h-[56px] w-full min-w-0 gap-2.5 p-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px]" style={chipStyle}>
          {chip}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.875rem] font-semibold text-[var(--color-brand-text-primary)]">{label}</span>
          {sub ? (
            <span dir="auto" className="block font-mono-numbers text-[0.71875rem]" style={{ color: subTone ?? 'var(--color-brand-text-secondary)' }}>
              {sub}
            </span>
          ) : null}
        </span>
        <Tick on={selected} />
      </SelectableCard>
    </div>
  )
}

/** 15/700 section title with an optional note at the end. */
function Head({ title, end }: { title: string; end?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-1">
      <h3 className="text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">{title}</h3>
      {end}
    </div>
  )
}

/** Paid with folds into one row; the full list opens in a multi-select sheet over the filters. */
function PaidWithField({ methods }: { methods: PaymentMethod[] }) {
  const t = useT()
  const lt = useFlowLtCopy()
  const [open, setOpen] = useState(false)
  const selected = useExpenseFilterStore((s) => s.methods)
  const toggleMethod = useExpenseFilterStore((s) => s.toggleMethod)
  const names = selected.map((id) => methodLabel(methods.find((m) => m.id === id)) ?? id)
  const apply = (next: string[]) => {
    for (const id of new Set([...selected, ...next])) if (selected.includes(id) !== next.includes(id)) toggleMethod(id)
  }
  return (
    <>
      <SelectableCard as="action" surface="card" onClick={() => setOpen(true)} aria-haspopup="dialog" className="min-h-[60px] px-4 py-3">
        <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-[9px] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]">
          <Wallet className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">
            {selected.length ? lt.filters.nSelected(selected.length) : lt.filters.allMethods}
          </span>
          <span className="block truncate text-xs text-[var(--color-brand-text-secondary)]">
            {selected.length ? names.join(', ') : lt.filters.allMethodsSub}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-[var(--color-brand-text-muted)] rtl:rotate-180" aria-hidden />
      </SelectableCard>
      <OptionSheet
        multiple
        open={open}
        onClose={() => setOpen(false)}
        title={lt.filters.paidWith}
        subtitle={lt.filters.paidPickSub}
        zIndexClassName="z-[70]"
        value={selected}
        onChange={(next) => {
          apply(next)
          setOpen(false)
        }}
        options={methods.map((pm) => {
          const Icon = methodIcon(pm)
          return {
            value: pm.id,
            title: methodLabel(pm) ?? pm.name,
            subtitle: [cardKindLabel(pm.type, t.accountsPage), pm.currency].filter(Boolean).join(' · '),
            icon: <Icon />,
            tone: 'var(--color-brand-text-secondary)',
          }
        })}
      />
    </>
  )
}

/**
 * Flow's filters sheet: the date range (all time by default), the amount range, categories as tiles with how much
 * of their budget is used (or, on In, income types), and Paid with folded into one row until tapped. Direction is
 * not a filter here: it is the page's segment. One store (`useExpenseFilterStore`) backs this sheet and the page.
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
  const lt = useFlowLtCopy()
  const stats = useMonthlyStats()
  const paymentMethods = filterablePaymentMethods(useFinanceStore((s) => s.paymentMethods))
  const { cats, incomeSel, amtMin, amtMax, toggleCat, toggleIncomeType, reset } = useExpenseFilterStore(
    useShallow((s) => ({
      cats: s.cats,
      incomeSel: s.incomeTypes,
      amtMin: s.amtMin,
      amtMax: s.amtMax,
      toggleCat: s.toggleCat,
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
          {lt.filters.showResults(resultCount)}
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-2 px-1">
          <h2 className="text-lg font-bold text-[var(--color-brand-text-primary)]">{lt.filters.title}</h2>
          <span className="flex items-center gap-2">
            <Button variant="link" size="touch" className="px-1 font-semibold" onClick={reset}>
              {t.expenses.resetAll}
            </Button>
            <IconButton variant="sheetAction" aria-label={t.common.close} onClick={onClose}>
              <X />
            </IconButton>
          </span>
        </div>

        <div className="flex flex-col gap-2.5">
          <Head title={lt.filters.dateRange} />
          <PeriodControl />
        </div>

        <div className="flex flex-col gap-2.5">
          <Head
            title={lt.filters.amountRange}
            end={
              <span className="font-mono-numbers text-[0.8125rem] font-semibold text-[var(--color-brand-primary-ink)]">
                {formatWhole(amtMin)} – {formatWhole(amtMax)}{amtMax >= AMOUNT_MAX ? '+' : ''} {currency}
              </span>
            }
          />
          <AmountRangeControl currency={currency} />
        </div>

        {segment === 'in' ? (
          incomeTypes.length ? (
            <div className="flex flex-col gap-2.5">
              <Head title={t.filters.incomeType} end={selectMulti} />
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
          ) : null
        ) : (
          <div className="flex flex-col gap-2.5">
            <Head title={lt.filters.category} end={selectMulti} />
            <div role="group" aria-label={t.filters.category} className="grid grid-cols-2 gap-2">
              {categories.map((c) => {
                const colors = categoryChipColors(c.id)
                const b = categoryBudget(c.id, stats.categoryBudgetCaps, stats.categorySpending)
                const tone = !b ? undefined : b.pct > 1 ? 'var(--color-brand-red)' : b.pct >= 0.8 ? 'var(--color-brand-amber)' : undefined
                return (
                  <CheckCard
                    key={c.id}
                    selected={cats.includes(c.id)}
                    onClick={() => toggleCat(c.id)}
                    chip={<CategoryIcon category={c.id} className="size-4" />}
                    chipStyle={{ background: colors.bg, color: colors.fg }}
                    label={c.label}
                    sub={b ? lt.filters.pctOfBudget(Math.round(b.pct * 100)) : lt.filters.noBudget}
                    subTone={tone}
                  />
                )
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <Head title={lt.filters.paidWith} />
          <PaidWithField methods={paymentMethods} />
        </div>
      </div>
    </FilterSheet>
  )
}
