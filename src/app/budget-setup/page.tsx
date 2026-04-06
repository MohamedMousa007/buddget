'use client'

import { SlidersHorizontal } from 'lucide-react'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { BudgetPlannerSummary } from '@/components/features/budget-planner/BudgetPlannerSummary'
import { BudgetPlannerCategories } from '@/components/features/budget-planner/BudgetPlannerCategories'
import { BudgetPlannerAiEvalCard } from '@/components/features/budget-planner/BudgetPlannerAiEvalCard'
import { BudgetPlannerChatPanel } from '@/components/features/budget-planner/BudgetPlannerChatPanel'
import { BudgetSetupNoPlansEmpty } from '@/components/features/budget-planner/BudgetSetupNoPlansEmpty'
import { BudgetSetupPlanToolbar } from '@/components/features/budget-planner/BudgetSetupPlanToolbar'
import { useBudgetSetupPage } from '@/hooks/useBudgetSetupPage'

/**
 * Multi-plan budget editor with subcategories, projected savings, and AI evaluation + chat.
 */
export default function BudgetSetupPage() {
  const p = useBudgetSetupPage()
  const { t } = p

  return (
    <div className="min-h-screen">
      <PageHeader>
        <PageHeaderContent>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <SlidersHorizontal className="w-6 h-6 text-[var(--color-brand-red)]" />
            {t.nav.budgetSetup}
          </h1>
        </PageHeaderContent>
      </PageHeader>

      <div className="px-4 py-6 lg:px-8 max-w-3xl mx-auto space-y-6">
        {!p.supabaseConfigured || p.user ? (
          p.budgetPlans.length > 0 ? (
            <>
              <BudgetSetupPlanToolbar
                plans={p.budgetPlans}
                activeId={p.activeBudgetPlanId}
                editingTabId={p.editingTabId}
                editingName={p.editingName}
                onSelect={p.setActiveBudgetPlanId}
                onStartRename={p.startRename}
                onEditingNameChange={p.setEditingName}
                onCommitRename={p.commitRename}
                onAddPlan={p.handleAddPlan}
                tabLabels={p.tabLabels}
                activePlan={p.activePlan}
                confirmDeleteMessage={t.common.confirmDeleteGeneric}
                deletePlanLabel={t.budgetPlanner.deletePlan}
                onDeleteActivePlan={() => p.deleteBudgetPlan(p.activePlan!.id)}
              />

              <BudgetPlannerSummary
                totalIncome={p.totalIncome}
                totalPlanned={p.totalPlanned}
                projectedSavings={p.projectedSavings}
                currency={p.settings.baseCurrency}
                labels={{
                  totalIncome: t.budgetPlanner.totalIncome,
                  totalPlanned: t.budgetPlanner.totalPlanned,
                  projectedSavings: t.budgetPlanner.projectedSavings,
                  projectedSavingsLine: t.budgetPlanner.projectedSavingsLine,
                }}
              />

              {p.activePlan ? (
                <BudgetPlannerCategories
                  categories={p.activePlan.categories}
                  labels={p.categoryLabels}
                  onAddPresetCategory={(icon, name) =>
                    p.addPlanCategory(p.activePlan!.id, { name, icon, amount: 0 })
                  }
                  onAddCustomCategory={(name, icon) =>
                    p.addPlanCategory(p.activePlan!.id, { name, icon, amount: 0 })
                  }
                  onUpdateCategory={(categoryId, updates) =>
                    p.updatePlanCategory(p.activePlan!.id, categoryId, updates)
                  }
                  onDeleteCategory={(categoryId) => p.deletePlanCategory(p.activePlan!.id, categoryId)}
                  onAddSubcategory={(categoryId) =>
                    p.addPlanSubcategory(p.activePlan!.id, categoryId, { name: '', amount: 0, icon: '📦' })
                  }
                  onUpdateSubcategory={(categoryId, subId, updates) =>
                    p.updatePlanSubcategory(p.activePlan!.id, categoryId, subId, updates)
                  }
                  onDeleteSubcategory={(categoryId, subId) =>
                    p.deletePlanSubcategory(p.activePlan!.id, categoryId, subId)
                  }
                />
              ) : null}

              <BudgetPlannerAiEvalCard
                rating={p.evalResult?.rating ?? null}
                explanation={p.evalResult?.explanation ?? null}
                loading={p.evalLoading}
                error={p.evalError}
                labels={{
                  title: t.budgetPlanner.aiEvalTitle,
                  loading: t.budgetPlanner.aiEvalLoading,
                  error: t.budgetPlanner.aiEvalError,
                }}
              />

              <BudgetPlannerChatPanel
                plan={p.activePlan}
                messages={p.chat.messages}
                input={p.chat.input}
                onInputChange={p.chat.setInput}
                onSend={() => void p.chat.handleSend()}
                loading={p.chat.loading}
                onApply={p.chat.applyFromMessage}
                scrollAnchorRef={p.chat.scrollAnchorRef}
                labels={{
                  title: t.budgetPlanner.aiChatTitle,
                  placeholder: t.budgetPlanner.aiChatPlaceholder,
                  send: t.budgetPlanner.aiSend,
                  apply: t.budgetPlanner.applySuggestion,
                  applied: t.budgetPlanner.applied,
                }}
              />
            </>
          ) : (
            <BudgetSetupNoPlansEmpty
              title={t.budgetPlanner.noPlansEmptyTitle}
              description={t.budgetPlanner.noPlansEmptyDesc}
              createLabel={t.budgetPlanner.noPlansCreateFirst}
              onCreate={p.handleAddPlan}
            />
          )
        ) : (
          <div className="min-h-[40vh]" aria-hidden />
        )}
      </div>
    </div>
  )
}
