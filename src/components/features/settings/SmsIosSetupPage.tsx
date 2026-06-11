'use client'

import { useState, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  ArrowLeft, Copy, Check, ExternalLink,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { isNative, isIOS } from '@/lib/native/isNative'
import type { Currency } from '@/lib/store/types'

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── iPhone mock primitives ────────────────────────────────────────────────────

/** Wraps content in a phone-shaped frame with Dynamic Island pill. */
function PhoneFrame({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[20px] border-2 border-[var(--color-brand-border)] bg-[var(--color-brand-card)] overflow-hidden ${className}`}>
      {/* Dynamic Island */}
      <div className="flex justify-center bg-[var(--color-brand-card)] pt-2 pb-0.5">
        <div className="h-3.5 w-20 rounded-full bg-[var(--color-brand-border)]" />
      </div>
      {children}
    </div>
  )
}

/** iOS-style navigation bar. */
function NavBar({
  title,
  back,
  right,
}: {
  title: string
  back?: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-[var(--color-brand-card)] border-b border-[var(--color-brand-border)]">
      <div className="w-16 text-left">
        {back ?? null}
      </div>
      <span className="text-[11px] font-semibold text-[var(--color-brand-text-primary)] truncate">{title}</span>
      <div className="w-16 text-right flex justify-end">
        {right ?? null}
      </div>
    </div>
  )
}

/** iOS-style table section header. */
function SectionHeader({ label }: { label: string }) {
  return (
    <p className="px-4 pt-3 pb-1 text-[9px] uppercase tracking-wider text-[var(--color-brand-text-muted)]">
      {label}
    </p>
  )
}

/** iOS-style table row. */
function Row({
  icon,
  label,
  sublabel,
  trailing,
  highlight,
}: {
  icon?: React.ReactNode
  label: string
  sublabel?: string
  trailing?: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2 ${
        highlight
          ? 'bg-[var(--color-brand-green)]/12 ring-1 ring-inset ring-[var(--color-brand-green)]/30'
          : 'bg-[var(--color-brand-card)]'
      }`}
    >
      {icon && (
        <div className={`h-6 w-6 shrink-0 rounded-lg flex items-center justify-center text-[10px] font-bold ${
          highlight ? 'bg-[var(--color-brand-green)] text-white' : 'bg-[var(--color-brand-elevated)]'
        }`}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-[11px] font-medium leading-tight ${
          highlight ? 'text-[var(--color-brand-green)]' : 'text-[var(--color-brand-text-primary)]'
        }`}>
          {label}
        </p>
        {sublabel && (
          <p className="text-[9px] text-[var(--color-brand-text-muted)] leading-tight mt-0.5">{sublabel}</p>
        )}
      </div>
      {trailing}
    </div>
  )
}

/** iOS-style pill toggle. */
function Toggle({ on }: { on: boolean }) {
  return (
    <div className={`h-4 w-7 rounded-full flex items-center px-0.5 shrink-0 transition-colors ${
      on ? 'bg-[var(--color-brand-green)] justify-end' : 'bg-[var(--color-brand-border)] justify-start'
    }`}>
      <div className="h-3 w-3 rounded-full bg-white shadow-sm" />
    </div>
  )
}

/** iOS bottom tab bar for Shortcuts. */
function ShortcutsTabBar({ active }: { active: 'today' | 'automation' | 'gallery' }) {
  const tabs = [
    { id: 'today', label: 'Today' },
    { id: 'automation', label: 'Automation' },
    { id: 'gallery', label: 'Gallery' },
  ] as const
  return (
    <div className="flex border-t border-[var(--color-brand-border)] bg-[var(--color-brand-card)]">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`flex-1 flex flex-col items-center py-1.5 text-[9px] font-medium ${
            active === tab.id ? 'text-[var(--color-brand-red)]' : 'text-[var(--color-brand-text-muted)]'
          }`}
        >
          <div className={`h-4 w-4 rounded mb-0.5 ${
            active === tab.id ? 'bg-[var(--color-brand-red)]/20' : 'bg-[var(--color-brand-border)]'
          }`} />
          {tab.label}
        </div>
      ))}
    </div>
  )
}

/** Inline keyword chip on mock screens. */
function InlineChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--color-brand-green)]/15 border border-[var(--color-brand-green)]/40 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-brand-green)]">
      {label}
    </span>
  )
}

/** Arrow + label between two sub-screens. */
function FlowArrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 py-1">
      <span className="text-[9px] text-[var(--color-brand-text-muted)]">{label}</span>
      <div className="h-4 w-0.5 bg-[var(--color-brand-border)]" />
      <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-[var(--color-brand-border)]" />
    </div>
  )
}

/** Step separator (the numbered timeline block). */
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
        <p className="text-xs leading-relaxed text-[var(--color-brand-text-muted)] mb-4">{desc}</p>
        {children}
      </div>
    </div>
  )
}

/** Inline callout tip box. */
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-xl bg-[var(--color-brand-elevated)] px-3 py-2.5 text-[10px] leading-relaxed text-[var(--color-brand-text-muted)]">
      {children}
    </div>
  )
}

// ─── Copyable keyword chip (real UI, not mock) ─────────────────────────────────

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

// ─── Main component ────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void
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

      {/* ── Header ── */}
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

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto native-scroll px-4 pt-6 pb-4">

        {/* ─────────────── STEP 1 ─────────────── */}
        <StepBlock
          number={1}
          title={t.smsTracking.iosStepKeywordsTitle}
          desc={t.smsTracking.iosStepKeywordsDesc}
        >
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">
              {t.smsTracking.iosKeywordsYourCurrencies}
            </p>
            <div className="flex flex-wrap gap-2">
              {currencyKeywords.map((w) => (
                <KeywordChip key={w} word={w} copied={copiedWord === w} onCopy={onCopy} />
              ))}
            </div>

            {/* Catch-alls */}
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

        {/* ─────────────── STEP 2 ─────────────── */}
        <StepBlock
          number={2}
          title={t.smsTracking.iosStepOpenShortcutsTitle}
          desc="Open the Shortcuts app, tap the Automation tab at the bottom, then tap + to create a new automation."
        >
          <div className="space-y-1.5">

            {/* Screen 2a: Shortcuts Automation tab */}
            <PhoneFrame>
              <NavBar
                title="Automation"
                back={<span className="text-[10px] text-[var(--color-brand-red)]">Shortcuts</span>}
                right={
                  <div className="h-5 w-5 rounded-full bg-[var(--color-brand-red)] flex items-center justify-center ml-auto">
                    <span className="text-white text-[11px] font-bold leading-none">+</span>
                  </div>
                }
              />
              <div className="bg-[var(--color-brand-elevated)] px-4 py-5 flex flex-col items-center gap-2 min-h-[80px] justify-center">
                <p className="text-[10px] text-[var(--color-brand-text-muted)] text-center">No automations yet</p>
                <p className="text-[9px] text-[var(--color-brand-text-muted)]/60 text-center">Tap + to get started</p>
              </div>
              {/* Callout arrow pointing to + */}
              <div className="flex justify-end px-4 pb-1">
                <span className="text-[9px] text-[var(--color-brand-green)] font-semibold flex items-center gap-1">
                  Tap here <span className="text-base leading-none">↑</span>
                </span>
              </div>
              <ShortcutsTabBar active="automation" />
            </PhoneFrame>

            <FlowArrow label="Tap +" />

            {/* Screen 2b: New Automation — choose trigger */}
            <PhoneFrame>
              <NavBar
                title="New Automation"
                back={<span className="text-[10px] text-[var(--color-brand-red)] flex items-center"><ChevronLeft className="h-3 w-3 -mr-0.5" />Cancel</span>}
              />
              <SectionHeader label="Personal Automation" />
              <div className="divide-y divide-[var(--color-brand-border)]">
                <Row icon="⏰" label="Alarm" trailing={<ChevronRight className="h-3 w-3 text-[var(--color-brand-text-muted)]" />} />
                <Row icon="📱" label="App" trailing={<ChevronRight className="h-3 w-3 text-[var(--color-brand-text-muted)]" />} />
                <Row
                  icon="💬"
                  label="Message"
                  sublabel="When a message is received"
                  trailing={<ChevronRight className="h-3 w-3 text-[var(--color-brand-green)]" />}
                  highlight
                />
                <Row icon="✉️" label="Email" trailing={<ChevronRight className="h-3 w-3 text-[var(--color-brand-text-muted)]" />} />
              </div>
              <div className="flex justify-start px-4 pt-1 pb-1">
                <span className="text-[9px] text-[var(--color-brand-green)] font-semibold flex items-center gap-1">
                  <span className="text-base leading-none">↑</span> Tap Message
                </span>
              </div>
            </PhoneFrame>

          </div>
          {isNative() && isIOS() && (
            <button
              type="button"
              onClick={() => { window.location.href = 'shortcuts://' }}
              className="mt-3 inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--color-brand-green)] px-4 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t.smsTracking.iosOpenShortcutsButton}
            </button>
          )}
        </StepBlock>

        {/* ─────────────── STEP 3 ─────────────── */}
        <StepBlock
          number={3}
          title={t.smsTracking.iosStepAutomationTitle}
          desc="Tap 'Message Contains', paste your keyword, then make sure 'Run Immediately' is ON. If your iOS shows 'Ask Before Running', turn it OFF instead."
        >
          <div className="space-y-1.5">

            {/* Screen 3a: Message contains field */}
            <PhoneFrame>
              <NavBar
                title="New Automation"
                back={<span className="text-[10px] text-[var(--color-brand-red)] flex items-center"><ChevronLeft className="h-3 w-3 -mr-0.5" />Back</span>}
                right={<span className="text-[10px] text-[var(--color-brand-red)]">Next</span>}
              />
              <div className="bg-[var(--color-brand-elevated)] px-3 py-3 space-y-2">
                {/* Trigger condition */}
                <div className="rounded-xl bg-[var(--color-brand-green)]/12 ring-1 ring-[var(--color-brand-green)]/30 px-3 py-2.5">
                  <p className="text-[9px] uppercase tracking-wider text-[var(--color-brand-text-muted)] mb-1">When</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-[var(--color-brand-text-secondary)]">Message Contains</span>
                    <InlineChip label={primaryKeyword} />
                  </div>
                </div>
                {/* Run Immediately toggle */}
                <div className="divide-y divide-[var(--color-brand-border)] rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--color-brand-card)]">
                    <div>
                      <p className="text-[11px] font-medium text-[var(--color-brand-text-primary)]">Run Immediately</p>
                      <p className="text-[9px] text-[var(--color-brand-text-muted)]">No confirmation needed</p>
                    </div>
                    <Toggle on={true} />
                  </div>
                  <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--color-brand-card)]">
                    <span className="text-[11px] text-[var(--color-brand-text-muted)]">Notify When Run</span>
                    <Toggle on={false} />
                  </div>
                </div>
              </div>
            </PhoneFrame>

          </div>
          <Tip>
            On iOS 16 and earlier the toggle reads <strong className="text-[var(--color-brand-text-secondary)]">&ldquo;Ask Before Running&rdquo;</strong> &mdash; turn that <strong className="text-[var(--color-brand-text-secondary)]">OFF</strong> instead.
          </Tip>
        </StepBlock>

        {/* ─────────────── STEP 4 ─────────────── */}
        <StepBlock
          number={4}
          title={t.smsTracking.iosStepActionTitle}
          desc="Tap Next → New Blank Automation → Add Action. Search for 'Catch Bank SMS'. Set the Bank Message field to Shortcut Input, then tap Done."
          isLast
        >
          <div className="space-y-1.5">

            {/* Screen 4a: Add Action search */}
            <PhoneFrame>
              <NavBar
                title="Add Action"
                back={<span className="text-[10px] text-[var(--color-brand-red)] flex items-center"><ChevronLeft className="h-3 w-3 -mr-0.5" />Back</span>}
              />
              {/* Search bar */}
              <div className="px-3 py-2 bg-[var(--color-brand-elevated)]">
                <div className="flex items-center gap-2 rounded-xl bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] px-3 py-1.5">
                  <span className="text-[11px] text-[var(--color-brand-text-muted)]">🔍</span>
                  <span className="text-[11px] text-[var(--color-brand-text-secondary)] font-medium">Catch Bank SMS</span>
                </div>
              </div>
              <SectionHeader label="Apps" />
              <div className="divide-y divide-[var(--color-brand-border)]">
                <Row
                  icon={<span className="font-black text-[var(--color-brand-red)]">B</span>}
                  label="Catch Bank SMS"
                  sublabel="Buddget"
                  trailing={<ChevronRight className="h-3 w-3 text-[var(--color-brand-green)]" />}
                  highlight
                />
              </div>
              <div className="flex justify-start px-4 pt-1 pb-1">
                <span className="text-[9px] text-[var(--color-brand-green)] font-semibold flex items-center gap-1">
                  <span className="text-base leading-none">↑</span> Tap this result
                </span>
              </div>
            </PhoneFrame>

            <FlowArrow label="Tap Catch Bank SMS" />

            {/* Screen 4b: Action configured with parameter */}
            <PhoneFrame>
              <NavBar
                title="New Automation"
                back={<span className="text-[10px] text-[var(--color-brand-red)] flex items-center"><ChevronLeft className="h-3 w-3 -mr-0.5" />Back</span>}
                right={<span className="text-[10px] font-semibold text-[var(--color-brand-red)]">Done</span>}
              />
              <div className="bg-[var(--color-brand-elevated)] px-3 py-3 space-y-2">
                {/* Trigger summary */}
                <div className="rounded-xl overflow-hidden divide-y divide-[var(--color-brand-border)]">
                  <div className="px-3 py-2 bg-[var(--color-brand-card)]">
                    <p className="text-[9px] uppercase tracking-wider text-[var(--color-brand-text-muted)] mb-0.5">Trigger</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-[var(--color-brand-text-secondary)]">Message Contains</span>
                      <InlineChip label={primaryKeyword} />
                    </div>
                  </div>
                </div>
                {/* Action card */}
                <div className="rounded-xl bg-[var(--color-brand-green)]/12 ring-1 ring-[var(--color-brand-green)]/30 px-3 py-2.5 space-y-1.5">
                  <p className="text-[9px] uppercase tracking-wider text-[var(--color-brand-text-muted)]">Action</p>
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 shrink-0 rounded-lg bg-[var(--color-brand-red)] flex items-center justify-center">
                      <span className="text-white text-[9px] font-black">B</span>
                    </div>
                    <span className="text-[11px] font-semibold text-[var(--color-brand-green)]">Catch Bank SMS</span>
                  </div>
                  {/* Parameter row */}
                  <div className="rounded-lg bg-[var(--color-brand-card)] px-2.5 py-1.5">
                    <p className="text-[9px] text-[var(--color-brand-text-muted)] mb-0.5">Bank Message</p>
                    <div className="flex items-center gap-1">
                      <span className="inline-flex items-center rounded-full bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] px-2 py-0.5 text-[9px] font-medium text-[var(--color-brand-text-secondary)]">
                        Shortcut Input
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end px-4 pt-1 pb-1">
                <span className="text-[9px] text-[var(--color-brand-green)] font-semibold flex items-center gap-1">
                  Tap Done <span className="text-base leading-none">↑</span>
                </span>
              </div>
            </PhoneFrame>

          </div>
          <Tip>
            {t.smsTracking.iosRepeatPerCurrencyHint}
          </Tip>
        </StepBlock>

      </div>

      {/* ── Footer ── */}
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
