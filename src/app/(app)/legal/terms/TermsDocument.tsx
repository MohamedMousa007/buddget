import { LegalDocLink } from '@/components/legal/LegalDocLink'
import { TermsIntroSections } from './sections/TermsIntroSections'
import { TermsUsageSections } from './sections/TermsUsageSections'
import { TermsLiabilitySections } from './sections/TermsLiabilitySections'
import { TermsLegalSections } from './sections/TermsLegalSections'
import { LegalLocale } from '@/components/legal/LegalLocale'
import { TermsIntroSectionsAr } from './sections/ar/TermsIntroSections'
import { TermsUsageSectionsAr } from './sections/ar/TermsUsageSections'
import { TermsLiabilitySectionsAr } from './sections/ar/TermsLiabilitySections'
import { TermsLegalSectionsAr } from './sections/ar/TermsLegalSections'

/** The Terms of Service text, English and Arabic; which one shows follows the reader's legal language. */
export function TermsDocument() {
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
              Effective date: May 24, 2026 &nbsp;·&nbsp; Last updated: November 5, 2026
            </p>
            <p className="text-sm text-[var(--color-brand-text-secondary)] max-w-xl">
              Please read these Terms carefully before using Buddget. Also see our{' '}
              <LegalDocLink doc="privacy" className="text-[var(--color-brand-primary-ink)] hover:underline">
                Privacy Policy
              </LegalDocLink>
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
              تاريخ السريان: 24 مايو 2026 &nbsp;·&nbsp; آخر تحديث: 5 نوفمبر 2026
            </p>
            <p className="text-sm text-[var(--color-brand-text-secondary)] max-w-xl">
              يُرجى قراءة هذه الشروط بعناية قبل استخدام «بادجت». اطّلع أيضًا على{' '}
              <LegalDocLink doc="privacy" className="text-[var(--color-brand-primary-ink)] hover:underline">
                سياسة الخصوصية
              </LegalDocLink>
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
