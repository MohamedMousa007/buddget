import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Install buddget | Add to Home Screen',
  description: 'Install buddget on iPhone, Android, or desktop as a progressive web app.',
}

export default function InstallLayout({ children }: { children: ReactNode }) {
  return children
}
