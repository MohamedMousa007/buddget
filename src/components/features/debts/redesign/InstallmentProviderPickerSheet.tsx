'use client'

import { useMemo, useState } from 'react'
import { CreditCard, Plus, Search, X, ArrowLeft, Check } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { decomposePaymentMethodName } from '@/lib/payment/paymentMethodDefaults'
import { INSTALLMENT_PROVIDER_CATALOGUE } from '@/lib/constants/installmentProviders'
import { PaymentCardCarousel } from '@/components/features/payments/PaymentCardCarousel'
import type { PaymentMethod } from '@/lib/store/types'
import { ProviderBadge } from './ProviderBadge'

export interface CreditCardOption {
  debtId: string
  pm: PaymentMethod
}

export interface InstallmentProviderPickerSheetProps {
  open: boolean
  valueSlug?: string
  valueCardId?: string
  creditCards: CreditCardOption[]
  onPickBrand: (slug: string, name: string) => void
  onPickCard: (cardId: string, name: string, last4?: string) => void
  onCustom: (name: string) => void
  onAddCreditCard: () => void
  onClose: () => void
}

// All catalogue brands shown as tiles (search still filters). Card + Custom pinned after.
const TILE_SLUGS = ['valu', 'tabby', 'tamara', 'sympl', 'souhoola', 'aman', 'contact', 'halan', 'shahry', 'forsa', 'postpay', 'cashew', 'spotii', 'mispay']

/** Installment provider picker — 2-col brand grid + credit-card sub-view + custom (handoff §7). */
export function InstallmentProviderPickerSheet({
  open,
  valueSlug,
  valueCardId,
  creditCards,
  onPickBrand,
  onPickCard,
  onCustom,
  onAddCreditCard,
  onClose,
}: InstallmentProviderPickerSheetProps) {
  const [view, setView] = useState<'grid' | 'card' | 'custom'>('grid')
  const [query, setQuery] = useState('')
  const [customName, setCustomName] = useState('')
  const [cardIdx, setCardIdx] = useState(0)

  const tiles = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q) return INSTALLMENT_PROVIDER_CATALOGUE.filter((b) => b.slug !== 'other' && b.slug !== 'bank_epp' && b.name.toLowerCase().includes(q))
    return INSTALLMENT_PROVIDER_CATALOGUE.filter((b) => TILE_SLUGS.includes(b.slug)).sort(
      (a, b) => TILE_SLUGS.indexOf(a.slug) - TILE_SLUGS.indexOf(b.slug),
    )
  }, [query])

  const close = () => {
    setView('grid')
    setQuery('')
    setCustomName('')
    onClose()
  }

  return (
    <ModalShell open={open} onBackdropClick={close} scrollChild zIndexClassName="z-[120]" panelClassName={`${view === 'card' ? 'h-[50vh]' : 'h-[72vh]'} bg-[#14141b]`}>
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
        <div className="flex shrink-0 items-center gap-2.5 pb-3 pt-1">
          {view !== 'grid' ? (
            <button type="button" aria-label="Back" onClick={() => setView('grid')} className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white/8 p-[9px] text-white/70">
              <ArrowLeft className="h-full w-full" />
            </button>
          ) : null}
          <span className="min-w-0 flex-1 text-lg font-semibold text-white">
            {view === 'card' ? 'Which credit card?' : view === 'custom' ? 'Custom provider' : 'Choose provider'}
          </span>
          <button type="button" aria-label="Close" onClick={close} className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white/8 p-[9px] text-white/70">
            <X className="h-full w-full" />
          </button>
        </div>

        {view === 'grid' ? (
          <>
            <div className="relative mb-3 shrink-0">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search provider"
                className="h-11 w-full rounded-xl border border-white/10 bg-black/30 ps-10 pe-3 text-[15px] text-white outline-none"
              />
            </div>
            <div className="native-scroll -mx-1 min-h-0 flex-1 overflow-y-auto px-1">
              <div className="grid grid-cols-2 gap-2.5">
                {tiles.map((b) => {
                  const sel = valueSlug === b.slug && !valueCardId
                  return (
                    <button
                      key={b.slug}
                      type="button"
                      onClick={() => {
                        onPickBrand(b.slug, b.name)
                        close()
                      }}
                      className="relative flex items-center gap-3 rounded-[16px] border p-3.5 text-start transition-colors"
                      style={sel ? { borderColor: `${b.color}`, background: `${b.color}18` } : { borderColor: 'rgba(255,255,255,.1)' }}
                    >
                      <ProviderBadge slug={b.slug} name={b.name} color={b.color} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-bold text-white">{b.name}</span>
                        <span className="block text-[11px] font-medium capitalize text-white/45">{b.category.replace('_', ' ')}</span>
                      </span>
                      {sel ? <Check className="h-4 w-4 shrink-0" style={{ color: b.color }} /> : null}
                    </button>
                  )
                })}
                {/* Credit card + Custom pinned */}
                <button
                  type="button"
                  onClick={() => setView('card')}
                  className="flex items-center gap-3 rounded-[16px] border border-white/10 p-3.5 text-start"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-[#8A5CF6]/22 text-[#8A5CF6]"><CreditCard className="h-5 w-5" /></span>
                  <span className="block truncate text-[15px] font-bold text-white">Credit card</span>
                </button>
                <button
                  type="button"
                  onClick={() => setView('custom')}
                  className="flex items-center gap-3 rounded-[16px] border border-white/10 p-3.5 text-start"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-white/8 text-white/60"><Plus className="h-5 w-5" /></span>
                  <span className="block truncate text-[15px] font-bold text-white">Custom</span>
                </button>
              </div>
            </div>
          </>
        ) : null}

        {view === 'card' ? (
          <div className="min-h-0 flex-1">
            {/* §7: the credit-card carousel filtered to the user's cards (reuses §5 deck). */}
            <PaymentCardCarousel
              methods={creditCards.map((c) => c.pm)}
              active={cardIdx}
              onActiveChange={setCardIdx}
              defaultLabel="Credit card"
              hint={creditCards.length ? 'Tap your card to link this plan to it' : 'Add a credit card to link this plan'}
              selectedId={valueCardId ? creditCards.find((c) => c.debtId === valueCardId)?.pm.id : undefined}
              onCardSelect={(m) => {
                const c = creditCards.find((x) => x.pm.id === m.id)
                if (c) {
                  // Pass the bare provider — the card label appends `••last4` itself.
                  onPickCard(c.debtId, decomposePaymentMethodName(m.name, m.last4).provider, m.last4 ?? undefined)
                  close()
                }
              }}
              onAddCard={() => {
                close()
                onAddCreditCard()
              }}
              addLabel="Add credit card"
            />
          </div>
        ) : null}

        {view === 'custom' ? (
          <div className="flex flex-col gap-3 pt-1">
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Provider name"
              className="h-[52px] w-full rounded-xl border border-white/10 bg-black/30 px-3.5 text-[15px] text-white outline-none"
            />
            <button
              type="button"
              disabled={!customName.trim()}
              onClick={() => {
                onCustom(customName.trim())
                close()
              }}
              className="h-[52px] w-full rounded-[14px] bg-[var(--color-brand-red)] text-base font-bold text-white disabled:opacity-40"
            >
              Use “{customName.trim() || '…'}”
            </button>
          </div>
        ) : null}
      </div>
    </ModalShell>
  )
}
