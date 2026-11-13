'use client'

import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { pickablePaymentMethods } from '@/lib/accounts/kinds'
import { useEffect, useRef, useState, useMemo } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { Button } from '@/components/ui/button'
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
export function SelectPaymentMethodSheet({ open, value, paymentMethods: allMethods, onSelect, onClose }: Props) {
  const t = useT()
  const paymentMethods = useMemo(() => pickablePaymentMethods(allMethods, value), [allMethods, value])
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
          <V3SheetHeader onClose={onClose}>
            <V3SheetHeader.Title>{t.paymentMethods.title}</V3SheetHeader.Title>
          </V3SheetHeader>

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

          <div className="sheet-cta shrink-0 px-[18px] pb-[calc(16px+env(safe-area-inset-bottom))] pt-4">
            {activeIsAdd ? (
              <Button size="cta-block" onClick={() => setSetupOpen(true)} className="text-base font-semibold">
                {t.paymentMethods.addMethod}
              </Button>
            ) : (
              <Button
                size="cta-block"
                onClick={() => activeMethod && choose(activeMethod.id)}
                disabled={!activeMethod}
                className="text-base font-semibold"
              >
                {t.paymentMethods.selectCard}
              </Button>
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
