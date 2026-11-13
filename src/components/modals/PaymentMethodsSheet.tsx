'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Pencil, Star, Trash2 } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { Button } from '@/components/ui/button'
import { PaymentCardCarousel } from '@/components/features/payments/PaymentCardCarousel'
import { PaymentMethodSetupSheet } from '@/components/features/payments/PaymentMethodSetupSheet'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useT } from '@/lib/i18n'
import { decomposePaymentMethodName } from '@/lib/payment/paymentMethodDefaults'
import type { PaymentMethod } from '@/lib/store/types'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { CardActionMenu } from '@/components/ui/CardActionMenu'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'

export function PaymentMethodsSheet() {
  const t = useT()
  const confirm = useConfirm()
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
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null)
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

  const deck = useMemo(() => paymentMethods.filter((m) => m.type !== 'cash' && m.type !== 'bank_account' && !m.closedAt), [paymentMethods])
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
          <V3SheetHeader onClose={close}>
            <V3SheetHeader.Title>{t.paymentMethods.title}</V3SheetHeader.Title>
          </V3SheetHeader>

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
              onMenu={(id, anchor) => { setCardMenuId(id); setMenuAnchor(anchor) }}
            />
          )}

          <div className="sheet-cta shrink-0 px-[18px] pb-[calc(16px+env(safe-area-inset-bottom))] pt-4">
            <Button size="cta-block" onClick={openAdd} className="text-base font-semibold">
              <Plus className="h-5 w-5" />
              {t.paymentMethods.addMethod}
            </Button>
          </div>

          {menuCard ? (
            <CardActionMenu
              anchor={menuAnchor}
              onClose={() => { setCardMenuId(null); setMenuAnchor(null) }}
              title={`${decomposePaymentMethodName(menuCard.name, menuCard.last4).provider}${menuCard.last4 ? ` ••${menuCard.last4}` : ''}`}
              items={[
                { label: t.paymentMethods.edit, icon: <Pencil size={17} />, onSelect: () => openEdit(menuCard) },
                ...(menuCard.isDefault
                  ? []
                  : [{
                      label: t.paymentMethods.setDefault,
                      icon: <Star size={17} />,
                      onSelect: () => updatePaymentMethod(menuCard.id, { isDefault: true }),
                    }]),
                {
                  label: t.paymentMethods.delete,
                  icon: <Trash2 size={17} />,
                  destructive: true,
                  onSelect: async () => {
                    const children = paymentMethods.filter((m) => m.parentId === menuCard.id).length
                    if (!(await confirm({ title: t.paymentMethods.delete, body: t.accountsPage.closeAccountBody(children), destructive: true }))) return
                    deletePaymentMethod(menuCard.id)
                    setActive(0)
                  },
                },
              ]}
              zClassName="z-[110]"
            />
          ) : null}
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
