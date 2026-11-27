'use client'

import { useMemo, useState } from 'react'
import { CreditCard, Plus, Search, ArrowLeft, Check } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { decomposePaymentMethodName } from '@/lib/payment/paymentMethodDefaults'
import { INSTALLMENT_PROVIDER_CATALOGUE } from '@/lib/constants/installmentProviders'
import { PaymentCardCarousel } from '@/components/features/payments/PaymentCardCarousel'
import type { PaymentMethod } from '@/lib/store/types'
import { ProviderBadge } from './ProviderBadge'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { IconButton } from '@/components/ui/IconButton'
import { Button } from '@/components/ui/button'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { Input } from '@/components/ui/input'
import { useT } from '@/lib/i18n'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'
import { useDebtsV9Copy } from '@/lib/i18n/debtsV9Copy'
import { PAYMENT_BRANDS } from '@/lib/payment/paymentMethodDefaults'
import { bankLogoForName } from '@/lib/payment/bankLogos'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { BrandMark } from '@/components/features/accounts/BrandMark'
import { readable, soft } from './heroCardShared'

const BANKS = Object.values(PAYMENT_BRANDS).filter((b) => b.type === 'bank_account' && !b.retired)

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
  const t = useT().debts
  const kind = useDebtsSubsLtCopy().install.providerKind
  const v9 = useDebtsV9Copy().install
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
  const banks = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? BANKS.filter((b) => [b.name, b.full ?? '', ...(b.aliases ?? [])].some((n) => n.toLowerCase().includes(q))) : BANKS
  }, [query])

  const close = () => {
    setView('grid')
    setQuery('')
    setCustomName('')
    onClose()
  }

  return (
    <ModalShell open={open} onBackdropClick={close} scrollChild zIndexClassName="z-[120]" panelClassName={`${view === 'card' ? 'h-[50dvh]' : 'h-[72dvh]'} bg-[var(--color-brand-card)]`}>
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
        <V3SheetHeader
          title={view === 'card' ? t.whichCardTitle : view === 'custom' ? t.customProviderTitle : t.chooseProvider}
          onClose={close}
          leading={
            view !== 'grid' ? (
              <IconButton aria-label={t.backLabel} variant="tinted" size="sm" shape="round" onClick={() => setView('grid')}>
                <ArrowLeft className="rtl:rotate-180" />
              </IconButton>
            ) : undefined
          }
        />

        {view === 'grid' ? (
          <>
            <div className="relative mb-3 shrink-0">
              <Search className="pointer-events-none absolute start-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-[var(--color-brand-text-muted)]" />
              <Input
                size="brand"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.searchProvider}
                className="ps-10"
              />
            </div>
            <div className="native-scroll -mx-1 min-h-0 flex-1 overflow-y-auto px-1">
              <div className="grid grid-cols-2 gap-2.5">
                {tiles.map((b) => {
                  const sel = valueSlug === b.slug && !valueCardId
                  return (
                    <SelectableCard
                      key={b.slug}
                      selected={sel}
                      onClick={() => {
                        onPickBrand(b.slug, b.name)
                        close()
                      }}
                      className="gap-3 p-3.5"
                      style={sel ? { borderColor: b.color, background: soft(b.color, 12) } : undefined}
                    >
                      <ProviderBadge slug={b.slug} name={b.name} color={b.color} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">{b.name}</span>
                        <span className="block text-[0.6875rem] font-medium text-[var(--color-brand-text-muted)]">{kind[b.category]}</span>
                      </span>
                      {sel ? <Check className="h-4 w-4 shrink-0" style={{ color: readable(b.color) }} /> : null}
                    </SelectableCard>
                  )
                })}
                {/* Credit card + Custom pinned */}
                <SelectableCard
                  as="action"
                  onClick={() => setView('card')}
                  className="gap-3 p-3.5"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-[var(--color-cat-6)]/20 text-[var(--color-cat-6)]"><CreditCard className="h-5 w-5" /></span>
                  <span className="block truncate text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">{t.debtTypeCreditCard}</span>
                </SelectableCard>
                <SelectableCard
                  as="action"
                  onClick={() => setView('custom')}
                  className="gap-3 p-3.5"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-[var(--color-brand-sunken)] text-[var(--color-brand-text-secondary)]"><Plus className="h-5 w-5" /></span>
                  <span className="block truncate text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">{t.customLabel}</span>
                </SelectableCard>
              </div>
              {/* Banks run installment plans too (round 9): a bank is kept by name, like a custom provider. */}
              {banks.length ? (
                <>
                  <h3 className={`${microClassName} mb-2 mt-4 px-1`}>{v9.banks}</h3>
                  <div className="grid grid-cols-2 gap-2.5">
                    {banks.map((b) => (
                      <SelectableCard key={b.id} onClick={() => { onCustom(b.name); close() }} className="gap-3 p-3.5">
                        <BrandMark name={b.name} color={b.colors[0]} size={40} logo={bankLogoForName(b.name)} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">{b.name}</span>
                          <span className="block text-[0.6875rem] font-medium text-[var(--color-brand-text-muted)]">{v9.bank}</span>
                        </span>
                      </SelectableCard>
                    ))}
                  </div>
                </>
              ) : null}
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
              defaultLabel={t.debtTypeCreditCard}
              hint={creditCards.length ? t.pickCardHint : t.addCardHint}
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
              addLabel={t.addCreditCardBtn}
            />
          </div>
        ) : null}

        {view === 'custom' ? (
          <div className="flex flex-col gap-3 pt-1">
            <Input size="brand" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder={t.providerNamePh} />
            <Button
              disabled={!customName.trim()}
              onClick={() => {
                onCustom(customName.trim())
                close()
              }}
              size="cta-block"
            >
              {t.useName(customName.trim() || '…')}
            </Button>
          </div>
        ) : null}
      </div>
    </ModalShell>
  )
}
