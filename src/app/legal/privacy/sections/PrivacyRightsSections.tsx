import { LegalSection } from '@/components/legal/LegalSection'

/** Data Retention and User Rights (GDPR + CCPA) sections. */
export function PrivacyRightsSections() {
  return (
    <>
      <LegalSection title="4. Data Retention">
        <p>
          We retain your personal and financial data for as long as your account is active or as necessary
          to provide the Service. Specifically:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong className="text-[var(--color-brand-text-primary)]">Active accounts:</strong> Data is
            retained indefinitely while your account remains active to maintain continuity of your
            financial history.
          </li>
          <li>
            <strong className="text-[var(--color-brand-text-primary)]">After account deletion:</strong>{' '}
            Personal data (account details, financial records, SMS events) is deleted within 30 days of
            your account deletion request. Some data may be retained longer if required by law or for
            legitimate security purposes (e.g., fraud prevention logs).
          </li>
          <li>
            <strong className="text-[var(--color-brand-text-primary)]">Backup data:</strong> Copies held
            in database backups may persist for up to 90 days before being overwritten.
          </li>
          <li>
            <strong className="text-[var(--color-brand-text-primary)]">AI query logs:</strong> Conversation
            history sent to Google Gemini API is governed by Google&apos;s data retention policies. We do
            not maintain a permanent server-side log of your AI messages beyond the current session.
          </li>
        </ul>
        <p>
          To request early deletion of your data, use the Delete Account feature in the Profile page, or
          contact{' '}
          <a href="mailto:hello@buddget.app" className="text-[var(--color-brand-red)] hover:underline">
            hello@buddget.app
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="5. Your Privacy Rights">
        <p>
          Buddget does not currently target users in the European Economic Area. If you are located in the
          EEA and use the Service, you may have additional rights under applicable local law; contact us at{' '}
          <a href="mailto:hello@buddget.app" className="text-[var(--color-brand-red)] hover:underline">
            hello@buddget.app
          </a>
          .
        </p>
        <p className="mt-3 font-medium text-[var(--color-brand-text-primary)]">
          Rights under CCPA (California residents):
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Right to know:</strong> Know what personal information is collected, used, shared, or
            sold.
          </li>
          <li>
            <strong>Right to delete:</strong> Request deletion of personal information we have collected
            from you.
          </li>
          <li>
            <strong>Right to opt out of sale:</strong> We do not sell your personal information. No
            opt-out action is required.
          </li>
          <li>
            <strong>Right to non-discrimination:</strong> We will not discriminate against you for
            exercising any of your CCPA rights.
          </li>
        </ul>
        <p className="mt-3">
          To exercise any of these rights, contact us at{' '}
          <a href="mailto:hello@buddget.app" className="text-[var(--color-brand-red)] hover:underline">
            hello@buddget.app
          </a>{' '}
          with the subject line "Privacy Rights Request." We will respond within 30 days (or as required by
          applicable law).
        </p>
      </LegalSection>
    </>
  )
}
