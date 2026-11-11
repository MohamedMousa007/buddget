'use client'

import { useEffect, useRef } from 'react'
import { ChevronLeft } from 'lucide-react'
import { navigate } from '@/lib/navigation/navigate'
import { PageBody } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/button'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useT } from '@/lib/i18n'

interface Props {
  title: string
  children: React.ReactNode
  /** Where the back control goes. Defaults to the settings page. */
  backHref?: string
}

const HIGHLIGHT = ['bg-[var(--color-brand-primary-soft)]']
const HIGHLIGHT_MS = 1800

/**
 * Body chrome for a settings screen that is not the settings page itself: a back control and the title inline,
 * under the app's own header (there is no second header bar), plus the arrival highlight for settings search.
 */
export function SettingsSubPageShell({ title, children, backHref = '/settings' }: Props) {
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
    <div ref={bodyRef}>
      <PageBody narrow className="space-y-4">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="touch" onClick={() => navigate(backHref)} aria-label={t.common.back} className="-ms-2 px-2">
            <ChevronLeft className="size-5 rtl:rotate-180" />
          </Button>
          <h2 className="text-xl font-bold text-[var(--color-brand-text-primary)]">{title}</h2>
        </div>
        {children}
      </PageBody>
    </div>
  )
}
