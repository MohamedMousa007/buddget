'use client'

import { useState, useCallback, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  Copy, Check, ExternalLink, ChevronLeft, ChevronRight,
  ShieldCheck, AlertTriangle, Loader2, Zap,
} from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { isNative, isIOS } from '@/lib/native/isNative'
import {
  getSmsBridgeStatus, runSmsHealthCheck,
  type SmsBridgeStatus, type SmsHealthResult,
} from '@/lib/native/smsTracker'
import type { Currency } from '@/lib/store/types'

/** Arabic synonyms banks use instead of (or alongside) the Latin code. */
const CURRENCY_SYNONYMS: Partial<Record<Currency, string[]>> = {
  EGP: ['EGP', 'جنيه'],
  AED: ['AED', 'درهم'],
  SAR: ['SAR', 'ريال'],
  QAR: ['QAR', 'ريال'],
  KWD: ['KWD', 'دينار'],
  BHD: ['BHD', 'دينار'],
  JOD: ['JOD', 'دينار'],
  OMR: ['OMR', 'ريال'],
}

/** Currency-independent verbs for banks that omit the currency code. */
const CATCH_ALL_KEYWORDS = ['debited', 'received', 'purchase', 'تم خصم', 'تم استلام']

const TOTAL_STEPS = 5

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

/** Stylized mock of a Shortcuts-app screen region — pure design-system CSS. */
function MockFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3 space-y-1.5">
      {children}
    </div>
  )
}

function MockRow({ label, highlight, trailing }: { label: string; highlight?: boolean; trailing?: React.ReactNode }) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
        highlight
          ? 'bg-[var(--color-brand-green)]/15 text-[var(--color-brand-green)] font-semibold ring-1 ring-[var(--color-brand-green)]/40'
          : 'bg-[var(--color-brand-card)] text-[var(--color-brand-text-secondary)]'
      }`}
    >
      <span className="truncate">{label}</span>
      {trailing}
    </div>
  )
}

function MockToggle({ on }: { on: boolean }) {
  return (
    <span
      className={`inline-flex h-4 w-7 shrink-0 items-center rounded-full px-0.5 ${
        on ? 'bg-[var(--color-brand-green)] justify-end' : 'bg-[var(--color-brand-border)] justify-start'
      }`}
    >
      <span className="h-3 w-3 rounded-full bg-white" />
    </span>
  )
}

function KeywordChip({ word, copied, onCopy }: { word: string; copied: boolean; onCopy: (w: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onCopy(word)}
      className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3.5 text-xs font-semibold text-[var(--color-brand-text-primary)] hover:border-[var(--color-brand-green)]/50 transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-[var(--color-brand-green)]" /> : <Copy className="h-3.5 w-3.5 opacity-60" />}
      {word}
    </button>
  )
}

type HealthState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'done'; result: SmsHealthResult | null }

/**
 * Five-step illustrated guide for wiring the iOS Shortcuts automation to the
 * native "Catch Bank SMS" App Intent. Self-contained: derives keyword
 * suggestions from the user's currencies and runs the native health check.
 */
export function SmsIosWalkthrough() {
  const t = useT()
  const [step, setStep] = useState(0)
  const [copiedWord, setCopiedWord] = useState<string | null>(null)
  const [showCatchAlls, setShowCatchAlls] = useState(false)
  const [health, setHealth] = useState<HealthState>({ phase: 'idle' })
  const [bridgeStatus, setBridgeStatus] = useState<SmsBridgeStatus | null>(null)

  const { baseCurrency, secondaryCurrency, incomeSources } = useFinanceStore(
    useShallow((s) => ({
      baseCurrency: s.settings.baseCurrency,
      secondaryCurrency: s.settings.secondaryCurrency,
      incomeSources: s.incomeSources,
    })),
  )

  // Every currency the user actually transacts in, base first, deduped.
  const currencies = [
    baseCurrency,
    ...(secondaryCurrency ? [secondaryCurrency] : []),
    ...incomeSources.map((s) => s.currency),
  ].filter((c, i, arr) => arr.indexOf(c) === i)

  const currencyKeywords = currencies.flatMap((c) => CURRENCY_SYNONYMS[c] ?? [c])
    .filter((w, i, arr) => arr.indexOf(w) === i)

  const primaryKeyword = currencyKeywords[0] ?? 'AED'

  const onCopy = useCallback(async (word: string) => {
    try {
      await navigator.clipboard.writeText(word)
      setCopiedWord(word)
      setTimeout(() => setCopiedWord(null), 1500)
    } catch { /* clipboard unavailable */ }
  }, [])

  const onCheck = useCallback(async () => {
    setHealth({ phase: 'checking' })
    const result = await runSmsHealthCheck()
    setHealth({ phase: 'done', result })
    setBridgeStatus(await getSmsBridgeStatus())
  }, [])

  // Surface the App Intent's last run when the user reaches the final step.
  useEffect(() => {
    if (step === TOTAL_STEPS - 1 && isNative() && isIOS()) {
      void getSmsBridgeStatus().then(setBridgeStatus)
    }
  }, [step])

  const steps = [
    {
      title: t.smsTracking.iosStepKeywordsTitle,
      desc: t.smsTracking.iosStepKeywordsDesc,
      body: (
        <div className="space-y-3">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-brand-text-muted)]">
              {t.smsTracking.iosKeywordsYourCurrencies}
            </p>
            <div className="flex flex-wrap gap-2">
              {currencyKeywords.map((w) => (
                <KeywordChip key={w} word={w} copied={copiedWord === w} onCopy={onCopy} />
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowCatchAlls((v) => !v)}
            className="text-xs text-[var(--color-brand-text-muted)] underline underline-offset-2 hover:text-[var(--color-brand-text-secondary)] transition-colors min-h-[44px]"
          >
            {t.smsTracking.iosKeywordsCatchAlls}
          </button>
          {showCatchAlls && (
            <div className="space-y-2">
              <p className="text-[10px] text-[var(--color-brand-text-muted)]">
                {t.smsTracking.iosKeywordsCatchAllsHint}
              </p>
              <div className="flex flex-wrap gap-2">
                {CATCH_ALL_KEYWORDS.map((w) => (
                  <KeywordChip key={w} word={w} copied={copiedWord === w} onCopy={onCopy} />
                ))}
              </div>
            </div>
          )}
          <p className="rounded-xl bg-[var(--color-brand-green)]/10 px-3 py-2 text-[10px] leading-relaxed text-[var(--color-brand-green)]">
            {t.smsTracking.iosKeywordsPrivacy}
          </p>
        </div>
      ),
    },
    {
      title: t.smsTracking.iosStepOpenShortcutsTitle,
      desc: t.smsTracking.iosStepOpenShortcutsDesc,
      body: (
        <div className="space-y-3">
          <MockFrame>
            <MockRow label="Email" />
            <MockRow label="Message" highlight trailing={<ChevronRight className="h-3 w-3" />} />
            <MockRow label="Wi-Fi" />
          </MockFrame>
          {isNative() && isIOS() && (
            <button
              type="button"
              onClick={() => { window.location.href = 'shortcuts://' }}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--color-brand-green)] px-4 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t.smsTracking.iosOpenShortcutsButton}
            </button>
          )}
        </div>
      ),
    },
    {
      title: t.smsTracking.iosStepAutomationTitle,
      desc: t.smsTracking.iosStepAutomationDesc,
      body: (
        <MockFrame>
          <MockRow label={`Message Contains: ${primaryKeyword}`} highlight />
          <MockRow label="Run Immediately" trailing={<MockToggle on />} />
          <MockRow label="Notify When Run" trailing={<MockToggle on={false} />} />
        </MockFrame>
      ),
    },
    {
      title: t.smsTracking.iosStepActionTitle,
      desc: t.smsTracking.iosStepActionDesc,
      body: (
        <div className="space-y-3">
          <MockFrame>
            <div className="flex items-center gap-2 rounded-lg bg-[var(--color-brand-card)] px-3 py-2 text-xs text-[var(--color-brand-text-muted)]">
              <span className="opacity-60">🔍</span> Catch Bank SMS
            </div>
            <MockRow label="Buddget · Catch Bank SMS" highlight trailing={<Zap className="h-3 w-3" />} />
            <MockRow label="Bank Message → Shortcut Input" />
          </MockFrame>
          <p className="rounded-xl bg-[var(--color-brand-elevated)] px-3 py-2 text-[10px] leading-relaxed text-[var(--color-brand-text-muted)]">
            {t.smsTracking.iosRepeatPerCurrencyHint}
          </p>
        </div>
      ),
    },
    {
      title: t.smsTracking.iosStepCheckTitle,
      desc: t.smsTracking.iosStepCheckDesc,
      body: (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => void onCheck()}
            disabled={health.phase === 'checking' || !(isNative() && isIOS())}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--color-brand-green)] px-4 text-xs font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {health.phase === 'checking'
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <ShieldCheck className="h-3.5 w-3.5" />}
            {health.phase === 'checking' ? t.smsTracking.iosCheckChecking : t.smsTracking.iosCheckSetupButton}
          </button>
          {health.phase === 'done' && <HealthRows result={health.result} />}
          <LastCatchRow status={bridgeStatus} />
        </div>
      ),
    },
  ]

  const current = steps[step]

  return (
    <div className="space-y-4">
      {/* Step header */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-brand-text-muted)]">
          {t.smsTracking.iosWalkthroughStep(step + 1, TOTAL_STEPS)}
        </p>
        <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{current.title}</p>
        <p className="text-xs leading-relaxed text-[var(--color-brand-text-muted)]">{current.desc}</p>
      </div>

      {current.body}

      {/* Pager */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="inline-flex h-11 min-w-[44px] items-center gap-1 rounded-xl px-3 text-xs font-semibold text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)] transition-colors disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          {t.smsTracking.iosWalkthroughPrev}
        </button>
        <div className="flex items-center gap-1.5">
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={t.smsTracking.iosWalkthroughStep(i + 1, TOTAL_STEPS)}
              onClick={() => setStep(i)}
              className="flex h-11 w-4 items-center justify-center"
            >
              <span
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'w-4 bg-[var(--color-brand-green)]' : 'w-1.5 bg-[var(--color-brand-border)]'
                }`}
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1))}
          disabled={step === TOTAL_STEPS - 1}
          className="inline-flex h-11 min-w-[44px] items-center gap-1 rounded-xl px-3 text-xs font-semibold text-[var(--color-brand-green)] hover:opacity-80 transition-opacity disabled:opacity-40"
        >
          {t.smsTracking.iosWalkthroughNext}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function HealthRows({ result }: { result: SmsHealthResult | null }) {
  const t = useT()
  const rows: Array<{ label: string; ok: boolean }> = [
    { label: t.smsTracking.iosCheckTokenSaved, ok: result?.tokenSaved ?? false },
    { label: t.smsTracking.iosCheckServerReachable, ok: (result?.status ?? 0) > 0 },
    { label: t.smsTracking.iosCheckTokenValid, ok: result?.ok ?? false },
  ]
  const failure = !result || !result.tokenSaved
    ? t.smsTracking.iosCheckFailedToken
    : result.status === 0
      ? t.smsTracking.iosCheckFailedNetwork
      : result.ok
        ? null
        : t.smsTracking.iosCheckFailedAuth

  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-xs">
          {r.ok
            ? <Check className="h-3.5 w-3.5 shrink-0 text-[var(--color-brand-green)]" />
            : <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
          <span className={r.ok ? 'text-[var(--color-brand-text-secondary)]' : 'text-amber-400'}>
            {r.label}
          </span>
        </div>
      ))}
      {failure && (
        <p className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-[10px] leading-relaxed text-amber-400">
          {failure}
        </p>
      )}
    </div>
  )
}

function LastCatchRow({ status }: { status: SmsBridgeStatus | null }) {
  const t = useT()
  if (!status) return null
  const fired = status.lastRunAt !== ''
  const failed = fired && status.lastResult === 'failed'
  return (
    <div className="flex items-center gap-2 rounded-xl bg-[var(--color-brand-elevated)] px-3 py-2 text-xs text-[var(--color-brand-text-muted)]">
      {failed ? (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
      ) : fired ? (
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[var(--color-brand-green)]" />
      ) : (
        <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-brand-text-muted)] animate-pulse" />
      )}
      <span>
        {failed
          ? t.smsTracking.iosLastCatchFailed
          : fired
            ? t.smsTracking.iosLastCatch(timeAgo(status.lastRunAt))
            : t.smsTracking.iosLastCatchWaiting}
      </span>
    </div>
  )
}
