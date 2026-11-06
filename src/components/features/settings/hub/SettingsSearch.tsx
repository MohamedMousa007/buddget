'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Clock, Search, SearchX, X } from 'lucide-react'
import { useAuth } from '@/components/auth/AuthProvider'
import { SettingsChip } from '@/components/features/settings/SettingsRow'
import { SETTING_ICONS } from '@/components/features/settings/settingIcons'
import { GROUP_TONE } from '@/components/features/settings/groupMeta'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useOpenSetting } from '@/hooks/useOpenSetting'
import { isToggleSetting, useSettingToggle, type ToggleSettingId } from '@/hooks/useSettingToggle'
import { useSettingValue } from '@/hooks/useSettingValue'
import { useLocale, useT } from '@/lib/i18n'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { registerBackGuard } from '@/lib/navigation/backGuard'
import { navigate } from '@/lib/navigation/navigate'
import { SETTING_BY_ID, type SettingId } from '@/lib/settings/registry'
import { normalizeQuery, searchSettings } from '@/lib/settings/search'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { applyTheme } from '@/lib/theme/applyTheme'
import { useScrollLock } from '@/lib/ui/scrollLock'
import { cn } from '@/lib/utils'

function Highlight({ text, query }: { text: string; query: string }) {
  const words = normalizeQuery(query).split(/\s+/).filter(Boolean)
  if (!words.length) return <>{text}</>
  const lower = normalizeQuery(text)
  const marks: Array<[number, number]> = []
  for (const w of words) {
    const i = lower.indexOf(w)
    if (i >= 0 && lower.length === text.length) marks.push([i, i + w.length])
  }
  if (!marks.length) return <>{text}</>
  marks.sort((a, b) => a[0] - b[0])
  const out: React.ReactNode[] = []
  let at = 0
  for (const [s, e] of marks) {
    if (s < at) continue
    out.push(<Fragment key={s}>{text.slice(at, s)}<mark className="rounded bg-[var(--color-brand-primary-soft)] px-0.5 text-[var(--color-brand-primary-ink)]">{text.slice(s, e)}</mark></Fragment>)
    at = e
  }
  out.push(<Fragment key="rest">{text.slice(at)}</Fragment>)
  return <>{out}</>
}

function ToggleTrail({ id }: { id: ToggleSettingId }) {
  const { on, set } = useSettingToggle(id)
  return <Switch size="touch" aria-label={id} checked={on} onCheckedChange={set} />
}

function ThemeTrail() {
  const t = useT()
  const theme = useFinanceStore((s) => s.settings.theme)
  const update = useFinanceStore((s) => s.updateSettings)
  const dark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  return (
    <Switch
      size="touch"
      aria-label={t.a11y.darkMode}
      checked={dark}
      onCheckedChange={(on) => {
        update({ theme: on ? 'dark' : 'light' })
        applyTheme(on ? 'dark' : 'light')
      }}
    />
  )
}

function Trail({ id }: { id: SettingId }) {
  const { locale, setLocale } = useLocale()
  const value = useSettingValue(id)
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight
  if (isToggleSetting(id)) return <ToggleTrail id={id} />
  if (id === 'theme') return <ThemeTrail />
  if (id === 'language') {
    return (
      <Button variant="outline" size="touch" onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}>
        {locale === 'ar' ? 'English' : 'العربية'}
      </Button>
    )
  }
  return (
    <>
      {value ? <span className="font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">{value}</span> : null}
      <Chevron className="size-4 text-[var(--color-brand-text-muted)]" aria-hidden />
    </>
  )
}

/**
 * Full-screen settings search: a blurred backdrop, instant ranked results with the match highlighted, switches that
 * work right inside the results, recent searches and suggestions when the box is empty, and full keyboard control.
 */
export function SettingsSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const copy = useSettingsHubCopy()
  const { locale } = useLocale()
  const { user } = useAuth()
  const goTo = useOpenSetting()
  const recent = useSettingsStore((s) => s.recentSettingSearches)
  const remember = useSettingsStore((s) => s.rememberSettingSearch)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useScrollLock(open)
  useEscapeClose(open, onClose)
  useEffect(() => {
    if (!open) return
    return registerBackGuard(() => { onClose(); return true })
  }, [open, onClose])
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const results = useMemo(() => searchSettings(query, locale, Boolean(user)).slice(0, 8), [query, locale, user])
  const searching = query.trim().length > 0

  if (!open || typeof document === 'undefined') return null

  const choose = (id: SettingId) => {
    remember(query)
    onClose()
    setQuery('')
    goTo(id)
  }
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight

  return createPortal(
    <div className="fixed inset-0 z-[140] flex justify-center px-4 pt-[max(env(safe-area-inset-top),1rem)] sm:pt-[12vh]" role="dialog" aria-modal="true" aria-label={copy.searchLabel}>
      <button
        type="button"
        aria-label={copy.close}
        data-raw-button-ok="full-screen scrim"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[var(--color-brand-bg)]/70 backdrop-blur-xl"
      />
      <div className="relative flex max-h-[min(78dvh,640px)] w-full max-w-xl flex-col gap-3 self-start">
        <div className="relative">
          <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-[var(--color-brand-primary-ink)]" aria-hidden />
          <Input
            ref={inputRef}
            size="brand"
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0) }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
              if (e.key === 'Enter' && results[active]) { e.preventDefault(); choose(results[active]!) }
            }}
            placeholder={copy.searchPlaceholder}
            aria-label={copy.searchLabel}
            className="h-14 rounded-2xl ps-12 pe-12 text-base shadow-[var(--shadow-lg)]"
          />
          <IconButton
            aria-label={searching ? copy.clearSearch : copy.close}
            size="sm"
            shape="round"
            onClick={() => (searching ? (setQuery(''), inputRef.current?.focus()) : onClose())}
            className="absolute end-2 top-1/2 -translate-y-1/2"
          >
            <X />
          </IconButton>
        </div>

        <div className="native-scroll min-h-0 overflow-y-auto rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-2 shadow-[var(--shadow-lg)]">
          {searching ? (
            results.length ? (
              <ul role="listbox" aria-label={copy.searchLabel}>
                {results.map((id, i) => {
                  const entry = SETTING_BY_ID[id]
                  const Icon = SETTING_ICONS[entry.icon]
                  return (
                    <li key={id} role="option" aria-selected={i === active}>
                      <div
                        onMouseEnter={() => setActive(i)}
                        className={cn('flex min-h-14 items-center gap-3 rounded-xl px-2 py-1.5', i === active && 'bg-[var(--color-brand-elevated)]')}
                      >
                        <button
                          type="button"
                          data-raw-button-ok="result row body"
                          onClick={() => choose(id)}
                          className={cn('flex min-w-0 flex-1 items-center gap-3 text-start', locale === 'ar' && 'text-end')}
                        >
                          <SettingsChip icon={Icon} tone={GROUP_TONE[entry.group]} destructive={entry.kind === 'danger'} />
                          <span className="min-w-0 flex-1">
                            <span className={cn('block truncate text-[0.9375rem] font-semibold', entry.kind === 'danger' ? 'text-[var(--color-brand-red)]' : 'text-[var(--color-brand-text-primary)]')}>
                              <Highlight text={copy.items[id].label} query={query} />
                            </span>
                            <span className="block truncate text-xs text-[var(--color-brand-text-muted)]">{copy.groupName[entry.group]}</span>
                          </span>
                        </button>
                        <span className="flex shrink-0 items-center gap-1.5"><Trail id={id} /></span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <SearchX className="size-8 text-[var(--color-brand-text-muted)]" aria-hidden />
                <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{copy.search.noResults(query.trim())}</p>
                <p className="text-xs text-[var(--color-brand-text-muted)]">{copy.search.noResultsHint}</p>
                <Button variant="outline" size="touch" className="mt-2" onClick={() => { onClose(); navigate('/settings'); useSettingsStore.getState().openSettingsSheet('feedback') }}>
                  {copy.search.reportMissing}
                </Button>
              </div>
            )
          ) : (
            <div className="space-y-4 p-2">
              <p className="text-xs text-[var(--color-brand-text-muted)]">{copy.search.hint}</p>
              {recent.length ? (
                <div>
                  <p className="pb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">{copy.recent}</p>
                  <div className="flex flex-wrap gap-2">
                    {recent.map((r) => (
                      <Button key={r} variant="outline" size="touch" onClick={() => { setQuery(r); inputRef.current?.focus() }}>
                        <Clock className="size-4" aria-hidden />{r}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div>
                <p className="pb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">{copy.suggestions}</p>
                <div className="flex flex-wrap gap-2">
                  {copy.suggestionList.map((sug) => (
                    <Button key={sug} variant="secondary" size="touch" onClick={() => { setQuery(sug); inputRef.current?.focus() }}>
                      {sug}<Chevron className="size-4 opacity-60" aria-hidden />
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
