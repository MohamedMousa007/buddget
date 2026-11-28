'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { CardSpotlight } from '@/components/features/membership/FlipCardRig'
import { GuestPassCard } from '@/components/features/membership/GuestPassCard'
import { MembershipPanel } from '@/components/features/membership/PointsList'
import { Fine, Sub } from '@/components/features/rewards/pageParts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/lib/i18n'
import { useRewardsCopy } from '@/lib/i18n/rewardsCopy'
import { INVITE_TARGET } from '@/lib/native/inviteLinks'
import { fetchInviterFirstName } from '@/lib/referrals/referralsApi'
import { STORE_LINKS } from '@/lib/site/config'
import { waitlistInvitePath } from '@/lib/site/waitlist'
import { displayLink, saveInviteFromLink } from './inviteCode'

/** Before either store has the app, a newcomer's way in is the waitlist, not web sign-up (STORE_LIVE in the site config). */
const PRELAUNCH = !STORE_LINKS.appStore && !STORE_LINKS.googlePlay

/** What a friend sees on `/i/<code>`: the guest pass signed by the inviter, what they get, and the way in. The code is saved on open. */
export function InviteLanding({ code }: { code: string }) {
  const copy = useRewardsCopy()
  const { locale } = useLocale()
  const c = copy.landing
  const p = copy.invite.pass
  const [saved, setSaved] = useState(false)
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void Promise.resolve(saveInviteFromLink(code)).then(() => { if (live) setSaved(true) })
    void fetchInviterFirstName(code).then((n) => { if (live) setName(n) })
    return () => { live = false }
  }, [code])

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="safe-area-top bg-[linear-gradient(160deg,var(--color-hero-from),var(--color-hero-to))] text-[var(--color-brand-on-primary)]">
        <div className="mx-auto grid w-full max-w-md gap-3.5 px-5 pb-[22px] pt-4">
          <div className="flex items-center gap-2">
            <span aria-hidden className="flex size-8 items-center justify-center rounded-[9px] bg-[var(--color-brand-on-primary)] text-xl font-extrabold text-[var(--color-brand-primary)]">b</span>
            <span className="text-xl font-bold">buddget</span>
            <span dir="ltr" className="ms-auto truncate font-mono text-[0.6875rem] opacity-85">{displayLink(`https://buddget.app/i/${code}`)}</span>
          </div>
          <div className="grid gap-1">
            <h1 dir="auto" className="m-0 text-[1.625rem] font-extrabold leading-[1.1] tracking-[-0.025em] rtl:leading-[1.4] rtl:tracking-normal">{name ? c.title(name) : c.titleNoName}</h1>
            <p dir="auto" className="m-0 text-sm opacity-90">{c.sub}</p>
          </div>
        </div>
      </header>

      <main className="safe-area-bottom mx-auto flex w-full max-w-md flex-1 flex-col gap-3.5 px-4 pb-[22px] pt-[18px]">
        <CardSpotlight>
          <GuestPassCard
            flipLabel={c.flip}
            front={{
              mark: p.mark,
              title: p.title,
              from: name ? p.from(name) : undefined,
              subtitle: p.sub,
              facts: [{ label: p.code, value: code, code: true }, { label: c.youGet, value: p.friendValue }, { label: name ? c.inviterGets(name) : c.inviterGetsNoName, value: p.youWeek }],
            }}
            back={{ mark: c.backMark, benefits: c.benefits, footer: [p.codeLine(code), p.noCharge] }}
          />
        </CardSpotlight>
        <div className="-mt-1 flex items-center justify-between gap-2">
          <Sub className="text-xs text-[var(--color-brand-text-muted)]">{c.tap}</Sub>
          {saved ? <Badge tone="positive" size="sm" bordered={false} data-invite-saved>{c.saved}</Badge> : null}
        </div>

        <MembershipPanel>
          <ul className="m-0 grid list-none gap-[9px] px-4 py-3.5 text-sm">
            {c.benefits.map((b) => (
              <li key={b} className="flex items-center gap-2.5">
                <Check aria-hidden className="size-4 shrink-0 text-[var(--color-brand-primary-ink)]" strokeWidth={2.25} />
                <span dir="auto">{b}</span>
              </li>
            ))}
          </ul>
        </MembershipPanel>

        <div className="mt-auto grid gap-2.5">
          {/* Real links: a tap before the page hydrates still goes on to sign-up (a router.push button did nothing then). */}
          {PRELAUNCH
            ? <Button size="cta-block" className="font-bold" nativeButton={false} render={<Link href={waitlistInvitePath(locale, code)} />}>{c.waitlist}</Button>
            : <Button size="cta-block" className="font-bold" nativeButton={false} render={<Link href={INVITE_TARGET} />}>{c.create}</Button>}
          <Button size="cta-block" variant="outline" nativeButton={false} render={<Link href={INVITE_TARGET} />}>{c.signIn}</Button>
        </div>
        <Fine>{PRELAUNCH ? c.waitlistFoot : c.foot}</Fine>
      </main>
    </div>
  )
}
