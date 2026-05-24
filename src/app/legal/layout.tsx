import type { ReactNode } from 'react'
import Link from 'next/link'

/**
 * Shared layout for all /legal/* pages (Terms, Privacy Policy).
 * Renders a minimal branded header and a max-width prose container.
 * No AppShell nav chrome — legal pages must be accessible pre-auth.
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-brand-bg)] text-[var(--color-brand-text-primary)]">
      {/* Minimal header */}
      <header className="sticky top-0 z-10 border-b border-white/5 backdrop-blur-md bg-[var(--color-brand-bg)]/80">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold text-[var(--color-brand-text-primary)] hover:text-[var(--color-brand-red)] transition-colors"
          >
            <span className="text-[var(--color-brand-red)] font-bold text-lg leading-none">B</span>
            <span>Buddget</span>
          </Link>
          <nav className="flex items-center gap-4 text-xs text-[var(--color-brand-text-muted)]">
            <Link href="/legal/terms" className="hover:text-[var(--color-brand-text-primary)] transition-colors">
              Terms
            </Link>
            <Link href="/legal/privacy" className="hover:text-[var(--color-brand-text-primary)] transition-colors">
              Privacy
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
          <span>© {new Date().getFullYear()} Buddget. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/legal/terms" className="hover:text-[var(--color-brand-red)] transition-colors">
              Terms of Service
            </Link>
            <Link href="/legal/privacy" className="hover:text-[var(--color-brand-red)] transition-colors">
              Privacy Policy
            </Link>
            <a href="mailto:support@buddget.app" className="hover:text-[var(--color-brand-red)] transition-colors">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
