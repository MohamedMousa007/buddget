'use client'

import { useCallback, useRef, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { useAuth } from '@/components/auth/AuthProvider'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSharedBudgets } from '@/hooks/useSharedBudgets'
import { PlanSwitcher } from '@/components/features/budget-planner/PlanSwitcher'
import { BudgetPlanMembers } from '@/components/features/budget-planner/BudgetPlanMembers'
import { InviteMemberSheet } from '@/components/features/budget-planner/InviteMemberSheet'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { BudgetPlannerSummary } from '@/components/features/budget-planner/BudgetPlannerSummary'
import { BudgetPlannerCategories } from '@/components/features/budget-planner/BudgetPlannerCategories'
import { BudgetPlannerChatPanel } from '@/components/features/budget-planner/BudgetPlannerChatPanel'
import { BudgetPlannerBuddgyHero } from '@/components/features/budget-planner/BudgetPlannerBuddgyHero'
import { BudgetSetupNoPlansEmpty } from '@/components/features/budget-planner/BudgetSetupNoPlansEmpty'
import { BudgetSetupPlanToolbar } from '@/components/features/budget-planner/BudgetSetupPlanToolbar'
import { useBudgetSetupPage } from '@/hooks/useBudgetSetupPage'

/**
 * Multi-plan budget editor with Buddgy evaluation, plan builder chat, and manual edits.
 */
export default function BudgetSetupPage() {
  const categoriesSectionRef = useRef<HTMLDivElement>(null)
  const p = useBudgetSetupPage({ scrollToCategoriesRef: categoriesSectionRef })
  const { t } = p
  const { user } = useAuth()
  const { plans: sharedPlans, createSharedPlan, refresh: refreshShared } = useSharedBudgets()
  const activeSharedBudgetId = useFinanceStore((s) => s.activeSharedBudgetId)
  const defaultSharedBudgetPlanId = useFinanceStore((s) => s.defaultSharedBudgetPlanId)
  const setActiveSharedBudgetId = useFinanceStore((s) => s.setActiveSharedBudgetId)
  const setDefaultSharedBudgetPlanId = useFinanceStore((s) => s.setDefaultSharedBudgetPlanId)
  const [inviteOpen, setInviteOpen] = useState(false)

  const handleSetDefaultForShared = useCallback(async () => {
    if (!activeSharedBudgetId) return
    try {
      const res = await fetch('/api/budget/profile-default', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultBudgetPlanId: activeSharedBudgetId }),
      })
      if (res.ok) setDefaultSharedBudgetPlanId(activeSharedBudgetId)
    } catch {
      /* ignore */
    }
  }, [activeSharedBudgetId, setDefaultSharedBudgetPlanId])

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
              {user && p.supabaseConfigured ?
                <div className="space-y-4">
                  <PlanSwitcher
                    sharedPlans={sharedPlans}
                    activeSharedId={activeSharedBudgetId}
                    defaultSharedId={defaultSharedBudgetPlanId}
                    labels={{
                      personal: t.sharedBudget.planSwitcherPersonal,
                      createShared: t.sharedBudget.planSwitcherCreateShared,
                      defaultBadge: t.sharedBudget.defaultBadge,
                    }}
                    onSelectPersonal={() => setActiveSharedBudgetId(null)}
                    onSelectShared={(id) => setActiveSharedBudgetId(id)}
                    onCreateShared={() =>
                      void (async () => {
                        const plan = await createSharedPlan('Shared Budget')
                        if (plan?.id) setActiveSharedBudgetId(plan.id)
                      })()
                    }
                  />
                  {activeSharedBudgetId ?
                    <BudgetPlanMembers
                      planId={activeSharedBudgetId}
                      isOwner={sharedPlans.some(
                        (s) => s.id === activeSharedBudgetId && s.membership.kind === 'owner'
                      )}
                      onOpenInvite={() => setInviteOpen(true)}
                      onSetDefault={handleSetDefaultForShared}
                      showSetDefault={defaultSharedBudgetPlanId !== activeSharedBudgetId}
                    />
                  : null}
                  <InviteMemberSheet
                    open={inviteOpen && Boolean(activeSharedBudgetId)}
                    onClose={() => setInviteOpen(false)}
                    planId={activeSharedBudgetId ?? ''}
                    labels={{
                      title: t.sharedBudget.inviteTitle,
                      email: t.sharedBudget.inviteEmail,
                      emailPlaceholder: t.sharedBudget.inviteEmailPlaceholder,
                      roleView: t.sharedBudget.roleView,
                      roleManage: t.sharedBudget.roleManage,
                      syncLabel: t.sharedBudget.syncLabel,
                      syncHelp: t.sharedBudget.syncHelp,
                      send: t.sharedBudget.sendInvite,
                      notFoundHint: t.sharedBudget.notFoundHint,
                      inviteApp: t.sharedBudget.inviteApp,
                      foundAs: t.sharedBudget.foundAs,
                      close: t.sharedBudget.closeSheet,
                    }}
                    onInviteSent={() => void refreshShared()}
                  />
                </div>
              : null}
              <BudgetPlannerBuddgyHero
                variant={p.hasCategoryRows ? 'compact' : 'primary'}
                labels={p.buddgyHeroLabels}
                onStartBuilder={p.openBuddgyPlanBuilder}
              />

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
                <div ref={categoriesSectionRef}>
                  <BudgetPlannerCategories
                    categories={p.activePlan.categories}
                    settings={p.settings}
                    planEval={{
                      loading: p.evalLoading,
                      error: p.evalError,
                      rating: p.evalResult?.rating ?? null,
                      explanation: p.evalResult?.explanation ?? null,
                    }}
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
                </div>
              ) : null}

              <BudgetPlannerChatPanel
                plan={p.activePlan}
                messages={p.chat.messages}
                input={p.chat.input}
                onInputChange={p.chat.setInput}
                onSend={() => void p.chat.handleSend()}
                loading={p.chat.loading}
                onApply={p.chat.applyFromMessage}
                scrollAnchorRef={p.chat.scrollAnchorRef}
                builderActive={p.chat.builderActive}
                labels={{
                  title: t.budgetPlanner.aiChatTitle,
                  subtitle: t.budgetPlanner.buddgyChatSubtitle,
                  builderBadge: t.budgetPlanner.buddgyBuilderBadge,
                  placeholder: t.budgetPlanner.aiChatPlaceholder,
                  send: t.budgetPlanner.aiSend,
                  apply: t.budgetPlanner.applySuggestion,
                  applied: t.budgetPlanner.applied,
                }}
              />
            </>
          ) : (
            <>
              <BudgetPlannerBuddgyHero
                variant="primary"
                labels={p.buddgyHeroLabels}
                onStartBuilder={p.openBuddgyPlanBuilder}
              />
              <BudgetSetupNoPlansEmpty
                title={t.budgetPlanner.noPlansEmptyTitle}
                description={t.budgetPlanner.noPlansEmptyDesc}
                createLabel={t.budgetPlanner.noPlansCreateFirst}
                onCreate={p.handleAddPlan}
              />
            </>
          )
        ) : (
          <div className="min-h-[40vh]" aria-hidden />
        )}
      </div>
    </div>
  )
}
