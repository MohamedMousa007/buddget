'use client'

import { useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutGrid,
  CreditCard,
  DollarSign,
  ArrowUpDown,
  SlidersHorizontal,
  Check,
} from 'lucide-react'
import { CategoryIcon } from '@/components/dashboard/CategoryIcon'
import {
  useExpenseFilterStore,
  amountIsFiltered,
  AMOUNT_MAX,
} from '@/lib/store/useExpenseFilterStore'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'

export interface FilterCategoryOption {
  id: string
  label: string
}
export interface FilterMethodOption {
  id: string
  label: string
  color: string
}

type DropdownKey = 'cat' | 'method' | 'amount' | 'all' | null

/** Lightweight bottom-sheet shell matching the redesign (26px radius, slide-up). */
function FilterSheet({
  open,
  onClose,
  children,
  maxHeightClass = '',
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  maxHeightClass?: string
}) {
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
            className="fixed inset-0 z-[60] bg-[rgba(4,4,8,0.66)]"
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            exit={{ y: '110%' }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'hide-scrollbar fixed inset-x-0 bottom-0 z-[60] overflow-y-auto rounded-t-[26px] border-t border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-[18px] pt-2.5 shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.7)]',
              maxHeightClass,
            )}
            style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="mx-auto mt-0.5 mb-[14px] h-[5px] w-[42px] rounded-[3px] bg-[var(--color-brand-border)]" />
            {children}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}

function CheckBox({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] border-2 text-white',
        selected
          ? 'border-[var(--color-brand-red)] bg-[var(--color-brand-red)]'
          : 'border-[var(--color-brand-border)] bg-transparent',
      )}
    >
      <Check className="h-[13px] w-[13px]" strokeWidth={3} style={{ opacity: selected ? 1 : 0 }} />
    </span>
  )
}

function selRowClass(selected: boolean) {
  return cn(
    'flex w-full items-center gap-3 rounded-[13px] border px-[13px] py-[11px] text-start transition-colors',
    selected
      ? 'border-[var(--color-brand-red)] bg-[rgba(229,9,20,0.1)]'
      : 'border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]',
  )
}

function AmountRangeControl() {
  const { amtMin, amtMax, setAmtMin, setAmtMax } = useExpenseFilterStore(
    useShallow((s) => ({ amtMin: s.amtMin, amtMax: s.amtMax, setAmtMin: s.setAmtMin, setAmtMax: s.setAmtMax })),
  )
  const t = useT()
  const minPct = `${(amtMin / AMOUNT_MAX) * 100}%`
  const maxRightPct = `${100 - (amtMax / AMOUNT_MAX) * 100}%`

  return (
    <>
      <div className="relative mb-4 h-[26px]">
        <div className="absolute left-0 right-0 top-1/2 h-[5px] -translate-y-1/2 rounded-full bg-[var(--color-brand-elevated)]" />
        <div
          className="absolute top-1/2 h-[5px] -translate-y-1/2 rounded-full bg-[var(--color-brand-red)]"
          style={{ left: minPct, right: maxRightPct }}
        />
        <input
          className="rng2"
          type="range"
          min={0}
          max={AMOUNT_MAX}
          step={50}
          value={amtMin}
          onChange={(e) => setAmtMin(+e.target.value)}
          aria-label={t.expenses.minimum}
        />
        <input
          className="rng2"
          type="range"
          min={0}
          max={AMOUNT_MAX}
          step={50}
          value={amtMax}
          onChange={(e) => setAmtMax(+e.target.value)}
          aria-label={t.expenses.maximum}
        />
      </div>
      <div className="mb-[18px] flex gap-[10px]">
        <label className="flex-1">
          <p className="mb-[5px] text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--color-brand-text-muted)]">
            {t.expenses.minimum}
          </p>
          <div className="flex items-center gap-[6px] rounded-[12px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 py-[9px]">
            <input
              className="font-mono-numbers min-w-0 flex-1 border-none bg-transparent text-[15px] font-bold text-[var(--color-brand-text-primary)] outline-none"
              type="number"
              min={0}
              max={AMOUNT_MAX}
              step={50}
              value={amtMin}
              onChange={(e) => setAmtMin(+e.target.value || 0)}
            />
            <span className="text-[11px] text-[var(--color-brand-text-muted)]">EGP</span>
          </div>
        </label>
        <label className="flex-1">
          <p className="mb-[5px] text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--color-brand-text-muted)]">
            {t.expenses.maximum}
          </p>
          <div className="flex items-center gap-[6px] rounded-[12px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 py-[9px]">
            <input
              className="font-mono-numbers min-w-0 flex-1 border-none bg-transparent text-[15px] font-bold text-[var(--color-brand-text-primary)] outline-none"
              type="number"
              min={0}
              max={AMOUNT_MAX}
              step={50}
              value={amtMax}
              onChange={(e) => setAmtMax(+e.target.value || 0)}
            />
            <span className="text-[11px] text-[var(--color-brand-text-muted)]">EGP</span>
          </div>
        </label>
      </div>
    </>
  )
}

const redDoneBtn =
  'h-[46px] w-full rounded-[14px] bg-[var(--color-brand-red)] text-[14.5px] font-bold text-white'

export function ExpenseFilters({
  categories,
  methods,
  resultCount,
}: {
  categories: FilterCategoryOption[]
  methods: FilterMethodOption[]
  resultCount: number
}) {
  const t = useT()
  const [dropdown, setDropdown] = useState<DropdownKey>(null)
  const close = () => setDropdown(null)
  const { cats, methodsSel, amtMin, amtMax, toggleCat, toggleMethod, reset } = useExpenseFilterStore(
    useShallow((s) => ({
      cats: s.cats,
      methodsSel: s.methods,
      amtMin: s.amtMin,
      amtMax: s.amtMax,
      toggleCat: s.toggleCat,
      toggleMethod: s.toggleMethod,
      reset: s.reset,
    })),
  )

  const amtActive = amountIsFiltered(amtMin, amtMax)
  const filterCount = (cats.length ? 1 : 0) + (methodsSel.length ? 1 : 0) + (amtActive ? 1 : 0)

  const catChipLabel =
    cats.length === 0
      ? t.expenses.labelCategory
      : cats.length === 1
        ? (categories.find((c) => c.id === cats[0])?.label ?? cats[0])
        : `${t.expenses.labelCategories} (${cats.length})`
  const methodChipLabel =
    methodsSel.length === 0
      ? t.expenses.labelPayment
      : methodsSel.length === 1
        ? (methods.find((m) => m.id === methodsSel[0])?.label ?? methodsSel[0])
        : `${t.expenses.labelPayment} (${methodsSel.length})`
  const amtChipLabel = amtActive
    ? `${amtMin.toLocaleString('en-US')}–${amtMax.toLocaleString('en-US')}`
    : t.expenses.labelAmount

  const chip = (active: boolean) =>
    cn(
      'inline-flex shrink-0 items-center gap-[6px] whitespace-nowrap rounded-full border px-[13px] py-2 text-[12.5px] font-semibold transition-colors',
      active
        ? 'border-[var(--color-brand-red)] bg-[rgba(229,9,20,0.12)] text-[var(--color-brand-text-primary)]'
        : 'border-[var(--color-brand-border)] bg-[var(--color-brand-card)] text-[var(--color-brand-text-secondary)]',
    )

  const amountReadout = `${amtMin.toLocaleString('en-US')} – ${amtMax.toLocaleString('en-US')} EGP`

  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="hide-scrollbar flex min-w-0 flex-1 gap-[7px] overflow-x-auto py-0.5">
        <button type="button" onClick={() => setDropdown('cat')} className={chip(cats.length > 0)}>
          <LayoutGrid className="h-[14px] w-[14px]" />
          {catChipLabel}
          <ArrowUpDown className="h-[13px] w-[13px] opacity-55" />
        </button>
        <button type="button" onClick={() => setDropdown('method')} className={chip(methodsSel.length > 0)}>
          <CreditCard className="h-[14px] w-[14px]" />
          {methodChipLabel}
          <ArrowUpDown className="h-[13px] w-[13px] opacity-55" />
        </button>
        <button type="button" onClick={() => setDropdown('amount')} className={chip(amtActive)}>
          <DollarSign className="h-[14px] w-[14px]" />
          {amtChipLabel}
          <ArrowUpDown className="h-[13px] w-[13px] opacity-55" />
        </button>
      </div>
      <button
        type="button"
        onClick={() => setDropdown('all')}
        className="relative flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[13px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] text-[var(--color-brand-text-primary)]"
        aria-label={t.expenses.filtersTitle}
      >
        <SlidersHorizontal className="h-[18px] w-[18px]" />
        {filterCount > 0 ? (
          <span className="absolute -right-[5px] -top-[5px] flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] border-2 border-[var(--color-brand-bg)] bg-[var(--color-brand-red)] px-1 text-[10px] font-extrabold text-white">
            {filterCount}
          </span>
        ) : null}
      </button>

      {/* Category dropdown */}
      <FilterSheet open={dropdown === 'cat'} onClose={close} maxHeightClass="max-h-[80%]">
        <div className="mb-[14px] flex items-center justify-between">
          <h3 className="text-[16px] font-extrabold text-[var(--color-brand-text-primary)]">{t.expenses.labelCategory}</h3>
          <span className="text-[11px] text-[var(--color-brand-text-muted)]">{t.expenses.selectMulti}</span>
        </div>
        <div className="mb-[14px] flex flex-col gap-[7px]">
          {categories.map((c) => {
            const sel = cats.includes(c.id)
            return (
              <button key={c.id} type="button" onClick={() => toggleCat(c.id)} className={selRowClass(sel)}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[var(--color-brand-card)] text-[var(--color-brand-text-secondary)]">
                  <CategoryIcon category={c.id} className="h-[17px] w-[17px]" />
                </span>
                <span className="flex-1 text-[14px] font-semibold text-[var(--color-brand-text-primary)]">{c.label}</span>
                <CheckBox selected={sel} />
              </button>
            )
          })}
        </div>
        <button type="button" onClick={close} className={redDoneBtn}>{t.expenses.doneCta}</button>
      </FilterSheet>

      {/* Payment dropdown */}
      <FilterSheet open={dropdown === 'method'} onClose={close} maxHeightClass="max-h-[80%]">
        <div className="mb-[14px] flex items-center justify-between">
          <h3 className="text-[16px] font-extrabold text-[var(--color-brand-text-primary)]">{t.expenses.labelPayment}</h3>
          <span className="text-[11px] text-[var(--color-brand-text-muted)]">{t.expenses.selectMulti}</span>
        </div>
        <div className="mb-[14px] flex flex-col gap-[7px]">
          {methods.map((m) => {
            const sel = methodsSel.includes(m.id)
            return (
              <button key={m.id} type="button" onClick={() => toggleMethod(m.id)} className={selRowClass(sel)}>
                <span className="h-[10px] w-[10px] shrink-0 rounded-full" style={{ background: m.color }} />
                <span className="flex-1 text-[14px] font-semibold text-[var(--color-brand-text-primary)]">{m.label}</span>
                <CheckBox selected={sel} />
              </button>
            )
          })}
        </div>
        <button type="button" onClick={close} className={redDoneBtn}>{t.expenses.doneCta}</button>
      </FilterSheet>

      {/* Amount dropdown */}
      <FilterSheet open={dropdown === 'amount'} onClose={close}>
        <div className="mb-[18px] flex items-center justify-between">
          <h3 className="text-[16px] font-extrabold text-[var(--color-brand-text-primary)]">{t.expenses.amountRange}</h3>
          <span className="font-mono-numbers text-[14px] font-bold text-[var(--color-brand-red)]">{amountReadout}</span>
        </div>
        <AmountRangeControl />
        <button type="button" onClick={close} className={redDoneBtn}>{t.expenses.doneCta}</button>
      </FilterSheet>

      {/* All-filters sheet */}
      <FilterSheet open={dropdown === 'all'} onClose={close} maxHeightClass="max-h-[84%]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[17px] font-extrabold text-[var(--color-brand-text-primary)]">{t.expenses.filtersTitle}</h3>
          <button type="button" onClick={reset} className="text-[12.5px] font-bold text-[var(--color-brand-red)]">
            {t.expenses.resetAll}
          </button>
        </div>

        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--color-brand-text-muted)]">
          {t.expenses.labelCategory}
        </p>
        <div className="mb-[18px] grid grid-cols-2 gap-[7px]">
          {categories.map((c) => {
            const sel = cats.includes(c.id)
            return (
              <button key={c.id} type="button" onClick={() => toggleCat(c.id)} className={selRowClass(sel)}>
                <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-[var(--color-brand-card)] text-[var(--color-brand-text-secondary)]">
                  <CategoryIcon category={c.id} className="h-4 w-4" />
                </span>
                <span className="flex-1 truncate text-[13px] font-semibold text-[var(--color-brand-text-primary)]">{c.label}</span>
                <CheckBox selected={sel} />
              </button>
            )
          })}
        </div>

        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--color-brand-text-muted)]">
          {t.expenses.labelPayment}
        </p>
        <div className="mb-[18px] flex flex-col gap-[7px]">
          {methods.map((m) => {
            const sel = methodsSel.includes(m.id)
            return (
              <button key={m.id} type="button" onClick={() => toggleMethod(m.id)} className={selRowClass(sel)}>
                <span className="h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: m.color }} />
                <span className="flex-1 text-[13.5px] font-semibold text-[var(--color-brand-text-primary)]">{m.label}</span>
                <CheckBox selected={sel} />
              </button>
            )
          })}
        </div>

        <div className="mb-1 flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--color-brand-text-muted)]">
            {t.expenses.amountRange}
          </p>
          <span className="font-mono-numbers text-[12.5px] font-bold text-[var(--color-brand-text-primary)]">{amountReadout}</span>
        </div>
        <AmountRangeControl />

        <button type="button" onClick={close} className="h-12 w-full rounded-[14px] bg-[var(--color-brand-red)] text-[15px] font-bold text-white">
          {t.expenses.showResults.replace('{count}', String(resultCount))}
        </button>
      </FilterSheet>
    </div>
  )
}
