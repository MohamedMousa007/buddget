'use client'

import { useAdminPanel } from '@/hooks/useAdminPanel'
import { AdminLoginScreen } from '@/components/features/admin/AdminLoginScreen'
import { AdminDashboardHeader } from '@/components/features/admin/AdminDashboardHeader'
import { AdminAiSection } from '@/components/features/admin/AdminAiSection'
import { AdminSmsTemplatesSection } from '@/components/features/admin/AdminSmsTemplatesSection'
import { AdminSmsPromotionSection } from '@/components/features/admin/AdminSmsPromotionSection'
import { AdminSmsTrackedSection } from '@/components/features/admin/AdminSmsTrackedSection'
import { AdminUsersSection } from '@/components/features/admin/AdminUsersSection'
import { AdminAnalyticsSection } from '@/components/features/admin/AdminAnalyticsSection'
import { AdminServerSection } from '@/components/features/admin/AdminServerSection'
import { AdminHelpSection } from '@/components/features/admin/AdminHelpSection'

export default function AdminPage() {
  const admin = useAdminPanel()

  if (!admin.authenticated) {
    return (
      <AdminLoginScreen
        pin={admin.pin}
        onPinChange={admin.setPin}
        error={admin.error}
        loading={admin.loading}
        onLogin={() => void admin.handleLogin()}
      />
    )
  }

  return (
    <div>
      <AdminDashboardHeader onLock={admin.lock} />

      <div className="px-4 py-6 lg:px-8 space-y-6 max-w-3xl mx-auto">
        {admin.platformMessage ? (
          <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 py-2 text-xs text-[var(--color-brand-text-secondary)]">
            {admin.platformMessage}
          </div>
        ) : null}

        <AdminAiSection admin={admin} />
        <AdminSmsPromotionSection admin={admin} />
        <AdminSmsTemplatesSection admin={admin} />
        <AdminSmsTrackedSection admin={admin} />
        <AdminUsersSection admin={admin} />
        <AdminAnalyticsSection admin={admin} />
        <AdminServerSection config={admin.config} />
        <AdminHelpSection />
      </div>
    </div>
  )
}
