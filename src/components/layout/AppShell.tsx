'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { ModalProvider } from '@/components/modals/ModalProvider'

interface AppShellProps {
  children: React.ReactNode
}

function isBareAuthRoute(pathname: string | null) {
  if (!pathname) return false
  if (pathname.startsWith('/reset-password')) return true
  if (pathname === '/onboarding' || pathname.startsWith('/onboarding/')) return true
  return false
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const bare = isBareAuthRoute(pathname)

  if (bare) {
    return (
      <div className="min-h-screen bg-[var(--color-brand-bg)]">
        {children}
        <ModalProvider />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-brand-bg)]">
      <Sidebar />
      <main className="lg:ml-[200px] pb-20 lg:pb-0 min-h-screen">
        {children}
      </main>
      <BottomNav />
      <ModalProvider />
    </div>
  )
}
