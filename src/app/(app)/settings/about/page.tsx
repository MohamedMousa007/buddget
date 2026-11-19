'use client'

import { HelpCard } from '@/components/features/settings/hub/HelpCard'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'

/** About buddget, the privacy policy and the terms. */
export default function SettingsAboutPage() {
  const copy = useSettingsHubCopy()
  return <SettingsSubPageShell title={copy.page.aboutLegal}><HelpCard part="about" /></SettingsSubPageShell>
}
