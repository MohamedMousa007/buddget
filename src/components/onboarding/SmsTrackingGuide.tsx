'use client'

import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronLeft, Coffee, Copy, MessageSquare, Plus, ShieldCheck, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { Badge } from '@/components/ui/badge'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { convertCurrency } from '@/lib/utils/currency'
import { formatCurrency } from '@/lib/utils/formatters'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ShortcutsScene, type SceneId } from './sms/ShortcutsScenes'

const KW_EN = ['EGP', 'USD', 'charged', 'debited', 'purchase']
const KW_AR = ['جنيه', 'دولار', 'خصم', 'شراء', 'عملية']

type Step = { scene?: SceneId; keyword?: boolean; done?: boolean }

/**
 * PARALLEL to the `steps` copy arrays in the dictionaries: index N here pairs with index N there.
 * smsGuideSteps.test.ts pins the lengths together, because `total` comes from THIS array.
 */
export const STEPS: Step[] = [
  { scene: 'automationTab' },
  { scene: 'pickMessage' },
  { keyword: true },
  { scene: 'messageContains' },
  { scene: 'runImmediately' },
  { scene: 'searchAction' },
  { scene: 'shortcutInput' },
  { done: true },
]

async function copyText(text: string) {
  try { const { Clipboard } = await import('@capacitor/clipboard'); await Clipboard.write({ string: text }); return } catch { /* web fallback */ }
  try { await navigator.clipboard.writeText(text) } catch { /* nothing else to try */ }
}
async function openShortcuts() {
  try { const { AppLauncher } = await import('@capacitor/app-launcher'); await AppLauncher.openUrl({ url: 'shortcuts://' }); return } catch { /* web fallback */ }
  window.location.href = 'shortcuts://'
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

const Highlight = ({ children, ar }: { children: ReactNode; ar?: boolean }) => (
  <span className={cn('rounded-[5px] bg-[var(--color-brand-primary-soft)] px-1.5 py-px font-extrabold text-[var(--color-brand-primary-ink)]', !ar && 'font-mono-numbers')}>{children}</span>
)
const Bubble = ({ rtl, children }: { rtl?: boolean; children: ReactNode }) => (
  <div dir={rtl ? 'rtl' : 'ltr'} className={cn('max-w-[270px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 py-2.5 text-[0.8125rem] leading-relaxed text-[var(--color-brand-text-primary)]', rtl ? 'self-end rounded-[16px_16px_4px_16px]' : 'self-start rounded-[16px_16px_16px_4px]')}>{children}</div>
)

function KeywordScreen({ onCopy }: { onCopy: (k: string) => void }) {
  const g = useT().smsTracking.guide
  const chip = (k: string, ar?: boolean) => (
    <Button key={k} variant="outline" size="sm" onClick={() => onCopy(k)} className={cn('font-bold', !ar && 'font-mono-numbers')}>{k}<Copy className="size-3.5 text-[var(--color-brand-text-muted)]" aria-hidden /></Button>
  )
  return (
    <div className="mx-auto flex w-full max-w-[330px] flex-col gap-4">
      <div>
        <h2 className="text-[19px] font-bold leading-tight tracking-[-0.02em] text-[var(--color-brand-text-primary)]">{g.kwHeaderTitle}</h2>
        <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--color-brand-text-secondary)]">{g.kwHeaderBody}</p>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-[0.625rem] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">{g.kwSentLabel}</p>
        <Bubble>{g.kwEnPre}<Highlight>{g.kwEnHl}</Highlight>{g.kwEnPost}</Bubble>
        <Bubble rtl>{g.kwArPre}<Highlight ar>{g.kwArHl}</Highlight>{g.kwArPost}</Bubble>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-[0.625rem] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">{g.kwCommonLabel}</p>
        <div className="flex flex-wrap gap-2">{KW_EN.map((k) => chip(k))}</div>
        <div className="flex flex-wrap gap-2" dir="rtl">{KW_AR.map((k) => chip(k, true))}</div>
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
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const total = STEPS.length
  const cur = STEPS[index]
  const copy = g.steps[index]
  const isLast = index === total - 1

  const onCopy = useCallback((k: string) => {
    void copyText(k)
    setCopied(k)
    clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopied(null), 1500)
  }, [])
  const close = useCallback(() => (onClose ? onClose() : window.history.back()), [onClose])
  const finish = useCallback(() => { onComplete?.(); close() }, [onComplete, close])
  const restart = () => setIndex(0)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--color-brand-bg)]">
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
              {cur.keyword ? <KeywordScreen onCopy={onCopy} /> : cur.done ? <DoneScene /> : <ShortcutsScene id={cur.scene!} />}
            </div>

            {!cur.keyword ? (
              <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4">
                <p className="text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">{copy.title}</p>
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--color-brand-text-secondary)]"><Emphasis text={copy.desc} /></p>
              </div>
            ) : null}

            <div className="mt-3 flex gap-2.5">
              {cur.done ? (
                <>
                  <Button size="cta" onClick={restart} className="flex-1 font-bold"><Plus className="size-4" aria-hidden />{g.addKeyword}</Button>
                  <Button variant="outline" size="cta" onClick={finish} className="flex-1 font-bold">{g.finish}</Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="cta" onClick={openShortcuts} className="font-semibold">{g.openShortcuts}</Button>
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
