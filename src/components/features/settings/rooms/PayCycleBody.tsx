'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
import { arEG, enUS } from 'date-fns/locale'
import { Minus, Plus } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { IconButton } from '@/components/ui/IconButton'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { SETTING_ICONS } from '@/components/features/settings/settingIcons'
import { ROOM_TONE } from '@/components/features/settings/roomMeta'
import { useLocale } from '@/lib/i18n'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { PAY_CYCLE_MAX_DAY, PAY_CYCLE_MIN_DAY, currentCycle } from '@/lib/settings/payCycle'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

export function PayCycleBody() {
  const copy = useSettingsHubCopy()
  const c = copy.payCycle
  const { locale } = useLocale()
  const day = useFinanceStore((s) => s.settings.monthStartDay)
  const updateSettings = useFinanceStore((s) => s.updateSettings)

  const cycle = useMemo(() => currentCycle(new Date(), day), [day])
  const fmt = (d: Date) => format(d, 'd MMM', { locale: locale === 'ar' ? arEG : enUS })
  const set = (next: number) => updateSettings({ monthStartDay: next })
  const wrap = (n: number) => (n < PAY_CYCLE_MIN_DAY ? PAY_CYCLE_MAX_DAY : n > PAY_CYCLE_MAX_DAY ? PAY_CYCLE_MIN_DAY : n)
  const pct = Math.round((cycle.elapsedDays / cycle.totalDays) * 100)

  return (
    <>
      <Card padding="lg" data-setting-id="payCycle" className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{c.question}</p>
            <p className="mt-0.5 text-xs text-[var(--color-brand-text-muted)]">{c.hint}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <IconButton aria-label={c.decrease} variant="outlined" size="md" onClick={() => set(wrap(day - 1))}>
              <Minus />
            </IconButton>
            <span aria-live="polite" className="font-mono-numbers min-w-12 text-center text-3xl font-bold text-[var(--color-brand-text-primary)]">{day}</span>
            <IconButton aria-label={c.increase} variant="outlined" size="md" onClick={() => set(wrap(day + 1))}>
              <Plus />
            </IconButton>
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">{c.current}</p>
          <Progress value={pct} aria-label={c.current}>
            <ProgressTrack className="h-2.5">
              <ProgressIndicator className="bg-[var(--color-brand-primary)]" />
            </ProgressTrack>
          </Progress>
          <div className="font-mono-numbers mt-2 flex justify-between text-sm font-semibold text-[var(--color-brand-text-primary)]">
            <span>{fmt(cycle.start)}</span>
            <span className="font-sans text-xs font-medium text-[var(--color-brand-text-muted)]">{c.today} · {cycle.elapsedDays}/{cycle.totalDays}</span>
            <span>{fmt(cycle.end)}</span>
          </div>
        </div>

        <p className="rounded-xl bg-[var(--color-brand-primary-soft)] p-3 text-[13px] leading-snug text-[var(--color-brand-primary-ink)]">{c.note}</p>
      </Card>

      <SettingsSection>
        <SettingsRow icon={SETTING_ICONS.calendar} tone={ROOM_TONE.money} title={c.paydays} subtitle={c.paydaysHint} href="/paydays" />
      </SettingsSection>
    </>
  )
}
