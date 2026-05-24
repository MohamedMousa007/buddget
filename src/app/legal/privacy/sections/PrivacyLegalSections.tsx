import { LegalSection } from '@/components/legal/LegalSection'

/** International Transfers, Changes to Policy, and Contact sections. */
export function PrivacyLegalSections() {
  return (
    <>
      <LegalSection title="9. International Data Transfers">
        <p>
          Your personal data may be transferred to and processed in countries other than the country in
          which you reside, including the United States, where Supabase and Google Cloud infrastructure are
          located.
        </p>
        <p>
          By using the Service, you acknowledge and consent to the transfer of your information to countries
          outside your country of residence, which may have different data protection rules than your country.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes to This Privacy Policy">
        <p>
          We may update this Privacy Policy from time to time to reflect changes in our practices, legal
          requirements, or Service features. When we make material changes, we will provide notice by:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Posting a prominent notice within the app</li>
          <li>Sending an email to the address associated with your account</li>
          <li>Updating the &ldquo;Last updated&rdquo; date at the top of this page</li>
        </ul>
        <p>
          Your continued use of the Service after the effective date of the revised policy constitutes your
          acceptance of the changes. If you do not agree with the changes, you should stop using the Service
          and request deletion of your account.
        </p>
      </LegalSection>

      <LegalSection title="11. Contact Us">
        <p>
          Buddget is operated as an independent product. For legal inquiries, contact{' '}
          <a href="mailto:support@buddget.app" className="text-[var(--color-brand-red)] hover:underline">
            support@buddget.app
          </a>
          .
        </p>
        <p>
          If you have questions, concerns, or requests regarding this Privacy Policy or our data practices,
          please contact us:
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
          For CCPA requests, please include &ldquo;CCPA Request&rdquo; in your subject line. We will respond within
          the timeframe required by applicable law.
        </p>
      </LegalSection>
    </>
  )
}
