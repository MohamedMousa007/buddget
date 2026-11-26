'use client'

import { useMemo, useState } from 'react'
import { SheetFrame } from '@/components/features/subscriptions/SheetFrame'
import { Button } from '@/components/ui/button'
import { OptionChip } from '@/components/ui/OptionChip'
import { trackedDebtIds } from '@/lib/goals/debtGoal'
import { useT } from '@/lib/i18n'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Goal } from '@/lib/store/types'
import { useShallow } from 'zustand/react/shallow'

/** A debt goal's linked debts. Saving goals edit their plan in the goal sheet's own rows (finish line, Fund it, pocket). */
export function PlanEditorSheet({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const t = useT()
  const s = useFinanceStore(useShallow((st) => ({ goals: st.goals, debts: st.debts })))
  const [debtIds, setDebtIds] = useState(goal.linkedDebtIds)
  const takenElsewhere = useMemo(() => trackedDebtIds(s.goals, goal.id), [s.goals, goal.id])
  const upd = useFinanceStore((st) => st.updateGoal)
  const toggle = (id: string) => setDebtIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))

  const save = () => {
    upd(goal.id, { linkedDebtIds: debtIds })
    onClose()
  }

  return (
    <SheetFrame
      open
      onClose={onClose}
      title={t.goals.detail.pocketTitle}
      zClassName="z-[110]"
      footer={<Button size="cta-block" onClick={save}>{t.goals.detail.editSave}</Button>}
    >
      <div className="flex flex-wrap gap-2">
        {s.debts.filter((d) => d.status !== 'cleared' || debtIds.includes(d.id)).map((d) => (
          <OptionChip
            key={d.id}
            size="sm"
            disabled={takenElsewhere.has(d.id)}
            selected={debtIds.includes(d.id)}
            onClick={() => toggle(d.id)}
          >
            {d.name}
          </OptionChip>
        ))}
      </div>
    </SheetFrame>
  )
}
