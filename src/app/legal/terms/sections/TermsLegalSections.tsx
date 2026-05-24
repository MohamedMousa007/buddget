import { LegalSection } from '@/components/legal/LegalSection'

/** Sections 13–17: Termination, Changes, Dispute Resolution, Severability, Contact. */
export function TermsLegalSections() {
  return (
    <>
      <LegalSection title="13. Termination">
        <p>
          We may suspend or terminate your access to the Service at any time, with or without notice,
          if we reasonably believe you have violated these Terms, for legal or security reasons, or for
          any other legitimate operational reason.
        </p>
        <p>
          You may stop using the Service and delete your account at any time via the Profile or Settings
          page. Upon account deletion, your personal data will be removed in accordance with our{' '}
          <a href="/legal/privacy" className="text-[var(--color-brand-red)] hover:underline">
            Privacy Policy
          </a>
          .
        </p>
        <p>Sections 8, 9, 11, 12, and 15 will survive termination of your account.</p>
      </LegalSection>

      <LegalSection title="14. Changes to These Terms">
        <p>
          We reserve the right to modify these Terms at any time. For material changes, we will provide
          at least 14 days&apos; advance notice by posting a prominent notice in the app or by email.
        </p>
        <p>
          Your continued use of the Service after the effective date constitutes acceptance of the
          revised Terms. If you do not agree, you must stop using the Service.
        </p>
      </LegalSection>

      <LegalSection title="15. Dispute Resolution and Governing Law">
        <p>
          We encourage you to contact us first at{' '}
          <a href="mailto:support@buddget.app" className="text-[var(--color-brand-red)] hover:underline">
            support@buddget.app
          </a>{' '}
          to resolve any dispute informally before pursuing formal proceedings.
        </p>
        <p>
          If a dispute cannot be resolved informally, it shall be settled by binding arbitration under
          the rules of a mutually agreed arbitration body, conducted in English. Each party shall bear
          its own costs unless the arbitrator determines otherwise.
        </p>
        <p>
          These Terms are governed by general principles of international commercial law. Nothing in
          this section prevents either party from seeking emergency injunctive or other equitable relief
          from a court of competent jurisdiction.
        </p>
      </LegalSection>

      <LegalSection title="16. Severability">
        <p>
          If any provision of these Terms is found to be unenforceable or invalid, that provision shall
          be modified to the minimum extent necessary to make it enforceable, and the remaining
          provisions shall continue in full force.
        </p>
      </LegalSection>

      <LegalSection title="17. Contact Us">
        <p>Buddget is operated as an independent product. For all inquiries including legal matters:</p>
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
      </LegalSection>
    </>
  )
}
