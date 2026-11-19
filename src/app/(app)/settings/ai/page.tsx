'use client'

import { AiCard } from '@/components/features/settings/hub/AiCard'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'

/** Buddgy and AI: tips, learning, and the way into Memory. */
export default function SettingsAiPage() {
  const copy = useSettingsHubCopy()
  return <SettingsSubPageShell title={copy.page.buddgyAi}><AiCard /></SettingsSubPageShell>
}
