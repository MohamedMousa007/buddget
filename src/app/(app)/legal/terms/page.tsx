import type { Metadata } from 'next'
import { AppLink as Link } from '@/components/ui/AppLink'
import { TermsIntroSections } from './sections/TermsIntroSections'
import { TermsUsageSections } from './sections/TermsUsageSections'
import { TermsLiabilitySections } from './sections/TermsLiabilitySections'
import { TermsLegalSections } from './sections/TermsLegalSections'
import { LegalLocale } from '@/components/legal/LegalLocale'
import { TermsIntroSectionsAr } from './sections/ar/TermsIntroSections'
import { TermsUsageSectionsAr } from './sections/ar/TermsUsageSections'
import { TermsLiabilitySectionsAr } from './sections/ar/TermsLiabilitySections'
import { TermsLegalSectionsAr } from './sections/ar/TermsLegalSections'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Buddget Terms of Service — the rules and conditions governing your use of the Buddget personal finance platform.',
  alternates: { canonical: 'https://buddget.app/legal/terms' },
}

/**
 * /legal/terms — full Terms of Service page.
 * Fully static; no data fetching required.
 */
export default function TermsPage() {
  return (
    <LegalLocale
      en={
        <div className="space-y-10">
          {/* Page header */}
          <div className="space-y-2 pb-6 border-b border-white/5">
            <p className="text-xs font-medium text-[var(--color-brand-primary-ink)] uppercase tracking-wider">
              Legal
            </p>
            <h1 className="text-3xl font-bold font-heading tracking-tight">Terms of Service</h1>
            <p className="text-sm text-[var(--color-brand-text-muted)]">
              Effective date: May 24, 2026 &nbsp;·&nbsp; Last updated: May 24, 2026
            </p>
            <p className="text-sm text-[var(--color-brand-text-secondary)] max-w-xl">
              Please read these Terms carefully before using Buddget. Also see our{' '}
              <Link href="/legal/privacy" className="text-[var(--color-brand-primary-ink)] hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>

          {/* Section groups */}
          <TermsIntroSections />
          <TermsUsageSections />
          <TermsLiabilitySections />
          <TermsLegalSections />
        </div>
      }
      ar={
        <>
          <div className="space-y-2 pb-6 border-b border-white/5">
            <p className="text-xs font-medium text-[var(--color-brand-primary-ink)]">قانوني</p>
            <h1 className="text-3xl font-bold font-heading tracking-tight">شروط الخدمة</h1>
            <p className="text-sm text-[var(--color-brand-text-muted)]">
              تاريخ السريان: 24 مايو 2026 &nbsp;·&nbsp; آخر تحديث: 24 مايو 2026
            </p>
            <p className="text-sm text-[var(--color-brand-text-secondary)] max-w-xl">
              يُرجى قراءة هذه الشروط بعناية قبل استخدام «بادجت». اطّلع أيضًا على{' '}
              <Link href="/legal/privacy" className="text-[var(--color-brand-primary-ink)] hover:underline">
                سياسة الخصوصية
              </Link>
              .
            </p>
          </div>
          <TermsIntroSectionsAr />
          <TermsUsageSectionsAr />
          <TermsLiabilitySectionsAr />
          <TermsLegalSectionsAr />
        </>
      }
    />
  )
}
