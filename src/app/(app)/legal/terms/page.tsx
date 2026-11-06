import type { Metadata } from 'next'
import { legalAlternates } from '@/lib/legal/paths'
import { TermsDocument } from './TermsDocument'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Buddget Terms of Service — the rules and conditions governing your use of the Buddget personal finance platform.',
  alternates: legalAlternates('terms', 'en'),
}

/** /legal/terms: the language follows the app setting; /ar/legal/terms is always Arabic. */
export default function TermsPage() {
  return <TermsDocument />
}
