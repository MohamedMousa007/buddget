'use client'

import { useState } from 'react'
import { Copy, Ellipsis, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { Button } from '@/components/ui/button'
import { CardActionMenu } from '@/components/ui/CardActionMenu'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/input'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { useBudgetSheetsCopy } from '@/components/features/budget/useSheetsCopy'
import type { BudgetPlan } from '@/lib/store/types'

export interface PlanListSheetProps {
  open: boolean
  plans: BudgetPlan[]
  activeId: string | null
  onClose: () => void
  onActivate: (id: string) => void
  onRename: (id: string, name: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onNew: () => void
}

/** Plain list of budgets: switch, rename, duplicate, delete. The deck replaces it in the plans step. */
export function PlanListSheet({ open, plans, activeId, onClose, onActivate, onRename, onDuplicate, onDelete, onNew }: PlanListSheetProps) {
  const c = useBudgetSheetsCopy().plans
  const confirm = useConfirm()
  const [menu, setMenu] = useState<{ plan: BudgetPlan; anchor: DOMRect } | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)

  const state = (p: BudgetPlan) => (p.status === 'draft' ? c.draft : p.status === 'archived' ? c.archived : null)

  const commitRename = () => {
    if (renaming && renaming.name.trim()) onRename(renaming.id, renaming.name.trim())
    setRenaming(null)
  }

  return (
    <ModalShell open={open} onBackdropClick={onClose} padContent>
      <ModalSheetHeader title={c.title} onClose={onClose} />
      <div className="mt-3 flex flex-col gap-2 pb-2">
        {plans.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--color-brand-text-secondary)]">{c.empty}</p>
        ) : null}
        {plans.map((p) => {
          const active = p.id === activeId
          const label = state(p)
          return (
            <div
              key={p.id}
              className={`flex min-h-16 items-center gap-3 rounded-2xl border px-4 py-2 ${
                active
                  ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-soft)]'
                  : 'border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]'
              }`}
            >
              <div className="min-w-0 flex-1">
                {renaming?.id === p.id ? (
                  <Input
                    size="brand"
                    autoFocus
                    value={renaming.name}
                    placeholder={c.renamePlaceholder}
                    onChange={(e) => setRenaming({ id: p.id, name: e.target.value })}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename()
                      if (e.key === 'Escape') setRenaming(null)
                    }}
                  />
                ) : (
                  <>
                    <p className="truncate text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{p.name}</p>
                    <p className="text-xs text-[var(--color-brand-text-secondary)]">{c.lines(p.categories.length)}</p>
                  </>
                )}
              </div>
              {active || label ? (
                <span className="rounded-full bg-[var(--color-brand-card)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-brand-primary-ink)]">
                  {active ? c.active : label}
                </span>
              ) : null}
              <IconButton
                aria-label={c.more(p.name)}
                onClick={(e) => setMenu({ plan: p, anchor: e.currentTarget.getBoundingClientRect() })}
              >
                <Ellipsis />
              </IconButton>
            </div>
          )
        })}
      </div>
      <div className="sheet-cta">
        <Button size="cta-block" onClick={onNew}>
          <Plus />
          {c.new}
        </Button>
      </div>
      <CardActionMenu
        anchor={menu?.anchor ?? null}
        zClassName="z-[120]"
        onClose={() => setMenu(null)}
        items={
          menu
            ? [
                ...(menu.plan.id === activeId ? [] : [{ label: c.setActive, icon: <Star className="size-4" />, onSelect: () => onActivate(menu.plan.id) }]),
                { label: c.rename, icon: <Pencil className="size-4" />, onSelect: () => setRenaming({ id: menu.plan.id, name: menu.plan.name }) },
                { label: c.duplicate, icon: <Copy className="size-4" />, onSelect: () => onDuplicate(menu.plan.id) },
                {
                  label: c.delete,
                  icon: <Trash2 className="size-4" />,
                  destructive: true,
                  onSelect: async () => {
                    const plan = menu.plan
                    if (await confirm({ title: c.deleteTitle(plan.name), body: c.deleteBody, confirmLabel: c.deleteConfirm, destructive: true })) onDelete(plan.id)
                  },
                },
              ]
            : []
        }
      />
    </ModalShell>
  )
}
