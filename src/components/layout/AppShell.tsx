'use client'

import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { ModalProvider } from '@/components/modals/ModalProvider'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
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
