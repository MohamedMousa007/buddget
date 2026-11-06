'use client'

import type { ReactNode } from 'react'
import { AppLink as Link } from '@/components/ui/AppLink'
import { BuddgetWordmark } from '@/components/brand'
import { HIT_AREA } from '@/lib/ui/hitArea'
import { legalPath } from '@/lib/legal/paths'
import { LegalLabel, useLegalLocale, useLegalLocaleIsExplicit } from '@/components/legal/LegalLocale'

/**
 * Shared frame for all legal pages (Terms, Privacy Policy): a minimal branded header and a max-width prose container.
 * No AppShell nav chrome: legal pages must be accessible pre-auth.
 */
export function LegalFrame({ children }: { children: ReactNode }) {
  const locale = useLegalLocale()
  const explicit = useLegalLocaleIsExplicit()
  const own = explicit ? locale : 'en'
  const terms = legalPath('terms', own)
  const privacy = legalPath('privacy', own)
  const homeLabel = locale === 'ar' ? 'الصفحة الرئيسية لبادجت' : 'Buddget home'
  return (
    <div className="min-h-screen bg-[var(--color-brand-bg)] text-[var(--color-brand-text-primary)]">
      {/* Minimal header */}
      <header className="sticky top-0 z-10 border-b border-white/5 backdrop-blur-md bg-[var(--color-brand-bg)]/80">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href={explicit ? `/${locale}` : '/'} aria-label={homeLabel} className={`flex items-center gap-2 outline-none ${HIT_AREA} focus-visible:ring-2 focus-visible:ring-[var(--color-brand-focus)] rounded-sm`}>
            <BuddgetWordmark height={24} />
          </Link>
          <nav className="flex items-center gap-4 text-xs text-[var(--color-brand-text-muted)]">
            <Link href={terms} className="hover:text-[var(--color-brand-text-primary)] transition-colors">
              <LegalLabel en="Terms" ar="الشروط" />
            </Link>
            <Link href={privacy} className="hover:text-[var(--color-brand-text-primary)] transition-colors">
              <LegalLabel en="Privacy" ar="الخصوصية" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Prose container */}
      <main className="max-w-3xl mx-auto px-4 py-10 lg:py-16">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 mt-8">
        <div className="max-w-3xl mx-auto px-4 flex flex-wrap items-center justify-between gap-4 text-xs text-[var(--color-brand-text-muted)]">
          <span>© {new Date().getFullYear()} <LegalLabel en="Buddget. All rights reserved." ar="بادجت. جميع الحقوق محفوظة." /></span>
          <div className="flex gap-4">
            <Link href={terms} className="hover:text-[var(--color-brand-primary-ink)] transition-colors">
              <LegalLabel en="Terms of Service" ar="شروط الخدمة" />
            </Link>
            <Link href={privacy} className="hover:text-[var(--color-brand-primary-ink)] transition-colors">
              <LegalLabel en="Privacy Policy" ar="سياسة الخصوصية" />
            </Link>
            <a href="mailto:support@buddget.app" className="hover:text-[var(--color-brand-primary-ink)] transition-colors">
              <LegalLabel en="Contact" ar="اتصل بنا" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
