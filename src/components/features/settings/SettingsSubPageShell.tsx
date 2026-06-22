'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { SettingsSaveButton } from '@/components/features/settings/SettingsSaveButton'
import { useLocale } from '@/lib/i18n'

interface Props {
  title: string
  children: React.ReactNode
  /** Show the "Save & sync" header action (force-push to server). Default true. */
  showSave?: boolean
}

export function SettingsSubPageShell({ title, children, showSave = true }: Props) {
  const { locale } = useLocale()
  const isRtl = locale === 'ar'

  return (
    <div className="min-h-screen">
      <PageHeader>
        <PageHeaderContent>
          <div className="flex items-center gap-1">
            <Link
              href="/settings"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)] transition-colors shrink-0"
              aria-label="Back to Settings"
            >
              {isRtl
                ? <ChevronRight className="h-5 w-5" />
                : <ChevronLeft className="h-5 w-5" />}
            </Link>
            <h1 className="text-xl font-bold text-[var(--color-brand-text-primary)]">{title}</h1>
            {showSave ? <div className="ms-auto"><SettingsSaveButton /></div> : null}
          </div>
        </PageHeaderContent>
      </PageHeader>
      <div className="px-4 py-4 lg:px-6 max-w-3xl mx-auto space-y-4">
        {children}
      </div>
    </div>
  )
}
