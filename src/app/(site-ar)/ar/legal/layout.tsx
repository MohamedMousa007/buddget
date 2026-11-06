import type { ReactNode } from 'react'
import { LegalFrame } from '@/components/legal/LegalFrame'
import { LegalLocaleProvider } from '@/components/legal/LegalLocale'

/** /ar/legal/*: the Arabic legal documents. The URL, not the app setting, chooses the language. */
export default function ArabicLegalLayout({ children }: { children: ReactNode }) {
  return (
    <LegalLocaleProvider locale="ar">
      <LegalFrame>{children}</LegalFrame>
    </LegalLocaleProvider>
  )
}
