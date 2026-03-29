'use client'

import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { useSettingsPage } from '@/hooks/useSettingsPage'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { SettingsImportBanner } from '@/components/features/settings/SettingsImportBanner'
import { SettingsGuestAccountCard } from '@/components/features/settings/SettingsGuestAccountCard'
import { SettingsSignedInAccountCard } from '@/components/features/settings/SettingsSignedInAccountCard'
import { SettingsCurrencySection } from '@/components/features/settings/SettingsCurrencySection'
import { SettingsPageLinksSection } from '@/components/features/settings/SettingsPageLinksSection'
import { SettingsPaymentMethodsSection } from '@/components/features/settings/SettingsPaymentMethodsSection'
import { SettingsAiAssistantSection } from '@/components/features/settings/SettingsAiAssistantSection'
import { SettingsAdminLinkCard } from '@/components/features/settings/SettingsAdminLinkCard'
import { SettingsDataManagementSection } from '@/components/features/settings/SettingsDataManagementSection'
import { SettingsAppPreferencesSection } from '@/components/features/settings/SettingsAppPreferencesSection'

export default function SettingsPage() {
  const store = useFinanceStore()
  const { setActiveModal } = useSettingsStore()
  const requireAuth = useRequireAuthAction()
  const s = useSettingsPage()

  return (
    <div className="min-h-screen">
      <PageHeader>
        <PageHeaderContent>
          <h1 className="text-xl font-bold text-white">Your Preferences</h1>
          <p className="text-xs text-[var(--color-brand-text-muted)] mt-1">
            Manage your currencies, payments, and data. Budget settings live in your Profile.
          </p>
        </PageHeaderContent>
      </PageHeader>

      <div className="px-4 py-6 lg:px-8 space-y-6 max-w-3xl mx-auto">
        <SettingsImportBanner banner={s.importBanner} />

        {!s.user && s.supabaseConfigured ? (
          <SettingsGuestAccountCard onOpenAuth={() => s.openAuthModal('/settings')} />
        ) : null}

        {s.user ? <SettingsSignedInAccountCard user={s.user} onSignOut={s.signOutAndHome} /> : null}

        <SettingsCurrencySection store={store} />
        <SettingsPageLinksSection />
        <SettingsPaymentMethodsSection
          store={store}
          onAddClick={() =>
            requireAuth(
              () => setActiveModal('addPaymentMethod'),
              'Sign in to start adding your payment methods.'
            )
          }
        />
        <SettingsAiAssistantSection store={store} aiStatus={s.aiStatus} />
        <SettingsAdminLinkCard />
        <SettingsDataManagementSection
          store={store}
          fileInputRef={s.fileInputRef}
          showResetConfirm={s.showResetConfirm}
          onShowResetConfirm={s.setShowResetConfirm}
          onExport={s.handleExport}
          onImportChange={s.handleImport}
        />
        <SettingsAppPreferencesSection store={store} />

        <p className="text-center text-xs text-[var(--color-brand-text-muted)] pb-8">
          Buddget v1.0 — Your money, your way.
        </p>
      </div>
    </div>
  )
}
