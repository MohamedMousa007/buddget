'use client'

import { useState } from 'react'
import { OptionChip } from '@/components/ui/OptionChip'
import type { SiteLocale } from '@/lib/site/config'
import { siteContent } from '@/lib/site/routes'

export function BuddgyQA({ locale }: { locale: SiteLocale }) {
  const b = siteContent[locale].home.buddgy
  const [i, setI] = useState(0)
  return (
    <div className="grid gap-4">
      <div role="group" aria-label={b.pill} className="flex flex-wrap gap-2">
        {b.qa.map((x, n) => (
          <OptionChip key={x.q} size="md" surface="card" selected={n === i} onClick={() => setI(n)}>{x.q}</OptionChip>
        ))}
      </div>
      <div aria-live="polite" className="grid min-h-40 gap-2 rounded-2xl border border-brand-border bg-brand-card p-6">
        <b className="text-xl">{b.qa[i].a1}</b>
        <span className="text-brand-text-secondary">{b.qa[i].a2}</span>
      </div>
      <p className="text-sm text-brand-text-secondary">{b.sample} {b.disclaimer}</p>
    </div>
  )
}
