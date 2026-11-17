'use client'

import { AvatarBadge, FounderChip } from '@/components/features/membership/AvatarBadge'
import { MembershipPanel } from '@/components/features/membership/PointsList'
import { TierBadge } from '@/components/features/membership/TierBadge'
import { initials } from '@/components/features/rewards/pageParts'
import { useMemberMarks } from '@/components/features/rewards/useMemberMarks'

/** The profile head (option A): the avatar with its PRO tag and founder ring, the name with the tier badge and founder chip, the plan and tier line. Absent while billing is off. */
export function ProfileMemberHead({ name, avatarSrc }: { name: string; avatarSrc: string | null | undefined }) {
  const marks = useMemberMarks()
  if (!marks.line) return null
  return (
    <MembershipPanel className="flex items-center gap-3.5 p-4">
      <AvatarBadge proTag={marks.proTag} founder={!!marks.founderNumber}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {avatarSrc ? <img src={avatarSrc} alt="" width={64} height={64} /> : initials(name)}
      </AvatarBadge>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 text-lg font-bold tracking-[-0.01em] text-[var(--color-brand-text-primary)] rtl:tracking-normal">
          <span dir="auto" className="min-w-0 break-words">{name}</span>
          {marks.tier ? <TierBadge tier={marks.tier} size={22} label={marks.tierLabel} /> : null}
          {marks.founderNumber ? <FounderChip number={marks.founderNumber} /> : null}
        </div>
        <small dir="auto" className="block text-[0.78125rem] font-medium text-[var(--color-brand-text-secondary)]">{marks.line}</small>
      </div>
    </MembershipPanel>
  )
}
