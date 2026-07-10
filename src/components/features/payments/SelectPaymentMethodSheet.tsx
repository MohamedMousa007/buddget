'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { PaymentCardCarousel } from '@/components/features/payments/PaymentCardCarousel'
import { PaymentMethodSetupSheet } from '@/components/features/payments/PaymentMethodSetupSheet'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import type { PaymentMethod } from '@/lib/store/types'

interface Props {
  open: boolean
  value: string
  paymentMethods: PaymentMethod[]
  onSelect: (id: string) => void
  onClose: () => void
}

/**
 * Payment-method picker sheet — the same swipeable card carousel as the wallet,
 * but for selection: tap the focused card (or the CTA) to choose it. A trailing
 * “+” add tile opens the setup sheet inline (no old add-payment form).
 */
export function SelectPaymentMethodSheet({ open, value, paymentMethods, onSelect, onClose }: Props) {
  const t = useT()
  const baseCurrency = useFinanceStore((s) => s.settings.baseCurrency)
  const [active, setActive] = useState(0)
  const [setupOpen, setSetupOpen] = useState(false)
  const prevOpen = useRef(false)
  useEscapeClose(open, onClose)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- focus the selected card when the sheet opens */
    if (open && !prevOpen.current) {
      const idx = paymentMethods.findIndex((m) => m.id === value)
      setActive(idx >= 0 ? idx : Math.max(0, paymentMethods.findIndex((m) => m.isDefault)))
      setSetupOpen(false)
    }
    prevOpen.current = open
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, value, paymentMethods])

  const choose = (id: string) => { onSelect(id); onClose() }
  const activeIsAdd = active >= paymentMethods.length
  const activeMethod = paymentMethods[Math.min(active, paymentMethods.length - 1)]

  return (
    <>
      <ModalShell open={open} onBackdropClick={onClose} zIndexClassName="z-[110]">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between px-[18px] pb-2 pt-1">
            <span className="text-lg font-semibold text-[var(--color-brand-text-primary)]">
              {t.paymentMethods.title}
            </span>
            <button
              type="button" onClick={onClose} aria-label={t.common.close}
              className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[var(--color-brand-elevated)] p-[9px] text-[var(--color-brand-text-muted)]"
            >
              <X className="h-full w-full" />
            </button>
          </div>

          {paymentMethods.length > 0 && (
            <PaymentCardCarousel
              methods={paymentMethods}
              active={active}
              onActiveChange={setActive}
              defaultLabel={t.paymentMethods.default}
              hint={t.paymentMethods.selectHint}
              selectedId={value}
              onCardSelect={(m) => choose(m.id)}
              onAddCard={() => setSetupOpen(true)}
              addLabel={t.paymentMethods.addMethod}
            />
          )}

          <div className="shrink-0 px-[18px] pb-[calc(16px+env(safe-area-inset-bottom))] pt-4">
            {activeIsAdd ? (
              <button
                type="button" onClick={() => setSetupOpen(true)}
                className="flex h-[52px] w-full items-center justify-center rounded-[14px] bg-[var(--color-brand-red)] text-base font-semibold text-white"
              >
                {t.paymentMethods.addMethod}
              </button>
            ) : (
              <button
                type="button" onClick={() => activeMethod && choose(activeMethod.id)}
                disabled={!activeMethod}
                className="flex h-[52px] w-full items-center justify-center rounded-[14px] bg-[var(--color-brand-red)] text-base font-semibold text-white disabled:opacity-50"
              >
                {t.paymentMethods.selectCard}
              </button>
            )}
          </div>
        </div>
      </ModalShell>

      <PaymentMethodSetupSheet
        open={open && setupOpen}
        editing={null}
        baseCurrency={baseCurrency}
        nested
        onClose={() => setSetupOpen(false)}
        onSaved={(id) => { setSetupOpen(false); choose(id) }}
      />
    </>
  )
}
