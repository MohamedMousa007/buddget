'use client'

import { HelpCard } from '@/components/features/settings/hub/HelpCard'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'

/** Help and feedback: send feedback, the ideas board and your requests. */
export default function SettingsHelpPage() {
  const copy = useSettingsHubCopy()
  return <SettingsSubPageShell title={copy.page.helpFeedback}><HelpCard part="support" /></SettingsSubPageShell>
}
