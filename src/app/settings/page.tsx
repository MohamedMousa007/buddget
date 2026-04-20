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
import { useRouter } from 'next/navigation'
import { Compass } from 'lucide-react'
import { useTutorialController } from '@/components/tutorial/TutorialController'

export default function SettingsPage() {
  const t = useT()
  const router = useRouter()
  const tutorial = useTutorialController()
  // TODO: Settings children accept the full store — refactor to individual selectors per section
  const store = useFinanceStore()
  const s = useSettingsPage()

  const handleShowTour = () => {
    // Kick off on /budget-setup — the tour's first step lives there and
    // the controller handles cross-route navigation for subsequent steps.
    router.push('/budget-setup')
    // Tiny microtask so the route transition starts before we arm the
    // tour (the controller navigates per-step, but the first step needs
    // the anchor to be live).
    setTimeout(() => tutorial.start('postOnboardingTour'), 50)
  }

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

        <button
          type="button"
          onClick={handleShowTour}
          className="w-full flex items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-3 text-start hover:bg-[var(--color-brand-elevated)] transition-colors"
        >
          <span className="h-9 w-9 rounded-full flex items-center justify-center bg-[var(--color-brand-red)]/10 text-[var(--color-brand-red)]">
            <Compass className="h-4 w-4" aria-hidden />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-[var(--color-brand-text-primary)]">
              {t.settings.showMeAround}
            </span>
            <span className="block text-xs text-[var(--color-brand-text-muted)] mt-0.5">
              {t.settings.showMeAroundDesc}
            </span>
          </span>
        </button>

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
