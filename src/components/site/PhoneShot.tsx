import Image from 'next/image'
import type { SiteLocale } from '@/lib/site/config'
import { screenAlt, screenSrc, type ScreenKey } from '@/lib/site/screens'

type Props = { screen: ScreenKey; locale: SiteLocale; size?: 'md' | 'sm'; priority?: boolean; className?: string }

/** A real capture from the running app inside a device frame. */
export function PhoneShot({ screen, locale, size = 'md', priority, className }: Props) {
  const width = size === 'sm' ? 216 : 284
  return (
    <div className={`site-phone ${className ?? ''}`} data-size={size}>
      <Image src={screenSrc(screen)} alt={screenAlt(screen, locale)} width={780} height={1688} sizes={`${width}px`} priority={priority} unoptimized />
    </div>
  )
}

export function PhonePair({ a, b, locale }: { a: ScreenKey; b: ScreenKey; locale: SiteLocale }) {
  return (
    <div className="site-pair">
      <div className="site-pair-a"><PhoneShot screen={a} locale={locale} /></div>
      <div className="site-pair-b"><PhoneShot screen={b} locale={locale} size="sm" /></div>
    </div>
  )
}
