'use client'

import type { ComponentProps } from 'react'
import { AppLink } from '@/components/ui/AppLink'
import { legalPath, type LegalDoc } from '@/lib/legal/paths'
import { useLegalLocale, useLegalLocaleIsExplicit } from './LegalLocale'

/**
 * Link to the other legal document. On a language-in-the-URL page (`/ar/legal/*`) it stays in that
 * language's URL; inside the app it keeps the language-neutral `/legal/*` (the Arabic site is not in the native bundle).
 */
export function LegalDocLink({ doc, ...rest }: { doc: LegalDoc } & Omit<ComponentProps<typeof AppLink>, 'href'>) {
  const locale = useLegalLocale()
  const explicit = useLegalLocaleIsExplicit()
  return <AppLink href={legalPath(doc, explicit ? locale : 'en')} {...rest} />
}
