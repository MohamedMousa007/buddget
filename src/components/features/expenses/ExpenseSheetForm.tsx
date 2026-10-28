'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, X, Plus, Info, ArrowLeftRight } from 'lucide-react'
import type { Currency, PaymentMethod, SpendExclusion } from '@/lib/store/types'
import { isMethodExcluded } from '@/lib/spending/exclusion'
import { SettingsSwitchRow } from '@/components/features/settings/SettingsSwitchRow'
import { EXPENSE_CATEGORY_GRID } from '@/lib/constants/categoryGrid'
import { isNonSpendCategory } from '@/lib/constants/categoryMeta'
import { useT, useLocale } from '@/lib/i18n'
import { UnifiedDatePicker, formatDatePillLabel } from '@/components/ui/UnifiedDatePicker'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { CurrencyField } from '@/components/ui/CurrencyField'
import { PaymentMethodPicker } from '@/components/features/payments/PaymentMethodPicker'
import { cn } from '@/lib/utils'
import { rgba } from '@/lib/utils/color'
import { useIsNativeClient } from '@/lib/native/useIsNativeClient'
import { AmountTextInput } from '@/components/ui/AmountTextInput'
import { useNumberPad } from '@/components/ui/useNumberPad'
import { Scrim } from '@/components/ui/Scrim'
import { useModalTitleId } from '@/components/modals/ModalShell'
import { IconButton } from '@/components/ui/IconButton'
import { OptionChip } from '@/components/ui/OptionChip'
import { FieldButton } from '@/components/ui/FieldButton'
import { Switch } from '@/components/ui/switch'
import { AccentTile, accentTileGridClass, accentTileGridStyle } from '@/components/ui/AccentTile'

const HIDE_SCROLL = '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'


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
  /** Edit-only: set when this expense was reversed — shows a charged/refunded line. */
  refundedAt?: string
  refundKind?: 'refunded' | 'declined'
  /** Edit-only: someone repaid what was paid for them. */
  onMarkRepaid?: () => void
  owedSettled?: boolean
  /** Edit-only: set when the expense came from a scanned receipt — opens its breakdown and photo. */
  onViewReceipt?: () => void
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
    refundedAt,
    refundKind,
    installment,
    onMarkRepaid,
    owedSettled,
    onViewReceipt,
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
  // A new expense on a not-counted account starts out left out; it can be changed after it is saved.
  const addOnExcludedMethod = mode === 'add' && isMethodExcluded(paymentMethods, paymentMethodId)
  const amountNum = parseFloat(amount)
  const submitDisabled =
    !amount.trim() || Number.isNaN(amountNum) || amountNum <= 0 || !description.trim()

  const setAmt = (v: string) => {
    if (/^[0-9]*\.?[0-9]*$/.test(v)) setAmount(v)
  }

  const native = useIsNativeClient()
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
            <div id={useModalTitleId()} className="font-heading text-lg font-bold text-[var(--color-brand-text-primary)]">
              {mode === 'edit' ? t.expenseForm.titleEdit : t.expenseForm.titleAdd}
            </div>
            <div className="flex items-center gap-2">
              <OptionChip
                as="trigger"
                size="sm"
                onClick={() => setCalOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={calOpen}
              >
                <Calendar className="size-3.5 text-[var(--color-brand-text-muted)]" />
                {formatDatePillLabel(date, locale, t.expenseForm.today)}
              </OptionChip>
              <IconButton
                onClick={handleX}
                aria-label={t.common.close}
                variant="tinted"
                shape="round"
              >
                <X strokeWidth={2} />
              </IconButton>
            </div>
          </div>
        </div>

        {/* body */}
        <div className={`min-h-0 flex-1 overflow-y-auto px-5 pt-3.5 pb-1.5 flex flex-col gap-3.5 ${HIDE_SCROLL}`}>
          {/* amount + currency */}
          <div className="grid grid-cols-[1fr_108px] gap-3 items-end">
            <div>
              <label htmlFor="ef-amount" className={`block ${microLabel} mb-2`}>{t.expenseForm.amount}</label>
              {native ? (
                <FieldButton
                  id="ef-amount"
                  onClick={amountPad.openPad}
                  dir="ltr"
                  value={amount || undefined}
                  placeholder="0.00"
                  affordance={null}
                  valueClassName="font-mono-numbers text-2xl font-bold tracking-[-0.02em]"
                  className={`bg-[var(--color-brand-elevated)] ${amountPad.isOpen ? 'border-[var(--color-brand-primary)]' : ''}`}
                />
              ) : (
                <AmountTextInput
                  id="ef-amount"
                  value={amount}
                  onChange={setAmount}
                  currency={currency}
                  placeholder="0.00"
                  dir="ltr"
                  className="h-12 w-full min-w-0 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3.5 text-start font-mono-numbers text-2xl font-bold tracking-[-0.02em] text-[var(--color-brand-text-primary)] outline-none placeholder:text-[var(--color-brand-text-muted)] focus-visible:border-[var(--color-brand-focus)] focus-visible:ring-3 focus-visible:ring-[var(--color-brand-focus)]/50"
                />
              )}
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
            <Input
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
              size="brand"
            />
          </div>

          {submitError ? <p className="text-xs text-[var(--color-brand-red)]">{submitError}</p> : null}

          {/* category grid */}
          <div>
            <div className={`${microLabel} mb-2.5`}>{t.expenseForm.category}</div>
            <div className="-mx-5 px-5">
              <div ref={catRef} onScroll={onCatScroll} className={`overflow-x-auto pb-0.5 ${HIDE_SCROLL}`}>
                <div
                  role="radiogroup"
                  aria-label={t.expenseForm.category}
                  className={accentTileGridClass}
                  style={accentTileGridStyle}
                >
                  {EXPENSE_CATEGORY_GRID.map((c) => {
                    const Icon = c.icon
                    return (
                      <AccentTile
                        key={c.id}
                        accent={c.accent}
                        selected={c.id === category}
                        dashed={c.nonspend}
                        onClick={() => setCategory(c.id)}
                        icon={<Icon />}
                        label={t.expenseForm.categoryLabels[c.id] ?? c.id}
                        badge={c.nonspend ? (
                          <span className="absolute end-1.5 top-1.5 inline-flex h-3.5 w-3.5 text-[var(--color-brand-text-muted)]">
                            <ArrowLeftRight className="h-full w-full" strokeWidth={2.4} />
                          </span>
                        ) : null}
                      />
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
              <Card
                variant="elevated"
                radius="sm"
                padding="none"
                className="mt-3 flex items-start gap-2.5 px-3 py-2.5"
              >
                <Info className="mt-px w-4 h-4 shrink-0 text-[var(--color-brand-text-muted)]" />
                <span className="text-start text-xs font-medium leading-[1.4] text-[var(--color-brand-text-secondary)]">
                  {t.expenseForm.nonSpendHint}
                </span>
              </Card>
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
            <Card
              variant="elevated"
              radius="sm"
              padding="sm"
              className="bg-[var(--color-brand-elevated)]/40"
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-sm font-medium text-[var(--color-brand-text-primary)]">
                  {t.expenseForm.splitInstallments}
                </span>
                <Switch
                  size="touch"
                  aria-label={t.expenseForm.splitInstallments}
                  checked={installment.enabled}
                  onCheckedChange={installment.setEnabled}
                />
              </div>
              {installment.enabled ? (
                <div className="mt-3 space-y-3">
                  <div className="flex gap-2">
                    {[3, 4, 6, 12].map((n) => (
                      <OptionChip
                        key={n}
                        size="segment"
                        selected={installment.count === n}
                        onClick={() => installment.setCount(n)}
                      >
                        {n}
                      </OptionChip>
                    ))}
                  </div>
                  <p className="font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">
                    {installment.count} × {((parseFloat(amount) || 0) / installment.count).toFixed(2)} {currency} {t.expenseForm.installmentEach}
                  </p>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-[var(--color-brand-text-muted)]">
                      {t.expenseForm.installmentFirstDue}
                    </span>
                    <Input
                      type="date"
                      value={installment.firstDue}
                      onChange={(e) => installment.setFirstDue(e.target.value)}
                      size="brand" className={cn('rounded-lg px-3 text-sm')}
                    />
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
            </Card>
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

          {onViewReceipt ? (
            <Button variant="outline" size="touch" onClick={onViewReceipt}>{t.receiptDetail.viewReceipt}</Button>
          ) : null}

          {/* note */}
          <div>
            {noteOpen ? (
              <div className="relative">
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t.expenseForm.notePlaceholder}
                  aria-label={t.expenseForm.addNote}
                  size="brand"
                  style={{ paddingBlock: 0, paddingInline: '14px 46px' }}
                />
                <IconButton
                  onClick={() => {
                    setNoteOpen(false)
                    setNotes('')
                  }}
                  aria-label={t.common.close}
                  size="sm"
                  className="absolute end-2 top-1/2 -translate-y-1/2"
                >
                  {IcClose}
                </IconButton>
              </div>
            ) : (
              <Button
                variant="link"
                size="sm"
                onClick={() => setNoteOpen(true)}
                className="self-start font-semibold text-[var(--color-brand-text-secondary)] no-underline hover:text-[var(--color-brand-text-primary)] hover:underline"
              >
                <Plus className="size-3.5" />
                {t.expenseForm.addNote}
              </Button>
            )}
          </div>
          {!nonSpendSelected ? (
            <div className="space-y-2">
              <div className="divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-2xl border border-[var(--color-brand-border)]">
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
                  <Button variant="outline" size="touch" onClick={onMarkRepaid}>{t.exclusion.markRepaid}</Button>
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
          <Button
            type="button"
            onClick={onSubmit}
            disabled={submitDisabled}
            size="cta-block"
            className={`h-14 rounded-2xl text-base font-semibold ${
              submitDisabled
                ? 'cursor-not-allowed bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-muted)] disabled:opacity-100'
                : ''
            }`}
          >
            {mode === 'edit' ? t.expenseForm.saveChanges : t.expenseForm.saveExpense}
          </Button>
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
            <Scrim label={t.common.close} onClick={() => setConfirmOpen(false)} tone="heavy" blur={false} />
            <Card
              padding="none"
              className="relative w-full max-w-72 px-5 pt-6 pb-5 text-start"
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
                <Button
                  type="button"
                  onClick={() => {
                    setConfirmOpen(false)
                    onSubmit()
                  }}
                  size="cta"
                  className="text-base font-semibold"
                >
                  {t.expenseForm.saveChanges}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    onDiscard?.()
                    setConfirmOpen(false)
                    onClose()
                  }}
                  variant="outline"
                  size="cta"
                  className="bg-transparent text-base font-semibold text-[var(--color-brand-red)] hover:bg-[var(--color-brand-elevated)]"
                >
                  {t.expenseForm.discardChanges}
                </Button>
              </div>
            </Card>
          </div>
        </Portal>
      ) : null}
    </>
  )
}
