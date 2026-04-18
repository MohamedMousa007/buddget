'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { ModalProvider } from '@/components/modals/ModalProvider'
import { OnboardingBanner } from '@/components/layout/OnboardingBanner'
import { DesktopHeaderBar } from '@/components/layout/DesktopHeaderBar'
import { InstallButton } from '@/components/pwa/InstallButton'
import { useThemeSync } from '@/hooks/useThemeSync'
import { useRates } from '@/hooks/useRates'
import { useGoldPrice } from '@/hooks/useGoldPrice'

/** Keeps FX + gold spot in sync for all main app routes (not auth/onboarding). */
function MarketRatesSync() {
  useRates()
  useGoldPrice()
  return null
}

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
  useThemeSync()
  const pathname = usePathname()
  const bare = isBareAuthRoute(pathname)
  // The dashboard absorbs the header (logo + month + bell + avatar) into its
  // own dark hero block, so we suppress the regular top bar + its offset on
  // `/` to avoid visual duplication. Every other route keeps the existing
  // sticky header.
  const isDashboard = pathname === '/'

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
      <MarketRatesSync />
      <Sidebar />
      {isDashboard ? null : <DesktopHeaderBar />}
      <main
        className={
          isDashboard
            ? 'pt-0 lg:ms-[176px] pb-16 lg:pb-0 min-h-screen'
            : 'pt-[calc(3rem+env(safe-area-inset-top,0px))] lg:pt-12 lg:ms-[176px] pb-16 lg:pb-0 min-h-screen'
        }
      >
        <OnboardingBanner />
        {children}
      </main>
      <InstallButton variant="banner" />
      <BottomNav />
      <ModalProvider />
    </div>
  )
}
