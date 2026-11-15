'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MemberCard } from '@/components/features/membership/MemberCard'
import { AppLink as Link } from '@/components/ui/AppLink'
import { billingOn, useBillingStore } from '@/lib/billing/billingStore'
import { subscriptionView } from '@/lib/billing/subscriptionView'
import { useLocale } from '@/lib/i18n'
import { intlTag } from '@/lib/i18n/dateFormat'
import { useMembershipCopy } from '@/lib/i18n/membershipCopy'

/** The Buddget Pro card under the profile banner: Free, a trial, active, a billing issue or ended. Opens /settings/pro. Absent while billing is off. */
export function MembershipCard() {
  const c = useMembershipCopy()
  const { locale } = useLocale()
  const me = useBillingStore((s) => s.me)
  if (!billingOn(me)) return null

  const view = subscriptionView(me)
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(intlTag(locale), { day: 'numeric', month: 'short' }) : '')
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight
  const h = c.hub
  const facts: Parameters<typeof MemberCard>[0]['facts'] =
    view.kind === 'free' ? [{ label: h.freeLine, value: h.freeCta, mono: false }]
    : view.kind === 'trial' ? [{ label: h.trialLine, value: h.trialDay(view.trialDay ?? 1, view.trialTotal), mono: false }]
    : view.kind === 'issue' ? [{ label: h.issue, value: date(view.until) }]
    : view.kind === 'expired' ? [{ label: h.ended, value: date(view.until) }]
    : [{ label: h.since, value: date(view.memberSince) }, { label: h.renews, value: date(view.until) }]

  return (
    <Link href="/settings/pro" className="relative block">
      <MemberCard kind="pro" mark={c.mark} size="mini" className="pe-10" state={view.kind === 'issue' ? 'grace' : view.kind === 'expired' ? 'expired' : 'active'} facts={facts} />
      <Chevron className="pointer-events-none absolute end-3 top-1/2 size-5 -translate-y-1/2 text-[var(--member-fg-2)]" aria-hidden />
    </Link>
  )
}
