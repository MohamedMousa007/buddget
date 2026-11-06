import type { ReactNode } from 'react'
import { LegalFrame } from '@/components/legal/LegalFrame'

/** Shared layout for all /legal/* pages; the language follows the app setting. */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return <LegalFrame>{children}</LegalFrame>
}
