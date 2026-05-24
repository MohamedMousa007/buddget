import { LegalSection } from '@/components/legal/LegalSection'

/** Sections 11–13: International Transfers, Changes to Policy, Contact. */
export function PrivacyLegalSections() {
  return (
    <>
      <LegalSection title="11. International Data Transfers">
        <p>
          Your data may be processed in countries other than your own, including the United States,
          where Supabase, Google, and Groq infrastructure are hosted. These countries may have data
          protection laws different from those in Egypt, UAE, or your country of residence.
        </p>
        <p>
          By using the Service, you acknowledge and consent to these transfers as necessary to provide
          the Service.
        </p>
      </LegalSection>

      <LegalSection title="12. Changes to This Policy">
        <p>
          We may update this Privacy Policy to reflect changes in our practices, features, or legal
          requirements. For material changes we will:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Post a prominent notice in the app</li>
          <li>Email you at the address on your account</li>
          <li>Update the &ldquo;Last updated&rdquo; date at the top of this page</li>
        </ul>
        <p>
          Continued use after the effective date constitutes acceptance. If you do not agree, stop
          using the Service and delete your account.
        </p>
      </LegalSection>

      <LegalSection title="13. Contact Us">
        <p>
          For all privacy inquiries, rights requests, and data deletion:
        </p>
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">Email:</strong>{' '}
          <a href="mailto:support@buddget.app" className="text-[var(--color-brand-red)] hover:underline">
            support@buddget.app
          </a>
        </p>
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">Website:</strong>{' '}
          <a
            href="https://buddget.app"
            className="text-[var(--color-brand-red)] hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            buddget.app
          </a>
        </p>
        <p className="mt-3 text-xs text-[var(--color-brand-text-muted)]">
          For CCPA requests include &ldquo;CCPA Request&rdquo; in the subject line.
          For GDPR requests include &ldquo;GDPR Request&rdquo; in the subject line.
          We will respond within 30 days.
        </p>
        <p className="mt-2 text-xs text-[var(--color-brand-text-muted)]">
          &copy; 2026 Buddget. All rights reserved.
        </p>
      </LegalSection>
    </>
  )
}
