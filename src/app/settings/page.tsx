'use client'

import { User, Shield, Palette, Globe, MessageSquare, Database, Target, RefreshCw, FileText } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import Link from 'next/link'
import { useAuth } from '@/components/auth/AuthProvider'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { resolveProfileAvatarSrc } from '@/lib/profile/avatarDisplay'
import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { useT, useLocale } from '@/lib/i18n'
import { cn } from '@/lib/utils'

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="px-1 pt-5 pb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">
      {label}
    </p>
  )
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] divide-y divide-[var(--color-brand-border)] overflow-hidden">
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const t = useT()
  const { locale } = useLocale()
  const { user } = useAuth()

  const { profile, dataReady } = useFinanceStore(
    useShallow((s) => ({
      profile: s.profile,
      dataReady: s.dataReady,
    })),
  )

  if (!dataReady) return <div className="p-4"><SkeletonList rows={8} /></div>

  const avatarSrc = resolveProfileAvatarSrc(profile)
  const displayName = profile.name || t.common.user
  const displayEmail = user?.email || profile.email || ''

  return (
    <div>
      <div className="px-4 py-4 lg:px-6 max-w-3xl mx-auto pb-10">
        {/* Identity header */}
        {user && (
          <Link
            href="/settings/profile"
            className="flex items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-3.5 mb-2 hover:bg-[var(--color-brand-elevated)] transition-colors"
          >
            <div className="w-12 h-12 rounded-full overflow-hidden border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] flex items-center justify-center shrink-0">
              {avatarSrc
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={avatarSrc} alt="" className="w-full h-full object-cover" width={48} height={48} />
                : <User className="w-6 h-6 text-[var(--color-brand-text-secondary)]" />}
            </div>
            <div className={cn('flex-1 min-w-0', locale === 'ar' && 'text-end')}>
              <p className="text-base font-semibold text-[var(--color-brand-text-primary)] truncate">{displayName}</p>
              {displayEmail ? (
                <p className="text-xs text-[var(--color-brand-text-muted)] truncate">{displayEmail}</p>
              ) : null}
            </div>
          </Link>
        )}

        {/* Account */}
        {user && (
          <>
            <SectionHeader label={t.settings.hub.sectionAccount} />
            <SectionCard>
              <SettingsRow icon={User} title={t.settings.hub.profile} subtitle={t.settings.hub.profileSubtitle} href="/settings/profile" />
              <SettingsRow icon={Shield} title={t.settings.hub.account} subtitle={t.settings.hub.accountSubtitle} href="/settings/account" />
            </SectionCard>
          </>
        )}

        {/* Preferences */}
        <SectionHeader label={t.settings.hub.sectionPreferences} />
        <SectionCard>
          <SettingsRow icon={Palette} title={t.settings.hub.display} subtitle={t.settings.hub.displaySubtitle} href="/settings/display" />
          <SettingsRow icon={Globe} title={t.settings.hub.currency} subtitle={t.settings.hub.currencySubtitle} href="/settings/currency" />
        </SectionCard>

        {/* Data & Tracking */}
        <SectionHeader label={t.settings.hub.sectionDataTracking} />
        <SectionCard>
          {user && (
            <SettingsRow icon={MessageSquare} title={t.settings.hub.sms} subtitle={t.settings.hub.smsSubtitle} href="/settings/sms" />
          )}
          <SettingsRow icon={Database} title={t.settings.hub.data} subtitle={t.settings.hub.dataSubtitle} href="/settings/data" />
        </SectionCard>

        {/* More */}
        <SectionHeader label={t.settings.hub.sectionMore} />
        <SectionCard>
          <SettingsRow icon={Target} title={t.settings.hub.goals} subtitle={t.settings.hub.goalsSubtitle} href="/goals" />
          <SettingsRow icon={RefreshCw} title={t.settings.hub.subscriptions} subtitle={t.settings.hub.subscriptionsSubtitle} href="/subscriptions" />
        </SectionCard>

        {/* Legal */}
        <SectionHeader label={t.settings.hub.sectionLegal} />
        <SectionCard>
          <SettingsRow icon={FileText} title={t.settings.hub.terms} href="/legal/terms" />
          <SettingsRow icon={FileText} title={t.settings.hub.privacy} href="/legal/privacy" />
        </SectionCard>

        <div className="text-center text-xs text-[var(--color-brand-text-muted)] pt-6 pb-4 space-y-1">
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
