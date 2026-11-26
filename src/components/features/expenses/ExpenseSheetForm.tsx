'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronRight, Image as ImageIcon, Info, MessageSquare, Receipt, StickyNote, Trash2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import type { Currency, PaymentMethod, SpendExclusion } from '@/lib/store/types'
import { isMethodExcluded } from '@/lib/spending/exclusion'
import { SettingsSwitchRow } from '@/components/features/settings/SettingsSwitchRow'
import { isNonSpendCategory } from '@/lib/constants/categoryMeta'
import { useT, useLocale } from '@/lib/i18n'
import { useFlowLtCopy } from '@/lib/i18n/flowLtCopy'
import { useLightTouchCopy } from '@/lib/i18n/lightTouchCopy'
import { UnifiedDatePicker, formatDatePillLabel } from '@/components/ui/UnifiedDatePicker'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AmountHero } from '@/components/ui/AmountHero'
import { PickerRow } from '@/components/ui/PickerRow'
import { PillButton } from '@/components/ui/PillButton'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { PaymentMethodPicker } from '@/components/features/payments/PaymentMethodPicker'
import { SelectPaymentMethodSheet } from '@/components/features/payments/SelectPaymentMethodSheet'
import { MethodValue } from '@/components/features/expenses/MethodValue'
import { UnsavedChangesDialog } from '@/components/features/expenses/UnsavedChangesDialog'
import { CategoryIcon } from '@/components/dashboard/CategoryIcon'
import { CategoryPickerSheet } from '@/components/features/expenses/CategoryPickerSheet'
import { ReceiptDetailSheet } from '@/components/receipt/ReceiptDetailSheet'
import { ReceiptImageViewer, ReceiptItemRow, receiptMoney, useReceiptImage } from '@/components/receipt/ReceiptParts'
import { useDismissGuard } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { OptionChip } from '@/components/ui/OptionChip'
import { Switch } from '@/components/ui/switch'
import { categoryChipColors } from '@/lib/expenses/categoryChip'
import { categoryBudget } from '@/lib/flow/categoryBudget'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { useShortDate } from '@/hooks/useShortDate'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { getMonthRange } from '@/lib/utils/calculations'
import { mergeDayTime, nowClock } from '@/lib/time/occurredAt'
import { formatClock } from '@/lib/i18n/dateFormat'
import { format } from 'date-fns'
import { tryConvertCurrency } from '@/lib/utils/currency'
import { formatWhole } from '@/lib/utils/formatters'

const HIDE_SCROLL = '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
const BOX = 'rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]'

function Portal({ children }: { children: React.ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}

/** Where an expense came from, for the "Recorded from" row. */
export interface ExpenseOrigin {
  kind: 'sms' | 'receipt' | 'manual'
  /** The bank that sent the message. */
  bank?: string
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
  /** Leave this out of spending, or mark it as paid for someone who owes it back. */
  exclusion: { value: SpendExclusion | undefined; setValue: (v: SpendExclusion | undefined) => void; owedBy: string; setOwedBy: (v: string) => void }
  submitError?: string
  paymentMethods: PaymentMethod[]
  creditCardOutstandingHint: { cardName: string; amountLabel: string } | null
  onSubmit: () => void
  onClose: () => void
  /** Edit-only: true when the form differs from the loaded snapshot. */
  isDirty?: boolean
  /** Edit-only: revert every field to the loaded snapshot. */
  onDiscard?: () => void
  /** The time of day (`HH:mm`, '' for none), shown after the date in the pill and edited in the date card. */
  clock: string
  setClock: (v: string) => void
  /** Edit-only: set when this expense was reversed — shows a charged/refunded line. */
  refundedAt?: string
  refundKind?: 'refunded' | 'declined'
  /** Edit-only: someone repaid what was paid for them. */
  onMarkRepaid?: () => void
  owedSettled?: boolean
  /** Edit-only: the scanned receipt behind this expense; its own section shows only when it exists. */
  receiptId?: string
  /** Edit-only: the bin in the header (the swipe on the row is not reachable by keyboard or screen reader). */
  onDelete?: () => void | Promise<boolean>
  /** Edit-only: the "Recorded from" row. */
  origin?: ExpenseOrigin
  /** Edit-only: the saved category and amount in base currency, already inside this month's budget totals. */
  saved?: { category: string; amountBase: number }
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
    /** Why the split cannot be saved yet; shown in the card. */
    error?: string
  }
}

/** The receipt as its own section: the first lines, what is left, the total, and the photo and full list one tap away. */
function ReceiptSection({ receiptId, onOpen }: { receiptId: string; onOpen: () => void }) {
  const lt = useFlowLtCopy()
  const shortDate = useShortDate()
  const receipt = useFinanceStore((s) => s.receipts.find((r) => r.id === receiptId) ?? null)
  const imgSrc = useReceiptImage(receiptId)
  const [viewing, setViewing] = useState(false)
  if (!receipt) return null
  const more = receipt.items.length - 3
  const discount = receipt.charges.filter((c) => c.type === 'discount' || c.amount < 0).reduce((s, c) => s + Math.abs(c.amount), 0)
  const merchant = receipt.merchant
  return (
    <section className={`mx-4 mt-3 overflow-hidden ${BOX}`}>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-4 pb-1.5 pt-3.5 text-start">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]">
          <Receipt className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{lt.expense.receiptItems(receipt.items.length)}</span>
          {merchant ? <span dir="auto" className="block truncate text-xs text-[var(--color-brand-text-secondary)]">{merchant}</span> : null}
        </span>
        <ChevronRight className="size-4 shrink-0 text-[var(--color-brand-text-muted)] rtl:rotate-180" aria-hidden />
      </button>
      <div className="px-4 pb-1">
        {receipt.items.slice(0, 3).map((it, i) => (
          <ReceiptItemRow key={i} item={it} />
        ))}
      </div>
      <div className="mx-4 flex items-center justify-between border-t border-dashed border-[var(--color-brand-border-strong)] py-2.5 text-[0.8125rem]">
        <span className="text-[var(--color-brand-text-muted)]">
          {[more > 0 ? lt.expense.more(more) : null, discount > 0 ? `−${receiptMoney(discount)}` : null].filter(Boolean).join(' · ')}
        </span>
        <b dir="ltr" className="font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">{receiptMoney(receipt.amount)} {receipt.currency}</b>
      </div>
      <div className={`grid border-t border-[var(--color-brand-border)] ${imgSrc ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {imgSrc ? (
          <Button variant="ghost" className="h-11 rounded-none font-semibold text-[var(--color-brand-primary-ink)]" onClick={() => setViewing(true)}>
            <ImageIcon className="size-4" aria-hidden />
            {lt.expense.viewImage}
          </Button>
        ) : null}
        <Button variant="ghost" className={`h-11 rounded-none font-semibold text-[var(--color-brand-primary-ink)] ${imgSrc ? 'border-s border-[var(--color-brand-border)]' : ''}`} onClick={onOpen}>
          <Receipt className="size-4" aria-hidden />
          {lt.expense.allItems(receipt.items.length)}
        </Button>
      </div>
      {imgSrc ? (
        <ReceiptImageViewer
          open={viewing}
          src={imgSrc}
          title={lt.receipt.imageTitle(merchant || lt.receipt.title)}
          sub={lt.receipt.imageSub(shortDate(receipt.receiptDate))}
          onClose={() => setViewing(false)}
        />
      ) : null}
    </section>
  )
}

/**
 * The expense sheet (add and edit), Light touch: the date pill top-left with the bin and close beside it, the amount
 * with its currency inline and the title under it, then one grouped list (Category with budget left, Paid with, where
 * it was recorded from), the receipt when there is one, a slim note, and whether it counts. Leaving with unsaved edits
 * asks to save or discard.
 */
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
    exclusion,
    submitError,
    paymentMethods,
    creditCardOutstandingHint,
    onSubmit,
    onClose,
    isDirty,
    onDiscard,
    clock,
    setClock,
    refundedAt,
    refundKind,
    installment,
    onMarkRepaid,
    owedSettled,
    receiptId,
    onDelete,
    origin,
    saved,
  } = props
  const t = useT()
  const lt = useFlowLtCopy()
  const choose = useLightTouchCopy().moneySource.choose
  const { locale } = useLocale()
  const stats = useMonthlyStats()
  const { base, rates, monthStartDay } = useFinanceStore(
    useShallow((s) => ({ base: s.settings.baseCurrency, rates: s.exchangeRates, monthStartDay: s.settings.monthStartDay })),
  )
  const monthFilter = useSettingsStore((s) => s.monthFilter)

  const [calOpen, setCalOpen] = useState(false)
  const [catOpen, setCatOpen] = useState(false)
  const [methodOpen, setMethodOpen] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const noteRef = useRef<HTMLTextAreaElement>(null)

  // The note grows with what is typed, from one line.
  useLayoutEffect(() => {
    const n = noteRef.current
    if (!n) return
    n.style.height = 'auto'
    n.style.height = `${n.scrollHeight}px`
  }, [notes])

  const nonSpendSelected = isNonSpendCategory(category)
  // A new expense on a not-counted account starts out left out; it can be changed after it is saved.
  const addOnExcludedMethod = mode === 'add' && isMethodExcluded(paymentMethods, paymentMethodId)
  const amountNum = parseFloat(amount)
  const submitDisabled =
    !amount.trim() || Number.isNaN(amountNum) || amountNum <= 0 || !description.trim() || (mode === 'add' && !category)

  const setAmt = (v: string) => {
    if (/^[0-9]*\.?[0-9]*$/.test(v)) setAmount(v)
  }

  // A new expense counts as started once anything is typed into it.
  const unsaved = mode === 'edit' ? Boolean(isDirty) : Boolean(amount.trim() || description.trim() || notes.trim())
  const handleX = () => {
    if (unsaved) setConfirmOpen(true)
    else onClose()
  }

  // Escape, backdrop tap, swipe-down and Android back take the same unsaved-changes route as the X button.
  useDismissGuard(() => {
    if (confirmOpen) {
      setConfirmOpen(false)
      return true
    }
    if (unsaved) {
      setConfirmOpen(true)
      return true
    }
    return false
  })

  const handleDelete = async () => {
    if (!onDelete || deleting) return
    setDeleting(true)
    const done = await Promise.resolve(onDelete())
    if (done === false) setDeleting(false)
  }

  // "Counted in your Food budget · 590 left": this month's budget for the category, after this expense. An edit gives
  // its saved amount back first, since the month's totals already hold it.
  const method = paymentMethods.find((m) => m.id === paymentMethodId)
  const excluded = exclusion.value !== undefined || addOnExcludedMethod || Boolean(refundKind)
  // Only an expense dated in the current cycle changes what is left this month.
  const cycle = getMonthRange(monthFilter, monthStartDay)
  const inCycle = date >= format(cycle.start, 'yyyy-MM-dd') && date <= format(cycle.end, 'yyyy-MM-dd')
  const amountBase = Number.isFinite(amountNum) && amountNum > 0 ? tryConvertCurrency(amountNum, currency, base, rates) ?? 0 : 0
  const budget = category && !nonSpendSelected ? categoryBudget(category, stats.categoryBudgetCaps, stats.categorySpending) : null
  const giveBack = budget && saved && categoryBudget(saved.category, stats.categoryBudgetCaps, {})?.row === budget.row ? saved.amountBase : 0
  const leftAfter = budget ? budget.left + giveBack - (inCycle ? amountBase : 0) : 0
  const catName = (c: string) => t.expenseForm.categoryLabels[c] ?? c
  const budgetLine = !category
    ? ''
    : nonSpendSelected
      ? lt.expense.moneyMove
      : excluded
        ? lt.expense.notCounted
        : !budget
          ? lt.expense.noBudget(catName(category))
          : !inCycle
            ? lt.expense.counted(catName(budget.row))
            : leftAfter >= 0
            ? lt.expense.budgetLeft(catName(budget.row), formatWhole(leftAfter))
            : lt.expense.budgetOver(catName(budget.row), formatWhole(-leftAfter))
  const conversion = currency !== base && amountBase > 0 ? `≈ ${formatWhole(amountBase)} ${base}` : undefined
  const colors = category ? categoryChipColors(category) : null
  // A new expense shows the current time until one is picked; an edit shows its stored time (none for a row with none).
  const shownClock = clock || (mode === 'add' ? nowClock() : '')
  const clockAt = mergeDayTime(date, shownClock)
  const datePill = `${formatDatePillLabel(date, locale, t.expenseForm.today)}${clockAt ? ` · ${formatClock(new Date(clockAt), locale)}` : ''}`
  const originValue = origin
    ? origin.kind === 'receipt'
      ? <><Receipt className="size-4 shrink-0 text-[var(--color-brand-text-muted)]" aria-hidden />{lt.expense.fromReceipt}</>
      : origin.kind === 'sms'
        ? <><MessageSquare className="size-4 shrink-0 text-[var(--color-brand-text-muted)]" aria-hidden /><span className="truncate">{origin.bank ? lt.expense.fromSms(origin.bank) : lt.expense.fromSmsPlain}</span></>
        : lt.expense.fromYou
    : null

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col outline-none">
        {/* header — ModalShell renders the drag handle above this. The sheet's name stays for screen readers. */}
        <V3SheetHeader
          onClose={handleX}
          leading={
            <PillButton icon={<Calendar />} onClick={() => setCalOpen(true)} aria-haspopup="dialog" aria-expanded={calOpen} className="h-9 border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] font-semibold">
              <span dir="auto">{datePill}</span>
            </PillButton>
          }
          actions={onDelete ? <V3SheetHeader.Action icon={<Trash2 size={16} />} label={lt.expense.deleteAria} tone="danger" onClick={() => void handleDelete()} /> : undefined}
        >
          <span className="sr-only">
            <V3SheetHeader.Title>{mode === 'edit' ? t.expenseForm.titleEdit : t.expenseForm.titleAdd}</V3SheetHeader.Title>
          </span>
        </V3SheetHeader>

        {/* body */}
        <div className={`min-h-0 flex-1 overflow-y-auto pb-4 ${HIDE_SCROLL}`}>
          <AmountHero
            id="ef-amount"
            value={amount}
            onChange={setAmt}
            currency={currency}
            onCurrencyChange={(c) => setCurrency(c as Currency)}
            base={base}
            sign="−"
            top={
              colors ? (
                <span aria-hidden className="flex size-[52px] items-center justify-center rounded-[16px]" style={{ background: colors.bg, color: colors.fg }}>
                  <CategoryIcon category={category} className="size-6" />
                </span>
              ) : undefined
            }
            line={conversion ?? ''}
            className="pb-0"
          />
          <div className="flex flex-col items-center px-5 pb-5 text-center">
            <input
              id="ef-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              // Some Android IMEs (e.g. Gboard Arabic) only fire `input`/onChange when the composition commits; sync
              // mid-composition so the submit gate reflects the typed word live.
              onCompositionUpdate={(e) => setDescription(e.currentTarget.value)}
              onCompositionEnd={(e) => setDescription(e.currentTarget.value)}
              aria-label={t.expenseForm.description}
              placeholder={t.expenseForm.descriptionPlaceholder}
              enterKeyHint="next"
              maxLength={120}
              dir="auto"
              className="w-full bg-transparent text-center text-[1.0625rem] font-semibold text-[var(--color-brand-text-primary)] outline-none placeholder:text-[var(--color-brand-text-muted)]"
            />
            {budgetLine ? (
              <p className={`mt-1 text-[0.8125rem] ${budget && inCycle && leftAfter < 0 && !excluded ? 'text-[var(--color-brand-red)]' : 'text-[var(--color-brand-text-secondary)]'}`} role="status">
                {budgetLine}
              </p>
            ) : null}
          </div>

          {submitError ? <p role="alert" className="mx-5 mb-2 text-xs text-[var(--color-brand-red)]">{submitError}</p> : null}

          <Card padding="none" divide className="mx-4 overflow-hidden rounded-2xl">
            <PickerRow
              label={t.expenseForm.category}
              onClick={() => setCatOpen(true)}
              value={
                category && colors ? (
                  <>
                    <span aria-hidden className="flex size-6 items-center justify-center rounded-[7px]" style={{ background: colors.bg, color: colors.fg }}>
                      <CategoryIcon category={category} className="size-3.5" />
                    </span>
                    <span className="truncate">{catName(category)}</span>
                  </>
                ) : (
                  <span className="text-[var(--color-brand-text-muted)]">{choose}</span>
                )
              }
            />
            <PickerRow
              label={lt.filters.paidWith}
              onClick={() => setMethodOpen(true)}
              value={method ? <MethodValue method={method} /> : <span className="text-[var(--color-brand-text-muted)]">{choose}</span>}
            />
            {originValue ? <PickerRow label={lt.expense.recordedFrom} value={<span className="inline-flex min-w-0 items-center gap-1.5">{originValue}</span>} /> : null}
          </Card>

          {nonSpendSelected ? (
            <div className={`mx-4 mt-3 flex items-start gap-2.5 px-3 py-2.5 ${BOX}`}>
              <Info className="mt-px size-4 shrink-0 text-[var(--color-brand-text-muted)]" aria-hidden />
              <span className="text-start text-xs font-medium leading-[1.4] text-[var(--color-brand-text-secondary)]">{t.expenseForm.nonSpendHint}</span>
            </div>
          ) : null}

          {creditCardOutstandingHint ? (
            <p className="mx-5 mt-2 text-xs leading-snug text-[var(--color-brand-text-muted)]" role="status">
              ⓘ{' '}
              {t.addExpense.creditCardOutstandingHint(creditCardOutstandingHint.cardName, creditCardOutstandingHint.amountLabel)}
            </p>
          ) : null}

          {/* BNPL: split this purchase into an installment plan */}
          {mode === 'add' && installment?.isBnplPurchase ? (
            <div className={`mx-4 mt-3 p-4 ${BOX}`}>
              <div className="flex w-full items-center justify-between">
                <span className="text-sm font-medium text-[var(--color-brand-text-primary)]">{t.expenseForm.splitInstallments}</span>
                <Switch size="touch" aria-label={t.expenseForm.splitInstallments} checked={installment.enabled} onCheckedChange={installment.setEnabled} />
              </div>
              {installment.enabled ? (
                <div className="mt-3 space-y-3">
                  <div className="flex gap-2">
                    {[3, 4, 6, 12].map((n) => (
                      <OptionChip key={n} size="segment" selected={installment.count === n} onClick={() => installment.setCount(n)}>
                        {n}
                      </OptionChip>
                    ))}
                  </div>
                  <p className="font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">
                    {installment.count} × {((parseFloat(amount) || 0) / installment.count).toFixed(2)} {currency} {t.expenseForm.installmentEach}
                  </p>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-[var(--color-brand-text-muted)]">{t.expenseForm.installmentFirstDue}</span>
                    <DatePickerField value={installment.firstDue} onChange={installment.setFirstDue} />
                  </label>
                  <PaymentMethodPicker
                    value={installment.fundingMethodId}
                    onChange={installment.setFundingMethodId}
                    paymentMethods={paymentMethods.filter((m) => m.type !== 'bnpl')}
                    label={t.expenseForm.installmentPayFrom}
                  />
                  {installment.error ? <p role="alert" className="text-xs text-[var(--color-brand-red)]">{installment.error}</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* reversal audit line — charged vs refunded/declined date */}
          {refundKind ? (
            <div className="mx-5 mt-3 flex items-center gap-1.5 text-xs text-[var(--color-brand-text-muted)]">
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

          {receiptId ? <ReceiptSection receiptId={receiptId} onOpen={() => setReceiptOpen(true)} /> : null}

          {/* note: one slim line that grows */}
          <label className={`mx-4 mt-3 flex min-h-12 items-start gap-3 px-4 py-3 ${BOX}`}>
            <StickyNote className="mt-[3px] size-[18px] shrink-0 text-[var(--color-brand-text-muted)]" aria-hidden />
            <textarea
              ref={noteRef}
              rows={1}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              aria-label={t.expenseForm.addNote}
              placeholder={t.expenseForm.notePlaceholder}
              dir="auto"
              className="block min-h-6 w-full resize-none overflow-hidden bg-transparent text-[0.9375rem] leading-6 text-[var(--color-brand-text-primary)] outline-none placeholder:text-[var(--color-brand-text-muted)]"
            />
          </label>

          {!nonSpendSelected ? (
            <div className="mx-4 mt-3 space-y-2">
              <div className={`divide-y divide-[var(--color-brand-border)] overflow-hidden ${BOX}`}>
                {addOnExcludedMethod ? (
                  <SettingsSwitchRow label={t.exclusion.expenseTitle} hint={t.exclusion.reasonMethod} checked disabled onChange={() => {}} />
                ) : (
                  <SettingsSwitchRow
                    label={t.exclusion.expenseTitle}
                    hint={t.exclusion.expenseHint}
                    checked={exclusion.value !== undefined}
                    onChange={(v) => exclusion.setValue(v ? 'manual' : undefined)}
                  />
                )}
                {exclusion.value !== undefined ? (
                  <SettingsSwitchRow
                    label={t.exclusion.forSomeone}
                    hint={t.exclusion.forSomeoneHint}
                    checked={exclusion.value === 'for_someone'}
                    onChange={(v) => exclusion.setValue(v ? 'for_someone' : 'manual')}
                  />
                ) : null}
              </div>
              {exclusion.value === 'for_someone' && onMarkRepaid ? (
                owedSettled ? (
                  <p className="text-xs font-medium text-[var(--color-brand-green)]">{t.exclusion.badgeRepaid}</p>
                ) : (
                  <Button variant="outline" size="touch" className="w-full" onClick={onMarkRepaid}>{t.exclusion.markRepaid}</Button>
                )
              ) : null}
              {exclusion.value === 'for_someone' ? (
                <Input
                  value={exclusion.owedBy}
                  onChange={(e) => exclusion.setOwedBy(e.target.value)}
                  placeholder={t.exclusion.owedByPlaceholder}
                  aria-label={t.exclusion.owedByLabel}
                  size="brand"
                  maxLength={60}
                />
              ) : null}
            </div>
          ) : null}
        </div>

        {/* footer */}
        <div className="sheet-cta shrink-0 border-t border-[var(--color-brand-border)] px-4 pb-6 pt-3">
          {submitDisabled ? (
            <p className="mb-2 text-center text-xs font-medium text-[var(--color-brand-text-muted)]" role="status">
              {!amount.trim() || Number.isNaN(amountNum) || amountNum <= 0
                ? t.expenseForm.cueAmount
                : !description.trim()
                  ? t.expenseForm.cueDescription
                  : t.expenseForm.cueCategory}
            </p>
          ) : null}
          <Button type="button" onClick={onSubmit} disabled={submitDisabled} size="cta-block" className="font-semibold">
            {mode === 'edit' ? t.expenseForm.saveChanges : t.expenseForm.saveExpense}
          </Button>
        </div>
      </div>

      {/* ===== overlays (portalled above the sheet) ===== */}
      <CategoryPickerSheet open={catOpen} value={category} onChange={setCategory} onClose={() => setCatOpen(false)} own={saved} />
      <SelectPaymentMethodSheet
        open={methodOpen}
        value={paymentMethodId}
        paymentMethods={paymentMethods}
        onSelect={setPaymentMethodId}
        onClose={() => setMethodOpen(false)}
      />
      {receiptId ? <ReceiptDetailSheet receiptId={receiptId} open={receiptOpen} onClose={() => setReceiptOpen(false)} zIndexClassName="z-[120]" /> : null}

      {calOpen ? (
        <Portal>
          <UnifiedDatePicker
            open
            value={date}
            onConfirm={(iso) => setDate(iso)}
            time={{ value: shownClock, label: lt.expense.time }}
            onConfirmDateTime={(iso, hm) => {
              setDate(iso)
              setClock(hm)
            }}
            onClose={() => setCalOpen(false)}
          />
        </Portal>
      ) : null}

      {/* save / discard: an edit, or a new expense with something typed in. Save on a new one that is not complete
          yet keeps the sheet open on the cue line. */}
      <UnsavedChangesDialog
        open={confirmOpen}
        body={mode === 'edit' ? t.expenseForm.confirmBody : lt.expense.unsavedAddBody}
        saveLabel={mode === 'edit' ? t.expenseForm.saveChanges : t.expenseForm.saveExpense}
        onSave={() => {
          setConfirmOpen(false)
          onSubmit()
        }}
        onDiscard={() => {
          onDiscard?.()
          setConfirmOpen(false)
          onClose()
        }}
        onKeep={() => setConfirmOpen(false)}
      />
    </>
  )
}

