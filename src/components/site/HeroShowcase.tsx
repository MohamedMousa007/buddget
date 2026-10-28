'use client'

import { useEffect, useState } from 'react'
import { OptionChip } from '@/components/ui/OptionChip'
import type { SiteLocale } from '@/lib/site/config'
import { siteContent } from '@/lib/site/routes'
import type { ScreenKey } from '@/lib/site/screens'
import { PhoneShot } from './PhoneShot'

const ROTATE_MS = 4200

/** Hero phone that cycles through real screens until the visitor picks one. */
export function HeroShowcase({ locale }: { locale: SiteLocale }) {
  const tabs = siteContent[locale].home.hero.tabs
  const [index, setIndex] = useState(0)
  const [auto, setAuto] = useState(true)

  useEffect(() => {
    if (!auto || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setIndex((i) => (i + 1) % tabs.length), ROTATE_MS)
    return () => clearInterval(id)
  }, [auto, tabs.length])

  const current = tabs[index]
  const chips = locale === 'ar' ? [['flow-ar', '8,247'], ['buddgy-ar', '687']] : [['flow', '8,247'], ['buddgy-1', '687']]

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="site-float relative">
        {tabs.map((t, i) => (
          <div key={t.key} className={i === index ? 'block' : 'hidden'} aria-hidden={i !== index}>
            <PhoneShot screen={t.key as ScreenKey} locale={locale} priority={i === 0} />
          </div>
        ))}
        <div className="absolute -start-16 top-36 hidden items-center gap-2.5 rounded-2xl border border-brand-border bg-brand-card/90 px-3.5 py-2.5 text-[13px] font-medium shadow-[var(--shadow-lg)] backdrop-blur-md xl:flex">
          <span className="site-spark size-2 rounded-full bg-brand-primary" />
          <span>{locale === 'ar' ? 'المتبقي للإنفاق' : 'Left to spend'} <b dir="ltr" className="font-mono">{chips[0][1]}</b></span>
        </div>
        <div className="absolute -end-14 top-80 hidden items-center gap-2.5 rounded-2xl border border-brand-border bg-brand-card/90 px-3.5 py-2.5 text-[13px] font-medium shadow-[var(--shadow-lg)] backdrop-blur-md xl:flex">
          <span className="size-2 rounded-full bg-brand-amber" />
          <span>{locale === 'ar' ? 'آمن اليوم' : 'Safe today'} <b dir="ltr" className="font-mono">{chips[1][1]}</b></span>
        </div>
      </div>
      <div role="group" aria-label={current.label} className="flex flex-wrap justify-center gap-2">
        {tabs.map((t, i) => (
          <OptionChip key={t.key} size="md" surface="card" selected={i === index} onClick={() => { setIndex(i); setAuto(false) }}>
            {t.label}
          </OptionChip>
        ))}
      </div>
    </div>
  )
}
