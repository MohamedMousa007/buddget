'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, X, Plus, Info, ArrowLeftRight } from 'lucide-react'
import type { Currency, PaymentMethod } from '@/lib/store/types'
import { EXPENSE_CATEGORY_GRID } from '@/lib/constants/categoryGrid'
import { isNonSpendCategory } from '@/lib/constants/categoryMeta'
import { useT, useLocale } from '@/lib/i18n'
import { UnifiedDatePicker, formatDatePillLabel } from '@/components/ui/UnifiedDatePicker'
import { CurrencyField } from '@/components/ui/CurrencyField'
import { PaymentMethodPicker } from '@/components/features/payments/PaymentMethodPicker'
import { rgba } from '@/lib/utils/color'
import { useNumberPad } from '@/components/ui/useNumberPad'

const HIDE_SCROLL = '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

// shared surface/input recipes — all theme-driven via brand tokens
const INPUT =
  'h-12 w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3.5 text-start text-base font-normal text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] focus:outline-none focus:border-[var(--color-brand-focus)]'

function Portal({ children }: { children: React.ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}

export interface ExpenseSheetFormProps {
  mode: 'add' | 'edit'
  date: string
  setDate: (v: string) => void
  description: string
  setDescription: (v: string) => void
  amount: string
  setAmount: (v: string) => void
  currency: Currency
  setCurrency: (c: Currency) => void
  category: string
  setCategory: (c: string) => void
  paymentMethodId: string
  setPaymentMethodId: (id: string) => void
  notes: string
  setNotes: (v: string) => void
  submitError?: string
  paymentMethods: PaymentMethod[]
  creditCardOutstandingHint: { cardName: string; amountLabel: string } | null
  onSubmit: () => void
  onClose: () => void
  /** Edit-only: true when the form differs from the loaded snapshot. */
  isDirty?: boolean
  /** Edit-only: revert every field to the loaded snapshot. */
  onDiscard?: () => void
  /** Edit-only: set when this expense was reversed — shows a charged/refunded line. */
  refundedAt?: string
  refundKind?: 'refunded' | 'declined'
  /** Add-only: BNPL "split into installments" controls (shown when the PM is `bnpl`). */
  installment?: {
    isBnplPurchase: boolean
    enabled: boolean
    setEnabled: (v: boolean) => void
    count: number
    setCount: (n: number) => void
    firstDue: string
    setFirstDue: (v: string) => void
    fundingMethodId: string
    setFundingMethodId: (id: string) => void
  }
}

export function ExpenseSheetForm(props: ExpenseSheetFormProps) {
  const {
    mode,
    date,
    setDate,
    description,
    setDescription,
    amount,
    setAmount,
    currency,
    setCurrency,
    category,
    setCategory,
    paymentMethodId,
    setPaymentMethodId,
    notes,
    setNotes,
    submitError,
    paymentMethods,
    creditCardOutstandingHint,
    onSubmit,
    onClose,
    isDirty,
    onDiscard,
    refundedAt,
    refundKind,
    installment,
  } = props
  const t = useT()
  const { locale } = useLocale()
  const ar = locale === 'ar'

  const [calOpen, setCalOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(mode === 'edit' && Boolean(notes.trim()))

  // subtle scroll-position indicator for the category grid
  const catRef = useRef<HTMLDivElement>(null)
  const [scroll, setScroll] = useState({ frac: 0, thumb: 40 })
  const onCatScroll = () => {
    const el = catRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    const frac = max > 0 ? Math.abs(el.scrollLeft) / max : 0
    const thumb = el.scrollWidth > 0 ? Math.max(22, Math.min(100, (el.clientWidth / el.scrollWidth) * 100)) : 40
    setScroll({ frac, thumb })
  }
  useEffect(() => {
    // measure the initial thumb width once the grid has mounted
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot measurement of the scroll indicator
    onCatScroll()
  }, [])

  const nonSpendSelected = isNonSpendCategory(category)
  const amountNum = parseFloat(amount)
  const submitDisabled =
    !amount.trim() || Number.isNaN(amountNum) || amountNum <= 0 || !description.trim()

  const setAmt = (v: string) => {
    if (/^[0-9]*\.?[0-9]*$/.test(v)) setAmount(v)
  }

  const amountPad = useNumberPad({ value: amount, onChange: setAmt, currency })

  const handleX = () => {
    if (mode === 'edit' && isDirty) setConfirmOpen(true)
    else onClose()
  }

  const IcClose = <X className="w-full h-full" strokeWidth={2} />
  const microLabel = 'font-semibold text-[10px] tracking-[.08em] uppercase text-[var(--color-brand-text-muted)]'

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col outline-none">
        {/* header — ModalShell renders the drag handle above this. */}
        <div className="shrink-0 px-5 pt-1">
          <div className="flex items-center justify-between">
            <div className="font-heading text-lg font-bold text-[var(--color-brand-text-primary)]">
              {mode === 'edit' ? t.expenseForm.titleEdit : t.expenseForm.titleAdd}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCalOpen(true)}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 py-2 text-xs font-semibold text-[var(--color-brand-text-secondary)] hover:border-[var(--color-brand-text-muted)]"
              >
                <Calendar className="w-3.5 h-3.5 text-[var(--color-brand-text-muted)]" />
                {formatDatePillLabel(date, locale, t.expenseForm.today)}
              </button>
              <button
                type="button"
                onClick={handleX}
                aria-label={t.common.close}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-border)] hover:text-[var(--color-brand-text-secondary)]"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>

        {/* body */}
        <div className={`min-h-0 flex-1 overflow-y-auto px-5 pt-3.5 pb-1.5 flex flex-col gap-3.5 ${HIDE_SCROLL}`}>
          {/* amount + currency */}
          <div className="grid grid-cols-[1fr_108px] gap-3 items-end">
            <div>
              <label htmlFor="ef-amount" className={`block ${microLabel} mb-2`}>{t.expenseForm.amount}</label>
              <button
                id="ef-amount"
                type="button"
                onClick={amountPad.openPad}
                dir="ltr"
                className={`flex h-12 w-full items-center rounded-xl border bg-[var(--color-brand-elevated)] px-3.5 ${amountPad.isOpen ? 'border-[var(--color-brand-red)]' : 'border-[var(--color-brand-border)]'}`}
              >
                <span className={`min-w-0 flex-1 text-start font-bold text-2xl font-mono-numbers tracking-[-0.02em] ${amount ? 'text-[var(--color-brand-text-primary)]' : 'text-[var(--color-brand-text-muted)]'}`}>
                  {amount || '0.00'}
                </span>
              </button>
              {amountPad.pad}
            </div>
            <div>
              <div className={`${microLabel} mb-2`}>{t.expenseForm.currency}</div>
              <CurrencyField
                value={currency}
                onChange={setCurrency}
                className="h-12 w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3.5 text-base font-semibold"
              />
            </div>
          </div>

          {/* description */}
          <div>
            <label htmlFor="ef-description" className={`block ${microLabel} mb-2`}>{t.expenseForm.description}</label>
            <input
              id="ef-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              // Some Android IMEs (e.g. Gboard Arabic) only fire `input`/onChange when the
              // composition commits; sync mid-composition so the submit gate reflects the
              // typed word live. Setting the identical value is a no-op DOM-write, so it
              // doesn't disrupt the composing region.
              onCompositionUpdate={(e) => setDescription(e.currentTarget.value)}
              onCompositionEnd={(e) => setDescription(e.currentTarget.value)}
              placeholder={t.expenseForm.descriptionPlaceholder}
              className={INPUT}
            />
          </div>

          {submitError ? <p className="text-xs text-[var(--color-brand-red)]">{submitError}</p> : null}

          {/* category grid */}
          <div>
            <div className={`${microLabel} mb-2.5`}>{t.expenseForm.category}</div>
            <div className="-mx-5 px-5">
              <div ref={catRef} onScroll={onCatScroll} className={`overflow-x-auto pb-0.5 ${HIDE_SCROLL}`}>
                <div
                  className="grid w-max gap-2"
                  style={{ gridAutoFlow: 'column', gridTemplateRows: 'repeat(2,60px)', gridAutoColumns: '66px' }}
                >
                  {EXPENSE_CATEGORY_GRID.map((c) => {
                    const on = c.id === category
                    const Icon = c.icon
                    const tileStyle: React.CSSProperties = on
                      ? { background: rgba(c.accent, 0.15), border: `1px solid ${rgba(c.accent, 0.55)}` }
                      : {
                          background: 'var(--color-brand-elevated)',
                          border: c.nonspend
                            ? '1px dashed var(--color-brand-border)'
                            : '1px solid var(--color-brand-border)',
                        }
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCategory(c.id)}
                        aria-pressed={on}
                        style={tileStyle}
                        className="relative flex flex-col items-center justify-center gap-1.5 rounded-2xl transition-all"
                      >
                        {c.nonspend ? (
                          <span className="absolute top-1.5 inline-flex w-3.5 h-3.5 text-[var(--color-brand-text-muted)] end-1.5">
                            <ArrowLeftRight className="w-full h-full" strokeWidth={2.4} />
                          </span>
                        ) : null}
                        <Icon
                          className="w-6 h-6"
                          style={{ color: on ? c.accent : 'var(--color-brand-text-muted)' }}
                        />
                        <span
                          className="whitespace-nowrap text-[10px] font-semibold"
                          style={{ color: on ? 'var(--color-brand-text-primary)' : 'var(--color-brand-text-secondary)' }}
                        >
                          {t.expenseForm.categoryLabels[c.id] ?? c.id}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            {/* scroll indicator */}
            <div className="mt-2.5 flex justify-center">
              <div className="relative h-1 w-16 overflow-hidden rounded-full bg-[var(--color-brand-border)]">
                <div
                  className="absolute top-0 bottom-0 rounded-full bg-[var(--color-brand-text-secondary)]"
                  style={{
                    width: `${scroll.thumb}%`,
                    [ar ? 'right' : 'left']: `${(100 - scroll.thumb) * scroll.frac}%`,
                    transition: `${ar ? 'right' : 'left'} .08s linear`,
                  }}
                />
              </div>
            </div>
            {nonSpendSelected ? (
              <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 py-2.5">
                <Info className="mt-px w-4 h-4 shrink-0 text-[var(--color-brand-text-muted)]" />
                <span className="text-start text-xs font-medium leading-[1.4] text-[var(--color-brand-text-secondary)]">
                  {t.expenseForm.nonSpendHint}
                </span>
              </div>
            ) : null}
          </div>

          {/* payment method */}
          <PaymentMethodPicker
            value={paymentMethodId}
            onChange={setPaymentMethodId}
            paymentMethods={paymentMethods}
            label={t.expenseForm.paymentMethod}
          />

          {creditCardOutstandingHint ? (
            <p className="text-xs leading-snug text-[var(--color-brand-text-muted)]" role="status">
              ⓘ{' '}
              {t.addExpense.creditCardOutstandingHint(
                creditCardOutstandingHint.cardName,
                creditCardOutstandingHint.amountLabel,
              )}
            </p>
          ) : null}

          {/* BNPL: split this purchase into an installment plan */}
          {mode === 'add' && installment?.isBnplPurchase ? (
            <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/40 p-3">
              <button
                type="button"
                onClick={() => installment.setEnabled(!installment.enabled)}
                aria-pressed={installment.enabled}
                className="flex w-full items-center justify-between"
              >
                <span className="text-sm font-medium text-[var(--color-brand-text-primary)]">
                  {t.expenseForm.splitInstallments}
                </span>
                <span
                  className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${installment.enabled ? 'bg-[var(--color-brand-red)]' : 'bg-[var(--color-brand-border)]'}`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${installment.enabled ? 'left-[18px]' : 'left-0.5'}`}
                  />
                </span>
              </button>
              {installment.enabled ? (
                <div className="mt-3 space-y-3">
                  <div className="flex gap-2">
                    {[3, 4, 6, 12].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => installment.setCount(n)}
                        className={`h-9 flex-1 rounded-lg border text-sm font-semibold transition-colors ${installment.count === n ? 'border-[var(--color-brand-red)] bg-[rgba(229,9,20,0.12)] text-[var(--color-brand-text-primary)]' : 'border-[var(--color-brand-border)] text-[var(--color-brand-text-secondary)]'}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <p className="font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">
                    {installment.count} × {((parseFloat(amount) || 0) / installment.count).toFixed(2)} {currency} {t.expenseForm.installmentEach}
                  </p>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-[var(--color-brand-text-muted)]">
                      {t.expenseForm.installmentFirstDue}
                    </span>
                    <input
                      type="date"
                      value={installment.firstDue}
                      onChange={(e) => installment.setFirstDue(e.target.value)}
                      className="w-full rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 py-2 text-sm text-[var(--color-brand-text-primary)]"
                    />
                  </label>
                  <PaymentMethodPicker
                    value={installment.fundingMethodId}
                    onChange={installment.setFundingMethodId}
                    paymentMethods={paymentMethods.filter((m) => m.type !== 'bnpl')}
                    label={t.expenseForm.installmentPayFrom}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {/* reversal audit line — charged vs refunded/declined date */}
          {refundKind ? (
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-brand-text-muted)]">
              <Info className="h-3.5 w-3.5 shrink-0" />
              <span>
                {t.expenseForm.charged} {formatDatePillLabel(date, locale, t.expenseForm.today)}
                {refundedAt ? (
                  <>
                    {' · '}
                    {refundKind === 'declined' ? t.expenseForm.declined : t.expenseForm.refunded}{' '}
                    {formatDatePillLabel(refundedAt.slice(0, 10), locale, t.expenseForm.today)}
                  </>
                ) : null}
              </span>
            </div>
          ) : null}

          {/* note */}
          <div>
            {noteOpen ? (
              <div className="relative">
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t.expenseForm.notePlaceholder}
                  aria-label={t.expenseForm.addNote}
                  className={INPUT}
                  style={{ paddingBlock: 0, paddingInline: '14px 46px' }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setNoteOpen(false)
                    setNotes('')
                  }}
                  aria-label={t.common.close}
                  className="absolute top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center p-2.5 text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-secondary)] end-2"
                >
                  {IcClose}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setNoteOpen(true)}
                className="inline-flex items-center gap-1.5 self-start py-0.5 text-sm font-semibold text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)]"
              >
                <Plus className="w-3.5 h-3.5" />
                {t.expenseForm.addNote}
              </button>
            )}
          </div>
          <div className="h-0.5" />
        </div>

        {/* footer */}
        <div className="sheet-cta shrink-0 border-t border-[var(--color-brand-border)] px-5 pt-3 pb-6">
          {submitDisabled ? (
            <p className="mb-2 text-center text-xs font-medium text-[var(--color-brand-text-muted)]" role="status">
              {!amount.trim() || Number.isNaN(amountNum) || amountNum <= 0
                ? t.expenseForm.cueAmount
                : t.expenseForm.cueDescription}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitDisabled}
            className={`h-14 w-full rounded-2xl text-base font-semibold transition-colors ${
              submitDisabled
                ? 'cursor-not-allowed bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-muted)]'
                : 'bg-[var(--color-brand-red)] text-white hover:bg-[var(--color-brand-red-hover)]'
            }`}
          >
            {mode === 'edit' ? t.expenseForm.saveChanges : t.expenseForm.saveExpense}
          </button>
        </div>
      </div>

      {/* ===== overlays (portalled above the sheet) ===== */}


      {/* calendar */}
      {calOpen ? (
        <Portal>
          <UnifiedDatePicker
            open
            value={date}
            onConfirm={(iso) => setDate(iso)}
            onClose={() => setCalOpen(false)}
          />
        </Portal>
      ) : null}

      {/* discard / save confirm (edit) */}
      {confirmOpen ? (
        <Portal>
          <div
            dir={ar ? 'rtl' : 'ltr'}
            className="fixed inset-0 z-[125] flex items-center justify-center p-7"
            style={{ animation: 'efFade .16s ease' }}
          >
            <button
              type="button"
              aria-label={t.common.close}
              onClick={() => setConfirmOpen(false)}
              className="absolute inset-0 border-none bg-black/[0.68]"
            />
            <div
              className="relative w-full max-w-72 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-5 pt-6 pb-5 text-start"
              style={{
                boxShadow: '0 24px 60px -12px rgba(0,0,0,.4)',
                animation: 'efPop .22s cubic-bezier(.22,1,.36,1)',
                fontFamily: ar ? 'var(--font-sans-ar)' : 'var(--font-sans)',
              }}
            >
              <div className="text-lg font-semibold text-[var(--color-brand-text-primary)]">{t.expenseForm.confirmTitle}</div>
              <div className="mt-2 text-sm font-normal leading-[1.45] text-[var(--color-brand-text-muted)]">
                {t.expenseForm.confirmBody}
              </div>
              <div className="mt-5 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmOpen(false)
                    onSubmit()
                  }}
                  className="h-12 rounded-xl bg-[var(--color-brand-red)] text-base font-semibold text-white hover:bg-[var(--color-brand-red-hover)]"
                >
                  {t.expenseForm.saveChanges}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDiscard?.()
                    setConfirmOpen(false)
                    onClose()
                  }}
                  className="h-12 rounded-xl border border-[var(--color-brand-border)] bg-transparent text-base font-semibold text-[var(--color-brand-red)] hover:bg-[var(--color-brand-elevated)]"
                >
                  {t.expenseForm.discardChanges}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      ) : null}
    </>
  )
}
