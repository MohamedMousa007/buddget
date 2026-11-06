'use client'

import { Moon, ShieldAlert, ShieldCheck, ShieldPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n'
import type { EmergencyState } from '@/lib/savings/wealthModel'

export interface WealthHeroBadgesProps {
  emergency: { state: EmergencyState; months?: string; target?: number }
  /** Only when zakat is due. */
  zakat?: { amount: string; due: string }
  onOpenEmergency: () => void
  onOpenZakat: () => void
}

const PILL = 'h-7 gap-1.5 rounded-full border-0 bg-[var(--flow-band-fg)] px-2.5 font-mono-numbers text-[0.78125rem] font-bold text-[var(--flow-band-b)] hover:bg-[var(--flow-band-fg)]/90 after:absolute after:inset-x-0 after:-inset-y-2 after:content-[""] relative'

/** Emergency fund and zakat as status pills in the hero's top row; each opens its sheet. */
export function WealthHeroBadges({ emergency, zakat, onOpenEmergency, onOpenZakat }: WealthHeroBadgesProps) {
  const t = useT().wealthPage
  const ef = {
    secured: { Icon: ShieldCheck, tone: 'text-[var(--color-brand-green)]', text: null },
    needsMoney: { Icon: ShieldAlert, tone: 'text-[var(--color-brand-amber)]', text: emergency.months ? t.efMonths(emergency.months, emergency.target ?? 0) : null },
    unset: { Icon: ShieldPlus, tone: 'text-[var(--color-brand-red)]', text: t.efSetUp },
  }[emergency.state]
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button size="sm" variant="secondary" className={PILL} onClick={onOpenEmergency} aria-label={t.efAria}>
        <ef.Icon className={`size-4 ${ef.tone}`} strokeWidth={2.25} aria-hidden />
        {ef.text}
      </Button>
      {zakat ? (
        <Button size="sm" variant="secondary" className={PILL} onClick={onOpenZakat} aria-label={t.zakatAria}>
          <Moon className="size-4 text-[var(--color-brand-gold)]" strokeWidth={2} aria-hidden />
          {t.zakatBadge(zakat.amount, zakat.due)}
        </Button>
      ) : null}
    </div>
  )
}
