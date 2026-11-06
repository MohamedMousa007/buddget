import type { Metadata } from 'next'
import { legalAlternates } from '@/lib/legal/paths'
import { PrivacyDocument } from './PrivacyDocument'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Buddget Privacy Policy — how we collect, use, store, and protect your personal finance data.',
  alternates: legalAlternates('privacy', 'en'),
}

/** /legal/privacy: the language follows the app setting; /ar/legal/privacy is always Arabic. */
export default function PrivacyPage() {
  return <PrivacyDocument />
}
