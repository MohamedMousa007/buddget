'use client'

import type { CSSProperties } from 'react'
import { ChevronLeft, Eye, EyeOff } from 'lucide-react'
import { fitBigNumber } from '@/components/features/hero/fitText'
import { PageContainer } from '@/components/layout/PageContainer'
import { IconButton } from '@/components/ui/IconButton'
import type { ProviderGroup } from '@/lib/accounts/providerGroups'
import { bankLogoForName } from '@/lib/payment/bankLogos'
import { PAYMENT_BRANDS } from '@/lib/payment/paymentMethodDefaults'
import { MASK } from '@/lib/privacy/mask'
import { useT } from '@/lib/i18n'
import { BrandMark } from './BrandMark'
import { providerColor, providerMeta } from './ProviderCard'
import { splitMoney } from './accountDisplay'

const TINT = 'color-mix(in oklab, var(--provider-brand) var(--provider-hero-amt), var(--provider-hero-base))'
const TINT_END = 'color-mix(in oklab, var(--provider-brand) calc(var(--provider-hero-amt) - 14%), var(--provider-hero-base))'
const FG2 = 'text-[color-mix(in_oklab,var(--flow-band-fg)_82%,transparent)]'

interface ProviderHeroProps {
  group: ProviderGroup
  base: string
  hidden: boolean
  onToggleHidden: () => void
  onBack: () => void
}

/**
 * The provider page's band, tinted with the brand: back, logo, name and full name, "Total here", one pill for accounts
 * and cards and one for what is set aside. The brand is mixed 62% with black (light) or 36% into the page (dark) so the
 * band's text clears AA on any catalogue colour; no brand colour falls back to the app teal.
 */
export function ProviderHero({ group, base, hidden, onToggleHidden, onBack }: ProviderHeroProps) {
  const all = useT()
  const t = all.accountsPage
  const brand = group.brandKey ? PAYMENT_BRANDS[group.brandKey]?.colors?.[0] : undefined
  const full = group.brandKey ? PAYMENT_BRANDS[group.brandKey]?.full : undefined
  const big = splitMoney(group.totalInBase, base)
  const style = {
    '--provider-brand': brand ?? 'var(--color-brand-primary-hover)',
    background: `linear-gradient(160deg, ${TINT} 0%, ${TINT_END} 100%)`,
  } as CSSProperties
  return (
    <section className="text-[var(--flow-band-fg)]" style={style}>
      <PageContainer className="pb-[22px] pt-1">
        <div className="-ms-2 flex min-h-14 items-center gap-1">
          <IconButton variant="onBandGhost" aria-label={all.common.back} onClick={onBack}>
            <ChevronLeft className="size-5 rtl:rotate-180" strokeWidth={2} />
          </IconButton>
        </div>
        <div className="flex items-center gap-3">
          <BrandMark name={group.name} color={providerColor(group)} size={48} logo={bankLogoForName(group.name)} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[1.1875rem] font-bold tracking-[-0.01em]">{group.name}</h2>
            {full && full !== group.name ? <span className={`block truncate text-[0.78125rem] ${FG2}`}>{full}</span> : null}
          </div>
          <IconButton onClick={onToggleHidden} aria-label={hidden ? t.showBalances : t.hideBalances} aria-pressed={hidden} variant="onBand" size="sm">
            {hidden ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </IconButton>
        </div>
        <p className={`mb-0.5 mt-5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] ${FG2}`}>{t.totalHere}</p>
        <p className="flex min-w-0 items-baseline gap-1.5">
          {group.approx && !hidden ? <span className={`text-lg ${FG2}`}>≈</span> : null}
          <span className={`whitespace-nowrap font-mono-numbers font-semibold leading-[1.05] tracking-[-0.04em] ${hidden ? 'text-4xl' : fitBigNumber(big.int)}`}>
            {hidden ? MASK : big.int}
          </span>
          <span className={`text-[0.8125rem] font-semibold ${FG2}`}>{base}</span>
        </p>
        <div className="mt-3.5 flex flex-wrap gap-2">
          <span className="inline-flex min-h-7 items-center rounded-full bg-[color-mix(in_oklab,var(--flow-band-fg)_14%,transparent)] px-3 text-[0.78125rem] font-semibold">{providerMeta(group, t)}</span>
          {group.heldInBase > 0 ? (
            <span dir="auto" className="inline-flex min-h-7 items-center rounded-full bg-[color-mix(in_oklab,var(--flow-band-fg)_14%,transparent)] px-3 font-mono-numbers text-[0.78125rem] font-semibold">
              {t.setAsideAt(hidden ? MASK : splitMoney(group.heldInBase, base).int)}
            </span>
          ) : null}
        </div>
      </PageContainer>
    </section>
  )
}
