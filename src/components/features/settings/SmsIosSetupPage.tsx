'use client'

import { useState, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ArrowLeft, Copy, Check, ExternalLink, ChevronRight } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { isNative, isIOS } from '@/lib/native/isNative'
import type { Currency } from '@/lib/store/types'

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

const CATCH_ALL_KEYWORDS = ['debited', 'received', 'purchase', 'تم خصم', 'تم استلام']

interface Props {
  onClose: () => void
}

function MockToggle({ on }: { on: boolean }) {
  return (
    <span className={`inline-flex h-4 w-7 shrink-0 items-center rounded-full px-0.5 ${on ? 'bg-[var(--color-brand-green)] justify-end' : 'bg-[var(--color-brand-border)] justify-start'}`}>
      <span className="h-3 w-3 rounded-full bg-white" />
    </span>
  )
}

function KeywordChip({ word, copied, onCopy }: { word: string; copied: boolean; onCopy: (w: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onCopy(word)}
      className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3.5 text-xs font-semibold text-[var(--color-brand-text-primary)] hover:border-[var(--color-brand-green)]/50 active:scale-95 transition-all"
    >
      {copied
        ? <Check className="h-3.5 w-3.5 text-[var(--color-brand-green)]" />
        : <Copy className="h-3.5 w-3.5 opacity-50" />}
      {word}
    </button>
  )
}

function StepBlock({
  number,
  title,
  desc,
  children,
  isLast = false,
}: {
  number: number
  title: string
  desc: string
  children: React.ReactNode
  isLast?: boolean
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="h-8 w-8 shrink-0 rounded-full bg-[var(--color-brand-green)]/15 flex items-center justify-center">
          <span className="text-sm font-bold text-[var(--color-brand-green)]">{number}</span>
        </div>
        {!isLast && <div className="w-0.5 flex-1 min-h-[32px] bg-[var(--color-brand-border)] mt-2" />}
      </div>
      <div className="pb-8 flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-[var(--color-brand-text-primary)] mb-1">{title}</h3>
        <p className="text-xs leading-relaxed text-[var(--color-brand-text-muted)] mb-3">{desc}</p>
        {children}
      </div>
    </div>
  )
}

export function SmsIosSetupPage({ onClose }: Props) {
  const t = useT()
  const [copiedWord, setCopiedWord] = useState<string | null>(null)
  const [showCatchAlls, setShowCatchAlls] = useState(false)

  const { baseCurrency, secondaryCurrency, incomeSources } = useFinanceStore(
    useShallow((s) => ({
      baseCurrency: s.settings.baseCurrency,
      secondaryCurrency: s.settings.secondaryCurrency,
      incomeSources: s.incomeSources,
    })),
  )

  const currencies = [
    baseCurrency,
    ...(secondaryCurrency ? [secondaryCurrency] : []),
    ...incomeSources.map((s) => s.currency),
  ].filter((c, i, arr) => arr.indexOf(c) === i)

  const currencyKeywords = currencies
    .flatMap((c) => CURRENCY_SYNONYMS[c] ?? [c])
    .filter((w, i, arr) => arr.indexOf(w) === i)

  const primaryKeyword = currencyKeywords[0] ?? 'AED'

  const onCopy = useCallback(async (word: string) => {
    try {
      await navigator.clipboard.writeText(word)
      setCopiedWord(word)
      setTimeout(() => setCopiedWord(null), 1500)
    } catch { /* clipboard unavailable */ }
  }, [])

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-brand-bg)] flex flex-col">
      {/* Header */}
      <div className="shrink-0 safe-area-top bg-[var(--color-brand-bg)] border-b border-[var(--color-brand-border)]">
        <div className="flex items-center gap-2 px-2 h-14">
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)] transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-base font-semibold text-[var(--color-brand-text-primary)]">
            {t.smsTracking.iosSetupPageTitle}
          </h1>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto native-scroll px-4 pt-6 pb-4">
        {/* Step 1: Keywords */}
        <StepBlock
          number={1}
          title={t.smsTracking.iosStepKeywordsTitle}
          desc={t.smsTracking.iosStepKeywordsDesc}
        >
          <div className="space-y-3">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">
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
              className="text-xs text-[var(--color-brand-text-muted)] underline underline-offset-2 min-h-[44px] flex items-center"
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
            <p className="rounded-xl bg-[var(--color-brand-green)]/10 px-3 py-2.5 text-[10px] leading-relaxed text-[var(--color-brand-green)]">
              {t.smsTracking.iosKeywordsPrivacy}
            </p>
          </div>
        </StepBlock>

        {/* Step 2: Open Shortcuts */}
        <StepBlock
          number={2}
          title={t.smsTracking.iosStepOpenShortcutsTitle}
          desc={t.smsTracking.iosStepOpenShortcutsDesc}
        >
          <div className="space-y-3">
            {/* Mock Shortcuts app */}
            <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] overflow-hidden">
              {/* Tab bar */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-brand-border)] bg-[var(--color-brand-card)]">
                <div className="flex gap-4">
                  <span className="text-[10px] text-[var(--color-brand-text-muted)]">Today</span>
                  <span className="text-[10px] font-semibold text-[var(--color-brand-red)] pb-0.5 border-b border-[var(--color-brand-red)]">
                    Automation
                  </span>
                  <span className="text-[10px] text-[var(--color-brand-text-muted)]">Gallery</span>
                </div>
                <div className="h-5 w-5 rounded-full bg-[var(--color-brand-red)] flex items-center justify-center">
                  <span className="text-white text-[10px] font-bold leading-none">+</span>
                </div>
              </div>
              {/* Trigger list */}
              <div className="p-2 space-y-1">
                <div className="flex items-center justify-between rounded-lg px-3 py-2 text-xs text-[var(--color-brand-text-muted)] bg-[var(--color-brand-card)]">
                  <span>Email</span>
                  <ChevronRight className="h-3 w-3" />
                </div>
                <div className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold bg-[var(--color-brand-green)]/15 text-[var(--color-brand-green)] ring-1 ring-[var(--color-brand-green)]/40">
                  <span>Message</span>
                  <ChevronRight className="h-3 w-3" />
                </div>
                <div className="flex items-center justify-between rounded-lg px-3 py-2 text-xs text-[var(--color-brand-text-muted)] bg-[var(--color-brand-card)]">
                  <span>Wi-Fi</span>
                  <ChevronRight className="h-3 w-3" />
                </div>
              </div>
            </div>
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
        </StepBlock>

        {/* Step 3: Set trigger */}
        <StepBlock
          number={3}
          title={t.smsTracking.iosStepAutomationTitle}
          desc={t.smsTracking.iosStepAutomationDesc}
        >
          <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] overflow-hidden">
            <div className="p-3 space-y-1.5">
              {/* Trigger condition */}
              <div className="rounded-lg bg-[var(--color-brand-green)]/15 ring-1 ring-[var(--color-brand-green)]/40 px-3 py-2.5">
                <p className="text-[9px] uppercase tracking-wider text-[var(--color-brand-text-muted)] mb-0.5">When</p>
                <p className="text-xs font-semibold text-[var(--color-brand-green)]">
                  Message Contains · <span className="font-mono">{primaryKeyword}</span>
                </p>
              </div>
              {/* Run Immediately ON */}
              <div className="flex items-center justify-between rounded-lg bg-[var(--color-brand-card)] px-3 py-2 text-xs">
                <span className="text-[var(--color-brand-text-secondary)]">Run Immediately</span>
                <MockToggle on={true} />
              </div>
              {/* Notify off */}
              <div className="flex items-center justify-between rounded-lg bg-[var(--color-brand-card)] px-3 py-2 text-xs">
                <span className="text-[var(--color-brand-text-muted)]">Notify When Run</span>
                <MockToggle on={false} />
              </div>
            </div>
          </div>
        </StepBlock>

        {/* Step 4: Add action */}
        <StepBlock
          number={4}
          title={t.smsTracking.iosStepActionTitle}
          desc={t.smsTracking.iosStepActionDesc}
          isLast
        >
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] overflow-hidden">
              <div className="p-3 space-y-1.5">
                {/* Search bar */}
                <div className="flex items-center gap-2 rounded-lg bg-[var(--color-brand-card)] px-3 py-2 text-xs text-[var(--color-brand-text-muted)]">
                  <span className="opacity-60 text-sm">🔍</span>
                  <span>Catch Bank SMS</span>
                </div>
                {/* Highlighted result */}
                <div className="flex items-center gap-2.5 rounded-lg bg-[var(--color-brand-green)]/15 ring-1 ring-[var(--color-brand-green)]/40 px-3 py-2">
                  <div className="h-7 w-7 shrink-0 rounded-lg bg-[var(--color-brand-red)] flex items-center justify-center">
                    <span className="text-white text-[9px] font-bold">B</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-brand-green)]">Catch Bank SMS</p>
                    <p className="text-[9px] text-[var(--color-brand-text-muted)]">Buddget</p>
                  </div>
                </div>
                {/* Parameter assignment */}
                <div className="rounded-lg bg-[var(--color-brand-card)] px-3 py-2">
                  <p className="text-[9px] text-[var(--color-brand-text-muted)] mb-0.5">Bank Message</p>
                  <p className="text-xs font-medium text-[var(--color-brand-text-primary)]">Shortcut Input</p>
                </div>
              </div>
            </div>
            <p className="rounded-xl bg-[var(--color-brand-elevated)] px-3 py-2.5 text-[10px] leading-relaxed text-[var(--color-brand-text-muted)]">
              {t.smsTracking.iosRepeatPerCurrencyHint}
            </p>
          </div>
        </StepBlock>
      </div>

      {/* Footer */}
      <div className="shrink-0 safe-area-bottom bg-[var(--color-brand-bg)] border-t border-[var(--color-brand-border)] px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="w-full h-12 rounded-xl bg-[var(--color-brand-green)] text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          {t.smsTracking.iosSetupDone}
        </button>
      </div>
    </div>
  )
}
