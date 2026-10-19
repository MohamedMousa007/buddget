'use client'

import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { navigate } from '@/lib/navigation/navigate'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { PageBody, PageContainer } from '@/components/layout/PageContainer'
import { IconButton } from '@/components/ui/IconButton'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useLocale, useT } from '@/lib/i18n'

interface Props {
  title: string
  children: React.ReactNode
  /** Where the back arrow goes: the room this page belongs to, or the hub. */
  backHref?: string
}

const HIGHLIGHT = ['bg-[var(--color-brand-primary-soft)]']
const HIGHLIGHT_MS = 1800

/**
 * Chrome for every settings page: back arrow, title, and the arrival highlight for
 * settings search (scrolls to the row whose `data-setting-id` was asked for).
 * Settings apply the moment they change, so there is no Save button.
 */
export function SettingsSubPageShell({ title, children, backHref = '/settings' }: Props) {
  const { locale } = useLocale()
  const t = useT()
  const bodyRef = useRef<HTMLDivElement>(null)
  const focusId = useSettingsStore((s) => s.settingsFocusId)
  const setFocusId = useSettingsStore((s) => s.setSettingsFocusId)

  useEffect(() => {
    if (!focusId) return
    const frame = requestAnimationFrame(() => {
      const el = bodyRef.current?.querySelector<HTMLElement>(`[data-setting-id="${CSS.escape(focusId)}"]`)
      setFocusId(null)
      if (!el) return
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el.classList.add(...HIGHLIGHT)
      window.setTimeout(() => el.classList.remove(...HIGHLIGHT), HIGHLIGHT_MS)
    })
    return () => cancelAnimationFrame(frame)
  }, [focusId, setFocusId])

  return (
    <div>
      <PageHeader>
        <PageContainer className="px-0 lg:px-0">
          <PageHeaderContent>
            <div className="flex items-center gap-1">
              <IconButton onClick={() => navigate(backHref)} aria-label={t.common.back}>
                {locale === 'ar' ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
              </IconButton>
              <h1 className="text-xl font-bold text-[var(--color-brand-text-primary)]">{title}</h1>
            </div>
          </PageHeaderContent>
        </PageContainer>
      </PageHeader>
      <div ref={bodyRef}>
        <PageBody narrow className="space-y-4">
          {children}
        </PageBody>
      </div>
    </div>
  )
}
