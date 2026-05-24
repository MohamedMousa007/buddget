import { LegalSection } from '@/components/legal/LegalSection'

/** Sections 6–7: Data Retention and Your Rights. */
export function PrivacyRightsSections() {
  return (
    <>
      <LegalSection title="6. Data Retention">
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">Active accounts:</strong> Data is
          retained for as long as your account is active.
        </p>
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">After account deletion:</strong>{' '}
          Personal data is deleted within 30 days of your deletion request. Database backups may retain
          copies for up to 90 days before being overwritten.
        </p>
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">Voice audio:</strong> Deleted
          immediately after transcription (not retained).
        </p>
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">Receipt images:</strong> Deleted
          immediately after expense data is extracted (not retained).
        </p>
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">SMS text:</strong> Not stored
          after parsing. Only extracted expense data is retained.
        </p>
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">
            Buddgy conversation history:
          </strong>{' '}
          Not permanently logged on our servers beyond the current session. Subject to Google&apos;s API
          data retention policies.
        </p>
        <p>
          To request deletion, use Delete Account in Profile/Settings or contact{' '}
          <a href="mailto:support@buddget.app" className="text-[var(--color-brand-red)] hover:underline">
            support@buddget.app
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="7. Your Rights">
        <p>
          Regardless of your location, you have the following rights regarding your personal data:
        </p>
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">Right of access:</strong> Request
          a copy of the personal data we hold about you.
        </p>
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">Right to rectification:</strong>{' '}
          Request correction of inaccurate personal data.
        </p>
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">Right to erasure:</strong> Request
          deletion of your personal data. You can delete your account directly in the app at any time.
        </p>
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">
            Right to data portability:
          </strong>{' '}
          Export your financial data in JSON format at any time from Settings &rarr; Export Data.
        </p>
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">
            Right to withdraw consent:
          </strong>{' '}
          Withdraw consent for optional features (SMS tracking, push notifications, voice, camera) at
          any time through Settings or device settings.
        </p>
        <p>
          For residents of the European Economic Area, these rights are also protected under GDPR. For
          California residents, these rights are protected under CCPA. We do not sell your personal
          information under either framework.
        </p>
        <p>
          To exercise any right, contact{' '}
          <a href="mailto:support@buddget.app" className="text-[var(--color-brand-red)] hover:underline">
            support@buddget.app
          </a>
          . We will respond within 30 days.
        </p>
      </LegalSection>
    </>
  )
}
