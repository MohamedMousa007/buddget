import type { Metadata } from 'next'

/**
 * Uses auth + finance client; avoid static prerender without env in CI.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function BudgetPreviewLayout({ children }: { children: React.ReactNode }) {
  return children
}
