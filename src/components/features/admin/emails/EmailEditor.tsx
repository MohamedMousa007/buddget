'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, History, Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useActionToast } from '@/components/ui/ActionToast'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { renderBlocks } from '@/lib/email/blocks'
import { withPreheader } from '@/lib/email/render'
import { EMAIL_LOCALES, LOCALE_LABEL, isSecurityScenario, type EmailLocale } from '@/lib/email/scenarios'
import { hasErrors, validateTemplate } from '@/lib/email/validate'
import { ARABIC_SAMPLES } from '@/lib/email/variables'
import { adminFetch, adminPost, errorMessage } from '../adminClient'
import { ago } from '../format'
import { AdminSheet } from '../ui/AdminSheet'
import { Field } from '../ui/Field'
import { Loading, Notice, PageHeader, Panel } from '../ui/Panel'
import { Pill } from '../ui/Pill'
import { useStepUp } from '../ui/StepUp'
import { BlockEditor } from './BlockEditor'
import { CodeEditor } from './CodeEditor'
import { EmailPreview } from './EmailPreview'
import { insertAtCursor } from './insertAtCursor'
import type { TemplateDetail, Working } from './types'
import { VariablePalette } from './VariablePalette'

type TextField = HTMLInputElement | HTMLTextAreaElement

const snapshot = (w: Pick<Working, 'subject' | 'preheader' | 'mode' | 'blocks' | 'html'>) =>
  JSON.stringify({ s: w.subject, p: w.preheader, m: w.mode, b: w.blocks, h: w.mode === 'html' ? w.html : '' })

function initial(d: TemplateDetail, locale: EmailLocale): Working {
  const slot = d.locales[locale]
  const src = slot.draft ?? slot.published
  const w = src
    ? { subject: src.subject, preheader: src.preheader, mode: src.mode, html: src.html, blocks: src.blocks, origin: slot.draft ? ('draft' as const) : ('published' as const), version: src.version }
    : { subject: d.blank[locale].subject, preheader: d.blank[locale].preheader, mode: 'visual' as const, html: '', blocks: d.blank[locale].blocks, origin: 'new' as const, version: 1 }
  return { ...w, base: snapshot(w) }
}

const htmlOf = (w: Working, locale: EmailLocale) =>
  w.mode === 'visual' ? renderBlocks(w.blocks, { locale, subject: w.subject, preheader: w.preheader }) : withPreheader(w.html, w.preheader)

export function EmailEditor({ scenarioKey, canManage, onBack }: { scenarioKey: string; canManage: boolean; onBack: () => void }) {
  const toast = useActionToast()
  const confirm = useConfirm()
  const stepUp = useStepUp()
  const [detail, setDetail] = useState<TemplateDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [work, setWork] = useState<Record<EmailLocale, Working> | null>(null)
  const [locale, setLocale] = useState<EmailLocale>('en')
  const [samples, setSamples] = useState<Record<EmailLocale, Record<string, string>> | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [history, setHistory] = useState(false)
  const lastField = useRef<TextField | null>(null)

  const load = useCallback(async (only?: EmailLocale) => {
    try {
      const d = await adminFetch<TemplateDetail>(`/api/admin/emails?key=${encodeURIComponent(scenarioKey)}`)
      setDetail(d)
      setSamples((s) => s ?? { en: d.samples, ar: { ...d.samples, ...ARABIC_SAMPLES } })
      setWork((prev) => ({
        en: !prev || only === 'en' ? initial(d, 'en') : prev.en,
        ar: !prev || only === 'ar' ? initial(d, 'ar') : prev.ar,
      }))
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [scenarioKey])

  useEffect(() => {
    void load()
  }, [load])

  const w = work?.[locale]
  const dirtyOf = (l: EmailLocale) => (work ? snapshot(work[l]) !== work[l].base : false)
  const anyDirty = dirtyOf('en') || dirtyOf('ar')

  useEffect(() => {
    if (!anyDirty) return
    const guard = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [anyDirty])

  const html = useMemo(() => (w ? htmlOf(w, locale) : ''), [w, locale])
  const customHtml = !!w && w.mode === 'html' && html !== renderBlocks(w.blocks, { locale, subject: w.subject, preheader: w.preheader })
  const issues = useMemo(() => (detail && w ? validateTemplate(detail.scenario, { subject: w.subject, preheader: w.preheader, html }) : []), [detail, w, html])

  if (error && !detail) return <Notice tone="negative">{error}</Notice>
  if (!detail || !work || !w || !samples) return <Loading rows={6} />

  const patch = (p: Partial<Working>) => setWork({ ...work, [locale]: { ...w, ...p } })
  const dir = locale === 'ar' ? 'rtl' : 'ltr'
  const blocksNow = () => renderBlocks(w.blocks, { locale, subject: w.subject, preheader: w.preheader })

  const goBack = async () => {
    if (anyDirty && !(await confirm({ title: 'Leave without saving?', body: 'You have unsaved changes in this email.', destructive: true, confirmLabel: 'Leave' }))) return
    onBack()
  }

  const switchMode = async (mode: 'visual' | 'html') => {
    if (mode === w.mode) return
    if (mode === 'html') return patch({ mode, html: blocksNow() })
    if (customHtml) {
      if (!(await confirm({ title: 'Discard the custom HTML?', body: 'This HTML was edited by hand, so it can’t become blocks. Going back to Visual restores the blocks and drops your HTML edits.', destructive: true, confirmLabel: 'Discard HTML' }))) return
    }
    patch({ mode })
  }

  const content = { subject: w.subject, preheader: w.preheader, mode: w.mode, html, blocks: w.blocks }
  const saveDraft = async (): Promise<boolean> => {
    const { version } = await adminPost<{ version: number }>('/api/admin/emails', { op: 'saveDraft', key: scenarioKey, locale, ...content })
    setWork((cur) => (cur ? { ...cur, [locale]: { ...cur[locale], origin: 'draft', version, base: snapshot(cur[locale]) } } : cur))
    return true
  }

  const act = async (name: string, fn: () => Promise<unknown>, ok: string, reload = true) => {
    setBusy(name)
    try {
      await fn()
      toast(ok)
      if (reload) await load()
    } catch (e) {
      toast(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const publish = async () => {
    const proof = isSecurityScenario(scenarioKey) ? await stepUp('This email carries sign-in links or codes. Publishing it changes what every user receives. Confirm it’s you.') : {}
    if (!proof) return
    await act('publish', async () => {
      if (dirtyOf(locale) || w.origin === 'new') await saveDraft()
      const res = await adminPost<{ translated: EmailLocale | null; translateNote: string | null }>('/api/admin/emails', { op: 'publish', key: scenarioKey, locale, ...proof })
      await load(locale)
      if (res.translated && !dirtyOf(res.translated)) await load(res.translated)
      if (res.translated) toast(`${LOCALE_LABEL[locale]} published. Buddgy drafted ${LOCALE_LABEL[res.translated]}: review it, edit if needed, then publish.`)
      else if (res.translateNote && !res.translateNote.includes('already') && !res.translateNote.includes('by hand')) toast(res.translateNote)
    }, `${LOCALE_LABEL[locale]} published`, false)
  }

  const translate = async () => {
    if (w.origin !== 'new' && !(await confirm({ title: `Rewrite ${LOCALE_LABEL[locale]} with Buddgy?`, body: `This replaces the ${LOCALE_LABEL[locale]} draft with a fresh translation of the ${LOCALE_LABEL[other]} version. You can edit it afterwards.`, confirmLabel: 'Translate' }))) return
    await act('translate', async () => {
      await adminPost('/api/admin/emails', { op: 'translate', key: scenarioKey, locale })
      await load(locale)
    }, `${LOCALE_LABEL[locale]} drafted by Buddgy: review it before publishing`, false)
  }

  const restore = async (version: number) => {
    if (dirtyOf(locale) && !(await confirm({ title: 'Replace your unsaved changes?', destructive: true, confirmLabel: 'Restore' }))) return
    setHistory(false)
    await act('restore', async () => {
      await adminPost('/api/admin/emails', { op: 'revert', key: scenarioKey, locale, version })
      await load(locale)
    }, `Version ${version} restored as a draft`, false)
  }

  const other: EmailLocale = locale === 'en' ? 'ar' : 'en'
  const published = detail.locales[locale].published
  const status = w.origin === 'new' ? 'Not saved yet' : w.origin === 'draft' ? `Draft v${w.version}` : `Published v${w.version}`
  const errorsPresent = hasErrors(issues)

  return (
    <>
      <PageHeader
        title={detail.scenario.name}
        description={detail.scenario.usedIn}
        actions={<Button variant="outline" size="touch" onClick={() => void goBack()}><ArrowLeft className="rtl:rotate-180" />All emails</Button>}
      />
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Panel
          title="Content"
          actions={<><Pill tone={w.origin === 'published' ? 'good' : 'neutral'}>{status}</Pill>{dirtyOf(locale) ? <Pill tone="warn">Unsaved changes</Pill> : null}</>}
        >
          <div className="space-y-4" onFocusCapture={(e) => { const t = e.target; if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) lastField.current = t }}>
            <SegmentedControl
              ariaLabel="Language"
              value={locale}
              onChange={setLocale}
              options={EMAIL_LOCALES.map((l) => ({ value: l, label: LOCALE_LABEL[l] }))}
            />
            <Field label="Subject"><Input size="brand" dir={dir} value={w.subject} disabled={!canManage} onChange={(e) => patch({ subject: e.target.value })} /></Field>
            <Field label="Preheader" hint="The grey line next to the subject in the inbox."><Input size="brand" dir={dir} value={w.preheader} disabled={!canManage} onChange={(e) => patch({ preheader: e.target.value })} /></Field>

            <div>
              <p className="mb-2 text-xs font-medium text-[var(--color-brand-text-secondary)]">Variables · tap to insert at the cursor, or drag</p>
              <VariablePalette
                scenario={detail.scenario}
                onInsert={(token) => {
                  const f = lastField.current
                  if (f && document.contains(f) && !f.disabled) insertAtCursor(f, token)
                  else toast('Tap a field first, then a variable')
                }}
              />
            </div>

            <SegmentedControl ariaLabel="Editor mode" value={w.mode} onChange={(m) => void switchMode(m)} options={[{ value: 'visual', label: 'Visual' }, { value: 'html', label: 'HTML' }]} />
            {customHtml ? <Notice tone="warning">Custom HTML: edited by hand, so it can’t be turned back into blocks. Switching to Visual discards these edits.</Notice> : null}

            {w.mode === 'visual'
              ? <BlockEditor blocks={w.blocks} onChange={(blocks) => patch({ blocks })} dir={dir} />
              : <CodeEditor label="Email HTML" value={html} onChange={(v) => patch({ html: v })} />}

            {issues.length ? (
              <div className="space-y-2">
                {issues.map((i) => <Notice key={i.message} tone={i.level === 'error' ? 'negative' : 'warning'}>{i.message}</Notice>)}
              </div>
            ) : null}

            {canManage ? (
              <div className="flex flex-wrap gap-2">
                <Button size="touch" variant="outline" loading={busy === 'save'} disabled={!dirtyOf(locale) && w.origin !== 'new'} onClick={() => void act('save', saveDraft, 'Draft saved', false)}>Save draft</Button>
                <Button size="touch" loading={busy === 'publish'} disabled={errorsPresent || (w.origin === 'published' && !dirtyOf(locale))} onClick={() => void publish()}>Publish</Button>
                <Button size="touch" variant="outline" loading={busy === 'test'} disabled={errorsPresent} onClick={() => void act('test', () => adminPost('/api/admin/emails', { op: 'test', key: scenarioKey, locale, ...content, vars: samples[locale] }), 'Test email sent to you', false)}><Send />Send test</Button>
                <Button size="touch" variant="outline" loading={busy === 'translate'} onClick={() => void translate()}><Sparkles />Translate from {LOCALE_LABEL[other]}</Button>
                <Button size="touch" variant="ghost" onClick={() => setHistory(true)}><History />History</Button>
                {w.origin === 'draft' && published ? (
                  <Button size="touch" variant="ghost" onClick={async () => { if (await confirm({ title: 'Discard this draft?', body: 'The published version stays live.', destructive: true, confirmLabel: 'Discard' })) await act('discard', async () => { await adminPost('/api/admin/emails', { op: 'discardDraft', key: scenarioKey, locale }); await load(locale) }, 'Draft discarded', false) }}>Discard draft</Button>
                ) : null}
              </div>
            ) : <Notice>You can view this email but not change it.</Notice>}
          </div>
        </Panel>

        <Panel title="Preview" description={`${LOCALE_LABEL[locale]}${locale === 'ar' ? ' · right to left' : ''}. Updates as you type.`} className="lg:sticky lg:top-4">
          <EmailPreview
            scenario={detail.scenario}
            subject={w.subject}
            preheader={w.preheader}
            html={html}
            sample={samples[locale]}
            onSample={(name, value) => setSamples({ ...samples, [locale]: { ...samples[locale], [name]: value } })}
          />
        </Panel>
      </div>

      <AdminSheet open={history} title={`History · ${LOCALE_LABEL[locale]}`} onClose={() => setHistory(false)}>
        <div className="space-y-2">
          {detail.versions.filter((v) => v.locale === locale).map((v) => (
            <div key={v.version} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-brand-border)] px-3.5 py-2.5">
              <div>
                <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">Version {v.version}{published?.version === v.version ? ' · live' : ''}</p>
                <p className="text-xs text-[var(--color-brand-text-muted)]">Published {ago(v.published_at)}</p>
              </div>
              {canManage ? <Button size="touch" variant="outline" loading={busy === 'restore'} onClick={() => void restore(v.version)}>Restore</Button> : null}
            </div>
          ))}
          {detail.versions.every((v) => v.locale !== locale) ? <p className="py-6 text-center text-sm text-[var(--color-brand-text-muted)]">Nothing published yet.</p> : null}
        </div>
      </AdminSheet>
    </>
  )
}
