'use client'

import type { CSSProperties } from 'react'
import { ChevronLeft, EyeOff } from 'lucide-react'
import { fitBigNumber } from '@/components/features/hero/fitText'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import type { ProviderGroup } from '@/lib/accounts/providerGroups'
import { bankLogoForName } from '@/lib/payment/bankLogos'
import { PAYMENT_BRANDS } from '@/lib/payment/paymentMethodDefaults'
import { MASK } from '@/lib/privacy/mask'
import { useT } from '@/lib/i18n'
import { useAccountsLtCopy } from '@/lib/i18n/accountsLtCopy'
import { BrandMark } from './BrandMark'
import { providerColor, providerMeta } from './ProviderCard'
import { moneyFlex } from './accountDisplay'

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
 * The provider page's hero (Light touch): a back link, then a rounded card tinted with the brand: logo, name and full
 * name, "Total here", and one line for accounts, cards and what is set aside. The brand is mixed 62% with black (light) or 36% into the page (dark) so the
 * band's text clears AA on any catalogue colour; no brand colour falls back to the app teal.
 */
export function ProviderHero({ group, base, hidden, onToggleHidden, onBack }: ProviderHeroProps) {
  const t = useT().accountsPage
  const brand = group.brandKey ? PAYMENT_BRANDS[group.brandKey]?.colors?.[0] : undefined
  const full = group.brandKey ? PAYMENT_BRANDS[group.brandKey]?.full : undefined
  const total = moneyFlex(group.totalInBase, base)
  const lt = useAccountsLtCopy().hero
  const style = {
    '--provider-brand': brand ?? 'var(--color-brand-primary-hover)',
    background: `linear-gradient(160deg, ${TINT} 0%, ${TINT_END} 100%)`,
  } as CSSProperties
  return (
    <>
      <Button variant="ghost" size="touch" onClick={onBack}
        className="-ms-2 mb-1 gap-1 px-2 font-semibold text-[var(--color-brand-text-primary)] [&_svg:not([class*='size-'])]:size-5">
        <ChevronLeft aria-hidden className="rtl:rotate-180" strokeWidth={2} />{t.title}
      </Button>
      <section className="overflow-hidden rounded-3xl px-[18px] pb-4 pt-4 text-[var(--flow-band-fg)]" style={style}>
        <div className="flex items-center gap-3">
          <BrandMark name={group.name} color={providerColor(group)} size={40} logo={bankLogoForName(group.name)} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[1.0625rem] font-bold">{group.name}</h2>
            {full && full !== group.name ? <span className={`block truncate text-[0.78125rem] ${FG2}`}>{full}</span> : null}
          </div>
          {/* No eye in the mockup: hiding lives in Settings > Privacy; while hidden, this one shows the balances again. */}
          {hidden ? (
            <IconButton onClick={onToggleHidden} aria-label={t.showBalances} aria-pressed variant="onBand" size="sm">
              <EyeOff className="size-4" aria-hidden />
            </IconButton>
          ) : null}
        </div>
        <p className={`mt-4 text-xs font-semibold ${FG2}`}>{t.totalHere}</p>
        <p className="flex min-w-0 items-baseline gap-1.5">
          {group.approx && !hidden ? <span className="text-lg">≈</span> : null}
          <span className={`whitespace-nowrap font-mono-numbers font-semibold leading-[1.05] tracking-[-0.04em] ${hidden ? 'text-[32px]' : fitBigNumber(total)}`}>
            {hidden ? MASK : total}
          </span>
          <span className="text-[0.8125rem] font-semibold">{base}</span>
        </p>
        <p dir="auto" className={`mt-2 text-xs ${FG2}`}>
          {providerMeta(group, t)}
          {group.heldInBase > 0 ? <> · <b className="font-mono-numbers">{hidden ? MASK : moneyFlex(group.heldInBase, base)}</b> {lt.setAside}</> : null}
        </p>
      </section>
    </>
  )
}
