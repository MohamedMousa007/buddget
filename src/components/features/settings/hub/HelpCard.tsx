'use client'

import { useState } from 'react'
import { Bug, CheckCircle, Globe, Inbox, ListChecks, Lightbulb, Mail, MessageCircleQuestion, Send, X } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { SETTING_ICONS } from '@/components/features/settings/settingIcons'
import { GROUP_TONE } from '@/components/features/settings/groupMeta'
import { BuddgetWordmark } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Textarea } from '@/components/ui/textarea'
import { useT } from '@/lib/i18n'
import { apiFetchAuth } from '@/lib/apiBase'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { SupportBoardSheet } from './SupportBoardSheet'
import { SupportInboxSheet } from './SupportInboxSheet'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

const APP_VERSION = '1.0'

type FeedbackType = 'bug' | 'idea' | 'question'

function FeedbackSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const copy = useSettingsHubCopy()
  const [type, setType] = useState<FeedbackType>('bug')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    onClose()
    setDone(null)
    setError(null)
    setTitle('')
    setDescription('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetchAuth('/api/support/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chosen: type, title, description }) })
      const data = (await res.json()) as { error?: string; number?: number }
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setDone(data.number ? `#${data.number}` : '✓')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalShell open={open} onBackdropClick={close} zIndexClassName="z-[110]" panelClassName="md:w-[460px]" padContent>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--color-brand-text-primary)]">{copy.help.feedback}</h2>
          <IconButton onClick={close} aria-label={copy.close} variant="tinted" size="sm" shape="round"><X className="h-full w-full" /></IconButton>
        </div>
        {done ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle className="size-12 text-[var(--color-brand-green)]" aria-hidden />
            <p className="text-base font-semibold text-[var(--color-brand-text-primary)]">{t.settings.feedback.successTitle}</p>
            <p className="text-sm text-[var(--color-brand-text-muted)]">{t.settings.feedback.successBody.replace('{id}', done)}</p>
            <Button size="touch" variant="outline" onClick={close}>{copy.close}</Button>
          </div>
        ) : (
          <form onSubmit={(e) => { void submit(e) }} className="space-y-4">
            <SegmentedControl<FeedbackType>
              ariaLabel={copy.help.feedback}
              value={type}
              onChange={setType}
              options={[
                { value: 'bug', label: copy.help.bug, icon: <Bug /> },
                { value: 'idea', label: copy.help.idea, icon: <Lightbulb /> },
                { value: 'question', label: copy.help.question, icon: <MessageCircleQuestion /> },
              ]}
            />
            <Input size="brand" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.settings.feedback.placeholderTitle} aria-label={t.settings.feedback.labelTitle} required minLength={3} maxLength={200} />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.settings.feedback.placeholderDescription}
              aria-label={t.settings.feedback.labelDescription}
              rows={5}
              maxLength={5000}
              className="resize-none rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-4 py-3"
            />
            {error ? <p className="text-sm text-[var(--color-brand-red)]">{error}</p> : null}
            <Button type="submit" size="cta-block" disabled={loading || title.length < 3}>
              <Send className="size-4" />{loading ? t.settings.feedback.submitting : t.settings.feedback.submit}
            </Button>
          </form>
        )}
      </div>
    </ModalShell>
  )
}

function AboutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const copy = useSettingsHubCopy()
  const h = copy.help
  return (
    <ModalShell open={open} onBackdropClick={onClose} zIndexClassName="z-[110]" panelClassName="md:w-[460px]" padContent>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--color-brand-text-primary)]">{h.about}</h2>
          <IconButton onClick={onClose} aria-label={copy.close} variant="tinted" size="sm" shape="round"><X className="h-full w-full" /></IconButton>
        </div>
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

/** Feedback (a popup with a bug / feature switch), the legal pages and About. */
export function HelpCard() {
  const copy = useSettingsHubCopy()
  const sheet = useSettingsStore((s) => s.settingsSheet)
  const openSheet = useSettingsStore((s) => s.openSettingsSheet)
  const tone = GROUP_TONE.help
  return (
    <>
      <SettingsSection title={copy.help.title}>
        <SettingsRow icon={SETTING_ICONS.help} tone={tone} title={copy.help.feedback} subtitle={copy.help.feedbackHint} onClick={() => openSheet('feedback')} settingId="feedback" />
        <SettingsRow icon={ListChecks} tone={tone} title={copy.help.board} subtitle={copy.help.boardHint} onClick={() => openSheet('board')} settingId="board" />
        <SettingsRow icon={Inbox} tone={tone} title={copy.help.inbox} subtitle={copy.help.inboxHint} onClick={() => openSheet('inbox')} settingId="inbox" />
        <SettingsRow icon={SETTING_ICONS.file} tone={tone} title={copy.help.terms} href="/legal/terms" settingId="terms" />
        <SettingsRow icon={SETTING_ICONS.file} tone={tone} title={copy.help.privacy} href="/legal/privacy" settingId="privacy" />
        <SettingsRow icon={SETTING_ICONS.info} tone={tone} title={copy.help.about} subtitle={copy.help.aboutHint} onClick={() => openSheet('about')} settingId="about" />
      </SettingsSection>
      <FeedbackSheet open={sheet === 'feedback'} onClose={() => openSheet(null)} />
      <SupportBoardSheet open={sheet === 'board'} onClose={() => openSheet(null)} />
      <SupportInboxSheet open={sheet === 'inbox'} onClose={() => openSheet(null)} />
      <AboutSheet open={sheet === 'about'} onClose={() => openSheet(null)} />
    </>
  )
}
