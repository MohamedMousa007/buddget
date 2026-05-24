import type { Metadata } from 'next'
import Link from 'next/link'
import { PrivacyDataSections } from './sections/PrivacyDataSections'
import { PrivacyRightsSections } from './sections/PrivacyRightsSections'
import { PrivacyTechSections } from './sections/PrivacyTechSections'
import { PrivacyLegalSections } from './sections/PrivacyLegalSections'

// TODO: Arabic (ar) version — translate section components and add locale routing when i18n is extended here.

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Buddget Privacy Policy — how we collect, use, store, and protect your personal finance data.',
  alternates: { canonical: 'https://buddget.app/legal/privacy' },
}

/**
 * /legal/privacy — full Privacy Policy page.
 * Fully static; no data fetching required.
 */
export default function PrivacyPage() {
  return (
    <div className="space-y-10">
      {/* Page header */}
      <div className="space-y-2 pb-6 border-b border-white/5">
        <p className="text-xs font-medium text-[var(--color-brand-red)] uppercase tracking-wider">
          Legal
        </p>
        <h1 className="text-3xl font-bold font-heading tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-[var(--color-brand-text-muted)]">
          Effective date: May 24, 2026 &nbsp;·&nbsp; Last updated: May 24, 2026
        </p>
        <p className="text-sm text-[var(--color-brand-text-secondary)] max-w-xl">
          This policy explains how Buddget collects, uses, and protects your data. Also see our{' '}
          <Link href="/legal/terms" className="text-[var(--color-brand-red)] hover:underline">
            Terms of Service
          </Link>
          .
        </p>
      </div>

      {/* Section groups */}
      <PrivacyDataSections />
      <PrivacyRightsSections />
      <PrivacyTechSections />
      <PrivacyLegalSections />
    </div>
  )
}
