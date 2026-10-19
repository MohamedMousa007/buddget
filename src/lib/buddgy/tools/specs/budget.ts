import { BUDGET_BLOCKS } from '@/lib/budget/blocks'
import { arr, bool, num, obj, oneOf, str, type ToolSpec } from '@/lib/buddgy/tools/spec'

const blocks = [...BUDGET_BLOCKS] as string[]

export const budgetSpecs: ToolSpec[] = [
  {
    name: 'get_budget',
    domain: 'budget',
    kind: 'read',
    description: 'Active budget plan: each line with ref, planned, spent this month and left.',
    params: obj({ block: oneOf(blocks, 'only this block') }),
  },
  {
    name: 'list_budget_plans',
    domain: 'budget',
    kind: 'read',
    description: 'All budget plans with status and which one is active.',
    params: obj({}),
  },
  {
    name: 'adjust_budget',
    domain: 'budget',
    kind: 'write',
    risk: 'approve',
    description:
      'Propose edits to the active plan lines (refs from get_budget). Locked or linked lines are skipped. A whole new plan is built in the Studio.',
    params: obj(
      {
        ops: arr(
          obj(
            {
              op: oneOf(['set', 'add', 'remove', 'move', 'rename', 'lock']),
              line: str('line ref or exact name; not for add'),
              amount: num('monthly amount for set and add'),
              name: str('new line name for add and rename'),
              block: oneOf(blocks, 'for add and move'),
              locked: bool('for lock; default true'),
            },
            ['op'],
          ),
        ),
      },
      ['ops'],
    ),
  },
  {
    name: 'activate_budget_plan',
    domain: 'budget',
    kind: 'write',
    risk: 'strong',
    description: 'Propose making another plan the active one from this cycle.',
    params: obj({ plan: str('plan ref or exact name') }, ['plan']),
  },
  {
    name: 'delete_budget_plan',
    domain: 'budget',
    kind: 'write',
    risk: 'strong',
    description: 'Propose deleting a budget plan.',
    params: obj({ plan: str('plan ref or exact name') }, ['plan']),
  },
]
