import { LegalSection } from '@/components/legal/LegalSection'

/** Sections 1–3: Acceptance, Service Description, User Accounts. */
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
          These Terms constitute a legally binding agreement between you and the individual operator of
          Buddget (&ldquo;Operator&rdquo;), who operates this Service independently and has not yet established a
          formal legal entity. By creating an account or otherwise accessing the Service, you represent
          that you are at least 18 years of age and have the legal capacity to enter into this agreement.
        </p>
      </LegalSection>

      <LegalSection title="2. Description of Service">
        <p>
          Buddget is an AI-powered personal finance management platform that helps individuals track
          expenses, income, debts, savings goals, subscriptions, and budget plans across multiple
          currencies. Features include, but are not limited to:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Manual and AI-assisted expense and income logging</li>
          <li>Budget planning with AI-generated recommendations</li>
          <li>
            Debt, savings, and goal tracking with multi-currency support (AED, EGP, USD, and others)
          </li>
          <li>
            Optional SMS-based automatic transaction detection via an iOS Shortcut or Android background
            service
          </li>
          <li>
            Optional push notifications for budget alerts, debt reminders, and transaction confirmations
          </li>
          <li>Optional voice-based expense entry via microphone</li>
          <li>Optional camera-based receipt scanning</li>
          <li>Optional biometric authentication (Face ID, fingerprint) for secure sign-in</li>
          <li>Downloadable financial reports</li>
        </ul>
        <p>
          The Service is provided free of charge. We reserve the right to introduce optional paid
          features in the future with at least 14 days&apos; prior notice.
        </p>
      </LegalSection>

      <LegalSection title="3. User Accounts and Eligibility">
        <p>
          You must be at least 18 years old to create an account. By registering, you represent that all
          information you provide is accurate, current, and complete, and that you will maintain its
          accuracy throughout your use of the Service.
        </p>
        <p>
          You are solely responsible for maintaining the confidentiality of your account credentials and
          for all activity that occurs under your account. Notify us immediately at{' '}
          <a href="mailto:support@buddget.app" className="text-[var(--color-brand-red)] hover:underline">
            support@buddget.app
          </a>{' '}
          if you suspect unauthorized access to your account.
        </p>
        <p>
          Where available, sign-in via Google or Apple is handled entirely by those providers. We do not
          store your Google or Apple password. Your use of those providers is governed by their respective
          terms and privacy policies.
        </p>
      </LegalSection>
    </>
  )
}
