'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronDown, X, Plus, Check, Info, ArrowLeftRight } from 'lucide-react'
import type { Currency, PaymentMethod, PaymentMethodType } from '@/lib/store/types'
import { FIAT_CURRENCIES } from '@/lib/constants/finance'
import { EXPENSE_CATEGORY_GRID, paymentTypeIcon } from '@/lib/constants/categoryGrid'
import { isNonSpendCategory } from '@/lib/constants/categoryMeta'
import { defaultColorForPaymentMethodType } from '@/lib/payment/paymentMethodDefaults'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { useT, useLocale } from '@/lib/i18n'
import { UnifiedDatePicker, formatDatePillLabel } from '@/components/ui/UnifiedDatePicker'

const HIDE_SCROLL = '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
const ADD_PAY_TYPES: PaymentMethodType[] = ['cash', 'bank_transfer', 'nol', 'card_credit', 'card_debit']
const LAST4_TYPES: PaymentMethodType[] = ['bank_transfer', 'card_credit', 'card_debit']

// shared surface/input recipes — all theme-driven via brand tokens
const INPUT =
  'h-12 w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3.5 text-start text-[15px] font-normal text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] focus:outline-none focus:border-[var(--color-brand-red)]'
const SHEET_SURFACE =
  'absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-[var(--color-brand-border)] bg-[var(--color-brand-card)]'

function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '')
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`
}
function swatchColor(pm: PaymentMethod): string {
  return pm.color || defaultColorForPaymentMethodType(pm.type, pm.name)
}

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
  } = props
  const t = useT()
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const { addPaymentMethod, settings } = useFinanceStore()

  const [calOpen, setCalOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [curOpen, setCurOpen] = useState(false)
  const [addPayOpen, setAddPayOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(mode === 'edit' && Boolean(notes.trim()))

  // add-payment inline form state
  const [apName, setApName] = useState('')
  const [apType, setApType] = useState<PaymentMethodType>('cash')
  const [apCurrency, setApCurrency] = useState<Currency>(settings.baseCurrency)
  const [apLast4, setApLast4] = useState('')
  const [apDefault, setApDefault] = useState(false)

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

  const selPay =
    paymentMethods.find((m) => m.id === paymentMethodId) || paymentMethods[0]
  const paySub = (m: PaymentMethod) =>
    `${t.expenseForm.paymentTypeLabels[m.type]} · ${m.currency}${m.last4 ? ` · ··${m.last4}` : ''}`

  const nonSpendSelected = isNonSpendCategory(category)
  const amountNum = parseFloat(amount)
  const submitDisabled =
    !amount.trim() || Number.isNaN(amountNum) || amountNum <= 0 || !description.trim()

  const setAmt = (v: string) => {
    if (/^[0-9]*\.?[0-9]*$/.test(v)) setAmount(v)
  }

  const handleX = () => {
    if (mode === 'edit' && isDirty) setConfirmOpen(true)
    else onClose()
  }

  const saveAddPayment = () => {
    if (!apName.trim()) return
    const before = new Set(paymentMethods.map((m) => m.id))
    addPaymentMethod({
      name: apName.trim(),
      type: apType,
      currency: clampFiatToAllowed(settings, apCurrency),
      color: defaultColorForPaymentMethodType(apType, apName.trim()),
      isDefault: apDefault,
      ...(apLast4 && LAST4_TYPES.includes(apType) ? { last4: apLast4 } : {}),
    })
    const added = useFinanceStore.getState().paymentMethods.find((m) => !before.has(m.id))
    if (added) setPaymentMethodId(added.id)
    setApName('')
    setApType('cash')
    setApCurrency(settings.baseCurrency)
    setApLast4('')
    setApDefault(false)
    setAddPayOpen(false)
    setPayOpen(false)
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
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 py-[7px] text-[12px] font-semibold text-[var(--color-brand-text-secondary)] hover:border-[var(--color-brand-text-muted)]"
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
                <X className="w-[18px] h-[18px]" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>

        {/* body */}
        <div className={`min-h-0 flex-1 overflow-y-auto px-5 pt-3.5 pb-1.5 flex flex-col gap-3.5 ${HIDE_SCROLL}`}>
          {/* amount + currency */}
          <div className="grid grid-cols-[1fr_108px] gap-3 items-end">
            <div>
              <div className={`${microLabel} mb-[7px]`}>{t.expenseForm.amount}</div>
              <div className="flex h-12 items-center rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3.5 focus-within:border-[var(--color-brand-red)]">
                <input
                  value={amount}
                  onChange={(e) => setAmt(e.target.value)}
                  dir="ltr"
                  inputMode="decimal"
                  placeholder="0.00"
                  aria-label={t.expenseForm.amount}
                  className="w-full min-w-0 flex-1 border-none bg-transparent text-start font-bold text-[24px] font-mono-numbers tracking-[-0.02em] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] focus:outline-none"
                />
              </div>
            </div>
            <div>
              <div className={`${microLabel} mb-[7px]`}>{t.expenseForm.currency}</div>
              <button
                type="button"
                onClick={() => setCurOpen(true)}
                className="flex h-12 w-full items-center justify-between rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3.5 text-[16px] font-semibold text-[var(--color-brand-text-secondary)] hover:border-[var(--color-brand-text-muted)]"
              >
                {currency}
                <ChevronDown className="w-4 h-4 text-[var(--color-brand-text-muted)]" />
              </button>
            </div>
          </div>

          {/* description */}
          <div>
            <div className={`${microLabel} mb-[7px]`}>{t.expenseForm.description}</div>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.expenseForm.descriptionPlaceholder}
              aria-label={t.expenseForm.description}
              className={INPUT}
            />
          </div>

          {submitError ? <p className="text-xs text-[var(--color-brand-red)]">{submitError}</p> : null}

          {/* category grid */}
          <div>
            <div className={`${microLabel} mb-[9px]`}>{t.expenseForm.category}</div>
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
                          <span className="absolute top-[5px] inline-flex w-[13px] h-[13px] text-[var(--color-brand-text-muted)] end-[5px]">
                            <ArrowLeftRight className="w-full h-full" strokeWidth={2.4} />
                          </span>
                        ) : null}
                        <Icon
                          className="w-[22px] h-[22px]"
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
            <div className="mt-[9px] flex justify-center">
              <div className="relative h-[3px] w-16 overflow-hidden rounded-full bg-[var(--color-brand-border)]">
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
              <div className="mt-[11px] flex items-start gap-[9px] rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 py-2.5">
                <Info className="mt-px w-4 h-4 shrink-0 text-[var(--color-brand-text-muted)]" />
                <span className="text-start text-[12px] font-medium leading-[1.4] text-[var(--color-brand-text-secondary)]">
                  {t.expenseForm.nonSpendHint}
                </span>
              </div>
            ) : null}
          </div>

          {/* payment method */}
          <div>
            <div className={`${microLabel} mb-[9px]`}>{t.expenseForm.paymentMethod}</div>
            <button
              type="button"
              onClick={() => setPayOpen(true)}
              className="flex h-14 w-full items-center justify-between rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 hover:border-[var(--color-brand-text-muted)]"
            >
              <div className="flex min-w-0 items-center gap-[11px]">
                {selPay ? (
                  <>
                    <span
                      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[11px]"
                      style={{ background: rgba(swatchColor(selPay), 0.16), color: swatchColor(selPay) }}
                    >
                      {(() => {
                        const Icon = paymentTypeIcon(selPay.type)
                        return <Icon className="w-4 h-4" />
                      })()}
                    </span>
                    <div className="min-w-0 text-start">
                      <div className="truncate text-[14px] font-semibold text-[var(--color-brand-text-primary)]">{selPay.name}</div>
                      <div className="mt-px truncate text-[11px] font-medium text-[var(--color-brand-text-muted)]">{paySub(selPay)}</div>
                    </div>
                  </>
                ) : (
                  <span className="text-[14px] font-medium text-[var(--color-brand-text-muted)]">{t.expenseForm.addPaymentMethod}</span>
                )}
              </div>
              <ChevronDown className="w-[18px] h-[18px] shrink-0 text-[var(--color-brand-text-muted)]" />
            </button>
          </div>

          {creditCardOutstandingHint ? (
            <p className="text-[11px] leading-snug text-[var(--color-brand-text-muted)]" role="status">
              ⓘ{' '}
              {t.addExpense.creditCardOutstandingHint(
                creditCardOutstandingHint.cardName,
                creditCardOutstandingHint.amountLabel,
              )}
            </p>
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
                  className="absolute top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center p-[9px] text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-secondary)] end-[7px]"
                >
                  {IcClose}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setNoteOpen(true)}
                className="inline-flex items-center gap-1.5 self-start py-0.5 text-[14px] font-semibold text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)]"
              >
                <Plus className="w-3.5 h-3.5" />
                {t.expenseForm.addNote}
              </button>
            )}
          </div>
          <div className="h-0.5" />
        </div>

        {/* footer */}
        <div className="shrink-0 border-t border-[var(--color-brand-border)] px-5 pt-3 pb-[22px]">
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitDisabled}
            className={`h-14 w-full rounded-2xl text-[16px] font-semibold transition-colors ${
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

      {/* payment dropdown */}
      {payOpen ? (
        <Portal>
          <div dir={ar ? 'rtl' : 'ltr'} className="fixed inset-0 z-[110]" style={{ animation: 'efFade .18s ease' }}>
            <button
              type="button"
              aria-label={t.common.close}
              onClick={() => setPayOpen(false)}
              className="absolute inset-0 border-none bg-black/55"
            />
            <div
              className={`${SHEET_SURFACE} px-4 pt-2.5 pb-[22px]`}
              style={{
                animation: 'efUp .28s cubic-bezier(.22,1,.36,1)',
                fontFamily: ar ? 'var(--font-sans-ar)' : 'var(--font-sans)',
              }}
            >
              <div className="mx-auto mt-0.5 mb-2.5 h-1 w-10 rounded-full bg-[var(--color-brand-border)]" />
              <div className="flex items-center justify-between px-1 pb-2">
                <div className="text-[16px] font-semibold text-[var(--color-brand-text-primary)]">{t.expenseForm.paymentTitle}</div>
                <button
                  type="button"
                  onClick={() => setPayOpen(false)}
                  aria-label={t.common.close}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-brand-elevated)] p-2 text-[var(--color-brand-text-muted)]"
                >
                  {IcClose}
                </button>
              </div>
              <div className={`flex max-h-[320px] flex-col gap-1 overflow-y-auto ${HIDE_SCROLL}`}>
                {paymentMethods.map((m) => {
                  const on = m.id === paymentMethodId
                  const Icon = paymentTypeIcon(m.type)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setPaymentMethodId(m.id)
                        setPayOpen(false)
                      }}
                      className="flex w-full items-center gap-3 rounded-xl border p-[10px_12px] transition-all"
                      style={{
                        borderColor: on ? rgba('#E50914', 0.4) : 'transparent',
                        background: on ? 'rgba(229,9,20,.07)' : 'transparent',
                      }}
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
                        style={{ background: rgba(swatchColor(m), 0.16), color: swatchColor(m) }}
                      >
                        <Icon className="w-[17px] h-[17px]" />
                      </span>
                      <div className="min-w-0 flex-1 text-start">
                        <div className="flex items-center gap-[7px]">
                          <span className="truncate text-[14px] font-semibold text-[var(--color-brand-text-primary)]">{m.name}</span>
                          {m.isDefault ? (
                            <span className="shrink-0 rounded-[6px] bg-[var(--color-brand-elevated)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[.05em] text-[var(--color-brand-text-muted)]">
                              {t.expenseForm.defaultBadge}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-px text-[11px] font-medium text-[var(--color-brand-text-muted)]">{paySub(m)}</div>
                      </div>
                      {on ? <Check className="w-5 h-5 shrink-0 text-[var(--color-brand-red)]" /> : null}
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={() => setAddPayOpen(true)}
                className="mt-2 flex h-12 w-full items-center gap-2.5 rounded-xl border border-[rgba(229,9,20,.28)] bg-[rgba(229,9,20,.08)] px-3.5 text-[14px] font-semibold text-[var(--color-brand-red)] hover:bg-[rgba(229,9,20,.14)]"
              >
                <Plus className="w-5 h-5" />
                {t.expenseForm.addPaymentMethod}
              </button>
            </div>
          </div>
        </Portal>
      ) : null}

      {/* currency dropdown */}
      {curOpen ? (
        <Portal>
          <div dir={ar ? 'rtl' : 'ltr'} className="fixed inset-0 z-[110]" style={{ animation: 'efFade .18s ease' }}>
            <button
              type="button"
              aria-label={t.common.close}
              onClick={() => setCurOpen(false)}
              className="absolute inset-0 border-none bg-black/55"
            />
            <div
              className={`${SHEET_SURFACE} px-4 pt-2.5 pb-[22px]`}
              style={{
                animation: 'efUp .28s cubic-bezier(.22,1,.36,1)',
                fontFamily: ar ? 'var(--font-sans-ar)' : 'var(--font-sans)',
              }}
            >
              <div className="mx-auto mt-0.5 mb-2.5 h-1 w-10 rounded-full bg-[var(--color-brand-border)]" />
              <div className="flex items-center justify-between px-1 pb-2">
                <div className="text-[16px] font-semibold text-[var(--color-brand-text-primary)]">{t.expenseForm.currencyTitle}</div>
                <button
                  type="button"
                  onClick={() => setCurOpen(false)}
                  aria-label={t.common.close}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-brand-elevated)] p-2 text-[var(--color-brand-text-muted)]"
                >
                  {IcClose}
                </button>
              </div>
              <div className={`flex max-h-[352px] flex-col gap-0.5 overflow-y-auto ${HIDE_SCROLL}`}>
                {FIAT_CURRENCIES.map((code) => {
                  const on = code === currency
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        setCurrency(code)
                        setCurOpen(false)
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl border p-3 transition-all"
                      style={{
                        borderColor: on ? rgba('#E50914', 0.4) : 'transparent',
                        background: on ? 'rgba(229,9,20,.07)' : 'transparent',
                      }}
                    >
                      <span className="w-[46px] text-start text-[15px] font-bold font-mono-numbers text-[var(--color-brand-text-primary)]">{code}</span>
                      <span className="flex-1 text-start text-[13px] font-medium text-[var(--color-brand-text-muted)]">
                        {t.expenseForm.currencyNames[code] ?? code}
                      </span>
                      {on ? <Check className="w-[19px] h-[19px] shrink-0 text-[var(--color-brand-red)]" /> : null}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </Portal>
      ) : null}

      {/* add payment method */}
      {addPayOpen ? (
        <Portal>
          <div dir={ar ? 'rtl' : 'ltr'} className="fixed inset-0 z-[120]" style={{ animation: 'efFade .18s ease' }}>
            <button
              type="button"
              aria-label={t.common.close}
              onClick={() => setAddPayOpen(false)}
              className="absolute inset-0 border-none bg-black/60"
            />
            <div
              className={`${SHEET_SURFACE} px-5 pt-2.5 pb-[22px]`}
              style={{
                animation: 'efUp .28s cubic-bezier(.22,1,.36,1)',
                fontFamily: ar ? 'var(--font-sans-ar)' : 'var(--font-sans)',
              }}
            >
              <div className="mx-auto mt-0.5 mb-3 h-1 w-10 rounded-full bg-[var(--color-brand-border)]" />
              <div className="mb-4 flex items-center justify-between">
                <div className="text-[17px] font-semibold text-[var(--color-brand-text-primary)]">{t.expenseForm.addPaymentMethod}</div>
                <button
                  type="button"
                  onClick={() => setAddPayOpen(false)}
                  aria-label={t.common.close}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-brand-elevated)] p-2 text-[var(--color-brand-text-muted)]"
                >
                  {IcClose}
                </button>
              </div>
              <div className="flex flex-col gap-[15px]">
                <div>
                  <div className={`${microLabel} mb-[7px]`}>{t.expenseForm.name}</div>
                  <input
                    value={apName}
                    onChange={(e) => setApName(e.target.value)}
                    placeholder={t.expenseForm.namePlaceholder}
                    className={INPUT}
                  />
                </div>
                <div>
                  <div className={`${microLabel} mb-[9px]`}>{t.expenseForm.type}</div>
                  <div className={`flex gap-[7px] overflow-x-auto ${HIDE_SCROLL}`}>
                    {ADD_PAY_TYPES.map((ty) => {
                      const on = apType === ty
                      return (
                        <button
                          key={ty}
                          type="button"
                          onClick={() => setApType(ty)}
                          aria-pressed={on}
                          className="shrink-0 whitespace-nowrap rounded-full border px-[13px] py-2 text-[12px] font-semibold transition-all"
                          style={
                            on
                              ? { background: 'var(--color-brand-red)', borderColor: 'var(--color-brand-red)', color: '#fff' }
                              : {
                                  background: 'var(--color-brand-elevated)',
                                  borderColor: 'var(--color-brand-border)',
                                  color: 'var(--color-brand-text-muted)',
                                }
                          }
                        >
                          {t.expenseForm.paymentTypeLabels[ty]}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div
                  className="grid gap-3"
                  style={{ gridTemplateColumns: LAST4_TYPES.includes(apType) ? '1fr 1fr' : '1fr' }}
                >
                  <div>
                    <div className={`${microLabel} mb-[7px]`}>{t.expenseForm.currency}</div>
                    <button
                      type="button"
                      onClick={() => {
                        const i = FIAT_CURRENCIES.indexOf(apCurrency)
                        setApCurrency(FIAT_CURRENCIES[(i + 1) % FIAT_CURRENCIES.length])
                      }}
                      className="flex h-12 w-full items-center justify-between rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3.5 text-[15px] font-semibold text-[var(--color-brand-text-primary)]"
                    >
                      {apCurrency}
                      <ChevronDown className="w-[15px] h-[15px] text-[var(--color-brand-text-muted)]" />
                    </button>
                  </div>
                  {LAST4_TYPES.includes(apType) ? (
                    <div>
                      <div className={`${microLabel} mb-[7px]`}>{t.expenseForm.last4}</div>
                      <input
                        value={apLast4}
                        onChange={(e) => setApLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        dir="ltr"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="0001"
                        className={`${INPUT} font-medium font-mono-numbers`}
                      />
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-[14px] font-medium text-[var(--color-brand-text-secondary)]">{t.expenseForm.setDefault}</span>
                  <button
                    type="button"
                    onClick={() => setApDefault((v) => !v)}
                    role="switch"
                    aria-checked={apDefault}
                    aria-label={t.expenseForm.setDefault}
                    className="relative h-[26px] w-[44px] rounded-full border-none transition-colors"
                    style={{ background: apDefault ? 'var(--color-brand-red)' : 'var(--color-brand-border)' }}
                  >
                    <span
                      className="absolute top-[3px] h-5 w-5 rounded-full bg-white transition-transform start-[3px]"
                      style={{ transform: apDefault ? (ar ? 'translateX(-18px)' : 'translateX(18px)') : 'translateX(0)' }}
                    />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={saveAddPayment}
                  disabled={!apName.trim()}
                  className="mt-1 h-12 w-full rounded-xl bg-[var(--color-brand-red)] text-[15px] font-semibold text-white hover:bg-[var(--color-brand-red-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t.expenseForm.addPaymentMethod}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      ) : null}

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
            className="fixed inset-0 z-[125] flex items-center justify-center p-[26px]"
            style={{ animation: 'efFade .16s ease' }}
          >
            <button
              type="button"
              aria-label={t.common.close}
              onClick={() => setConfirmOpen(false)}
              className="absolute inset-0 border-none bg-black/[0.68]"
            />
            <div
              className="relative w-full max-w-[300px] rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-5 pt-[22px] pb-[18px] text-start"
              style={{
                boxShadow: '0 24px 60px -12px rgba(0,0,0,.4)',
                animation: 'efPop .22s cubic-bezier(.22,1,.36,1)',
                fontFamily: ar ? 'var(--font-sans-ar)' : 'var(--font-sans)',
              }}
            >
              <div className="text-[17px] font-semibold text-[var(--color-brand-text-primary)]">{t.expenseForm.confirmTitle}</div>
              <div className="mt-2 text-[13.5px] font-normal leading-[1.45] text-[var(--color-brand-text-muted)]">
                {t.expenseForm.confirmBody}
              </div>
              <div className="mt-5 flex flex-col gap-[9px]">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmOpen(false)
                    onSubmit()
                  }}
                  className="h-12 rounded-xl bg-[var(--color-brand-red)] text-[15px] font-semibold text-white hover:bg-[var(--color-brand-red-hover)]"
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
                  className="h-12 rounded-xl border border-[var(--color-brand-border)] bg-transparent text-[15px] font-semibold text-[var(--color-brand-red)] hover:bg-[var(--color-brand-elevated)]"
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
