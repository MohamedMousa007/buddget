'use client'

import { ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { ProviderFace, ProviderGroup } from '@/lib/accounts/providerGroups'
import { bankLogoForName } from '@/lib/payment/bankLogos'
import { PAYMENT_BRANDS, PAYMENT_TYPE_META } from '@/lib/payment/paymentMethodDefaults'
import { MASK } from '@/lib/privacy/mask'
import type { PaymentMethod } from '@/lib/store/types'
import { useT } from '@/lib/i18n'
import { BrandMark } from './BrandMark'
import { ProviderCardFaces, useFacesFit } from './ProviderCardFaces'
import { moneyFlex } from './accountDisplay'

/** The provider's own colour: the catalogue's first brand colour, else its first account's, else the type colour. */
export function providerColor(group: ProviderGroup): string {
  const first = group.accounts[0]?.method ?? group.cards[0]?.method
  return (group.brandKey ? PAYMENT_BRANDS[group.brandKey]?.colors?.[0] : undefined) ?? first?.color ?? PAYMENT_TYPE_META[first?.type ?? 'bank_account'].color
}

/** "3 accounts · 4 cards"; a card-only group says only its cards. */
export function providerMeta(group: ProviderGroup, t: { accountsCount: (n: number) => string; cardsCount: (n: number) => string }): string {
  return [group.accountCount ? t.accountsCount(group.accountCount) : null, t.cardsCount(group.cardCount)].filter(Boolean).join(' · ')
}

interface ProviderCardProps {
  group: ProviderGroup
  base: string
  masked: boolean
  /** An account of the provider has an unexplained gap: the mark carries the amber "!". */
  alert?: boolean
  /** Opens the provider page. */
  onOpen: () => void
  /** A face in a spread stack. */
  onFace: (face: ProviderFace) => void
}

/**
 * One bank or wallet on Accounts: mark, name, "N accounts · M cards", the ≈ total in the base currency, what is set
 * aside, and its card faces. When the faces fit in a row the whole card is one button; when they stack, the header
 * opens the provider page and the stack spreads on its own. Credit owed never appears here.
 */
export function ProviderCard({ group, base, masked, alert = false, onOpen, onFace }: ProviderCardProps) {
  const t = useT().accountsPage
  const label = t.cardsCount(group.cardCount)
  const { measure, room, stacked } = useFacesFit(group.cards.length, label)
  const meta = providerMeta(group, t)
  const byId = new Map<string, PaymentMethod>(group.accounts.map((a) => [a.method.id, a.method]))
  const parentOf = (f: ProviderFace) => (f.parentAccountId ? byId.get(f.parentAccountId) : undefined)
  const amount = (n: number) => (masked ? MASK : moneyFlex(n, base))

  const head = (
    <span className="flex items-center gap-3">
      <BrandMark name={group.name} color={providerColor(group)} alert={alert} logo={bankLogoForName(group.name)} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-bold text-[var(--color-brand-text-primary)]">{group.name}</span>
        <span className="mt-0.5 block truncate whitespace-nowrap text-[0.8125rem] text-[var(--color-brand-text-muted)]">{meta}</span>
      </span>
      <span className="shrink-0 text-end">
        <span className="block whitespace-nowrap font-mono-numbers text-base font-semibold tracking-[-0.02em] text-[var(--color-brand-text-primary)]">
          {group.approx && !masked ? '≈ ' : ''}{amount(group.totalInBase)}{' '}
          <span className="text-[0.71875rem] font-normal text-[var(--color-brand-text-muted)]">{base}</span>
        </span>
        {group.heldInBase > 0 ? (
          <span dir="auto" className="mt-0.5 block whitespace-nowrap font-mono-numbers text-[0.71875rem] font-semibold text-[var(--color-brand-primary-ink)]">{t.setAsideAt(amount(group.heldInBase))}</span>
        ) : null}
      </span>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-[var(--color-brand-text-muted)] rtl:rotate-180" />
    </span>
  )
  const faces = group.cards.length > 0 ? (
    <ProviderCardFaces faces={group.cards} label={label} parentOf={parentOf} layout={stacked ? 'stack' : 'row'} room={room} onFace={onFace} />
  ) : null

  if (!stacked) {
    return (
      <Card render={<button type="button" />} interactive padding="none" onClick={onOpen} aria-label={`${group.name}, ${meta}`}
        className="block w-full transition-[border-color,transform] duration-150 ease-out active:scale-[0.99] motion-reduce:transition-none">
        <span className="block px-4 pb-3 pt-3.5"><span ref={measure} className="block">{head}</span></span>
        {faces ? <span className="block px-4 pb-3.5">{faces}</span> : null}
      </Card>
    )
  }
  return (
    <Card padding="none">
      <button type="button" onClick={onOpen} aria-label={`${group.name}, ${meta}`} data-raw-button-ok="the provider card's header, a whole-region tap target"
        className="block w-full rounded-2xl px-4 pb-3 pt-3.5 text-start outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-brand-focus)]">
        <span ref={measure} className="block">{head}</span>
      </button>
      <div className="px-4 pb-3.5">{faces}</div>
    </Card>
  )
}
