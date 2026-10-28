import { LegalSection } from '@/components/legal/LegalSection'

/** Sections 8–10: Cookies & Local Storage, Security, Children's Privacy. */
export function PrivacyTechSections() {
  return (
    <>
      <LegalSection title="8. Cookies and Local Storage">
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">Authentication cookies:</strong>{' '}
          Session tokens from Supabase are stored in secure HTTP-only cookies. Strictly necessary —
          cannot be opted out of while using the Service.
        </p>
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">
            Local storage (PWA and native app):
          </strong>{' '}
          Financial data is cached locally to support offline use. Stored only on your device.
        </p>
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">Preference storage:</strong> UI
          settings (theme, language, display preferences) stored locally.
        </p>
        <p>
          We do not use advertising cookies, behavioral tracking cookies, or any third-party analytics
          cookies. We do not participate in cross-site tracking or advertising networks.
        </p>
      </LegalSection>

      <LegalSection title="9. Security">
        <p>We implement the following measures to protect your data:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>All data in transit is encrypted using TLS/HTTPS</li>
          <li>Data at rest is encrypted by Supabase infrastructure (AES-256)</li>
          <li>
            Row-level security (RLS) policies in the database ensure each user can only access their
            own data
          </li>
          <li>
            SMS and notification ingest endpoints are protected by per-user Bearer tokens you control
            and can rotate at any time
          </li>
          <li>Biometric data never leaves your device</li>
          <li>Passwords are hashed and never stored in plaintext</li>
        </ul>
        <p>
          No system is perfectly secure. You are responsible for maintaining the security of your
          credentials and devices.
        </p>
      </LegalSection>

      <LegalSection title="10. Children's Privacy">
        <p>
          The Service is intended for users 18 years of age and older. We do not knowingly collect
          personal information from anyone under 13.
        </p>
        <p>
          If you believe a child has provided us with personal information, contact us at{' '}
          <a href="mailto:support@buddget.app" className="text-[var(--color-brand-red)] hover:underline">
            support@buddget.app
          </a>{' '}
          and we will delete it promptly.
        </p>
      </LegalSection>
    </>
  )
}
