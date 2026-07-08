'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, X, Plus, Check } from 'lucide-react'
import type { PaymentMethod } from '@/lib/store/types'
import { paymentTypeIcon } from '@/lib/constants/categoryGrid'
import { defaultColorForPaymentMethodType } from '@/lib/payment/paymentMethodDefaults'
import { rgba } from '@/lib/utils/color'
import { useT, useLocale } from '@/lib/i18n'

const HIDE_SCROLL = '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
const SHEET_SURFACE =
  'absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-[var(--color-brand-border)] bg-[var(--color-brand-card)]'

function swatchColor(pm: PaymentMethod): string {
  return pm.color || defaultColorForPaymentMethodType(pm.type, pm.name)
}

function Portal({ children }: { children: React.ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}

export interface PaymentMethodPickerProps {
  /** Selected payment method id. */
  value: string
  onChange: (id: string) => void
  paymentMethods: PaymentMethod[]
  /** Opens the host's "add payment method" flow (expense sheet overlay, income modal, …). */
  onAddNew: () => void
  /** Optional uppercase micro-label above the trigger. */
  label?: string
}

/**
 * Shared payment-method trigger + bottom-sheet dropdown. Manages its own open
 * state and closes when the selection changes (covers add-then-select). Used by
 * the expense sheet and the income add/edit modals.
 */
export function PaymentMethodPicker({
  value,
  onChange,
  paymentMethods,
  onAddNew,
  label,
}: PaymentMethodPickerProps) {
  const t = useT()
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const [open, setOpen] = useState(false)

  const selPay = paymentMethods.find((m) => m.id === value) || paymentMethods[0]
  const paySub = (m: PaymentMethod) =>
    `${t.expenseForm.paymentTypeLabels[m.type]} · ${m.currency}${m.last4 ? ` · ··${m.last4}` : ''}`
  const IcClose = <X className="w-full h-full" strokeWidth={2} />
  const microLabel = 'font-semibold text-[10px] tracking-[.08em] uppercase text-[var(--color-brand-text-muted)]'

  return (
    <div>
      {label ? <div className={`${microLabel} mb-2.5`}>{label}</div> : null}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-12 w-full items-center justify-between gap-2 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 hover:border-[var(--color-brand-text-muted)]"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {selPay ? (
            <>
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{ background: rgba(swatchColor(selPay), 0.16), color: swatchColor(selPay) }}
              >
                {(() => {
                  const Icon = paymentTypeIcon(selPay.type)
                  return <Icon className="w-[15px] h-[15px]" />
                })()}
              </span>
              <span className="min-w-0 truncate text-start text-sm font-semibold text-[var(--color-brand-text-primary)]">
                {selPay.name}
              </span>
              <span className="shrink-0 text-xs font-medium text-[var(--color-brand-text-muted)]">
                {selPay.currency}
                {selPay.last4 ? ` · ··${selPay.last4}` : ''}
              </span>
            </>
          ) : (
            <span className="text-sm font-medium text-[var(--color-brand-text-muted)]">
              {t.expenseForm.addPaymentMethod}
            </span>
          )}
        </div>
        <ChevronDown className="w-5 h-5 shrink-0 text-[var(--color-brand-text-muted)]" />
      </button>

      {open ? (
        <Portal>
          <div dir={ar ? 'rtl' : 'ltr'} className="fixed inset-0 z-[110]" style={{ animation: 'efFade .18s ease' }}>
            <button
              type="button"
              aria-label={t.common.close}
              onClick={() => setOpen(false)}
              className="absolute inset-0 border-none bg-black/55"
            />
            <div
              className={`${SHEET_SURFACE} px-4 pt-2.5 pb-6`}
              style={{
                animation: 'efUp .28s cubic-bezier(.22,1,.36,1)',
                fontFamily: ar ? 'var(--font-sans-ar)' : 'var(--font-sans)',
              }}
            >
              <div className="mx-auto mt-0.5 mb-2.5 h-1 w-10 rounded-full bg-[var(--color-brand-border)]" />
              <div className="flex items-center justify-between px-1 pb-2">
                <div className="text-base font-semibold text-[var(--color-brand-text-primary)]">
                  {t.expenseForm.paymentTitle}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={t.common.close}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-brand-elevated)] p-3 text-[var(--color-brand-text-muted)]"
                >
                  {IcClose}
                </button>
              </div>
              <div className={`flex max-h-80 flex-col gap-1 overflow-y-auto ${HIDE_SCROLL}`}>
                {paymentMethods.map((m) => {
                  const on = m.id === value
                  const Icon = paymentTypeIcon(m.type)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        onChange(m.id)
                        setOpen(false)
                      }}
                      className="flex w-full items-center gap-3 rounded-xl border p-[10px_12px] transition-all"
                      style={{
                        borderColor: on ? rgba('#E50914', 0.4) : 'transparent',
                        background: on ? 'rgba(229,9,20,.07)' : 'transparent',
                      }}
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                        style={{ background: rgba(swatchColor(m), 0.16), color: swatchColor(m) }}
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <div className="min-w-0 flex-1 text-start">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-[var(--color-brand-text-primary)]">
                            {m.name}
                          </span>
                          {m.isDefault ? (
                            <span className="shrink-0 rounded-sm bg-[var(--color-brand-elevated)] px-1.5 py-0.5 text-xs font-semibold uppercase tracking-[.05em] text-[var(--color-brand-text-muted)]">
                              {t.expenseForm.defaultBadge}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-px text-xs font-medium text-[var(--color-brand-text-muted)]">{paySub(m)}</div>
                      </div>
                      {on ? <Check className="w-5 h-5 shrink-0 text-[var(--color-brand-red)]" /> : null}
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  onAddNew()
                }}
                className="mt-2 flex h-12 w-full items-center gap-2.5 rounded-xl border border-[rgba(229,9,20,.28)] bg-[rgba(229,9,20,.08)] px-3.5 text-sm font-semibold text-[var(--color-brand-red)] hover:bg-[rgba(229,9,20,.14)]"
              >
                <Plus className="w-5 h-5" />
                {t.expenseForm.addPaymentMethod}
              </button>
            </div>
          </div>
        </Portal>
      ) : null}
    </div>
  )
}
