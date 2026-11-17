import type { ReactNode } from 'react'
import { Gift } from 'lucide-react'
import { cn } from '@/lib/utils'
import s from './membership.module.css'

export interface InviteCtaCardProps {
  /** "Give 37 days of Pro, get a week". */
  title: ReactNode
  /** "For every friend who sticks with buddget". */
  subtitle: ReactNode
  /** "Invite ›". */
  actionLabel: string
  onClick: () => void
  className?: string
}

/** The invite call to action that sits on Rewards, the profile hub and Plan and billing. The whole card is the control. */
export function InviteCtaCard({ title, subtitle, actionLabel, onClick, className }: InviteCtaCardProps) {
  return (
    <button type="button" onClick={onClick} className={cn(s.invcta, className)} data-raw-button-ok="a card that is one control: gift tile, two lines, action word">
      <span className={s.gi}><Gift aria-hidden /></span>
      <span><b dir="auto">{title}</b><small dir="auto">{subtitle}</small></span>
      <span dir="auto" className={s.go}>{actionLabel}</span>
    </button>
  )
}

/** How many reward slots are lit: never more than there are, never fewer than none. */
export const filledSlots = (filled: number, slots: number): number => Math.min(Math.max(0, Math.floor(filled)), Math.max(0, slots))

export interface InviteEarnedCardProps {
  /** "2 weeks of Pro earned": wrap the number in <b>. */
  title: ReactNode
  /** "2 of 4 this month". */
  monthLabel: ReactNode
  /** Rewards earned this month, and the monthly cap. */
  filled: number
  slots?: number
  /** "Starts when your trial or Pro time ends". */
  footStart?: ReactNode
  /** "Up to 12 a year": <b> marks the emphasis. */
  footEnd?: ReactNode
  className?: string
}

/** What inviting has earned: the total, this month's slots (2 of 4), and the yearly cap. */
export function InviteEarnedCard({ title, monthLabel, filled, slots = 4, footStart, footEnd, className }: InviteEarnedCardProps) {
  const on = filledSlots(filled, slots)
  return (
    <div className={cn(s.earned, className)}>
      <div className={s.earnedTop}><h4 dir="auto">{title}</h4><span dir="auto">{monthLabel}</span></div>
      <div className={s.slots} aria-hidden>
        {Array.from({ length: slots }, (_, i) => <i key={i} className={cn(i < on && s.slotOn)} data-on={i < on || undefined} />)}
      </div>
      {footStart || footEnd ? <div className={s.foot}><span dir="auto">{footStart}</span><span dir="auto">{footEnd}</span></div> : null}
    </div>
  )
}

export type FriendStatus = 'done' | 'almost' | 'pending'

export interface FriendRowProps {
  /** `done` earned the reward, `almost` joined and is part-way to counting, `pending` has not joined yet. */
  status: FriendStatus
  /** Initials; a pending invite shows "+" instead. */
  initials?: string
  name: ReactNode
  /** "Joined 3 Nov · stuck with it" / "Active 2 of 3 days" / "Waiting for them to join". */
  detail: ReactNode
  /** "+1 week" (green) or "Almost there" / "Pending" (amber). */
  statusLabel: ReactNode
  /** Almost there: active days so far out of the days needed. Draws the mini bar. */
  progress?: { done: number; total: number }
  className?: string
}

/** One invited friend. Put the rows in a `MembershipPanel`. */
export function FriendRow({ status, initials, name, detail, statusLabel, progress, className }: FriendRowProps) {
  const on = progress ? filledSlots(progress.done, progress.total) : 0
  return (
    <div className={cn(s.friend, className)} data-status={status}>
      <span className={cn(s.fav, status === 'pending' && s.favPending)} aria-hidden>{status === 'pending' ? '+' : initials}</span>
      <div>
        <b dir="auto">{name}</b>
        <small dir="auto">{detail}</small>
        {status === 'almost' && progress ? (
          <div className={s.mini3} aria-hidden>
            {Array.from({ length: progress.total }, (_, i) => <i key={i} className={cn(i < on && s.miniOn)} />)}
          </div>
        ) : null}
      </div>
      <em dir="auto" className={cn(status !== 'done' && s.wait)}>{statusLabel}</em>
    </div>
  )
}

export interface InviteLinkRowProps {
  /** Shown as is, left to right: "buddget.app/i/LAYLA-7K2". */
  link: string
  /** "Copy link"; pass "Copied" after a copy. */
  copyLabel: string
  onCopy: () => void
  className?: string
}

/** The invite link in a dashed well with its copy button. */
export function InviteLinkRow({ link, copyLabel, onCopy, className }: InviteLinkRowProps) {
  return (
    <div className={cn(s.linkrow, className)}>
      <span dir="ltr">{link}</span>
      <button type="button" onClick={onCopy} className={s.linkBtn} data-raw-button-ok="the copy chip inside the link well, drawn 40px with a 44px tap area">{copyLabel}</button>
    </div>
  )
}
