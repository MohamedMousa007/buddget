'use client'

import Link from 'next/link'
import { User, Settings } from 'lucide-react'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { ProfileBudgetSection } from '@/components/profile/ProfileBudgetSection'
import { useProfilePage } from '@/hooks/useProfilePage'
import { ProfileAvatarSection } from '@/components/features/profile/ProfileAvatarSection'
import { ProfilePersonalDetailsSection } from '@/components/features/profile/ProfilePersonalDetailsSection'
import { ProfileOnboardingSection } from '@/components/features/profile/ProfileOnboardingSection'

export default function ProfilePage() {
  const p = useProfilePage()

  return (
    <div className="min-h-screen">
      <PageHeader>
        <PageHeaderContent>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <User className="w-6 h-6 text-[var(--color-brand-red)]" />
            Profile
          </h1>
        </PageHeaderContent>
      </PageHeader>

      <div className="px-4 py-6 lg:px-8 space-y-6 max-w-3xl mx-auto">
        <p className="text-sm text-[var(--color-brand-text-muted)]">
          Your account and budget live here. For currencies, AI, backups, and app preferences, open{' '}
          <Link href="/settings" className="text-[var(--color-brand-red)] hover:underline inline-flex items-center gap-1">
            <Settings className="w-3.5 h-3.5" />
            Settings
          </Link>
          .
        </p>

        <ProfileAvatarSection
          fileRef={p.fileRef}
          store={p.store}
          activePreset={p.activePreset}
          onAvatarFile={p.onAvatarFile}
        />
        <ProfilePersonalDetailsSection store={p.store} user={p.user} />
        <ProfileOnboardingSection
          expertDone={p.expertDone}
          pct={p.pct}
          stages={p.onboardingStages}
          supabaseConfigured={p.supabaseConfigured}
          user={p.user}
          onRedoOnboarding={p.goOnboarding}
        />
        <ProfileBudgetSection />
      </div>
    </div>
  )
}
