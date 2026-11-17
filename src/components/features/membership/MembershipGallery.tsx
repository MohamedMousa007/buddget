'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { AvatarBadge, FounderChip } from './AvatarBadge'
import { CardSpotlight } from './FlipCardRig'
import { FounderSignatureCard } from './FounderSignatureCard'
import { GuestPassCard } from './GuestPassCard'
import { HotStreakCard, type StreakWeek } from './HotStreakCard'
import { FriendRow, InviteCtaCard, InviteEarnedCard, InviteLinkRow } from './InviteBlocks'
import { LetterpressTierCard } from './LetterpressTierCard'
import { ManageBar, type ManageAction } from './ManageBar'
import { PlanCompareShowcase } from './PlanCompareShowcase'
import { MembershipPanel, PointsList, StepsList } from './PointsList'
import { ProMemberCard } from './ProMemberCard'
import { ProMonthPanel } from './ProMonthPanel'
import { SparksPacks, packTotalSparks, type SparksPackOption } from './SparksPacks'
import { TierBadge } from './TierBadge'
import { TierLadder } from './TierLadder'
import { TIER_ORDER, isTierLocked, tierProgressPct, tierRank, type TierKey } from './tiers'

/*
 * Every membership component in every state, with the mockup's own sample copy, for a side-by-side check against
 * docs/design/pro-rewards/mockup.html. Not routed and not localised: the pages pass real EN and AR copy.
 */

const NAME = 'Layla Hassan'
const noop = () => {}

const TIER: Record<TierKey, { name: string; floor: number; next: number | null; pts: number; perks: string[]; ladder: string }> = {
  silver: { name: 'Silver', floor: 0, next: 300, pts: 120, perks: ['Your badge after your name', 'Points and a streak for every real week', 'The points shop'], ladder: 'Everyone starts here. Your card, badge and streak.' },
  emerald: { name: 'Emerald', floor: 300, next: 800, pts: 540, perks: ['A streak freeze every 4 weeks', 'Emerald app icon and monthly recap', 'Everything in Silver'], ladder: 'A freeze every 4 weeks, the emerald app icon and your monthly recap.' },
  diamond: { name: 'Diamond', floor: 800, next: 1500, pts: 1210, perks: ['Early access to new features', 'Diamond app icon and card', 'Everything in Emerald'], ladder: 'Early access to new features and the diamond app icon.' },
  elite: { name: 'Elite', floor: 1500, next: null, pts: 1980, perks: ['The crimson card and app icon', 'Your Elite waits if Pro pauses', 'Everything in Diamond'], ladder: 'Pro members only. The crimson card and app icon.' },
  founder: { name: 'Elite Founder', floor: 1500, next: null, pts: 1980, perks: ['Your founder number on the card', 'A say in what we build', 'Everything in Elite'], ladder: 'Founders who reach Elite. The highest tier there is.' },
}
const fmt = (n: number) => n.toLocaleString('en')

function tierCard(tier: TierKey, proActive: boolean) {
  const t = TIER[tier]
  const nextKey = TIER_ORDER[TIER_ORDER.indexOf(tier) + 1]
  const nextLine = tier === 'elite' ? 'The top tier for Pro members' : t.next !== null && nextKey ? `${fmt(t.next - t.pts)} pts to ${TIER[nextKey].name}` : 'The highest tier there is'
  return (
    <LetterpressTierCard
      tier={tier}
      locked={isTierLocked(tier, proActive)}
      lockLabel="Pro members only"
      flipLabel={`Your buddget rewards card, ${t.name} tier. Tap to see its perks`}
      front={{ tierName: t.name, points: fmt(t.pts), pointsUnit: 'pts', name: NAME, progress: tierProgressPct(t.pts, t.floor, t.next), nextLine, rankLine: `Tier ${tierRank(tier)} of 5` }}
      back={{ title: `${t.name} perks`, perks: t.perks, footer: [tier === 'founder' ? 'Founder #023' : 'Member 0042', 'Since Nov 2026'] }}
    />
  )
}

const proCard = (trial: boolean, tier: TierKey) => (
  <ProMemberCard
    flipLabel="Your buddget Pro membership card. Tap to flip"
    front={{
      mark: trial ? 'PRO TRIAL' : 'PRO',
      name: NAME,
      tier,
      tierLabel: `${TIER[tier].name} tier`,
      planLine: trial ? '30-day trial · No card on file' : 'Pro Yearly · Billed by the App Store',
      facts: [{ label: 'Member since', value: '17 NOV 2026' }, { label: trial ? 'Trial ends' : 'Renews', value: trial ? '16 DEC 2026' : '17 NOV 2027' }, { label: 'Member', value: '0427' }],
    }}
    back={{
      mark: 'INCLUDED',
      included: ['About 10x the AI', 'The Buddgy Advisor', 'Unlimited plans and View balance', '15% more Sparks in every pack'],
      billing: trial ? ['Then EGP 499 / year, if you choose', 'No charge yet'] : ['EGP 499 / year', 'Next 17 Nov 2027'],
    }}
  />
)

const founderCard = (name: string) => (
  <FounderSignatureCard
    flipLabel="Your founder card, number 23. Tap to flip"
    front={{ mark: 'FOUNDER', number: '#023', name, numberLabel: 'Your number', thanks: 'With thanks for building buddget with us from the very first weeks.' }}
    back={{ mark: 'FOUNDERS CLUB', perks: ['Founder #023 of at most 100', 'Your name on the credits, if you want it', 'Asked first when we test something new', 'Elite Founder when you reach Elite'], footer: ['Joined 17 Nov 2026', 'Yours for good'] }}
  />
)

const guestPass = (pro: boolean) => (
  <GuestPassCard
    flipLabel="Your invite pass. Tap to flip"
    front={{
      mark: 'GUEST PASS',
      title: '37 days of Pro, on Layla',
      subtitle: 'No card needed · For a new buddget account',
      facts: [{ label: 'Invite code', value: 'LAYLA-7K2', code: true }, { label: 'Friend gets', value: '30 + 7 DAYS' }, { label: 'You get', value: pro ? '500 SPARKS' : '1 WEEK' }],
    }}
    back={{ mark: 'WHAT THEY GET', benefits: ['Bank texts tracked automatically', 'About 10x the AI, and the Advisor', '37 days free, then Free or Pro: their choice'], footer: ['Code LAYLA-7K2', 'No card, no charge'] }}
  />
)

const manageActions = (trial: boolean): ManageAction[] => [
  { kind: 'plan', label: trial ? 'Choose plan' : 'Change plan', onClick: noop },
  { kind: 'manage', label: 'Manage', onClick: noop },
  { kind: 'restore', label: 'Restore', onClick: noop },
  { kind: 'receipts', label: 'Receipts', onClick: noop },
]

const capLabel = (cap: string) => <>Free stops at <b>{cap}</b></>
const monthPanel = (trial: boolean) => (
  <ProMonthPanel
    kicker={trial ? 'So far with Pro' : 'Pro this month'}
    title={<>Pro went <b>{trial ? '3×' : '7×'}</b> further than Free would have</>}
    subtitle={trial ? 'Four days in, and you’ve already passed three Free limits.' : 'You passed every Free limit, and nothing stopped you.'}
    youLabel="You"
    tiles={[
      { value: trial ? '38' : '214', label: 'Buddgy answers', delta: trial ? undefined : '+18%', freeCapPct: trial ? 79 : 14, capLabel: capLabel('≈30') },
      { value: trial ? '6' : '31', label: 'Receipts scanned', delta: trial ? undefined : '+9%', freeCapPct: trial ? 100 : 19, capLabel: capLabel('≈6') },
      { value: trial ? '3' : '12', label: 'Advisor answers', delta: trial ? undefined : '+4', freeCapPct: trial ? 33 : 8, capLabel: capLabel('1') },
      { value: trial ? '4' : '19', label: 'View balance', freeCapPct: trial ? 100 : 53, capLabel: capLabel('10') },
    ]}
  />
)

const WEEKS: StreakWeek[] = ['kept', 'kept', 'missed', 'kept', 'kept', 'frozen', 'kept', 'kept', 'kept', 'kept', 'kept', 'current']
const PACKS: SparksPackOption[] = [{ id: 'sparks_320', sparks: 320, price: 'EGP 49.99' }, { id: 'sparks_650', sparks: 650, price: 'EGP 99.99' }, { id: 'sparks_2000', sparks: 2000, price: 'EGP 299.99' }]
const EXTRA: SparksPackOption[] = [{ id: 'sparks_60', sparks: 60, price: 'EGP 9.99', tag: 'Egypt' }, { id: 'sparks_125', sparks: 125, price: 'EGP 19.99', tag: 'Egypt' }]

function Packs({ pro }: { pro: boolean }) {
  const [selected, setSelected] = useState('sparks_650')
  const picked = [...PACKS, ...EXTRA].find((p) => p.id === selected) ?? PACKS[1]!
  return (
    <MembershipPanel className="p-4">
      <SparksPacks
        packs={PACKS}
        extraPacks={EXTRA}
        selected={selected}
        onSelect={setSelected}
        popularId="sparks_650"
        bonusPercent={pro ? 15 : 0}
        copy={{ group: 'Sparks packs', popular: 'Most popular', plain: 'Sparks', bonus: (n) => `+${n} Pro bonus`, more: 'More packs', fewer: 'Fewer packs' }}
        cta={{ label: `Get ${packTotalSparks(picked, pro ? 15 : 0)} Sparks`, onClick: noop }}
        upsell={pro ? undefined : { text: `With Pro, this pack is ${packTotalSparks(picked, 15)} Sparks`, actionLabel: 'See Pro', onAction: noop }}
        finePrint={pro ? 'Pro adds 15% to every pack. Your Pro and member bonuses never add together; you always get the bigger one.' : undefined}
      />
    </MembershipPanel>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-text-muted)]">{title}</h3>
      {children}
    </section>
  )
}

const nameRow = (tier: TierKey, founder: boolean) => (
  <span className="flex flex-wrap items-center gap-1.5 text-lg font-bold text-[var(--color-brand-text-primary)]">
    {NAME}<TierBadge tier={tier} size={22} label={`${TIER[tier].name} tier`} />{founder ? <FounderChip number="#023" /> : null}
  </span>
)

export function MembershipGallery({ dark = false, className }: { /** Draw the dark theme regardless of the app's. */ dark?: boolean; className?: string }) {
  return (
    <div className={cn(dark && 'dark', 'bg-[var(--color-brand-bg)] text-[var(--color-brand-text-primary)]', className)}>
      <div className="mx-auto flex w-full max-w-[390px] flex-col gap-[22px] overflow-x-hidden px-4 py-6">
        <Section title="Pro card · Pro"><CardSpotlight hint="Tap the card to view details">{proCard(false, 'emerald')}</CardSpotlight></Section>
        <Section title="Pro card · Trial"><CardSpotlight hint="Tap the card to view details">{proCard(true, 'diamond')}</CardSpotlight></Section>
        {TIER_ORDER.map((t) => (
          <Section key={t} title={`Rewards card · ${TIER[t].name}`}><CardSpotlight hint="Tap the card to see its perks">{tierCard(t, true)}</CardSpotlight></Section>
        ))}
        <Section title="Rewards card · Elite, locked"><CardSpotlight hint="Tap the card to see its perks">{tierCard('elite', false)}</CardSpotlight></Section>
        <Section title="Rewards card · Elite Founder, locked"><CardSpotlight hint="Tap the card to see its perks">{tierCard('founder', false)}</CardSpotlight></Section>
        <Section title="Founder card"><CardSpotlight hint="Tap the card to flip it">{founderCard(NAME)}</CardSpotlight></Section>
        <Section title="Founder card · Arabic name"><CardSpotlight hint="Tap the card to flip it">{founderCard('ليلى حسن')}</CardSpotlight></Section>
        <Section title="Guest pass · Free or trial inviter"><CardSpotlight hint="Tap the pass to see what your friend gets">{guestPass(false)}</CardSpotlight></Section>
        <Section title="Guest pass · Pro inviter"><CardSpotlight hint="Tap the pass to see what your friend gets">{guestPass(true)}</CardSpotlight></Section>

        <Section title="Tier badges · 16, 20, 22, 28, 34">
          {TIER_ORDER.map((t) => (
            <div key={t} className="flex items-center gap-3">
              {[16, 20, 22, 28, 34].map((n) => <TierBadge key={n} tier={t} size={n} label={`${TIER[t].name} tier`} />)}
              <span className="text-sm text-[var(--color-brand-text-secondary)]">{TIER[t].name}</span>
            </div>
          ))}
        </Section>

        <Section title="Avatar marks">
          <MembershipPanel className="flex items-center gap-3.5 p-4"><AvatarBadge>LH</AvatarBadge><div>{nameRow('silver', false)}<small className="block text-[0.78125rem] text-[var(--color-brand-text-secondary)]">Free · Silver</small></div></MembershipPanel>
          <MembershipPanel className="flex items-center gap-3.5 p-4"><AvatarBadge proTag="PRO">LH</AvatarBadge><div>{nameRow('diamond', false)}<small className="block text-[0.78125rem] text-[var(--color-brand-text-secondary)]">buddget Pro · Diamond</small></div></MembershipPanel>
          <MembershipPanel className="flex items-center gap-3.5 p-4"><AvatarBadge proTag="PRO" founder>LH</AvatarBadge><div>{nameRow('founder', true)}<small className="block text-[0.78125rem] text-[var(--color-brand-text-secondary)]">Founder #023 · Elite Founder</small></div></MembershipPanel>
          <MembershipPanel className="flex items-center gap-3.5 p-4"><AvatarBadge founder>LH</AvatarBadge><div>{nameRow('emerald', true)}<small className="block text-[0.78125rem] text-[var(--color-brand-text-secondary)]">Founder #023 · Free · Emerald</small></div></MembershipPanel>
          <MembershipPanel className="flex items-center gap-5 p-4">
            <AvatarBadge size="md" cornerTier="emerald" cornerTierLabel="Emerald tier">LH</AvatarBadge>
            <AvatarBadge size="sm" proTag="PRO" founder>LH</AvatarBadge>
            <AvatarBadge size="sm" proTag="PRO">NA</AvatarBadge>
            <AvatarBadge size="sm">OK</AvatarBadge>
            <FounderChip number="#023" />
          </MembershipPanel>
        </Section>

        <Section title="Manage bar · Pro"><ManageBar label="Manage subscription" status={<>Renews <b>17 Nov 2027</b> · EGP 499 / yr</>} pill={{ label: '● Active', tone: 'positive' }} actions={manageActions(false)} /></Section>
        <Section title="Manage bar · Trial"><ManageBar label="Manage subscription" status={<>Trial · <b>no card on file</b></>} pill={{ label: 'Day 4 of 30', tone: 'brand' }} actions={manageActions(true)} /></Section>
        <Section title="Value panel · Pro">{monthPanel(false)}</Section>
        <Section title="Value panel · Trial">{monthPanel(true)}</Section>

        <Section title="Free showcase">
          <PlanCompareShowcase
            head={{ pill: 'You’re on Free', title: 'See what Pro adds to your money', subtitle: 'Same app. More AI, the Advisor, and no limits.' }}
            freeTitle="Free"
            proTitle="Pro"
            nowLabel="Now"
            rows={[
              { label: 'Buddgy and receipts', free: 'Limited', pro: 'About 10x more' },
              { label: 'Advisor', free: '1 a month', pro: 'Whenever you ask' },
              { label: 'Budget plans', free: '2', pro: 'Unlimited' },
              { label: 'View balance', free: '10 a month', pro: 'Unlimited' },
              { label: 'Sparks packs', free: 'Standard', pro: '+15% Sparks' },
            ]}
            footnote="SMS tracking stays free on every account."
          />
        </Section>

        <Section title="Hot streak">
          <HotStreakCard title={<><b>6</b>-week streak</>} subtitle="Your best is 9 weeks" points="+300" pointsLabel="points this streak" weeks={WEEKS} stripLabel="Last 12 weeks: 10 kept, 1 frozen, 1 missed" footStart={<>Next bonus at <b>8 weeks</b> · x2</>} footEnd={<><b>2</b> freezes left</>} />
        </Section>
        <Section title="Hot streak · new, this week open">
          <HotStreakCard title={<><b>2</b>-week streak</>} subtitle="Your best is 2 weeks" points="+20" pointsLabel="points this streak" weeks={['kept', 'kept', 'pending']} stripLabel="Last 12 weeks: 2 kept" footStart={<>Next bonus at <b>4 weeks</b> · x1.5</>} footEnd={<><b>0</b> freezes left</>} />
        </Section>

        <Section title="Invite call to action"><InviteCtaCard title="Give 37 days of Pro, get a week" subtitle="For every friend who sticks with buddget" actionLabel="Invite ›" onClick={noop} /></Section>

        {(['emerald', 'founder'] as const).map((cur) => (
          <Section key={cur} title={`Tier ladder · ${TIER[cur].name}`}>
            <TierLadder current={cur} proLabel="PRO" hereLabel="you’re here" rows={TIER_ORDER.map((t) => ({ tier: t, name: TIER[t].name, description: TIER[t].ladder, threshold: t === 'founder' ? 'Founder' : fmt(TIER[t].floor) }))} />
          </Section>
        ))}

        <Section title="Earn points"><PointsList rows={[{ label: 'Keep your week', hint: 'x1.5 from week 4, x2 from week 8', value: '+10' }, { label: 'Set your budget', value: '+10' }, { label: 'Track a full month', value: '+40' }]} /></Section>
        <Section title="Spend points"><PointsList rows={[{ label: 'Repair a missed week', hint: 'Within 48 hours, keeps your streak', value: '120 pts' }, { label: 'A streak freeze', value: '80 pts' }, { label: 'A card finish', value: '150 pts' }, { label: 'A Buddgy look', value: '120 pts' }]} /></Section>
        <Section title="Invite milestones"><PointsList rows={[{ label: '3 friends', value: '+50 pts' }, { label: '5 friends', value: '+100 pts' }, { label: '10 friends', value: 'The Connector card finish' }]} /></Section>

        <Section title="Invite link"><InviteLinkRow link="buddget.app/i/LAYLA-7K2" copyLabel="Copy link" onCopy={noop} /></Section>
        <Section title="Invite earned · weeks"><InviteEarnedCard title={<><b>2</b> weeks of Pro earned</>} monthLabel="2 of 4 this month" filled={2} footStart="Starts when your trial or Pro time ends" footEnd={<>Up to <b>12</b> a year</>} /></Section>
        <Section title="Invite earned · Sparks"><InviteEarnedCard title={<><b>1,000</b> Sparks earned</>} monthLabel="2 of 4 this month" filled={2} footStart="Added to your Sparks" footEnd={<>Up to <b>12</b> a year</>} /></Section>
        <Section title="Friends">
          <MembershipPanel>
            <FriendRow status="done" initials="NA" name="Nour A." detail="Joined 3 Nov · stuck with it" statusLabel="+1 week" />
            <FriendRow status="done" initials="OK" name="Omar K." detail="Joined 9 Nov · stuck with it" statusLabel="+500 Sparks" />
            <FriendRow status="almost" initials="SM" name="Sara M." detail="Active 2 of 3 days" statusLabel="Almost there" progress={{ done: 2, total: 3 }} />
            <FriendRow status="pending" name="Invite sent" detail="Waiting for them to join" statusLabel="Pending" />
          </MembershipPanel>
        </Section>
        <Section title="How it works"><StepsList steps={['Share your link or code', 'Your friend joins and gets 37 days of Pro, no card', 'They use buddget on 3 days in their first 2 weeks: you get a week of Pro']} /></Section>

        <Section title="Sparks packs · Free"><Packs pro={false} /></Section>
        <Section title="Sparks packs · Pro"><Packs pro /></Section>
      </div>
    </div>
  )
}
