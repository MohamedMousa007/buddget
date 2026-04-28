'use client'

import { MODAL_LABEL_CLASS } from '@/lib/modals/modalFormClasses'
import { EXPENSE_ENTRY_CATEGORIES } from '@/lib/constants/finance'
import type { CategoryChipOption } from '@/hooks/usePlanCategories'
import { useT } from '@/lib/i18n'

const chipRowClass = '-mx-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
const chipInnerClass = 'flex w-max gap-1.5 px-1'
const categoryChipBtn =
  'shrink-0 px-2 py-1 rounded-full text-[11px] font-medium transition-colors leading-tight'
const categoryChipActive = 'bg-[var(--color-brand-red)] text-white'
const categoryChipIdle =
  'bg-[#1A1A24] text-[#A0A0B8] border border-[#2A2A38] hover:border-[#5A5A72]'

export function ExpenseCategoryChips({
  category,
  onChange,
  options,
  subcategory,
  onSubcategoryChange,
}: {
  category: string
  onChange: (c: string) => void
  /** Plan-aware chip options. Falls back to legacy enum list when omitted. */
  options?: CategoryChipOption[]
  subcategory?: string
  onSubcategoryChange?: (s: string | undefined) => void
}) {
  const t = useT()
  const chips: CategoryChipOption[] =
    options && options.length > 0
      ? options
      : EXPENSE_ENTRY_CATEGORIES.map((c) => ({ id: c, label: c, subcategories: [] }))

  const selectedChip = chips.find((c) => c.id === category)
  const subs = selectedChip?.subcategories ?? []

  return (
    <div className="space-y-2">
      <span className={MODAL_LABEL_CLASS}>{t.addExpense.labelCategory}</span>
      <div className={chipRowClass}>
        <div className={chipInnerClass} role="list">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              role="listitem"
              onClick={() => {
                onChange(chip.id)
                onSubcategoryChange?.(undefined)
              }}
              className={`${categoryChipBtn} ${category === chip.id ? categoryChipActive : categoryChipIdle}`}
            >
              {chip.icon ? `${chip.icon} ${chip.label}` : chip.label}
            </button>
          ))}
        </div>
      </div>

      {subs.length > 0 && onSubcategoryChange ?
        <div>
          <span className={`${MODAL_LABEL_CLASS} opacity-90`}>{t.addExpense.labelSubcategory}</span>
          <div className={`${chipRowClass} mt-1.5`}>
            <div className={chipInnerClass}>
              <button
                type="button"
                onClick={() => onSubcategoryChange(undefined)}
                className={`${categoryChipBtn} ${
                  !subcategory ? categoryChipActive : categoryChipIdle
                }`}
              >
                General
              </button>
              {subs.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => onSubcategoryChange(sub.name)}
                  className={`${categoryChipBtn} ${
                    subcategory === sub.name ? categoryChipActive : categoryChipIdle
                  }`}
                >
                  {sub.icon ? `${sub.icon} ${sub.name}` : sub.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      : null}
    </div>
  )
}

export function PaymentMethodChips({
  methods,
  paymentMethodId,
  onChange,
  label,
}: {
  methods: { id: string; name: string }[]
  paymentMethodId: string
  onChange: (id: string) => void
  label?: string
}) {
  const t = useT()
  const heading = label ?? t.addExpense.labelPaymentMethod
  return (
    <div>
      <span className={MODAL_LABEL_CLASS}>{heading}</span>
      <div className={`${chipRowClass} mt-1.5`}>
        <div className={chipInnerClass}>
          {methods.map((method) => (
            <button
              key={method.id}
              type="button"
              onClick={() => onChange(method.id)}
              className={`${categoryChipBtn} ${
                paymentMethodId === method.id ? categoryChipActive : categoryChipIdle
              }`}
            >
              {method.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
