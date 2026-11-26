'use client'

import { useEffect, useMemo, useState } from 'react'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { CategoryGlyph } from '@/components/dashboard/CategoryIcon'
import { SelectField } from '@/components/ui/SelectField'
import { EXPENSE_ENTRY_CATEGORIES } from '@/lib/constants/finance'
import { ArrowUp, ChevronLeft, Coins, Pencil, Sparkles, X } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { GoalChat } from '@/components/features/goals/new/GoalChat'
import { CostSheet } from '@/components/features/goals/new/CostSheet'
import { FundItSheet, useFundSummary, type FundPlan } from '@/components/features/goals/FundItSheet'
import { GoalGlyph } from '@/components/features/goals/GoalGlyph'
import { IconPickerSheet } from '@/components/features/goals/IconPickerSheet'
import { goalCategoryLabelKey } from '@/components/features/goals/goalCategoryLabel'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { MoneySourceField, type MoneySource } from '@/components/features/savings-v3/MoneySourceField'
import { useDiscardPrompt } from '@/components/features/savings-v3/useDiscardPrompt'
import type { PocketVM } from '@/components/features/savings-v3/types'
import { accountTitle } from '@/components/features/accounts/accountDisplay'
import { AmountHero } from '@/components/ui/AmountHero'
import { AmountTextInput } from '@/components/ui/AmountTextInput'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/input'
import { OptionChip } from '@/components/ui/OptionChip'
import { PickerRow } from '@/components/ui/PickerRow'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useNewGoalForm, type FlowSeed } from '@/hooks/useNewGoalForm'
import { useLocale, useT } from '@/lib/i18n'
import { intlTag } from '@/lib/i18n/dateFormat'
import { useGoalsLtCopy } from '@/lib/i18n/goalsLtCopy'
import { ELSEWHERE } from '@/lib/goals/goalPocket'
import { monthsUntil, sharesOverFull } from '@/lib/goals/goalPlan'
import { GOAL_ICON_SET, goalVisual } from '@/lib/goals/goalVisual'
import { isEligibleCarryPocket } from '@/lib/savings/monthCarry'
import { pocketDisplayName } from '@/lib/savings/pocketIdentity'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Currency, GoalCategory } from '@/lib/store/types'
import { formatWhole } from '@/lib/utils/formatters'

/** The categories Add goal offers as chips: every saving goal, Other last. */
const SAVE: GoalCategory[] = [
  'vacation', 'house', 'car', 'education', 'wedding', 'phone_device', 'emergency_fund', 'family_support',
  'investment', 'business', 'retirement', 'gift', 'sadaqah_charity', 'quality_of_life', 'custom',
]
/** Pay off and Control spending: the goal types that follow debts or cap spending instead of saving. */
type OtherKey = 'debt' | 'card' | 'monthly' | 'category'
const OTHER: [OtherKey, GoalCategory][] = [['debt', 'debt_freedom'], ['card', 'debt_freedom'], ['monthly', 'spending_control'], ['category', 'spending_control']]
const OTHER_LABEL = { debt: 'payDebt', card: 'payCard', monthly: 'limitMonthly', category: 'limitCategory' } as const
/** Save-for categories that are often really a loan or installment being paid off. */
const DEBT_LIKE: ReadonlySet<string> = new Set(['car', 'house', 'education', 'phone_device', 'wedding', 'business'])
const num = (s: string) => (Number.isFinite(parseFloat(s)) ? parseFloat(s) : 0)

type Form = ReturnType<typeof useNewGoalForm>

/** "Already saved" and "Where is it?": the same Account · Pocket · Outside tabs as Add money. */
function SavedBlock({ form }: { form: Form }) {
  const lt = useGoalsLtCopy()
  const c = lt.goals
  const t = useT()
  const sf = t.savingsForms
  const accounts = useFinanceStore((s) => s.savingsAccounts)
  const kind = form.savedKind
  const pockets: PocketVM[] = useMemo(
    () => accounts.filter((a) => isEligibleCarryPocket(a) && a.currency === form.currency).map((account) => ({ account, coverAmount: 0, goalsAmount: 0, goalLabel: '', isAuto: false })),
    [accounts, form.currency],
  )
  const accountId = form.savedHome && form.savedHome !== ELSEWHERE ? form.savedHome : form.homeAccounts[0]?.method.id
  const value: MoneySource =
    kind === 'outside' ? { kind } : kind === 'pocket' ? { kind, id: form.savedPocketId ?? undefined } : { kind, id: accountId }
  const pick = (next: MoneySource) => {
    form.setSavedKind(next.kind)
    if (next.kind === 'pocket') {
      // No account fallback: until a pocket is picked the saved amount has no home, so it can never be set aside in an account.
      form.setSavedPocketId(next.id ?? null)
      form.setSavedHome(null)
      return
    }
    form.setSavedPocketId(null)
    form.setSavedHome(next.kind === 'outside' ? ELSEWHERE : next.id ?? null)
  }
  // The account tab starts on the first account that could hold the money, so the answer is never left blank.
  const { savedHome, savedPocketId, setSavedHome } = form
  useEffect(() => {
    if (kind === 'account' && !savedHome && accountId && !savedPocketId) setSavedHome(accountId)
  }, [kind, savedHome, savedPocketId, accountId, setSavedHome])

  const home = form.homeAccounts.find((h) => h.method.id === accountId)
  const account = home?.method
  const pocket = pockets.find((p) => p.account.id === form.savedPocketId)?.account
  const note = kind === 'outside' ? c.savedOutside
    : kind === 'pocket' ? pocket ? c.savedPocket(pocketDisplayName(pocket, sf.systemNames)) : ''
    : account ? c.savedAccount(accountTitle(account)) : ''

  return (
    <div className="mt-1">
      <p className="mb-2 ms-1 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">{c.savedTitle}</p>
      <MoneySourceField
        value={value}
        onChange={pick}
        paymentMethods={form.homeAccounts.map((h) => h.method)}
        pockets={pockets}
        labels={{ title: c.whereIsIt, from: c.keptIn, fromPocket: c.keptIn }}
      >
        <PickerRow
          label={c.alreadySaved}
          value={
            <AmountTextInput
              value={form.alreadySaved}
              onChange={form.setAlreadySaved}
              currency={form.currency}
              placeholder={c.alreadySavedPlaceholder}
              aria-label={c.alreadySaved}
              className="w-full min-w-0 bg-transparent text-end font-mono-numbers outline-none placeholder:text-[var(--color-brand-text-muted)]"
            />
          }
        />
      </MoneySourceField>
      {form.savedProblem === 'over_available' && (kind === 'pocket' ? pocket : account) ? (
        <p role="alert" className="mt-2 px-1 text-[0.8125rem] text-[var(--color-brand-amber)]">
          {kind === 'pocket' && pocket
            ? lt.money.overPocket(pocketDisplayName(pocket, sf.systemNames), formatWhole(pocket.currentBalance))
            : account ? t.wealthSheets.money.overAvailable(`${formatWhole(home?.free ?? 0)} ${form.currency}`, accountTitle(account)) : null}
        </p>
      ) : form.savedProblem === 'choose_pocket' ? (
        <p role="alert" className="mt-2 px-1 text-[0.8125rem] text-[var(--color-brand-amber)]">{lt.money.choosePocket}</p>
      ) : note && num(form.alreadySaved) > 0 ? (
        <p className="mt-2 px-1 text-xs text-[var(--color-brand-text-secondary)]">{note}</p>
      ) : null}
    </div>
  )
}

function PocketNote({ name }: { name: string }) {
  const c = useGoalsLtCopy().goals
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] px-4 py-3 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">
      <Coins className="size-4 shrink-0" aria-hidden />
      <span dir="auto">{c.pocketMade(name)}</span>
    </div>
  )
}

/** Add goal, version C: one page; Fund it opens its own sheet. Buddgy's chat stays behind the "Or tell Buddgy" box. */
function Flow({ seed, onClose }: { seed: FlowSeed | null; onClose: () => void }) {
  const t = useT()
  const f = t.goals.flow
  const lt = useGoalsLtCopy()
  const c = lt.goals
  const { locale } = useLocale()
  const { online } = useNetworkStatus()
  const form = useNewGoalForm(seed, onClose)
  const fundSummary = useFundSummary()
  const [chat, setChat] = useState<string | null>(seed?.text ?? null)
  const [ask, setAsk] = useState('')
  const [fundOpen, setFundOpen] = useState(false)
  const [iconOpen, setIconOpen] = useState(false)
  const [costOpen, setCostOpen] = useState(false)
  const [preset, setPreset] = useState<OtherKey | null>(null)
  // Typed data beyond what the seed filled in (a picked category names the goal for the user); Discard drops the saved draft too.
  const [seedName] = useState(form.name)
  const typed = form.name.trim() !== seedName.trim() || [form.targetAmount, form.alreadySaved, form.fixedAmount, form.limit].some((v) => v.trim() !== '')
  const discard = useDiscardPrompt(typed, () => { form.discard(); onClose() })

  if (chat !== null) {
    const leave = () => setChat(null)
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-12 shrink-0 items-center gap-2 ps-3 pe-3">
          <IconButton aria-label={f.back} onClick={leave}>
            <ChevronLeft className="rtl:rotate-180" />
          </IconButton>
          <p className="flex-1 text-center text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{f.chat.title}</p>
          <IconButton aria-label={f.close} onClick={discard.close}>
            <X />
          </IconButton>
        </div>
        {discard.prompt}
        <GoalChat key={chat} form={form} firstText={chat || null} onContinue={leave} onManual={leave} />
      </div>
    )
  }

  const custom = form.category === 'custom'
  const customIcon = custom && form.icon ? GOAL_ICON_SET[form.icon] : undefined
  const glyphGoal = { category: form.category, emoji: form.icon ?? '' }
  const target = num(form.targetAmount)
  const saved = num(form.alreadySaved)
  const months = Math.max(1, monthsUntil(form.now, form.targetDate))
  const finish = new Date(`${form.targetDate.slice(0, 7)}-01T00:00:00`).toLocaleDateString(intlTag(locale), { month: 'short', year: 'numeric' })
  const plan: FundPlan = { mode: form.fundingMode, sharePct: form.sharePct, fixed: form.fixedAmount, frequency: form.frequency }
  const setPlan = (p: FundPlan) => {
    form.setFundingMode(p.mode)
    form.setSharePct(p.sharePct)
    form.setFixedAmount(p.fixed)
    form.setFrequency(p.frequency)
  }
  const money = (n: number) => formatWhole(n)
  const summary = fundSummary(plan, money)
  const name = form.name.trim() || c.namePlaceholder
  const canCreate = form.canNext2
  const pickSave = (k: GoalCategory) => {
    setPreset(null)
    if (form.kind === 'save') form.chooseCategory(k)
    else form.pickCategory(k)
  }
  const pickOther = (key: OtherKey) => {
    setPreset(key)
    if (key === 'debt' || key === 'card') form.pickCategory('debt_freedom', key)
    else form.pickCategory('spending_control')
  }
  const identity = (
    <div className="flex w-full flex-col items-center">
      {custom ? (
        <button
          type="button"
          aria-label={c.iconChangeAria}
          onClick={() => setIconOpen(true)}
          data-raw-button-ok="the goal's own icon tile, tapped to pick another icon"
          className="relative rounded-[19px]"
        >
          <GoalGlyph goal={glyphGoal} size={64} />
          <span aria-hidden className="absolute -bottom-1 -end-1 flex size-6 items-center justify-center rounded-full border-2 border-[var(--color-brand-card)] bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]">
            <Pencil className="size-3" />
          </span>
        </button>
      ) : (
        <GoalGlyph goal={glyphGoal} size={64} />
      )}
      <input
        value={form.name}
        onChange={(e) => form.setName(e.target.value)}
        placeholder={c.namePlaceholder}
        aria-label={c.nameAria}
        dir="auto"
        className="mt-3 h-11 w-full bg-transparent text-center text-[1.0625rem] font-semibold text-[var(--color-brand-text-primary)] outline-none placeholder:text-[var(--color-brand-text-muted)]"
      />
    </div>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {discard.prompt}
      <V3SheetHeader onClose={discard.close}>
        <V3SheetHeader.Title>{c.newGoalTitle}</V3SheetHeader.Title>
      </V3SheetHeader>

      <div className="native-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-4 pt-1 [&>*]:shrink-0">
        {online ? (
          <form
            className="rounded-2xl bg-[var(--color-brand-primary-soft)] p-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (ask.trim()) setChat(ask.trim())
            }}
          >
            <p className="mb-2 flex items-center gap-2 text-[0.8125rem] font-semibold text-[var(--color-brand-primary-ink)]">
              <Sparkles className="size-4" aria-hidden />
              {c.askLabel}
            </p>
            <div className="flex items-center gap-2">
              <Input
                size="brand"
                value={ask}
                onChange={(e) => setAsk(e.target.value)}
                placeholder={c.askPlaceholder}
                aria-label={c.askLabel}
                className="h-11 flex-1 rounded-full bg-[var(--color-brand-card)] px-4"
              />
              <IconButton type="submit" variant="solid" size="lg" shape="round" aria-label={c.askSend} disabled={!ask.trim()}>
                <ArrowUp />
              </IconButton>
            </div>
          </form>
        ) : null}

        <div role="group" aria-label={f.s1.groupSave} className="hide-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {SAVE.map((k) => {
            const Icon = k === 'custom' && customIcon ? customIcon : goalVisual(k).icon
            return (
              <OptionChip key={k} selected={form.kind === 'save' && form.category === k} onClick={() => pickSave(k)} className="shrink-0">
                <Icon aria-hidden />
                {t.goals[goalCategoryLabelKey(k)] as string}
              </OptionChip>
            )
          })}
        </div>
        <div role="group" aria-label={`${f.s1.groupPay} · ${f.s1.groupControl}`} className="hide-scrollbar -mx-5 -mt-1 flex items-center gap-2 overflow-x-auto px-5 pb-1">
          {OTHER.map(([key, category]) => {
            const Icon = goalVisual(category).icon
            return (
              <OptionChip key={key} size="sm" selected={form.kind !== 'save' && preset === key} onClick={() => pickOther(key)} className="shrink-0">
                <Icon aria-hidden />
                {f.s1[OTHER_LABEL[key]]}
              </OptionChip>
            )
          })}
        </div>

        {form.kind === 'save' ? (
          <>
            <AmountHero
              value={form.targetAmount}
              onChange={form.setTargetAmount}
              currency={form.currency}
              onCurrencyChange={(code) => form.setCurrency(code as Currency)}
              base={form.baseCurrency}
              aria-label={f.s2.target}
              className="px-0 pb-1"
              top={identity}
              line={target > 0 ? <span className="font-mono-numbers">{c.perMonthToFinish(money(Math.max(0, target - saved) / months), finish)}</span> : ''}
            />
            <div className="-mt-2 flex justify-center">
              <Button variant="link" size="touch" onClick={() => setCostOpen(true)} className="gap-1.5 font-semibold no-underline">
                <Sparkles className="size-4" aria-hidden />
                {c.askCosts}
              </Button>
            </div>
            {form.advice ? (
              <p className="flex items-center gap-2 rounded-xl bg-[var(--color-brand-primary-soft)] px-3 py-2 text-[0.8125rem] text-[var(--color-brand-text-primary)]">
                <BuddgyIcon size={20} className="shrink-0" />
                <span className="min-w-0 flex-1">
                  {form.advice.kind === 'covered' ? f.advice.covered : f.advice.emergency(formatWhole(form.advice.amount))}
                </span>
                {form.advice.kind === 'emergency' ? (
                  <OptionChip size="sm" onClick={() => form.setTargetAmount(String((form.advice as { amount: number }).amount))}>
                    {f.advice.use}
                  </OptionChip>
                ) : null}
              </p>
            ) : null}
            {DEBT_LIKE.has(form.category) && form.linkable.some((d) => d.name?.trim() || d.personName?.trim() || d.person?.trim()) ? (
              <div className="flex flex-col gap-2 rounded-2xl border border-[var(--color-brand-border)] p-3">
                <p className="text-[0.8125rem] font-semibold text-[var(--color-brand-text-primary)]">{f.s2.linkLead}</p>
                <p className="text-xs text-[var(--color-brand-text-secondary)]">{f.s2.linkSub}</p>
                <div className="flex flex-wrap gap-2">
                  {form.linkable.slice(0, 4).map((d) => {
                    const label = d.name?.trim() || d.personName?.trim() || d.person?.trim()
                    return label ? (
                      <OptionChip key={d.id} size="sm" onClick={() => { setPreset('debt'); form.linkInstead(d.id, label) }}>
                        {label}
                      </OptionChip>
                    ) : null
                  })}
                </div>
              </div>
            ) : null}

            <Card padding="none" divide className="overflow-hidden">
              <PickerRow
                label={c.finishLine}
                value={<DatePickerField look="pill" mode="month" value={form.targetDate.slice(0, 7)} onChange={(v) => form.setTargetDate(`${v.slice(0, 7)}-01`)} />}
              />
              <PickerRow
                label={c.fundIt}
                onClick={() => setFundOpen(true)}
                value={<span className="truncate font-mono-numbers">{saved > 0 ? c.fundSummarySaved(summary, money(saved)) : summary}</span>}
              />
            </Card>
            {form.fundingMode === 'share' && sharesOverFull(form.otherShare, form.sharePct) ? (
              <p role="alert" className="px-1 text-[0.8125rem] text-[var(--color-brand-amber)]">{c.shareOver(form.otherShare + form.sharePct)}</p>
            ) : null}
            <PocketNote name={name} />
          </>
        ) : form.kind === 'limit' ? (
          <>
            <AmountHero
              value={form.limit}
              onChange={form.setLimit}
              currency={form.currency}
              onCurrencyChange={(code) => form.setCurrency(code as Currency)}
              base={form.baseCurrency}
              aria-label={f.s2.limit}
              label={f.s2.limit}
              className="px-0 pb-1"
              top={identity}
            />
            <div className="flex flex-col gap-1.5">
              <span className="ms-1 text-xs font-semibold text-[var(--color-brand-text-secondary)]">{f.s2.appliesTo}</span>
              <SelectField
                value={form.spendingCategory}
                onChange={form.setSpendingCategory}
                items={[
                  { value: '', label: t.goals.allSpending },
                  ...EXPENSE_ENTRY_CATEGORIES.map((cat) => ({
                    value: cat,
                    label: t.expenseForm.categoryLabels[cat] ?? cat,
                    glyph: <CategoryGlyph category={cat} className="size-4" />,
                  })),
                ]}
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center pt-2">{identity}</div>
            <div className="flex flex-col gap-2">
              <span className="ms-1 text-xs font-semibold text-[var(--color-brand-text-secondary)]">{f.s2.debts}</span>
              {form.activeDebts.length === form.activeDebts.filter((d) => form.tracked.has(d.id)).length ? (
                <p className="text-sm text-[var(--color-brand-text-secondary)]">{f.s2.noDebts}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {form.activeDebts.map((d) => {
                  const taken = form.tracked.has(d.id)
                  return (
                    <OptionChip
                      key={d.id}
                      size="sm"
                      disabled={taken}
                      title={taken ? f.s2.debtTracked : undefined}
                      selected={form.linkedDebtIds.includes(d.id)}
                      onClick={() => form.toggleDebt(d.id)}
                    >
                      {d.name}
                    </OptionChip>
                  )
                })}
              </div>
              <p className="text-xs text-[var(--color-brand-text-secondary)]">
                {f.s2.debtsTotal}: <b className="font-mono-numbers">{formatWhole(form.debtsOwed)}</b>
              </p>
            </div>
          </>
        )}
      </div>

      <div className="sheet-cta flex shrink-0 flex-col gap-2.5 border-t border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-5 pb-6 pt-3">
        {form.saveError ? <p role="alert" className="text-xs text-[var(--color-brand-red-text)]">{f.saveError}</p> : null}
        <Button size="cta-block" disabled={!canCreate} onClick={form.submit}>
          {c.createGoal}
        </Button>
      </div>

      <FundItSheet
        open={fundOpen}
        onClose={() => setFundOpen(false)}
        name={name}
        currency={form.currency}
        value={plan}
        onChange={setPlan}
        usualKeep={form.usualKeep}
        otherShare={form.otherShare}
      >
        <SavedBlock form={form} />
        <PocketNote name={name} />
      </FundItSheet>
      <IconPickerSheet open={iconOpen} value={form.icon} onChange={form.setIcon} onClose={() => setIconOpen(false)} />
      <CostSheet
        open={costOpen}
        name={form.name}
        categoryLabel={t.goals[goalCategoryLabelKey(form.category)] as string}
        currency={form.currency}
        onUse={(n) => form.setTargetAmount(String(n))}
        onClose={() => setCostOpen(false)}
      />
    </div>
  )
}

/** Create a saving goal (Add goal, version C). A draft survives closing. */
export function NewGoalFlow({ open, seed, onClose }: { open: boolean; seed: FlowSeed | null; onClose: () => void }) {
  if (!open) return null
  return (
    <ModalShell
      open={open}
      onBackdropClick={onClose}
      scrollChild
      panelClassName="h-[calc(100dvh-40px)] max-h-[calc(100dvh-40px)] md:h-[min(46rem,calc(100dvh-4rem))] md:max-h-[calc(100dvh-4rem)] md:w-[min(28rem,calc(100vw-2rem))] md:rounded-3xl"
    >
      <Flow seed={seed} onClose={onClose} />
    </ModalShell>
  )
}
