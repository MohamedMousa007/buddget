import { LegalSection } from '@/components/legal/LegalSection'

/** Termination, Changes to Terms, Governing Law, and Contact sections. */
export function TermsLegalSections() {
  return (
    <>
      <LegalSection title="11. Termination">
        <p>
          We may suspend or permanently terminate your access to the Service at any time, with or without
          notice, if we reasonably believe you have violated these Terms, if required for legal or security
          reasons, or for any other legitimate business reason.
        </p>
        <p>
          You may stop using the Service and close your account at any time via the Profile or Settings
          page. Upon account deletion, your personal data will be removed in accordance with our{' '}
          <a href="/legal/privacy" className="text-[var(--color-brand-red)] hover:underline">
            Privacy Policy
          </a>
          .
        </p>
        <p>
          Provisions that by their nature should survive termination — including Sections 7 (User Data), 8
          (IP), 9 (Limitation of Liability), 10 (Indemnification), and 13 (Governing Law) — will remain in
          full force after termination.
        </p>
      </LegalSection>

      <LegalSection title="12. Changes to These Terms">
        <p>
          We reserve the right to modify or replace these Terms at any time. For material changes, we will
          provide at least 14 days&apos; advance notice by posting a prominent notice in the app or by
          sending an email to the address associated with your account.
        </p>
        <p>
          Your continued use of the Service after the effective date of revised Terms constitutes your
          acceptance of the changes. If you do not agree to the new Terms, you must stop using the Service.
        </p>
      </LegalSection>

      <LegalSection title="13. Governing Law and Jurisdiction">
        <p>
          These Terms are governed by and construed in accordance with the laws of the United Arab Emirates.
          Any dispute arising out of or in connection with these Terms, including disputes relating to their
          existence, validity, or termination, shall be subject to the exclusive jurisdiction of the courts
          of Dubai, United Arab Emirates.
        </p>
        <p>
          If any provision of these Terms is found to be unenforceable or invalid, that provision shall be
          limited or eliminated to the minimum extent necessary so that these Terms shall otherwise remain
          in full force and effect.
        </p>
      </LegalSection>

      <LegalSection title="14. Contact Us">
        <p>
          Buddget is operated as an independent product. For legal inquiries, contact{' '}
          <a href="mailto:hello@buddget.app" className="text-[var(--color-brand-red)] hover:underline">
            hello@buddget.app
          </a>
          .
        </p>
        <p>
          If you have questions, concerns, or requests regarding these Terms, please contact us:
        </p>
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">Email:</strong>{' '}
          <a href="mailto:hello@buddget.app" className="text-[var(--color-brand-red)] hover:underline">
            hello@buddget.app
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
