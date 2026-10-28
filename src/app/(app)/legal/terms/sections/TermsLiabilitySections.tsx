import { LegalSection } from '@/components/legal/LegalSection'

/** Sections 8–12: User Data, IP, Disclaimer of Warranties, Limitation of Liability, Indemnification. */
export function TermsLiabilitySections() {
  return (
    <>
      <LegalSection title="8. User Data and Content Ownership">
        <p>
          You retain full ownership of all financial data, transactions, and other content you enter
          into the Service (&ldquo;User Content&rdquo;). By using the Service, you grant us a limited,
          non-exclusive, worldwide, royalty-free license to store, process, display, and transmit your
          User Content solely as necessary to operate and provide the Service.
        </p>
        <p>
          We do not sell your personal financial data to third parties. Aggregated and fully anonymized
          statistical data — with no personally identifiable information — may be used to improve the
          Service.
        </p>
        <p>
          You are solely responsible for the accuracy of the data you enter. We are not liable for
          financial decisions you make based on data you have entered or AI outputs generated from that
          data.
        </p>
      </LegalSection>

      <LegalSection title="9. Intellectual Property">
        <p>
          The Service, including its design, code, branding, features, and original content, is owned
          by the Operator and protected by applicable intellectual property laws. &ldquo;Buddget&rdquo; and
          associated logos are trademarks of the Operator.
        </p>
        <p>
          You may not copy, reproduce, distribute, modify, create derivative works from, publicly
          display, republish, or transmit any part of the Service except as reasonably necessary to use
          the Service for its intended purpose.
        </p>
      </LegalSection>

      <LegalSection title="10. Disclaimer of Warranties">
        <p>
          THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND,
          EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
          PARTICULAR PURPOSE, ACCURACY OF AI OUTPUTS, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE
          SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT EXPENSE CATEGORIZATION, VOICE
          TRANSCRIPTION, OR RECEIPT SCANNING WILL BE ACCURATE IN ALL CASES.
        </p>
      </LegalSection>

      <LegalSection title="11. Limitation of Liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE OPERATOR AND ANY ASSOCIATED PERSONNEL
          SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR
          PUNITIVE DAMAGES — INCLUDING LOSS OF PROFITS, DATA, GOODWILL, OR OTHER INTANGIBLE LOSSES —
          ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICE, INCLUDING ANY ERRORS IN
          AI-GENERATED BUDGET PLANS, VOICE TRANSCRIPTION, RECEIPT SCANNING, OR SMS PARSING.
        </p>
        <p>IN NO EVENT SHALL OUR TOTAL AGGREGATE LIABILITY TO YOU EXCEED USD 50.</p>
      </LegalSection>

      <LegalSection title="12. Indemnification">
        <p>
          You agree to defend, indemnify, and hold harmless the Operator and any associated personnel
          from and against any claims, liabilities, damages, losses, costs, and expenses arising out of
          or in any way connected with:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Your access to or use of the Service</li>
          <li>Your violation of these Terms</li>
          <li>Your violation of any applicable law or regulation</li>
          <li>Your infringement of any third-party rights</li>
          <li>
            Your use of the SMS auto-tracking feature in a manner inconsistent with applicable laws
          </li>
        </ul>
      </LegalSection>
    </>
  )
}
