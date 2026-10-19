'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, User, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { AppLink as Link } from '@/components/ui/AppLink'
import { useAuth } from '@/components/auth/AuthProvider'
import { PageBody } from '@/components/layout/PageContainer'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { QuickChanges } from '@/components/features/settings/QuickChanges'
import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { SettingsSearchResults } from '@/components/features/settings/SettingsSearchResults'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { ROOM_ICONS } from '@/components/features/settings/settingIcons'
import { ROOM_TONE } from '@/components/features/settings/roomMeta'
import { Card } from '@/components/ui/card'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/input'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { useSetupProgress } from '@/hooks/useSetupProgress'
import { useLocale, useT } from '@/lib/i18n'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { resolveProfileAvatarSrc } from '@/lib/profile/avatarDisplay'
import { ROOM_ROUTE, type RoomId } from '@/lib/settings/registry'
import { searchSettings } from '@/lib/settings/search'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { cn } from '@/lib/utils'

const GROUPS: RoomId[][] = [['you', 'money', 'alerts'], ['buddgy', 'look', 'data'], ['help']]

export default function SettingsPage() {
  const t = useT()
  const copy = useSettingsHubCopy()
  const { locale } = useLocale()
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const { steps, pct } = useSetupProgress()

  const { profile, settings, dataReady } = useFinanceStore(
    useShallow((s) => ({ profile: s.profile, settings: s.settings, dataReady: s.dataReady })),
  )
  const tipsOn = useSettingsStore((s) => s.buddgyNudges)
  const focusId = useSettingsStore((s) => s.settingsFocusId)
  const setFocusId = useSettingsStore((s) => s.setSettingsFocusId)
  const searchRef = useRef<HTMLDivElement>(null)

  // The profile menu's search button lands here asking for the field.
  useEffect(() => {
    if (focusId !== 'search') return
    searchRef.current?.querySelector('input')?.focus()
    setFocusId(null)
  }, [focusId, dataReady, setFocusId])

  const results = useMemo(() => searchSettings(query, locale, Boolean(user)), [query, locale, user])
  const searching = query.trim().length > 0

  if (!dataReady) return <div className="p-4"><SkeletonList rows={8} /></div>

  const avatarSrc = resolveProfileAvatarSrc(profile)
  const left = steps.filter((s) => !s.done).length
  const alertsOn = [settings.subDueReminders, settings.subPriceAlerts, settings.goalProgressAlerts, settings.goalAlerts].filter((v) => v ?? true).length
  const themeName = { light: copy.themeLight, dark: copy.themeDark, system: copy.themeAuto }[settings.theme]
  const second = settings.showSecondaryCurrency ? settings.secondaryCurrency : null

  const status: Record<RoomId, string> = {
    you: copy.status.you,
    money: copy.status.money(settings.baseCurrency, second, settings.monthStartDay),
    alerts: copy.status.alerts(alertsOn, 4),
    buddgy: copy.status.buddgy(tipsOn, settings.smsTrackingEnabled),
    look: copy.status.look(themeName, locale === 'ar' ? 'العربية' : 'English'),
    data: copy.status.data,
    help: copy.status.help,
  }

  return (
    <div>
      <PageHeader>
        <PageHeaderContent width="narrow">
          <h1 className="text-xl font-bold text-[var(--color-brand-text-primary)]">{copy.title}</h1>
        </PageHeaderContent>
      </PageHeader>
      <PageBody narrow className="space-y-4">
        <div ref={searchRef} className="relative">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 size-[18px] -translate-y-1/2 text-[var(--color-brand-text-muted)]" aria-hidden />
          <Input
            size="brand"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={copy.searchPlaceholder}
            aria-label={copy.searchLabel}
            className="ps-10 pe-11"
          />
          {searching ? (
            <IconButton
              aria-label={copy.clearSearch}
              size="sm"
              shape="round"
              onClick={() => setQuery('')}
              className="absolute end-1.5 top-1/2 -translate-y-1/2"
            >
              <X />
            </IconButton>
          ) : null}
        </div>

        {searching ? (
          <SettingsSearchResults ids={results} query={query} />
        ) : (
          <>
            {user ? (
              <Card
                render={<Link href="/settings/you" />}
                padding="none"
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--color-brand-elevated)]"
              >
                <span className="size-12 shrink-0 overflow-hidden rounded-full bg-[var(--color-brand-elevated)] ring-2 ring-[var(--color-brand-primary)] ring-offset-2 ring-offset-[var(--color-brand-card)]">
                  {avatarSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarSrc} alt="" className="size-full object-cover" width={48} height={48} />
                  ) : (
                    <span className="flex size-full items-center justify-center"><User className="size-6 text-[var(--color-brand-text-secondary)]" /></span>
                  )}
                </span>
                <span className={cn('min-w-0 flex-1', locale === 'ar' && 'text-end')}>
                  <span className="block truncate text-base font-semibold text-[var(--color-brand-text-primary)]">{profile.name || t.common.user}</span>
                  <span className="block truncate text-xs text-[var(--color-brand-text-muted)]">{user.email || profile.email}</span>
                </span>
                {left > 0 ? (
                  <ProgressRing pct={pct} size={40} stroke={4} track="var(--color-brand-border-strong)" arc="var(--color-brand-primary)">
                    <span className="font-mono-numbers text-[10px] font-bold text-[var(--color-brand-primary-ink)]">{pct}%</span>
                  </ProgressRing>
                ) : null}
              </Card>
            ) : null}

            <section>
              <p className="px-1 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">{copy.quickTitle}</p>
              <Card padding="none" className="overflow-hidden">
                <QuickChanges variant="card" />
              </Card>
            </section>

            <div className="space-y-3">
              {GROUPS.map((rooms) => (
                <SettingsSection key={rooms[0]}>
                  {rooms.map((room) => (
                    <SettingsRow
                      key={room}
                      icon={ROOM_ICONS[room]}
                      tone={ROOM_TONE[room]}
                      title={copy.rooms[room].title}
                      subtitle={status[room]}
                      href={ROOM_ROUTE[room]}
                    />
                  ))}
                </SettingsSection>
              ))}
            </div>
          </>
        )}

        <p className="pt-4 text-center text-xs text-[var(--color-brand-text-muted)]">
          <a href="https://www.exchangerate-api.com/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline hover:text-[var(--color-brand-text-secondary)]">
            {copy.footer}
          </a>
        </p>
      </PageBody>
    </div>
  )
}
