'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { AppLink as Link } from '@/components/ui/AppLink'
import { Badge } from '@/components/ui/badge'
import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { billingOn, useBillingStore } from '@/lib/billing/billingStore'
import { menuShowsProRow, proRowState, trialDaysLeft, type ProRowState } from '@/lib/billing/proRow'
import { subscriptionView } from '@/lib/billing/subscriptionView'
import { useLocale } from '@/lib/i18n'
import { intlTag } from '@/lib/i18n/dateFormat'
import { useMembershipCopy } from '@/lib/i18n/membershipCopy'
import { cn } from '@/lib/utils'
import { ProMark } from './ProMark'

const PILL: Partial<Record<ProRowState, { tone: 'gilt' | 'warn' | 'negative' | 'brand'; key: 'tryFree' | 'keepPro' | 'fix' | 'restart' }>> = {
  free: { tone: 'gilt', key: 'tryFree' },
  trialEnding: { tone: 'warn', key: 'keepPro' },
  issue: { tone: 'negative', key: 'fix' },
  ended: { tone: 'brand', key: 'restart' },
}

/**
 * The buddget Pro row: the Pro mark, the plan's status in words, and one pill that says what to do (Try free, Keep Pro, Fix, Restart).
 * `settings` is the row under Membership; `menu` is the slim row in the profile menu, shown only when there is something to do. Absent while billing is off.
 */
export function ProPlanRow({ variant, onNavigate }: { variant: 'settings' | 'menu'; onNavigate?: () => void }) {
  const c = useMembershipCopy()
  const { locale } = useLocale()
  const me = useBillingStore((s) => s.me)
  if (!billingOn(me)) return null

  const view = subscriptionView(me)
  const state = proRowState(view)
  if (variant === 'menu' && !menuShowsProRow(state)) return null

  const r = c.row
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(intlTag(locale), { day: '2-digit', month: 'short' }) : '')
  const title = state === 'trial' || state === 'trialEnding' ? r.trialName : r.name
  const sub =
    state === 'free' ? (variant === 'menu' ? r.freeMenuSub : r.freeSub)
    : state === 'trial' || state === 'trialEnding' ? r.trialLeft(trialDaysLeft(view.until))
    : state === 'issue' ? r.issueSub
    : state === 'ended' ? r.endedSub(date(view.until))
    : state === 'canceled' ? r.ends(date(view.until))
    : r.renews(date(view.until))
  const pill = PILL[state]
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight
  const tail = pill ? <Badge tone={pill.tone} size="sm" className="shrink-0">{r[pill.key]}</Badge> : <Chevron className="size-4 shrink-0 text-[var(--color-brand-text-muted)]" aria-hidden />
  const mark = <ProMark size={variant === 'menu' ? 'sm' : 'md'} faded={state === 'ended'} />

  if (variant === 'settings') {
    return <SettingsRow leading={mark} title={title} subtitle={sub} href="/settings/pro" settingId="pro" trailing={tail} />
  }
  return (
    <Link href="/settings/pro" onClick={onNavigate} role="menuitem" className={cn('flex min-h-11 w-full items-center gap-3 border-t border-[var(--color-brand-border)] px-4 py-2 text-start transition-colors hover:bg-[var(--color-brand-elevated)]')}>
      {mark}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-tight text-[var(--color-brand-text-primary)]">{title}</span>
        <span className="block truncate text-xs leading-snug text-[var(--color-brand-text-muted)]">{sub}</span>
      </span>
      {tail}
    </Link>
  )
}
