'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { useT } from '@/lib/i18n'
import { SmsLockHero } from './SmsLockHero'

interface SmsBrandIntroProps {
  platform?: 'ios' | 'android'
  cta: string
  ctaIcon?: ReactNode
  onCta: () => void
  ctaLoading?: boolean
  /** Quiet text link under the button (e.g. "I already know the steps", "Set up later"). */
  link?: { label: string; onClick: () => void }
  caption: string
  onClose?: () => void
  /** Extra line under the button, e.g. an error. */
  footnote?: ReactNode
}

/** Screen 0 of SMS setup, everywhere it appears (iPhone guides, onboarding on iPhone and Android). */
export function SmsBrandIntro({ platform = 'ios', cta, ctaIcon, onCta, ctaLoading, link, caption, onClose, footnote }: SmsBrandIntroProps) {
  const c = useT().smsSetup
  return (
    <section className="flex min-h-0 flex-1 flex-col px-6 pb-6 pt-3.5" aria-label={`${c.introTitle1} ${c.introTitle2}`}>
      <div className="flex h-9 items-center gap-2.5">
        <img src="/icons/icon-192.png" alt="" className="size-8 rounded-[9px] shadow-[var(--shadow-sm)]" />
        <span className="text-base font-bold tracking-[-0.01em] text-[var(--color-brand-text-primary)]">buddget</span>
        {onClose ? (
          <IconButton onClick={onClose} aria-label={c.close} variant="outlined" size="sm" shape="round" className="ms-auto"><X /></IconButton>
        ) : null}
      </div>
      <SmsLockHero platform={platform} />
      <h1 className="text-[29px] font-bold leading-[1.15] tracking-[-0.03em] text-[var(--color-brand-text-primary)]">{c.introTitle1}<br />{c.introTitle2}</h1>
      <p className="mt-2.5 text-sm leading-relaxed text-[var(--color-brand-text-secondary)]">{c.introBody}</p>
      <Button size="cta-block" className="mt-4 font-bold" onClick={onCta} loading={ctaLoading}>{ctaIcon}{cta}</Button>
      {footnote}
      {link ? (
        <Button variant="ghost" size="touch" onClick={link.onClick} className="mx-auto mt-1.5 text-sm font-semibold text-[var(--color-brand-primary-ink)]">{link.label}</Button>
      ) : null}
      <p className={link ? 'text-center text-xs text-[var(--color-brand-text-muted)]' : 'mt-2.5 text-center text-xs text-[var(--color-brand-text-muted)]'}>{caption}</p>
    </section>
  )
}
