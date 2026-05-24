import { LegalSection } from '@/components/legal/LegalSection'

/** What Data We Collect, How We Collect It, and Third-Party Services sections. */
export function PrivacyDataSections() {
  return (
    <>
      <LegalSection title="1. What Data We Collect">
        <p>We collect the following categories of personal and financial data:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong className="text-[var(--color-brand-text-primary)]">Account data:</strong> Email
            address, display name, profile photo (optional), country, city, phone number (optional),
            gender (optional).
          </li>
          <li>
            <strong className="text-[var(--color-brand-text-primary)]">Authentication data:</strong>{' '}
            Hashed passwords (email/password accounts), OAuth tokens from Google or Apple, and session
            tokens.
          </li>
          <li>
            <strong className="text-[var(--color-brand-text-primary)]">Financial data:</strong> Expenses,
            income sources, debts, savings accounts and balances, budget plans, payment methods,
            subscriptions, and financial goals you create within the app.
          </li>
          <li>
            <strong className="text-[var(--color-brand-text-primary)]">SMS transaction data:</strong>{' '}
            When you opt in to SMS auto-tracking, we receive and store the raw text of bank notification
            SMS messages you forward, including transaction amounts, merchant names, sender numbers, and
            timestamps.
          </li>
          <li>
            <strong className="text-[var(--color-brand-text-primary)]">AI query data:</strong> Natural-
            language messages and budget context you submit to the AI assistant. These are sent to the
            Google Gemini API for processing and are not stored beyond what is necessary to render the
            response.
          </li>
          <li>
            <strong className="text-[var(--color-brand-text-primary)]">Push notification tokens:</strong>{' '}
            Web Push subscription endpoints and VAPID keys used to deliver budget alerts and transaction
            notifications to your device.
          </li>
          <li>
            <strong className="text-[var(--color-brand-text-primary)]">Usage data:</strong> App usage
            patterns, device type, browser information, and IP addresses, collected automatically by
            Supabase infrastructure.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="2. How We Collect Data">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong className="text-[var(--color-brand-text-primary)]">Directly from you:</strong> When
            you register, enter financial data, complete onboarding, or contact support.
          </li>
          <li>
            <strong className="text-[var(--color-brand-text-primary)]">OAuth providers:</strong> When you
            choose Sign in with Google or Sign in with Apple, those providers share your email address and
            profile name with us upon your explicit authorization.
          </li>
          <li>
            <strong className="text-[var(--color-brand-text-primary)]">SMS Bridge:</strong> When you
            configure the iOS Shortcut or Android Bridge app to forward bank SMS messages to our ingest
            endpoint. This is strictly opt-in and requires an authenticated token you generate.
          </li>
          <li>
            <strong className="text-[var(--color-brand-text-primary)]">Automatically:</strong> Supabase
            infrastructure logs request metadata (IP address, timestamps, user agent) for security and
            service reliability purposes.
          </li>
          <li>
            <strong className="text-[var(--color-brand-text-primary)]">Local device storage:</strong> We
            cache financial data in your browser&apos;s local storage to enable offline Progressive Web App
            (PWA) functionality. This data never leaves your device except through your normal API calls.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Third-Party Services That Receive Your Data">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="text-[var(--color-brand-text-primary)]">Supabase</strong> — Authentication,
            database, and file storage. Processes your account and financial data on our behalf.{' '}
            <a
              href="https://supabase.com/privacy"
              className="text-[var(--color-brand-red)] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Supabase Privacy Policy
            </a>
          </li>
          <li>
            <strong className="text-[var(--color-brand-text-primary)]">Google</strong> — (a) Sign in with
            Google (Google Identity); (b) Gemini AI API for budget analysis and AI assistant features.
            Your budget context is transmitted to Gemini API servers when you use AI features.{' '}
            <a
              href="https://policies.google.com/privacy"
              className="text-[var(--color-brand-red)] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Privacy Policy
            </a>
          </li>
          <li>
            <strong className="text-[var(--color-brand-text-primary)]">Apple</strong> — Sign in with
            Apple authentication service.{' '}
            <a
              href="https://www.apple.com/legal/privacy/"
              className="text-[var(--color-brand-red)] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Apple Privacy Policy
            </a>
          </li>
          <li>
            <strong className="text-[var(--color-brand-text-primary)]">Browser Push Services</strong> —
            Web Push notifications are delivered via your browser&apos;s built-in push infrastructure
            (e.g., Firebase Cloud Messaging for Chrome, Mozilla Push Service for Firefox). Only a
            notification payload (title, body) is transmitted; no financial data is included in push
            payloads.
          </li>
        </ul>
        <p className="mt-2">We do not sell, rent, or trade your personal data to any third party.</p>
      </LegalSection>
    </>
  )
}
