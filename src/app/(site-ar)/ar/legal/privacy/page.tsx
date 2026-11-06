import type { Metadata } from 'next'
import { legalAlternates } from '@/lib/legal/paths'
import { PrivacyDocument } from '@/app/(app)/legal/privacy/PrivacyDocument'

export const metadata: Metadata = {
  title: 'سياسة الخصوصية',
  description: 'سياسة خصوصية «بادجت»: كيف نجمع بيانات ماليتك الشخصية ونستخدمها ونخزّنها ونحميها.',
  alternates: legalAlternates('privacy', 'ar'),
}

export default function ArabicPrivacyPage() {
  return <PrivacyDocument />
}
