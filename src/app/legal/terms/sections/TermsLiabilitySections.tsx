import { LegalSection } from '@/components/legal/LegalSection'

/** User Data, Intellectual Property, Limitation of Liability, and Indemnification sections. */
export function TermsLiabilitySections() {
  return (
    <>
      <LegalSection title="7. User Data and Content Ownership">
        <p>
          You retain full ownership of all financial data, transactions, and other content you enter into
          the Service ("User Content"). By using the Service, you grant Buddget a limited, non-exclusive,
          worldwide, royalty-free license to store, process, display, and transmit your User Content solely
          as necessary to operate and provide the Service.
        </p>
        <p>
          We do not sell your personal financial data to third parties. Aggregated and fully anonymized
          statistical data (with no personally identifiable information) may be used to improve the Service.
        </p>
        <p>
          You are solely responsible for the accuracy of the data you enter. Buddget is not liable for
          financial decisions you make based on data you have entered or AI outputs generated from that data.
        </p>
      </LegalSection>

      <LegalSection title="8. Intellectual Property">
        <p>
          The Service, including its design, code, branding, features, and original content, is owned by
          Buddget and protected by copyright, trademark, and other intellectual property laws. "Buddget,"
          "Buddgy," "budget.ai," and associated logos are trademarks of Buddget.
        </p>
        <p>
          You may not copy, reproduce, distribute, modify, create derivative works from, publicly display,
          publicly perform, republish, download, store, or transmit any part of the Service, except as
          reasonably necessary to use the Service for its intended purpose.
        </p>
      </LegalSection>

      <LegalSection title="9. Limitation of Liability">
        <p>
          THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
          IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
          PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED,
          ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
        </p>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, BUDDGET AND ITS OFFICERS, DIRECTORS,
          EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
          EXEMPLARY, OR PUNITIVE DAMAGES — INCLUDING LOSS OF PROFITS, DATA, GOODWILL, OR OTHER INTANGIBLE
          LOSSES — ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICE.
        </p>
        <p>
          IN NO EVENT SHALL BUDDGET&apos;S TOTAL AGGREGATE LIABILITY TO YOU EXCEED THE GREATER OF (A) THE
          AMOUNT YOU PAID TO USE THE SERVICE IN THE TWELVE MONTHS PRECEDING THE CLAIM OR (B) USD 50.
        </p>
      </LegalSection>

      <LegalSection title="10. Indemnification">
        <p>
          You agree to defend, indemnify, and hold harmless Buddget and its officers, directors, employees,
          and agents from and against any claims, liabilities, damages, losses, costs, and expenses
          (including reasonable legal fees) arising out of or in any way connected with:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Your access to or use of the Service</li>
          <li>Your violation of these Terms</li>
          <li>Your violation of any applicable law or regulation</li>
          <li>Your infringement of any third-party intellectual property or other rights</li>
        </ul>
      </LegalSection>
    </>
  )
}
