'use client'

import { ChevronRight, Moon, ShieldAlert, ShieldCheck, ShieldPlus } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import { useWealthLtCopy } from '@/lib/i18n/wealthLtCopy'
import type { EmergencyState } from '@/lib/savings/wealthModel'

export interface WealthPlanRowsProps {
  emergency: { state: EmergencyState; months: string; target: number }
  /** Only when zakat is due. */
  zakat?: { amount: string; due: string }
  onOpenEmergency: () => void
  onOpenZakat: () => void
}

const tint = (color: string) => `color-mix(in oklab, ${color} 16%, transparent)`

/**
 * The emergency fund and zakat as quiet rows at the end of Wealth. The Light touch hero has no badges (`lt.js` heroBand
 * drops the aside when L), so both sheets stay one tap away here instead.
 */
export function WealthPlanRows({ emergency, zakat, onOpenEmergency, onOpenZakat }: WealthPlanRowsProps) {
  const lt = useWealthLtCopy()
  const ef = {
    secured: { Icon: ShieldCheck, color: 'var(--color-brand-green)' },
    needsMoney: { Icon: ShieldAlert, color: 'var(--color-brand-amber)' },
    unset: { Icon: ShieldPlus, color: 'var(--color-brand-red)' },
  }[emergency.state]
  const chev = <ChevronRight aria-hidden className="size-4 text-[var(--color-brand-text-muted)] rtl:rotate-180" />
  return (
    <section className="px-4 lg:px-0">
      <Card padding="none" className="overflow-hidden rounded-2xl">
        <TransactionRow
          icon={<ef.Icon className="size-5" aria-hidden />}
          iconBg={tint(ef.color)}
          iconFg={ef.color}
          title={lt.efTitle}
          subtitle={emergency.state === 'unset' ? lt.efSetUp : lt.efCovered(emergency.months, emergency.target)}
          amount={chev}
          onClick={onOpenEmergency}
        />
        {zakat ? (
          <>
            <div aria-hidden className="ms-[82px] h-px bg-[var(--color-brand-border)]" />
            <TransactionRow
              icon={<Moon className="size-5" aria-hidden />}
              iconBg={tint('var(--color-brand-gold)')}
              iconFg="var(--color-brand-gold)"
              title={lt.zakatTitle}
              subtitle={lt.zakatDue(zakat.amount, zakat.due)}
              amount={chev}
              onClick={onOpenZakat}
            />
          </>
        ) : null}
      </Card>
    </section>
  )
}
