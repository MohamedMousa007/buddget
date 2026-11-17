'use client'

import { useEffect, useState } from 'react'
import { CardSpotlight } from '@/components/features/membership/FlipCardRig'
import { GuestPassCard } from '@/components/features/membership/GuestPassCard'
import { FriendRow, InviteEarnedCard, InviteLinkRow } from '@/components/features/membership/InviteBlocks'
import { MembershipPanel, PointsList, StepsList } from '@/components/features/membership/PointsList'
import { Fine, PageStack, Section, Sub, plainDate, withBold } from '@/components/features/rewards/pageParts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { BillingMe } from '@/lib/billing/billingStore'
import { useLocale } from '@/lib/i18n'
import { useRewardsCopy } from '@/lib/i18n/rewardsCopy'
import { fetchReferralSummary, type ReferralSummary } from '@/lib/referrals/referralsApi'
import { MONTH_CAP, YEAR_CAP } from '@/lib/referrals/rules'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { displayLink, earnedView, friendRow, friendToRemind, inviteReward } from './inviteCode'

/** Hands text to the system share sheet; where there is none, copies it. Resolves how it went. */
export async function shareOrCopy(text: string, url: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ text, url })
      return 'shared'
    }
  } catch (e) {
    if ((e as DOMException).name === 'AbortError') return 'shared'
  }
  try {
    await navigator.clipboard.writeText(text.includes(url) ? text : `${text} ${url}`)
    return 'copied'
  } catch {
    return 'failed'
  }
}

/** Invite friends: the guest pass, the link, what inviting has earned, the friends and their progress, and the rules. One summary call. */
export function InviteView({ me }: { me: BillingMe }) {
  const c = useRewardsCopy().invite
  const { locale } = useLocale()
  const first = (useFinanceStore((s) => s.profile.name) || '').trim().split(/\s+/)[0] ?? ''
  const [summary, setSummary] = useState<ReferralSummary | null>(null)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)

  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let live = true
    void fetchReferralSummary().catch(() => null).then((s) => {
      if (!live) return
      if (s) setSummary(s)
      setFailed(!s)
    })
    return () => { live = false }
  }, [attempt])
  const load = () => setAttempt((n) => n + 1)

  const invite = me.rewards?.invite
  const enabled = summary?.enabled ?? invite?.enabled ?? false
  const code = summary?.code ?? invite?.code ?? ''
  const link = summary?.link ?? invite?.link ?? ''
  if (!enabled || !code) return <p role="status" dir="auto" className="text-sm text-[var(--color-brand-text-secondary)]">{c.paused}</p>

  const reward = inviteReward(me)
  const sparks = reward === 'sparks'
  const rewardText = sparks ? c.rewardSparks : c.rewardWeek
  const date = (iso: string) => plainDate(iso, locale, false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard refused: the link stays on screen to copy by hand */ }
  }
  const share = async (text: string) => { if ((await shareOrCopy(text, link)) === 'copied') { setCopied(true); window.setTimeout(() => setCopied(false), 2000) } }
  const earned = summary ? earnedView(summary, reward) : null
  const remind = summary ? friendToRemind(summary.friends) : null

  return (
    <PageStack>
      <div className="grid justify-items-center gap-1.5 text-center">
        <Badge tone="brand" size="sm" bordered={false}>{c.pill}</Badge>
        <h3 dir="auto" className="m-0 text-2xl font-bold leading-[1.12] tracking-[-0.025em] text-[var(--color-brand-text-primary)] [text-wrap:balance] rtl:leading-[1.4] rtl:tracking-normal [&_b]:text-[var(--color-brand-primary-ink)]">
          {withBold(c.heroGive, c.heroGiveBold)}<br />{withBold(c.heroGet, sparks ? c.heroSparks : c.heroWeek)}
        </h3>
        <Sub>{c.heroSub(rewardText)}</Sub>
      </div>

      <CardSpotlight hint={c.pass.tap}>
        <GuestPassCard
          flipLabel={c.pass.flip}
          front={{
            mark: c.pass.mark,
            title: first ? c.pass.title(first) : c.pass.titleNoName,
            subtitle: c.pass.sub,
            facts: [{ label: c.pass.code, value: code, code: true }, { label: c.pass.friendGets, value: <span className="whitespace-nowrap">{c.pass.friendValue}</span> }, { label: c.pass.youGet, value: <span className="whitespace-nowrap">{sparks ? c.pass.youSparks : c.pass.youWeek}</span> }],
          }}
          back={{ mark: c.pass.backMark, benefits: c.pass.benefits, footer: [c.pass.codeLine(code), c.pass.noCharge] }}
        />
      </CardSpotlight>

      <div className="grid gap-2">
        <Button size="cta-block" className="font-bold" onClick={() => void share(c.shareText(link))}>{c.share}</Button>
        <InviteLinkRow link={displayLink(link)} copyLabel={copied ? c.copied : c.copy} onCopy={() => void copy()} />
      </div>

      {earned && summary ? (
        <InviteEarnedCard
          title={withBold(earned.kind === 'sparks' ? c.earned.sparks : c.earned.weeks(earned.amount), <span dir="ltr">{earned.amount.toLocaleString('en')}</span>)}
          monthLabel={c.earned.month(summary.caps.monthUsed, summary.caps.month ?? MONTH_CAP)}
          filled={summary.caps.monthUsed}
          slots={summary.caps.month ?? MONTH_CAP}
          footStart={earned.kind === 'sparks' ? c.earned.added : c.earned.startsLater}
          footEnd={withBold(c.earned.yearCap, summary.caps.year ?? YEAR_CAP)}
        />
      ) : null}

      <Section title={c.friendsTitle}>
        {failed ? (
          <MembershipPanel className="grid gap-2 p-4">
            <Sub>{c.loadError}</Sub>
            <Button size="touch" variant="outline" onClick={load}>{c.tryAgain}</Button>
          </MembershipPanel>
        ) : (
          <MembershipPanel>
            {summary && summary.friends.length > 0
              ? summary.friends.map((friend) => <FriendRow key={friend.id} {...friendRow(friend, c.friend, date)} />)
              : <FriendRow status="pending" name={c.none} detail={c.noneHint} statusLabel="" />}
          </MembershipPanel>
        )}
        {remind?.name ? <Button size="touch" variant="outline" className="w-full font-semibold" onClick={() => void share(c.remindText(link))}>{c.remind(remind.name)}</Button> : null}
      </Section>

      <Section title={c.howTitle}><StepsList steps={c.steps(rewardText)} /></Section>

      <Section title={c.milestonesTitle}>
        <PointsList
          rows={(summary?.milestones ?? [{ friends: 3, kind: 'points', amount: 50, reached: false }, { friends: 5, kind: 'points', amount: 100, reached: false }, { friends: 10, kind: 'card_finish', reached: false }] as ReferralSummary['milestones']).map((ms) => ({
            label: c.ms.friends(ms.friends),
            hint: ms.reached ? c.ms.reached : undefined,
            value: ms.kind === 'points' ? c.ms.pts(ms.amount ?? 0) : c.ms.connector,
          }))}
        />
        <Fine>{c.fine}</Fine>
      </Section>
    </PageStack>
  )
}
