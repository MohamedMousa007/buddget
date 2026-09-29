'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addMonths, format, subMonths } from 'date-fns'
import { IconButton } from '@/components/ui/IconButton'
import { PaydaysButton, HEADER_TITLE_ATTR } from '@/components/features/income/PaydaysButton'
import { ProfileAvatarWithMenu } from '@/components/layout/AuthNavButtons'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { navigate } from '@/lib/navigation/navigate'
import { useT } from '@/lib/i18n'

/** Flow's header: eyebrow, month + year, month arrows, Paydays (adaptive) and the avatar. */
export function FlowHeader({ monthName }: { monthName: string }) {
  const t = useT()
  const monthFilter = useSettingsStore((s) => s.monthFilter)
  const setMonthFilter = useSettingsStore((s) => s.setMonthFilter)
  const month = new Date(`${monthFilter}-01T00:00:00`)
  const atCurrent = monthFilter >= format(new Date(), 'yyyy-MM')

  return (
    <div className="flex min-h-14 items-center gap-0.5 pe-3 ps-[18px] pt-1">
      <div className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">
          {t.flow.eyebrow}
        </span>
        <span {...{ [HEADER_TITLE_ATTR]: '' }} className="flex items-baseline gap-1.5 overflow-hidden whitespace-nowrap">
          <span className="shrink-0 text-2xl font-bold tracking-[-0.02em] text-[var(--color-brand-text-primary)]">{monthName}</span>
          <span className="shrink-0 font-mono-numbers text-[13px] text-[var(--color-brand-text-muted)]">{format(month, 'yyyy')}</span>
        </span>
      </div>
      <IconButton variant="ghost" size="sm" aria-label={t.common.previousMonth} onClick={() => setMonthFilter(format(subMonths(month, 1), 'yyyy-MM'))}>
        <ChevronLeft className="size-[18px] rtl:rotate-180" strokeWidth={2} />
      </IconButton>
      <IconButton
        variant="ghost"
        size="sm"
        aria-label={t.common.nextMonth}
        disabled={atCurrent}
        onClick={() => setMonthFilter(format(addMonths(month, 1), 'yyyy-MM'))}
      >
        <ChevronRight className="size-[18px] rtl:rotate-180" strokeWidth={2} />
      </IconButton>
      <PaydaysButton onClick={() => navigate('/paydays')} />
      <ProfileAvatarWithMenu />
    </div>
  )
}
