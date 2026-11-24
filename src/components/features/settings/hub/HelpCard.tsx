'use client'

import { Globe, ListChecks, Mail, MessagesSquare } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { SETTING_ICONS } from '@/components/features/settings/settingIcons'
import { GROUP_TONE } from '@/components/features/settings/groupMeta'
import { BuddgetWordmark } from '@/components/brand'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { SupportBoardSheet } from './SupportBoardSheet'
import { SupportMessagesSheet } from './support/SupportMessagesSheet'
import { Badge } from '@/components/ui/badge'
import { useSupportCopy } from '@/lib/support/supportCopy'
import { useSupportUnread } from '@/lib/support/openThread'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'

const APP_VERSION = '1.0'

function AboutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const copy = useSettingsHubCopy()
  const h = copy.help
  return (
    <ModalShell open={open} onBackdropClick={onClose} zIndexClassName="z-[110]" panelClassName="md:w-[460px]" padContent>
      <div className="flex flex-col gap-4">
        <V3SheetHeader title={h.about} onClose={onClose} />
        <div className="flex flex-col items-center gap-2 py-2">
          <BuddgetWordmark className="h-auto w-44" />
          <p className="font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">{h.version} {APP_VERSION}</p>
        </div>
        <div className="space-y-3 text-sm leading-relaxed text-[var(--color-brand-text-secondary)]">
          {h.story.map((line) => <p key={line}>{line}</p>)}
        </div>
        <div className="divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-2xl border border-[var(--color-brand-border)]">
          <SettingsRow icon={Globe} title={h.web} href="https://buddget.app" />
          <SettingsRow icon={Mail} title={h.contact} href={`mailto:${h.contact}`} />
        </div>
        <p className="text-center text-xs text-[var(--color-brand-text-muted)]">{h.madeWith}</p>
      </div>
    </ModalShell>
  )
}

/** `support`: Messages (every conversation with the team, and a new one) and the ideas board. `about`: the legal pages and About. */
export function HelpCard({ part }: { part: 'support' | 'about' }) {
  const copy = useSettingsHubCopy()
  const sheet = useSettingsStore((s) => s.settingsSheet)
  const openSheet = useSettingsStore((s) => s.openSettingsSheet)
  const tone = GROUP_TONE.help
  const support = useSupportCopy()
  const unread = useSupportUnread()
  return (
    <>
      <SettingsSection>
        {part === 'support' ? (
          <>
            <SettingsRow
              icon={MessagesSquare}
              tone={tone}
              title={support.entry}
              subtitle={unread ? support.unreadHint(unread) : support.entryHint}
              onClick={() => openSheet('inbox')}
              settingId="feedback"
              trailing={unread ? <Badge tone="brand" size="sm" bordered={false} className="font-mono-numbers">{unread}</Badge> : undefined}
            />
            <SettingsRow icon={ListChecks} tone={tone} title={copy.help.board} subtitle={copy.help.boardHint} onClick={() => openSheet('board')} settingId="board" />
          </>
        ) : (
          <>
            <SettingsRow icon={SETTING_ICONS.file} tone={tone} title={copy.help.terms} href="/legal/terms" settingId="terms" />
            <SettingsRow icon={SETTING_ICONS.file} tone={tone} title={copy.help.privacy} href="/legal/privacy" settingId="privacy" />
            <SettingsRow icon={SETTING_ICONS.info} tone={tone} title={copy.help.about} subtitle={copy.help.aboutHint} onClick={() => openSheet('about')} settingId="about" />
          </>
        )}
      </SettingsSection>
      <SupportMessagesSheet open={sheet === 'inbox' || sheet === 'feedback'} startNew={sheet === 'feedback'} onClose={() => openSheet(null)} />
      <SupportBoardSheet open={sheet === 'board'} onClose={() => openSheet(null)} />
      <AboutSheet open={sheet === 'about'} onClose={() => openSheet(null)} />
    </>
  )
}
