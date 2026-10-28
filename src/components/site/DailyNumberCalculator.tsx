'use client'

import { useState } from 'react'
import type { SiteLocale } from '@/lib/site/config'
import { siteContent } from '@/lib/site/routes'
import { ButtonLink, Card } from './ui'
import { pathFor } from '@/lib/site/routes'

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')

type SliderProps = { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }

function Slider({ label, value, min, max, step, unit, onChange }: SliderProps) {
  return (
    <label className="grid gap-1">
      <span className="flex justify-between gap-3 text-[15px]">
        <span>{label}</span>
        <b dir="ltr" className="font-mono font-medium">{fmt(value)} {unit}</b>
      </span>
      <input className="site-range" type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

export function DailyNumberCalculator({ locale }: { locale: SiteLocale }) {
  const c = siteContent[locale].home.calc
  const [income, setIncome] = useState(28000)
  const [bills, setBills] = useState(11000)
  const [save, setSave] = useState(3500)
  const daily = Math.max(0, Math.round((income - bills - save) / 30))
  return (
    <Card className="grid gap-5 sm:p-9">
      <Slider label={c.income} value={income} min={5000} max={80000} step={500} unit={c.currency} onChange={setIncome} />
      <Slider label={c.bills} value={bills} min={0} max={50000} step={500} unit={c.currency} onChange={setBills} />
      <Slider label={c.save} value={save} min={0} max={30000} step={500} unit={c.currency} onChange={setSave} />
      <hr className="border-brand-border" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm text-brand-text-secondary">{c.result}</div>
          <div dir="ltr" aria-live="polite" className="font-mono text-6xl font-medium leading-none tracking-tight text-brand-primary-ink sm:text-7xl">{fmt(daily)}</div>
        </div>
        <ButtonLink href={pathFor(locale, 'download')}>{c.cta}</ButtonLink>
      </div>
      <p className="text-sm text-brand-text-secondary">{c.note}</p>
    </Card>
  )
}
