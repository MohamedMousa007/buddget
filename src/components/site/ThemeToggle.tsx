'use client'

import { useSyncExternalStore } from 'react'
import { SITE_THEME_KEY } from '@/lib/site/theme'

type Props = { toLight: string; toDark: string; className?: string; withLabel?: boolean }

function subscribe(onChange: () => void) {
  const mo = new MutationObserver(onChange)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => mo.disconnect()
}
const isDark = () => document.documentElement.classList.contains('dark')

export function ThemeToggle({ toLight, toDark, className, withLabel }: Props) {
  const dark = useSyncExternalStore(subscribe, isDark, () => true)

  function toggle() {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    document.documentElement.style.colorScheme = next ? 'dark' : 'light'
    try { localStorage.setItem(SITE_THEME_KEY, next ? 'dark' : 'light') } catch { /* storage blocked: the choice lasts for this visit */ }
  }

  return (
    <button type="button" className={className ?? 'theme-btn'} onClick={toggle} aria-label={withLabel ? undefined : dark ? toLight : toDark}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {dark
          ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></>
          : <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />}
      </svg>
      {withLabel ? <span>{dark ? toLight : toDark}</span> : null}
    </button>
  )
}
