import { LegalSection } from '@/components/legal/LegalSection'

/** Acceptance, Service Description, and User Accounts sections for Terms of Service. */
export function TermsIntroSections() {
  return (
    <>
      <LegalSection title="1. Acceptance of Terms">
        <p>
          By accessing or using Buddget (&ldquo;Service,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), you confirm that you have read,
          understood, and agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;) and our{' '}
          <a href="/legal/privacy" className="text-[var(--color-brand-red)] hover:underline">
            Privacy Policy
          </a>
          . If you do not agree to these Terms, do not access or use the Service.
        </p>
        <p>
          These Terms constitute a legally binding agreement between you and Buddget. By creating an account or
          otherwise accessing the Service, you represent that you are at least 18 years of age and have the
          legal capacity to enter into this agreement.
        </p>
      </LegalSection>

      <LegalSection title="2. Description of Service">
        <p>
          Buddget is an AI-powered personal finance management platform that helps individuals track expenses,
          income, debts, savings goals, subscriptions, and budget plans across multiple currencies. Features
          include, but are not limited to:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Manual and AI-assisted expense and income logging</li>
          <li>Budget planning with AI-generated recommendations (powered by Google Gemini)</li>
          <li>Debt, savings, and goal tracking with multi-currency support</li>
          <li>SMS-based automatic transaction ingestion via an iOS Shortcut or Android Bridge app</li>
          <li>Push notifications for budget alerts, debt reminders, and auto-tracked transactions</li>
          <li>Downloadable financial reports</li>
        </ul>
        <p>
          The Service is provided free of charge. We reserve the right to introduce paid features in the
          future with prior notice.
        </p>
      </LegalSection>

      <LegalSection title="3. User Accounts and Eligibility">
        <p>
          You must be at least 18 years old to create an account. By registering, you represent that all
          information you provide is accurate and complete and that you will maintain its accuracy.
        </p>
        <p>
          You are solely responsible for maintaining the confidentiality of your account credentials and for
          all activity that occurs under your account. Notify us immediately at{' '}
          <a href="mailto:hello@buddget.app" className="text-[var(--color-brand-red)] hover:underline">
            hello@buddget.app
          </a>{' '}
          if you suspect unauthorized access to your account.
        </p>
        <p>
          When you sign in via Google or Apple, authentication is handled by those respective third-party
          providers. We do not store your Google or Apple password. Your use of those providers is also
          governed by their respective terms of service and privacy policies.
        </p>
      </LegalSection>
    </>
  )
}
