'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Plus, Pencil, Star, Trash2 } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { PaymentCardCarousel } from '@/components/features/payments/PaymentCardCarousel'
import { PaymentMethodSetupSheet } from '@/components/features/payments/PaymentMethodSetupSheet'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useT } from '@/lib/i18n'
import { decomposePaymentMethodName } from '@/lib/payment/paymentMethodDefaults'
import type { PaymentMethod } from '@/lib/store/types'

export function PaymentMethodsSheet() {
  const t = useT()
  const paymentMethods = useFinanceStore((s) => s.paymentMethods)
  const updatePaymentMethod = useFinanceStore((s) => s.updatePaymentMethod)
  const deletePaymentMethod = useFinanceStore((s) => s.deletePaymentMethod)
  const baseCurrency = useFinanceStore((s) => s.settings.baseCurrency)
  const { activeModal, setActiveModal, pmPrefill, clearPmPrefill } = useSettingsStore()

  const isWalletModal = activeModal === 'paymentMethods'
  const isAddModal = activeModal === 'addPaymentMethod'
  const isOpen = isWalletModal || isAddModal

  const [active, setActive] = useState(0)
  const [cardMenuId, setCardMenuId] = useState<string | null>(null)
  const [setupOpen, setSetupOpen] = useState(false)
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null)

  const prevOpen = useRef(false)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- sync sheet state to the modal entry point on open */
    if (isOpen && !prevOpen.current) {
      setCardMenuId(null)
      if (isAddModal) {
        setEditingMethod(null)
        setSetupOpen(true)
      } else {
        setActive(0)
        setSetupOpen(false)
        setEditingMethod(null)
      }
    }
    prevOpen.current = isOpen
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, isAddModal])

  const close = () => {
    clearPmPrefill()
    setActiveModal(null)
  }
  useEscapeClose(isWalletModal && !setupOpen, close)

  const deck = useMemo(() => paymentMethods.filter((m) => m.type !== 'cash'), [paymentMethods])
  const menuCard = deck.find((m) => m.id === cardMenuId) ?? null

  const openAdd = () => { setEditingMethod(null); setSetupOpen(true) }
  const openEdit = (m: PaymentMethod) => { setEditingMethod(m); setCardMenuId(null); setSetupOpen(true) }
  const closeSetup = () => {
    if (isAddModal) { close(); return }
    setSetupOpen(false)
    setEditingMethod(null)
  }
  const onSaved = () => {
    if (!editingMethod) setActive(deck.length) // new non-cash card appended last
  }

  return (
    <>
      <ModalShell open={isWalletModal} onBackdropClick={close} scrollChild>
        <div className="relative flex min-h-0 flex-1 flex-col outline-none">
          <div className="flex shrink-0 items-center justify-between px-[18px] pb-2 pt-1">
            <span className="text-lg font-semibold text-[var(--color-brand-text-primary)]">
              {t.paymentMethods.title}
            </span>
            <button
              type="button" onClick={close} aria-label="Close"
              className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[var(--color-brand-elevated)] p-[9px] text-[var(--color-brand-text-muted)]"
            >
              <X className="h-full w-full" />
            </button>
          </div>

          {deck.length === 0 ? (
            <div className="flex h-[224px] items-center justify-center px-8 text-center text-sm text-[var(--color-brand-text-muted)]">
              {t.paymentMethods.emptyHint}
            </div>
          ) : (
            <PaymentCardCarousel
              methods={deck}
              active={active}
              onActiveChange={setActive}
              defaultLabel={t.paymentMethods.default}
              hint={t.paymentMethods.walletHint}
              onMenu={setCardMenuId}
            />
          )}

          <div className="shrink-0 px-[18px] pb-[calc(16px+env(safe-area-inset-bottom))] pt-4">
            <button
              type="button" onClick={openAdd}
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-[var(--color-brand-red)] text-base font-semibold text-white"
            >
              <Plus className="h-5 w-5" />
              {t.paymentMethods.addMethod}
            </button>
          </div>

          {menuCard && (
            <>
              <button
                type="button" aria-label="Close menu"
                onClick={() => setCardMenuId(null)}
                className="absolute inset-0 z-30 cursor-default"
              />
              <div
                className="absolute end-[44px] top-[92px] z-[31] w-[200px] overflow-hidden rounded-[14px] border border-[#34343f] bg-[#1E1E28]"
                style={{ boxShadow: '0 18px 44px -10px rgba(0,0,0,.7)' }}
              >
                <div className="flex items-center justify-between border-b border-[var(--color-brand-border)] py-2 pe-1.5 ps-3">
                  <span className="truncate text-[11.5px] font-semibold text-[var(--color-brand-text-muted)]">
                    {decomposePaymentMethodName(menuCard.name, menuCard.last4).provider}
                    {menuCard.last4 ? ` ••••${menuCard.last4}` : ''}
                  </span>
                  <button
                    type="button" aria-label="Close" onClick={() => setCardMenuId(null)}
                    className="flex h-[26px] w-[26px] items-center justify-center p-1.5 text-[var(--color-brand-text-muted)]"
                  >
                    <X className="h-full w-full" />
                  </button>
                </div>
                <button
                  type="button" onClick={() => openEdit(menuCard)}
                  className="flex w-full items-center gap-[11px] px-3.5 py-3 text-start text-sm font-medium text-white"
                >
                  <Pencil className="h-[17px] w-[17px] text-[#CFCFE0]" />
                  {t.paymentMethods.edit}
                </button>
                {!menuCard.isDefault && (
                  <>
                    <div className="h-px bg-[var(--color-brand-border)]" />
                    <button
                      type="button"
                      onClick={() => { updatePaymentMethod(menuCard.id, { isDefault: true }); setCardMenuId(null) }}
                      className="flex w-full items-center gap-[11px] px-3.5 py-3 text-start text-sm font-medium text-white"
                    >
                      <Star className="h-[17px] w-[17px] fill-[#38D96B] text-[#38D96B]" />
                      {t.paymentMethods.setDefault}
                    </button>
                  </>
                )}
                <div className="h-px bg-[var(--color-brand-border)]" />
                <button
                  type="button"
                  onClick={() => { deletePaymentMethod(menuCard.id); setCardMenuId(null); setActive(0) }}
                  className="flex w-full items-center gap-[11px] px-3.5 py-3 text-start text-sm font-medium text-[#FF6B6B]"
                >
                  <Trash2 className="h-[17px] w-[17px]" />
                  {t.paymentMethods.delete}
                </button>
              </div>
            </>
          )}
        </div>
      </ModalShell>

      <PaymentMethodSetupSheet
        open={isOpen && setupOpen}
        editing={editingMethod}
        prefill={isAddModal ? pmPrefill : null}
        baseCurrency={baseCurrency}
        onClose={closeSetup}
        onSaved={onSaved}
      />
    </>
  )
}
