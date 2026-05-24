import { LegalSection } from '@/components/legal/LegalSection'

/** Cookies & Local Storage, Children's Privacy, and Data Security sections. */
export function PrivacyTechSections() {
  return (
    <>
      <LegalSection title="6. Cookies and Local Storage">
        <p>
          Buddget uses a minimal set of browser storage mechanisms to operate:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong className="text-[var(--color-brand-text-primary)]">Authentication cookies:</strong>{' '}
            Session tokens issued by Supabase are stored in secure, HTTP-only cookies to maintain your
            login state. These are strictly necessary and cannot be opted out of while using the Service.
          </li>
          <li>
            <strong className="text-[var(--color-brand-text-primary)]">Local storage (PWA cache):</strong>{' '}
            Your financial data is cached in browser local storage to support offline access as a
            Progressive Web App. This data is stored only on your device and is not transmitted except
            through the normal API sync.
          </li>
          <li>
            <strong className="text-[var(--color-brand-text-primary)]">Theme and preference storage:</strong>{' '}
            UI preferences (theme, language, display settings) are stored in local storage on your device.
          </li>
        </ul>
        <p>
          We do not use advertising cookies, behavioral tracking cookies, or third-party analytics cookies.
          We do not participate in cross-site tracking or retargeting.
        </p>
      </LegalSection>

      <LegalSection title="7. Children's Privacy">
        <p>
          The Service is intended for users who are 18 years of age or older. The Service is not directed
          to, and we do not knowingly collect personal information from, children under 13 years of age
          (or under 16 years of age where required by applicable law).
        </p>
        <p>
          If you are a parent or guardian and believe that your child has provided us with personal
          information without your consent, please contact us immediately at{' '}
          <a href="mailto:hello@buddget.app" className="text-[var(--color-brand-red)] hover:underline">
            hello@buddget.app
          </a>
          . Upon verification, we will take steps to promptly delete such information from our systems.
        </p>
      </LegalSection>

      <LegalSection title="8. Data Security">
        <p>
          We implement industry-standard technical and organizational measures to protect your data against
          unauthorized access, alteration, disclosure, or destruction:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            All data in transit is encrypted using TLS/HTTPS. The Service enforces HTTPS on all endpoints.
          </li>
          <li>
            Data at rest is encrypted by Supabase infrastructure (AES-256 or equivalent).
          </li>
          <li>
            Database access is governed by row-level security (RLS) policies, ensuring that each user can
            only access their own data.
          </li>
          <li>
            SMS ingest endpoints are protected by per-user Bearer tokens that you control and can rotate or
            revoke at any time.
          </li>
          <li>
            Passwords are hashed and never stored in plaintext. OAuth sign-in does not involve us handling
            your provider password at all.
          </li>
          <li>
            Access to production data by Buddget personnel is restricted and logged.
          </li>
        </ul>
        <p>
          While we implement reasonable security measures, no system is perfectly secure. You are
          responsible for maintaining the security of your account credentials and devices. We cannot
          guarantee the absolute security of your data against all possible threats.
        </p>
      </LegalSection>
    </>
  )
}
