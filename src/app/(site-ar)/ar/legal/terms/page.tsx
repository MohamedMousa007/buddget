import type { Metadata } from 'next'
import { legalAlternates } from '@/lib/legal/paths'
import { TermsDocument } from '@/app/(app)/legal/terms/TermsDocument'

export const metadata: Metadata = {
  title: 'شروط الخدمة',
  description: 'شروط خدمة «بادجت»: القواعد والأحكام التي تحكم استخدامك لمنصة «بادجت» للتمويل الشخصي.',
  alternates: legalAlternates('terms', 'ar'),
}

export default function ArabicTermsPage() {
  return <TermsDocument />
}
