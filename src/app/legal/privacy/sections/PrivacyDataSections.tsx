import { LegalSection } from '@/components/legal/LegalSection'

/** Sections 1–5: Who We Are, What Data, How Collected, Third Parties, How We Use Data. */
export function PrivacyDataSections() {
  return (
    <>
      <LegalSection title="1. Who We Are">
        <p>
          Buddget (&ldquo;we,&rdquo; &ldquo;us,&rdquo; &ldquo;our&rdquo;) is an independently operated personal finance application.
          The Service is currently operated by an individual and has not yet established a formal legal
          entity. For all privacy inquiries, contact{' '}
          <a href="mailto:support@buddget.app" className="text-[var(--color-brand-red)] hover:underline">
            support@buddget.app
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="2. What Data We Collect">
        <p>We collect the following categories of data:</p>
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">Account data:</strong> Email
          address, display name, profile photo (optional), country, city, phone number (optional).
        </p>
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">Authentication data:</strong>{' '}
          Hashed passwords (for email/password accounts), session tokens, and OAuth tokens from Google
          or Apple where you choose to sign in that way.
        </p>
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">Financial data:</strong> Expenses,
          income sources, debts, savings balances, budget plans, payment methods, subscriptions, and
          financial goals you create within the app.
        </p>
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">Voice data:</strong> Audio
          recordings you initiate when using voice expense entry. Audio is transmitted to our servers,
          transcribed using Groq&apos;s Whisper API, and immediately discarded. Only the transcribed text
          and resulting expense entry are retained.
        </p>
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">Camera and image data:</strong>{' '}
          Receipt photos you capture using the camera feature. Images are transmitted to our servers for
          AI-powered analysis using Google Gemini Vision. Images are not permanently stored after
          expense data has been extracted.
        </p>
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">Biometric data:</strong> When you
          enable biometric sign-in, biometric verification (Face ID, fingerprint) is performed entirely
          by your device operating system. Biometric data never leaves your device and is never
          transmitted to or stored on our servers.
        </p>
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">
            SMS transaction data (opt-in only):
          </strong>{' '}
          When you enable SMS auto-tracking, the text content of bank notification SMS messages you
          authorize is transmitted to our servers for parsing. Only extracted expense data (amount,
          merchant, date, category) is stored. Raw SMS text is not permanently retained after
          processing.
        </p>
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">AI query data:</strong>{' '}
          Natural-language messages and financial context submitted to Buddgy, our AI assistant. These
          are sent to the Google Gemini API for processing. We do not maintain a permanent server-side
          log of Buddgy conversations beyond what is necessary to render the current response.
        </p>
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">
            Push notification tokens:
          </strong>{' '}
          Device tokens used to deliver push notifications to your device via Firebase Cloud Messaging
          (Android and web) and Apple Push Notification service (iOS). Tokens are stored linked to your
          account and deleted when you disable notifications or delete your account.
        </p>
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">Usage data:</strong> App usage
          patterns, device type, operating system, browser information, and IP addresses collected
          automatically through Supabase infrastructure for security and service reliability purposes.
        </p>
      </LegalSection>

      <LegalSection title="3. How We Collect Data">
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">Directly from you:</strong> When
          you register, enter financial data, complete onboarding, use voice or camera features, or
          contact support.
        </p>
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">OAuth providers:</strong> When you
          choose Sign in with Google or Sign in with Apple, those providers share your email address and
          profile name with us upon your explicit authorization.
        </p>
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">SMS Bridge (opt-in):</strong> When
          you configure and activate the iOS Shortcut or Android background service to forward bank SMS
          messages to our ingest endpoint. You must explicitly enable this feature and authorize an
          access token.
        </p>
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">Automatically:</strong> Supabase
          infrastructure logs request metadata (IP address, timestamps, user agent) for security
          purposes.
        </p>
        <p>
          <strong className="text-[var(--color-brand-text-primary)]">Local device storage:</strong>{' '}
          Financial data is cached in your browser or device local storage to enable offline access.
          This data does not leave your device except through normal authenticated API calls to our
          servers.
        </p>
      </LegalSection>

      <LegalSection title="4. Third-Party Services That Receive Your Data">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="text-[var(--color-brand-text-primary)]">
              Supabase (supabase.com):
            </strong>{' '}
            Authentication, database, and file storage. Processes your account and financial data on
            our behalf. Data stored on Supabase servers in the United States.{' '}
            <a
              href="https://supabase.com/privacy"
              className="text-[var(--color-brand-red)] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy Policy
            </a>
          </li>
          <li>
            <strong className="text-[var(--color-brand-text-primary)]">
              Google Gemini API (Google LLC):
            </strong>{' '}
            Processes Buddgy queries and receipt image analysis. Your budget context and images are
            transmitted to Google servers when you use AI features. We use the paid tier to prevent
            your data from being used for Google model training.{' '}
            <a
              href="https://policies.google.com/privacy"
              className="text-[var(--color-brand-red)] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy Policy
            </a>
          </li>
          <li>
            <strong className="text-[var(--color-brand-text-primary)]">Groq (groq.com):</strong>{' '}
            Processes voice audio for transcription using Whisper. Audio is sent to Groq servers for
            real-time transcription and is not retained by Groq beyond processing.{' '}
            <a
              href="https://groq.com/privacy"
              className="text-[var(--color-brand-red)] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy Policy
            </a>
          </li>
          <li>
            <strong className="text-[var(--color-brand-text-primary)]">
              Firebase Cloud Messaging (Google LLC):
            </strong>{' '}
            Delivers push notifications to Android devices and web browsers. Only a notification
            payload (title, body) is transmitted — no financial data is included in push payloads.
          </li>
          <li>
            <strong className="text-[var(--color-brand-text-primary)]">
              Apple Push Notification service (Apple Inc.):
            </strong>{' '}
            Delivers push notifications to iOS devices. Same content limitations as above.
          </li>
          <li>
            <strong className="text-[var(--color-brand-text-primary)]">
              Sign in with Google / Sign in with Apple:
            </strong>{' '}
            Authentication only. We receive your email and name. We do not receive your password.
          </li>
        </ul>
        <p>
          We do not sell, rent, or trade your personal data to any third party for marketing or
          advertising purposes.
        </p>
      </LegalSection>

      <LegalSection title="5. How We Use Your Data">
        <p>We use your data solely to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Provide, maintain, and improve the Service</li>
          <li>Authenticate your identity and maintain your session</li>
          <li>Process and store financial entries you create</li>
          <li>
            Generate AI-powered budget recommendations and insights via Buddgy on your request
          </li>
          <li>
            Detect and log bank transactions from SMS or notifications when you enable auto-tracking
          </li>
          <li>Send push notifications you have opted in to receive</li>
          <li>Detect and prevent fraud, abuse, and security incidents</li>
          <li>Respond to your support requests</li>
          <li>Comply with applicable legal obligations</li>
        </ul>
        <p>
          We do not use your data for advertising, behavioral profiling for third parties, or any
          purpose unrelated to operating the Service.
        </p>
      </LegalSection>
    </>
  )
}
