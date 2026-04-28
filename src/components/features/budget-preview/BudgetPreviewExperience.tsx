'use client'

import { motion } from 'framer-motion'
import { useBudgetPreviewPage } from '@/hooks/useBudgetPreviewPage'
import { formatCurrency } from '@/lib/utils/formatters'
import { Input } from '@/components/ui/input'
import { isSavingsCategoryRow } from '@/lib/budget/lifestyleMappings'

export function BudgetPreviewExperience() {
  const v = useBudgetPreviewPage()

  if (v.initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0F] text-[#A0A0B8] text-sm px-6">
        Preparing your plan…
      </div>
    )
  }

  if (v.bootError || !v.draft) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#0A0A0F] text-white px-6">
        <p className="text-sm text-[#A0A0B8]">{v.bootError ?? 'Nothing to preview.'}</p>
      </div>
    )
  }

  const surplusLabel = formatCurrency(Math.abs(v.unallocated), v.baseCurrency, false)
  const surplusPositive = v.unallocated >= 0

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-28">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-[#2A2A38] bg-[#0A0A0F]/95 px-4 py-3 backdrop-blur-sm">
        <span className="text-lg font-bold shrink-0">
          Bud<span className="text-[#E50914]">d</span>get
        </span>
        <h1 className="text-sm font-semibold text-center truncate flex-1 text-white">
          Your budget plan
        </h1>
        <button
          type="button"
          onClick={v.onSkip}
          className="text-xs text-[#5A5A72] hover:text-[#A0A0B8] shrink-0"
        >
          Skip / Do later
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-6 space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-xl font-bold text-white">Here&apos;s your first budget plan.</p>
          <p className="text-sm text-[#A0A0B8]">
            Based on what you told us. Adjust anything before we start.
          </p>
          <p className="text-[11px] text-[#5A5A72]">
            {v.planSource === 'ai' ? 'Personalised with AI' : 'Smart default template'}
          </p>
        </div>

        <section className="rounded-xl border border-[#2A2A38] bg-[#111118] p-4">
          <h2 className="text-sm font-semibold text-white mb-3">Income</h2>
          <p className="text-base text-white mb-2">
            Money coming in:{' '}
            <span className="font-semibold">
              {formatCurrency(Math.round(v.monthlyIncome), v.baseCurrency, false)} / month
            </span>
          </p>
          <ul className="text-sm text-[#A0A0B8] space-y-1">
            {v.draft.incomeSources
              .filter((i) => i.name.trim() && i.amount > 0)
              .map((i, k) => (
                <li key={k}>
                  {i.name}: {formatCurrency(i.amount, i.currency, false)} {i.currency}
                </li>
              ))}
          </ul>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-white mb-3">Budget categories</h2>
          <div className="space-y-2">
            {v.categories.map((c, index) =>
              isSavingsCategoryRow(c) ? null : (
                <motion.div
                  key={`${c.name}-${index}-${c.amount}`}
                  layout
                  className="flex items-center gap-3 rounded-xl border border-[#2A2A38] bg-[#111118] px-3 py-2"
                >
                  <span className="text-xl shrink-0 w-8 text-center" aria-hidden>
                    {c.emoji}
                  </span>
                  <span className="text-sm text-white flex-1 min-w-0 truncate">{c.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs text-[#5A5A72]">{v.baseCurrency}</span>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={c.amount}
                      onChange={(e) => v.onCategoryAmount(index, parseFloat(e.target.value) || 0)}
                      className="w-24 h-9 bg-[#0A0A0F] border-[#2A2A38] text-white text-sm"
                      aria-label={`${c.name} budget amount`}
                    />
                  </div>
                </motion.div>
              ),
            )}
          </div>
          <div className="mt-3 space-y-1 text-sm text-[#A0A0B8]">
            <p>
              Total budgeted:{' '}
              <span className="text-white font-medium">
                {formatCurrency(Math.round(v.budgetedTotal), v.baseCurrency, false)}
              </span>
            </p>
            <p className={v.unallocated < 0 ? 'text-[#E50914]' : ''}>
              Unallocated:{' '}
              <span className="font-medium">
                {formatCurrency(Math.round(v.unallocated), v.baseCurrency, false)}
              </span>
            </p>
            {v.regenerateExplanation ?
              <p className="text-sm text-[#A0A0B8] italic pt-1">
                Changed: {v.regenerateExplanation}
              </p>
            : null}
          </div>
        </section>

        <section className="rounded-xl border border-[#2A2A38] bg-[#111118] p-4">
          <h2 className="text-sm font-semibold text-white mb-2">Fixed costs</h2>
          <p className="text-xs text-[#5A5A72] mb-3">
            These are already deducted from your available budget.
          </p>
          {v.draft.fixedCosts.length ?
            <ul className="text-sm text-[#A0A0B8] space-y-1">
              {v.draft.fixedCosts.map((f, k) => (
                <li key={k}>
                  {f.name}: {formatCurrency(f.amount, v.baseCurrency, false)} {v.baseCurrency}
                </li>
              ))}
            </ul>
          : <p className="text-sm text-[#5A5A72]">None entered</p>}
        </section>

        <section className="rounded-xl border border-[#2A2A38] bg-[#111118] p-4">
          <h2 className="text-sm font-semibold text-white mb-2">Projected outcome</h2>
          <p className="text-sm text-[#A0A0B8] mb-1">At this pace:</p>
          <p className={`text-base font-medium ${surplusPositive ? 'text-green-400' : 'text-[#E50914]'}`}>
            {surplusPositive ?
              <>You&apos;ll save approximately {surplusLabel} this month</>
            : <>You&apos;d be short about {surplusLabel} at this pace</>}
          </p>
        </section>

        <section className="space-y-3">
          <button
            type="button"
            onClick={() => v.setRegenOpen(true)}
            disabled={v.aiBusy}
            className="w-full rounded-xl border border-[#2A2A38] bg-[#111118] py-3 text-sm font-medium text-white hover:border-[#E50914] disabled:opacity-50"
          >
            ↺ Regenerate with AI
          </button>
          {v.regenOpen ?
            <div className="rounded-xl border border-[#2A2A38] bg-[#111118] p-4 space-y-3">
              <label htmlFor="regen-feedback" className="sr-only">
                Feedback for AI
              </label>
              <textarea
                id="regen-feedback"
                value={v.regenNotes}
                onChange={(e) => v.setRegenNotes(e.target.value)}
                rows={4}
                placeholder="Tell us what to change... e.g. 'I want to save more' or 'I spend more on food than this'"
                className="w-full rounded-lg bg-[#0A0A0F] border border-[#2A2A38] text-white text-sm p-3 outline-none focus:border-[#E50914]"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => v.setRegenOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm text-[#A0A0B8] hover:bg-[#1A1A24]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={v.aiBusy || !v.regenNotes.trim()}
                  onClick={() => void v.runRegenerate()}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#E50914] text-white disabled:opacity-50"
                >
                  Generate new plan →
                </button>
              </div>
            </div>
          : null}
          {v.aiBusy ?
            <p className="text-center text-sm text-[#A0A0B8]">
              {v.regenStatus ?? 'Thinking about your feedback...'}
            </p>
          : null}
          {v.regenStatus && !v.aiBusy ?
            <p className="text-center text-sm text-amber-400" role="alert">
              {v.regenStatus}
            </p>
          : null}
        </section>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#2A2A38] bg-[#0A0A0F] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          disabled={v.confirmBusy}
          onClick={() => void v.onConfirm()}
          className="w-full rounded-xl bg-[#E50914] hover:bg-[#F40612] py-3.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {v.confirmBusy ? 'Saving…' : 'This looks good — let\'s go! →'}
        </button>
      </div>
    </div>
  )
}
