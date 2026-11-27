'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { CalendarCheck, Check, CircleAlert, CircleCheck, Minus, Pencil, Plus, Target, TriangleAlert, Undo2, Wallet } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconButton } from '@/components/ui/IconButton'
import { OptionSheet } from '@/components/ui/OptionSheet'
import { useActionToast } from '@/components/ui/ActionToast'
import { accountTitle } from '@/components/features/accounts/accountDisplay'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useLocale, useT } from '@/lib/i18n'
import { formatLocalized, monthNames } from '@/lib/i18n/dateFormat'
import { useMonthEndCopy } from '@/lib/i18n/monthEndCopy'
import { micro } from '@/lib/ui/microLabelStyle'
import { pocketDisplayName } from '@/lib/savings/pocketIdentity'
import { readSplit, type SplitEntry } from '@/lib/monthEnd/proposal'
import { fixedGoalNotes } from '@/lib/monthEnd/fixedGoals'
import { settlePrompt, settledKeys } from '@/lib/prompts/settle'
import { formatWhole } from '@/lib/utils/formatters'
import type { useMonthEnd } from '@/hooks/useMonthEnd'
import type { MonthEndLineView } from '@/lib/server/monthEnd'

export interface MonthEndSheetProps {
  open: boolean
  onClose: () => void
  monthEnd: ReturnType<typeof useMonthEnd>
  /** Opened from "Where your monthly savings go": the split is in view. */
  focusSplit?: boolean
}

const STEP = 5
const tile = (color: string) => ({ background: `color-mix(in oklab, ${color} 16%, transparent)`, color })
const pct = (n: number) => String(Math.round(n * 100) / 100)

/**
 * The Monthly saving sheet (final-ui v9, Savings): this month's leftover card (Fits / Capped / Overspent from the server's
 * figures; Confirm, Edit, "Applies by itself on …", Undo) and the editable "Where your monthly savings go" split.
 * Edit opens the split: a proposal is changed by changing the split (§0), never line by line.
 */
export function MonthEndSheet({ open, onClose, monthEnd, focusSplit }: MonthEndSheetProps) {
  const c = useMonthEndCopy()
  const sf = useT().savingsForms
  const { locale } = useLocale()
  const showToast = useActionToast()
  const { view, busy, confirm, undo, saveSplit } = monthEnd
  const { goals, parts, methods, stored, promptState, base } = useFinanceStore(
    useShallow((s) => ({
      goals: s.goals, parts: s.savingsAccounts, methods: s.paymentMethods, stored: s.profile.savingsSplit,
      promptState: s.settings.promptState, base: s.settings.baseCurrency,
    })),
  )
  const read = useMemo(() => readSplit(stored), [stored])
  const [draft, setDraft] = useState<SplitEntry[]>(read.entries)
  const [picking, setPicking] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const splitRef = useRef<HTMLDivElement>(null)
  // A new stored split (saved here, or pulled) replaces the draft.
  const [seen, setSeen] = useState(read)
  if (seen !== read) {
    setSeen(read)
    setDraft(read.entries)
  }
  useEffect(() => {
    if (open && focusSplit) splitRef.current?.scrollIntoView({ block: 'start' })
  }, [open, focusSplit])

  const sum = draft.reduce((s, e) => s + e.pct, 0)
  const dirty = JSON.stringify(draft.filter((e) => e.pct > 0)) !== JSON.stringify(read.entries)
  const month = view ? monthNames(locale)[Number(view.cycleStart.slice(5, 7)) - 1] : ''
  const day = (iso: string | null) => (iso ? formatLocalized(new Date(iso), 'd MMM', locale) : '')
  const leftover = view?.figures.leftover ?? 0

  const targetName = (id: string | null, kind: MonthEndLineView['kind']) => {
    if (kind === 'ms') return sf.systemNames.monthlySavings
    const g = goals.find((x) => x.id === id)
    if (g) return g.name
    const p = parts.find((x) => x.id === id)
    return p ? pocketDisplayName(p, sf.systemNames) : ''
  }
  const acctName = (id: string) => {
    const m = methods.find((x) => x.id === id)
    return m ? accountTitle(m) : ''
  }

  // One row per target (a goal can land in several accounts); chips per account.
  const items = useMemo(() => {
    const out: { key: string; kind: MonthEndLineView['kind']; id: string | null; base: number; parts: MonthEndLineView[] }[] = []
    for (const l of view?.lines ?? []) {
      const key = `${l.kind}:${l.targetId ?? ''}`
      const hit = out.find((x) => x.key === key)
      if (hit) { hit.base += l.amountBase; hit.parts.push(l) } else out.push({ key, kind: l.kind, id: l.targetId, base: l.amountBase, parts: [l] })
    }
    return out
  }, [view])
  const byAccount = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of view?.lines ?? []) m.set(l.accountId, (m.get(l.accountId) ?? 0) + l.amountBase)
    return [...m]
  }, [view])

  const step = (id: string, d: number) => setDraft((xs) => xs.map((e) => (e.target_id === id ? { ...e, pct: Math.max(0, Math.min(e.pct + d, e.pct + 100 - sum)) } : e)))
  const add = (id: string) => setDraft((xs) => (xs.some((e) => e.target_id === id) ? xs : [...xs, { target_id: id, pct: Math.min(STEP, Math.max(0, 100 - sum)) }]))
  const choices = [
    ...goals.filter((g) => g.status === 'active' && g.category !== 'debt_freedom' && g.category !== 'spending_control' && !draft.some((e) => e.target_id === g.id))
      .map((g) => ({ value: g.id, title: g.name, subtitle: c.goal, icon: <Target className="size-4" /> })),
    ...parts.filter((p) => p.category === 'savings' && !p.goalId && !p.isMonthlySavings && !draft.some((e) => e.target_id === p.id))
      .map((p) => ({ value: p.id, title: pocketDisplayName(p, sf.systemNames), subtitle: c.pocket, icon: <Wallet className="size-4" /> })),
  ]
  const settled = new Set(settledKeys(promptState))
  const notes = fixedGoalNotes(goals, draft, goals.filter((g) => settled.has(`splitNote:${g.id}`)).map((g) => g.id))

  const after = async (p: Promise<{ result: 'ok' | 'conflict' | 'failed'; notUndone: number }>, ok: string) => {
    const r = await p
    showToast(r.result === 'ok' ? (r.notUndone > 0 ? `${ok} · ${c.notUndone(formatWhole(r.notUndone))}` : ok) : r.result === 'conflict' ? c.conflict : c.failed)
  }

  if (!open) return null

  const card = (() => {
    if (!view || view.figures.reason || dismissed) return null
    const f = view.figures
    const sumLine = (
      <p className="mt-2 font-mono-numbers text-xs leading-relaxed text-[var(--color-brand-text-muted)]">
        {c.summary(formatWhole(f.income), formatWhole(f.spending))}{f.savedNet ? c.alreadySaved(formatWhole(f.savedNet)) : ''}
      </p>
    )
    if (view.status === 'empty') {
      return (
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]"><CircleAlert className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{c.overTitle(month)}</p>
              <p className="mt-0.5 text-[0.84375rem] text-[var(--color-brand-text-secondary)]">{c.overBody(formatWhole(Math.abs(leftover)))}</p>
              {sumLine}
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-brand-text-muted)]">{c.overNothing}</p>
            </div>
          </div>
          <div className="mt-1 flex justify-end"><Button variant="link" size="touch" onClick={() => setDismissed(true)}>{c.gotIt}</Button></div>
        </Card>
      )
    }
    if (view.status === 'undone') {
      return <Card className="p-4"><p className="text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{c.undoneTitle(month)}</p></Card>
    }
    const placed = view.lines.reduce((s, l) => s + l.amountBase, 0)
    if (view.status === 'applied') {
      const where = byAccount.length === 1 ? c.inAccount(acctName(byAccount[0][0])) : c.inAccounts(byAccount.length)
      return (
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-[11px]" style={tile('var(--color-brand-green)')}><CircleCheck className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{c.setAsideTitle(month)}</p>
              <p className="mt-0.5 font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">{c.setAsideLine(formatWhole(placed), where, day(view.appliedAt))}</p>
            </div>
            <Button variant="link" size="touch" disabled={busy || view.undoBlocked} onClick={() => void after(undo(), c.undone)}><Undo2 />{c.undo}</Button>
          </div>
          {view.undoBlocked ? <p className="mt-2 text-xs text-[var(--color-brand-text-muted)]">{c.undoBlocked}</p> : null}
        </Card>
      )
    }
    return (
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-[11px]" style={tile('var(--color-brand-primary)')}><CalendarCheck className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{c.leftoverTitle(month)}</p>
            <p className="mt-0.5 text-xs text-[var(--color-brand-text-muted)]">{c.appliesOn(day(view.autoApplyAt))}</p>
          </div>
          <span className="shrink-0 whitespace-nowrap font-mono-numbers text-[1.25rem] font-semibold text-[var(--color-brand-text-primary)]">
            {formatWhole(leftover)} <span className="text-[0.6875rem] font-normal text-[var(--color-brand-text-muted)]">{view.currency}</span>
          </span>
        </div>
        {sumLine}
        {f.notPlaced > 0 ? (
          <div className="mt-3 flex gap-2.5 rounded-2xl bg-[var(--color-brand-amber-soft)] px-3.5 py-3">
            <TriangleAlert aria-hidden className="size-[18px] shrink-0 text-[var(--color-brand-amber)]" />
            <p className="min-w-0 text-[0.8125rem] leading-[1.45] text-[var(--color-brand-text-primary)]">
              {c.notPlaced(formatWhole(f.notPlaced))}
              <span className="mt-0.5 block text-xs text-[var(--color-brand-text-secondary)]">
                {f.caps.map((a) => c.hadFree(acctName(a.accountId), formatWhole(a.cap))).join(', ')} {c.afterCards}
              </span>
            </p>
          </div>
        ) : null}
        <p style={micro} className="mt-3">{c.whereItGoes}{f.notPlaced > 0 ? ` · ${formatWhole(placed)}` : ''}</p>
        <div className="mt-1 divide-y divide-[var(--color-brand-border)]">
          {items.map((it) => (
            <div key={it.key} className="flex min-h-11 items-center gap-3 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.875rem] font-semibold text-[var(--color-brand-text-primary)]">{targetName(it.id, it.kind)}</p>
                <p className="truncate text-xs text-[var(--color-brand-text-muted)]">
                  {it.parts.map((p) => (it.parts.length > 1 ? c.amountIn(formatWhole(p.amount), acctName(p.accountId)) : c.inAccount(acctName(p.accountId)))).join(' · ')}
                </p>
              </div>
              <span className="shrink-0 font-mono-numbers text-[0.875rem] font-medium text-[var(--color-brand-text-primary)]">{formatWhole(it.base)}</span>
            </div>
          ))}
        </div>
        {byAccount.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {byAccount.map(([id, n]) => (
              <span key={id} className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[var(--color-brand-elevated)] px-2.5 text-xs font-semibold text-[var(--color-brand-text-primary)]">
                {acctName(id)}<span className="font-mono-numbers">{formatWhole(n)}</span>
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-3.5 grid grid-cols-2 gap-2">
          <Button variant="outline" size="touch" onClick={() => splitRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><Pencil />{c.edit}</Button>
          <Button size="touch" disabled={busy} onClick={() => void after(confirm(), c.confirmed)}><Check />{c.confirm}</Button>
        </div>
      </Card>
    )
  })()

  const about = (p: number) => (leftover > 0 ? c.aboutIn(formatWhole((leftover * p) / 100), month) : '')

  return (
    <>
      <ModalShell open={open} onBackdropClick={onClose} scrollChild>
        <div className="flex min-h-0 flex-1 flex-col">
          <V3SheetHeader onClose={onClose}>
            <V3SheetHeader.Title>{c.sheetTitle}</V3SheetHeader.Title>
            <V3SheetHeader.Subtitle>{c.sheetSubtitle}</V3SheetHeader.Subtitle>
          </V3SheetHeader>

          <div className="native-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-1">
            {card}

            <div ref={splitRef} className="scroll-mt-2 pt-5">
              <p className="px-1 text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">{c.splitTitle}</p>
              <p className="mt-1 px-1 text-[0.8125rem] leading-snug text-[var(--color-brand-text-secondary)]">{c.splitIntro}</p>
              <Card className="mt-3 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[0.84375rem] font-semibold text-[var(--color-brand-text-primary)]">{c.split}</span>
                  <span className={`font-mono-numbers text-[0.84375rem] font-semibold ${read.over && !dirty ? 'text-[var(--color-brand-red)]' : 'text-[var(--color-brand-text-primary)]'}`}>
                    {read.over && !dirty ? c.over100 : `${pct(sum)}%`} <span className="font-medium text-[var(--color-brand-text-muted)]">{c.ofHundred}</span>
                  </span>
                </div>
                <div className="mt-2 flex h-2 gap-[3px] overflow-hidden rounded-full bg-[var(--color-brand-elevated)]">
                  {draft.map((e) => <span key={e.target_id} className="h-full rounded-full bg-[var(--color-brand-primary)]" style={{ width: `${e.pct}%` }} />)}
                </div>
                <p className="mt-1.5 font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">{c.restGoes(pct(100 - sum))}</p>
              </Card>

              <Card padding="none" divide className="mt-3 overflow-hidden">
                {draft.map((e) => {
                  const kind = goals.some((g) => g.id === e.target_id) ? 'goal' : 'pocket'
                  return (
                    <div key={e.target_id} className="flex min-h-[72px] items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{targetName(e.target_id, kind)}</p>
                        <p className="mt-0.5 truncate font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">{about(e.pct)}</p>
                      </div>
                      <span className="flex shrink-0 items-center gap-3">
                        <IconButton aria-label={c.less} variant="sheetAction" disabled={e.pct <= 0} onClick={() => step(e.target_id, -STEP)}><Minus className="size-4" /></IconButton>
                        <span className="w-12 text-center font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{pct(e.pct)}%</span>
                        <IconButton aria-label={c.more} variant="sheetAction" disabled={sum >= 100} onClick={() => step(e.target_id, STEP)}><Plus className="size-4" /></IconButton>
                      </span>
                    </div>
                  )
                })}
                <div className="flex min-h-[64px] items-center gap-3 bg-[var(--color-brand-elevated)] px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{c.restRow}</p>
                    <p className="mt-0.5 truncate font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">{about(100 - sum)}</p>
                  </div>
                  <span className="w-12 shrink-0 text-center font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{pct(100 - sum)}%</span>
                </div>
              </Card>
              <div className="mt-1 flex justify-center">
                <Button variant="link" size="touch" disabled={sum >= 100 || choices.length === 0} onClick={() => setPicking(true)}><Plus />{c.addTarget}</Button>
              </div>
              {notes.map((g) => (
                <div key={g.id} className="mt-2 flex items-center gap-2 rounded-2xl bg-[var(--color-brand-elevated)] px-3.5 py-2">
                  <p className="min-w-0 flex-1 text-[0.8125rem] leading-[1.45] text-[var(--color-brand-text-primary)]">{c.fixedNote(g.name, `${formatWhole(g.monthlyContribution ?? 0)} ${g.currency || base}`)}</p>
                  <Button variant="link" size="touch" disabled={sum >= 100} onClick={() => add(g.id)}>{c.addAsPct}</Button>
                  <Button variant="ghost" size="touch" onClick={() => settlePrompt(`splitNote:${g.id}`)}>{c.dismiss}</Button>
                </div>
              ))}
              <p className="mt-2 px-1 text-xs leading-[1.45] text-[var(--color-brand-text-muted)]">{c.splitFootnote}</p>
            </div>
          </div>

          {dirty ? (
            <div className="px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">
              <Button size="cta-block" disabled={busy || sum > 100} onClick={() => void after(saveSplit(draft.filter((e) => e.pct > 0)), c.splitSaved)}>{c.saveSplit}</Button>
            </div>
          ) : null}
        </div>
      </ModalShell>
      <OptionSheet
        open={picking}
        overSheet
        onClose={() => setPicking(false)}
        title={c.addTarget}
        subtitle={c.addTargetSub}
        options={choices}
        value={null}
        onChange={(id) => add(id)}
      />
    </>
  )
}
