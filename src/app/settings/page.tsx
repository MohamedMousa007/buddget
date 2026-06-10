'use client'

import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { useSettingsPage } from '@/hooks/useSettingsPage'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { SettingsImportBanner } from '@/components/features/settings/SettingsImportBanner'
import { SettingsSignedInAccountCard } from '@/components/features/settings/SettingsSignedInAccountCard'
import { SettingsCurrencySection } from '@/components/features/settings/SettingsCurrencySection'
import { SettingsDataManagementSection } from '@/components/features/settings/SettingsDataManagementSection'
import { SettingsAppPreferencesSection } from '@/components/features/settings/SettingsAppPreferencesSection'
import { SettingsSecuritySection } from '@/components/features/settings/SettingsSecuritySection'
import { SettingsSmsTrackingSection } from '@/components/features/settings/SettingsSmsTrackingSection'
import { SkeletonList } from '@/components/ui/SkeletonList'

export default function SettingsPage() {
  const t = useT()
  // TODO: Settings children accept the full store — refactor to individual selectors per section
  const store = useFinanceStore()
  const dataReady = store.dataReady
  const s = useSettingsPage()

  if (!dataReady) return <div className="p-4"><SkeletonList rows={6} /></div>

  return (
    <div className="min-h-screen">
      <PageHeader>
        <PageHeaderContent>
          <h1 className="text-xl font-bold text-[var(--color-brand-text-primary)]">{t.settings.pageTitle}</h1>
          <p className="text-xs text-[var(--color-brand-text-muted)] mt-1">
            {t.settings.pageSubtitle}
          </p>
        </PageHeaderContent>
      </PageHeader>

      <div className="px-4 py-4 lg:px-6 space-y-4 max-w-3xl mx-auto">
        <SettingsImportBanner banner={s.importBanner} />

        {s.user ? <SettingsSignedInAccountCard user={s.user} onSignOut={s.signOutAndHome} /> : null}

        {s.user ? <SettingsSecuritySection store={store} /> : null}

        <SettingsCurrencySection store={store} />
        <SettingsDataManagementSection
          store={store}
          fileInputRef={s.fileInputRef}
          showResetConfirm={s.showResetConfirm}
          onShowResetConfirm={s.setShowResetConfirm}
          onExport={s.handleExport}
          onImportChange={s.handleImport}
        />
        <SettingsAppPreferencesSection store={store} />

        {s.user ? <SettingsSmsTrackingSection /> : null}

        <div className="text-center text-xs text-[var(--color-brand-text-muted)] pb-8 space-y-2">
          <p>{t.settings.footer}</p>
          <p>
            <a
              href="https://www.exchangerate-api.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[var(--color-brand-text-secondary)]"
            >
              {t.settings.ratesAttribution}
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
