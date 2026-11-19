'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, Coffee, Copy, MessageSquare, Plus, ShieldCheck, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { Badge } from '@/components/ui/badge'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { convertCurrency } from '@/lib/utils/currency'
import { formatCurrency } from '@/lib/utils/formatters'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { getSmsBridgeStatus } from '@/lib/native/smsTracker'
import { ShortcutsScene, type SceneId } from './sms/ShortcutsScenes'
import { allGuideKeywords, guideKeywords } from './sms/guideKeywords'

type Step = { scene?: SceneId; test?: boolean; done?: boolean }

/**
 * PARALLEL to the `steps` copy arrays in the dictionaries: index N here pairs with index N there.
 * smsGuideSteps.test.ts pins the lengths together, because `total` comes from THIS array.
 */
export const STEPS: Step[] = [
  { scene: 'automationTab' },
  { scene: 'pickMessage' },
  { scene: 'messageContains' },
  { scene: 'runImmediately' },
  { scene: 'searchAction' },
  { scene: 'shortcutInput' },
  { test: true },
  { done: true },
]

async function copyText(text: string) {
  try { const { Clipboard } = await import('@capacitor/clipboard'); await Clipboard.write({ string: text }); return } catch { /* web fallback */ }
  try { await navigator.clipboard.writeText(text) } catch { /* nothing else to try */ }
}
async function openApp(url: 'shortcuts://' | 'sms:') {
  try { const { AppLauncher } = await import('@capacitor/app-launcher'); await AppLauncher.openUrl({ url }); return } catch { /* web fallback */ }
  window.location.href = url
}

/** *segments* in a description render as teal emphasis. */
function Emphasis({ text }: { text: string }) {
  return <>{text.split('*').map((part, i) => (i % 2 === 1 ? <b key={i} className="font-bold text-[var(--color-brand-primary-ink)]">{part}</b> : part))}</>
}

function Hero() {
  const g = useT().smsTracking.guide
  const base = useFinanceStore((s) => s.settings.baseCurrency)
  const exchangeRates = useFinanceStore((s) => s.exchangeRates)
  return (
    <div className="mx-auto flex w-full max-w-[310px] flex-col items-center">
      <div className="flex w-full items-start gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-3.5 shadow-[var(--shadow-md)]">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-brand-green)] text-[var(--color-brand-card)]" aria-hidden><MessageSquare className="size-[18px]" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between"><span className="text-[0.8125rem] font-bold text-[var(--color-brand-text-primary)]">{g.heroBankName}</span><span className="text-[0.6875rem] text-[var(--color-brand-text-muted)]">{g.heroNow}</span></div>
          <p className="mt-0.5 text-[0.8125rem] leading-snug text-[var(--color-brand-text-secondary)]">{g.heroSmsPre}<span className="font-mono-numbers text-[var(--color-brand-text-primary)]">{g.heroSmsAmount}</span>{g.heroSmsPost}</p>
        </div>
      </div>
      <span className="my-2 h-7 w-0.5 rounded-full bg-[var(--color-brand-border-strong)]" aria-hidden />
      <div className="w-full rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-3.5 shadow-[var(--shadow-md)]">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[0.625rem] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">{g.heroLoggedLabel}</span>
          <Badge variant="positive" className="gap-1"><Check className="size-3" aria-hidden />{g.heroAutoLogged}</Badge>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-[var(--color-brand-amber-soft)] text-[var(--color-brand-amber)]" aria-hidden><Coffee className="size-5" /></span>
          <div className="min-w-0 flex-1"><p className="text-sm font-bold text-[var(--color-brand-text-primary)]">{g.heroMerchant}</p><p className="text-[0.6875rem] text-[var(--color-brand-text-muted)]">{g.heroCategory}</p></div>
          <div className="shrink-0 text-end">
            <span className="font-mono-numbers text-sm font-bold text-[var(--color-brand-text-primary)]">{formatCurrency(45, 'EGP')}</span>
            {base !== 'EGP' && <span className="block text-[0.625rem] text-[var(--color-brand-text-muted)]">{formatCurrency(convertCurrency(45, 'EGP', base, exchangeRates), base)}</span>}
            <p className="text-[0.6875rem] text-[var(--color-brand-text-muted)]">{g.heroMethod}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** The autofilled keyword is the active chip; any other word is one tap away, and every tap also copies it. */
function KeywordChips({ words, active, onPick }: { words: string[]; active: string; onPick: (k: string) => void }) {
  const g = useT().smsTracking.guide
  return (
    <div className="mb-3">
      <p className="mb-2 text-[0.625rem] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">{g.kwChipsLabel}</p>
      <div className="flex flex-wrap gap-2" dir="ltr">
        {words.map((k) => (
          <Button key={k} variant={k === active ? 'default' : 'outline'} size="sm" onClick={() => onPick(k)} aria-pressed={k === active} className="font-bold">
            {k}<Copy className="size-3.5 opacity-60" aria-hidden />
          </Button>
        ))}
      </div>
    </div>
  )
}

/** Watches the device's last automation run: the intent stamps it on every run, even for a text it then skips. */
function TestScreen({ keyword, onCopy }: { keyword: string; onCopy: (k: string) => void }) {
  const g = useT().smsTracking.guide
  const text = g.testMessage(keyword)
  const [connected, setConnected] = useState(false)
  useEffect(() => {
    if (connected) return
    // lastRunAt has whole-second precision, so allow a second of slack.
    const since = Date.now() - 1000
    const tick = async () => {
      const at = (await getSmsBridgeStatus())?.lastRunAt
      if (at && Date.parse(at) >= since) setConnected(true)
    }
    const id = setInterval(tick, 2000)
    return () => clearInterval(id)
  }, [connected])
  return (
    <div className="mx-auto flex w-full max-w-[310px] flex-col items-center gap-4">
      <div dir="ltr" className="max-w-[270px] self-end rounded-[16px_16px_4px_16px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 py-2.5 font-mono-numbers text-[0.8125rem] text-[var(--color-brand-text-primary)]">{text}</div>
      <Button variant="outline" size="sm" onClick={() => onCopy(text)} className="font-bold">{g.copyTest}<Copy className="size-3.5 text-[var(--color-brand-text-muted)]" aria-hidden /></Button>
      <div role="status">
        {connected
          ? <Badge variant="positive" className="gap-1 px-3 py-1 text-[0.8125rem]"><Check className="size-3.5" aria-hidden />{g.testConnected}</Badge>
          : <Badge className="px-3 py-1 text-[0.8125rem]">{g.testWaiting}</Badge>}
      </div>
    </div>
  )
}

function DoneScene() {
  const g = useT().smsTracking.guide
  return (
    <div className="flex flex-col items-center gap-3">
      <span className="flex size-[72px] items-center justify-center rounded-full bg-[var(--color-brand-green)] text-[var(--color-brand-card)] shadow-[var(--shadow-md)]"><Check className="size-9" strokeWidth={3} aria-hidden /></span>
      <Badge variant="positive" className="px-3 py-1 text-[0.8125rem]">{g.automationActive}</Badge>
    </div>
  )
}

export type SmsTrackingGuideProps = {
  onClose?: () => void
  /** Fired when the user taps "Finish" (setup complete), before closing. Distinct from cancel/X. */
  onComplete?: () => void
}

export default function SmsTrackingGuide({ onClose, onComplete }: SmsTrackingGuideProps) {
  const g = useT().smsTracking.guide
  const [phase, setPhase] = useState<'intro' | 'steps'>('intro')
  const [index, setIndex] = useState(0)
  const [copied, setCopied] = useState<string | null>(null)
  // Each pass through the steps builds one automation; the next pass uses the next keyword.
  const baseCurrency = useFinanceStore((s) => s.settings.baseCurrency)
  const keywords = guideKeywords(baseCurrency)
  const [used, setUsed] = useState<string[]>([])
  // The guide pre-fills the keyword for the round; tapping another chip switches to it (and copies it, as a fallback).
  const [picked, setPicked] = useState<string | null>(null)
  const keyword = picked ?? keywords.find((k) => !used.includes(k)) ?? keywords[0]
  const nextKeyword = keywords.find((k) => k !== keyword && !used.includes(k))
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const total = STEPS.length
  const cur = STEPS[index]
  const copy = g.steps[index]
  const desc = (cur.done && nextKeyword ? g.doneMore(nextKeyword) : copy.desc).replaceAll('{kw}', keyword)
  const isLast = index === total - 1

  const onCopy = useCallback((k: string) => {
    void copyText(k)
    setCopied(k)
    clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopied(null), 1500)
  }, [])
  const close = useCallback(() => (onClose ? onClose() : window.history.back()), [onClose])
  const finish = useCallback(() => { onComplete?.(); close() }, [onComplete, close])
  const restart = () => { setUsed((u) => [...u, keyword]); setPicked(null); setIndex(0) }

  return (
    <div className="fixed inset-0 z-[var(--z-dialog)] flex items-center justify-center bg-[var(--color-brand-bg)]">
      <div className="relative flex h-full max-h-[844px] w-full max-w-[390px] flex-col overflow-hidden bg-[var(--color-brand-bg)] safe-area-top safe-area-bottom">
        <IconButton onClick={close} aria-label={g.ariaClose} variant="outlined" size="sm" shape="round" className="absolute end-4 top-4 z-10"><X /></IconButton>

        {phase === 'intro' ? (
          <section className="flex min-h-0 flex-1 flex-col px-6 pb-6 pt-5" aria-label={g.brand}>
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-[10px] bg-[var(--color-brand-primary)] text-base font-extrabold text-[var(--color-brand-on-primary)]" aria-hidden>B</span>
              <span className="text-base font-bold tracking-[-0.01em] text-[var(--color-brand-text-primary)]">{g.brand}</span>
            </div>
            <div className="flex min-h-0 flex-1 items-center py-4"><Hero /></div>
            <h1 className="text-[29px] font-bold leading-[1.15] tracking-[-0.03em] text-[var(--color-brand-text-primary)]">{g.introTitle1}<br />{g.introTitle2}</h1>
            <p className="mt-2.5 text-sm leading-relaxed text-[var(--color-brand-text-secondary)]">{g.introBody}</p>
            <p className="mt-4 flex items-start gap-2 text-xs leading-snug text-[var(--color-brand-text-muted)]"><ShieldCheck className="mt-px size-4 shrink-0 text-[var(--color-brand-green)]" aria-hidden />{g.trust}</p>
            <Button size="cta-block" className="mt-4 font-bold" onClick={() => { setPhase('steps'); setIndex(0) }}>{g.cta}</Button>
            <p className="mt-2.5 text-center text-xs text-[var(--color-brand-text-muted)]">{g.ctaCaption}</p>
          </section>
        ) : (
          <section className="flex min-h-0 flex-1 flex-col px-5 pb-5 pt-4" aria-label={g.setupTitle}>
            <div className="flex items-center gap-2 pe-12">
              <IconButton onClick={() => (index === 0 ? setPhase('intro') : setIndex((i) => i - 1))} aria-label={g.ariaBack} variant="outlined" size="sm" shape="round"><ChevronLeft /></IconButton>
              <span className="text-[0.9375rem] font-bold tracking-[-0.01em] text-[var(--color-brand-text-primary)]">{g.setupTitle}</span>
            </div>
            <div className="mt-3 flex gap-1" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={index + 1} aria-label={g.stepOf(index + 1, total)}>
              {STEPS.map((_, i) => <span key={i} className={cn('h-1 flex-1 rounded-full transition-colors', i <= index ? 'bg-[var(--color-brand-primary)]' : 'bg-[var(--color-brand-sunken)]')} />)}
            </div>
            <p className="mt-2 text-[0.6875rem] font-semibold tabular-nums text-[var(--color-brand-text-muted)]">{g.stepOf(index + 1, total)}</p>

            <div className="flex min-h-0 flex-1 items-center justify-center py-3" key={index}>
              {cur.test ? <TestScreen keyword={keyword} onCopy={onCopy} /> : cur.done ? <DoneScene /> : <ShortcutsScene id={cur.scene!} keyword={keyword} />}
            </div>
            {cur.scene === 'messageContains' ? (
              <KeywordChips words={allGuideKeywords(baseCurrency)} active={keyword} onPick={(k) => { setPicked(k); onCopy(k) }} />
            ) : null}

            <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4">
              <p className="text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">{copy.title}</p>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--color-brand-text-secondary)]"><Emphasis text={desc} /></p>
            </div>

            <div className="mt-3 flex gap-2.5">
              {cur.done ? (
                <>
                  <Button size="cta" onClick={restart} className="flex-1 font-bold"><Plus className="size-4" aria-hidden />{g.addKeyword}</Button>
                  <Button variant="outline" size="cta" onClick={finish} className="flex-1 font-bold">{g.finish}</Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="cta" onClick={() => openApp(cur.test ? 'sms:' : 'shortcuts://')} className="font-semibold">{cur.test ? g.openMessages : g.openShortcuts}</Button>
                  <Button size="cta" onClick={() => setIndex((i) => Math.min(total - 1, i + 1))} disabled={isLast} className="flex-1 font-bold">{g.ariaNext}</Button>
                </>
              )}
            </div>
          </section>
        )}

        {copied ? (
          <div role="status" className="absolute bottom-24 start-1/2 z-20 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-[var(--color-brand-text-primary)] px-4 py-2.5 text-[0.78125rem] font-semibold text-[var(--color-brand-card)] shadow-[var(--shadow-md)]">
            <Check className="size-3.5 text-[var(--color-brand-green)]" strokeWidth={3} aria-hidden />{g.copied(copied)}
          </div>
        ) : null}
      </div>
    </div>
  )
}
