import type { Metadata } from 'next'
import { AppLink as Link } from '@/components/ui/AppLink'
import { PrivacyDataSections } from './sections/PrivacyDataSections'
import { PrivacyRightsSections } from './sections/PrivacyRightsSections'
import { PrivacyTechSections } from './sections/PrivacyTechSections'
import { PrivacyLegalSections } from './sections/PrivacyLegalSections'
import { LegalLocale } from '@/components/legal/LegalLocale'
import { PrivacyDataSectionsAr } from './sections/ar/PrivacyDataSections'
import { PrivacyRightsSectionsAr } from './sections/ar/PrivacyRightsSections'
import { PrivacyTechSectionsAr } from './sections/ar/PrivacyTechSections'
import { PrivacyLegalSectionsAr } from './sections/ar/PrivacyLegalSections'

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
    <LegalLocale
      en={
        <div className="space-y-10">
          {/* Page header */}
          <div className="space-y-2 pb-6 border-b border-white/5">
            <p className="text-xs font-medium text-[var(--color-brand-primary-ink)] uppercase tracking-wider">
              Legal
            </p>
            <h1 className="text-3xl font-bold font-heading tracking-tight">Privacy Policy</h1>
            <p className="text-sm text-[var(--color-brand-text-muted)]">
              Effective date: October 28, 2026 &nbsp;·&nbsp; Last updated: October 28, 2026
            </p>
            <p className="text-sm text-[var(--color-brand-text-secondary)] max-w-xl">
              This policy explains how Buddget collects, uses, stores, and protects your data. Also see our{' '}
              <Link href="/legal/terms" className="text-[var(--color-brand-primary-ink)] hover:underline">
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
      }
      ar={
        <>
          <div className="space-y-2 pb-6 border-b border-white/5">
            <p className="text-xs font-medium text-[var(--color-brand-primary-ink)]">قانوني</p>
            <h1 className="text-3xl font-bold font-heading tracking-tight">سياسة الخصوصية</h1>
            <p className="text-sm text-[var(--color-brand-text-muted)]">
              تاريخ السريان: 28 أكتوبر 2026 &nbsp;·&nbsp; آخر تحديث: 28 أكتوبر 2026
            </p>
            <p className="text-sm text-[var(--color-brand-text-secondary)] max-w-xl">
              توضّح هذه السياسة كيف تجمع «بادجت» بياناتك وتستخدمها وتخزّنها وتحميها. اطّلع أيضًا على{' '}
              <Link href="/legal/terms" className="text-[var(--color-brand-primary-ink)] hover:underline">
                شروط الخدمة
              </Link>
              .
            </p>
          </div>
          <PrivacyDataSectionsAr />
          <PrivacyRightsSectionsAr />
          <PrivacyTechSectionsAr />
          <PrivacyLegalSectionsAr />
        </>
      }
    />
  )
}
