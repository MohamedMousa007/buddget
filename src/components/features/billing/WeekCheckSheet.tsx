'use client'

import { useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { SheetBody, SheetFooter } from '@/components/features/savings-v3/MoneySheetParts'
import { SegmentStrip, type Segment } from '@/components/features/membership/SegmentStrip'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useMembershipCopy } from '@/lib/i18n/membershipCopy'
import { keepWeek, type KeepWeekResult } from '@/lib/loyalty/loyaltyApi'
import { weekCheckState } from '@/lib/loyalty/weekCheck'
import { useWeekCheckStore } from '@/lib/loyalty/weekCheckStore'
import { requestSmsReview } from '@/lib/sms/reviewRequest'

const STRIP = 8

function streakSegments(weeks: number): Segment[] {
  const kept = Math.min(weeks, STRIP - 1)
  return Array.from({ length: STRIP }, (_, i) => (i < kept ? 'kept' : i === kept ? 'now' : 'empty'))
}

/** The weekly check: keep the week, see the streak. The server decides whether the week may be kept and what it pays; this sheet only asks and shows. */
export function WeekCheckSheet() {
  const c = useMembershipCopy().week
  const open = useWeekCheckStore((s) => s.open)
  const summary = useWeekCheckStore((s) => s.summary)
  const close = useWeekCheckStore((s) => s.closeSheet)
  const load = useWeekCheckStore((s) => s.load)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<KeepWeekResult | null>(null)

  if (!open || !summary) return null
  const { week } = weekCheckState(summary)
  const target = week === 'last' ? summary.lastWeek : summary.thisWeek
  const unconfirmed = week === 'last' ? summary.unconfirmedLastWeek : summary.unconfirmedThisWeek
  const kept = result?.status === 'kept'
  const streak = kept ? result.streak : summary.streakWeeks

  const dismiss = () => { setResult(null); close() }
  const keep = async () => {
    setBusy(true)
    const out = await keepWeek(target)
    setBusy(false)
    setResult(out)
    if (out.status === 'kept' || out.status === 'already_kept') void load()
  }
  const note = !result ? null : kept ? null : result.status === 'already_kept' ? c.already : result.status === 'too_soon' || result.status === 'out_of_window' ? c.closed : result.status === 'unconfirmed_items' ? c.unconfirmed(unconfirmed || 1) : c.failed

  return (
    <ModalShell open onBackdropClick={busy ? () => {} : dismiss} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={busy ? () => {} : dismiss}>
          <V3SheetHeader.Title>{c.title}</V3SheetHeader.Title>
          <V3SheetHeader.Subtitle>{week === 'last' ? c.lastWeek : c.thisWeek}</V3SheetHeader.Subtitle>
        </V3SheetHeader>
        <SheetBody className="space-y-4 pt-1">
          <div className="rounded-[20px] bg-[image:var(--member-aurora)] p-4 text-[var(--member-fg)]">
            <p dir="ltr" className="font-mono-numbers text-[2.75rem] font-semibold leading-none">{streak}</p>
            <p dir="auto" className="mt-1 text-sm text-[var(--member-fg-2)]">{c.streak(streak)}</p>
            <div className="mt-3"><SegmentStrip segments={streakSegments(streak)} label={c.streak(streak)} onSurface /></div>
            {summary.freezesBanked > 0 ? <Badge tone="onBrand" size="sm" className="mt-3">{c.freeze(summary.freezesBanked)}</Badge> : null}
          </div>
          {kept ? (
            <div dir="auto" role="status" className="space-y-1">
              <p className="text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">{c.kept}</p>
              {result.points > 0 ? <p className="font-mono-numbers text-sm font-semibold text-[var(--color-brand-green)]">{c.plusPoints}</p> : <p className="text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{c.noRecord}</p>}
            </div>
          ) : null}
          {!kept && unconfirmed > 0 ? <p dir="auto" role="status" className="text-sm text-[var(--color-brand-text-secondary)]">{c.unconfirmed(unconfirmed)}</p> : null}
          {note ? <p role="status" dir="auto" className="text-xs text-[var(--color-brand-text-secondary)]">{note}</p> : null}
        </SheetBody>
        <SheetFooter safeArea>
          {kept ? (
            <Button size="cta-block" onClick={dismiss} className="font-semibold">{c.close}</Button>
          ) : unconfirmed > 0 ? (
            <Button size="cta-block" onClick={() => { dismiss(); requestSmsReview() }} className="font-semibold">{c.review}</Button>
          ) : (
            <Button size="cta-block" loading={busy} onClick={() => void keep()} className="font-semibold">{c.keepCta}</Button>
          )}
        </SheetFooter>
      </div>
    </ModalShell>
  )
}
