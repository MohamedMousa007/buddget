'use client'

import { useState } from 'react'
import type { SiteLocale } from '@/lib/site/config'
import { pathFor, siteContent } from '@/lib/site/routes'
import { ButtonLink, Card } from './ui'

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')

export function EmergencyCalculator({ locale }: { locale: SiteLocale }) {
  const c = siteContent[locale].tools.emergency
  const unit = siteContent[locale].home.calc.currency
  const [essentials, setEssentials] = useState(15000)
  const [months, setMonths] = useState(3)
  const [saving, setSaving] = useState(3500)
  const target = essentials * months
  const time = saving > 0 ? Math.ceil(target / saving) : 0
  return (
    <Card className="grid gap-5 sm:p-9">
      <label className="grid gap-1">
        <span className="flex justify-between gap-3 text-[15px]"><span>{c.essentials}</span><b dir="ltr" className="font-mono font-medium">{fmt(essentials)} {unit}</b></span>
        <input className="site-range" type="range" min={3000} max={60000} step={500} value={essentials} onChange={(e) => setEssentials(Number(e.target.value))} />
      </label>
      <label className="grid gap-1">
        <span className="flex justify-between gap-3 text-[15px]"><span>{c.months}</span><b dir="ltr" className="font-mono font-medium">{months}</b></span>
        <input className="site-range" type="range" min={1} max={12} step={1} value={months} onChange={(e) => setMonths(Number(e.target.value))} />
      </label>
      <label className="grid gap-1">
        <span className="flex justify-between gap-3 text-[15px]"><span>{c.saving}</span><b dir="ltr" className="font-mono font-medium">{fmt(saving)} {unit}</b></span>
        <input className="site-range" type="range" min={500} max={30000} step={500} value={saving} onChange={(e) => setSaving(Number(e.target.value))} />
      </label>
      <hr className="border-brand-border" />
      <div aria-live="polite" className="grid gap-4 sm:grid-cols-2">
        <div><div className="text-sm text-brand-text-secondary">{c.target}</div><div dir="ltr" className="font-mono text-4xl font-medium text-brand-primary-ink">{fmt(target)} <span className="text-lg">{unit}</span></div></div>
        <div><div className="text-sm text-brand-text-secondary">{c.time}</div><div dir="ltr" className="font-mono text-4xl font-medium text-brand-primary-ink">{time} <span className="text-lg">{c.monthsUnit}</span></div></div>
      </div>
      <ButtonLink href={pathFor(locale, 'download')} className="justify-self-start">{c.cta}</ButtonLink>
    </Card>
  )
}
