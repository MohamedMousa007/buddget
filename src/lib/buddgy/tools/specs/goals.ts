import { GOAL_CATEGORIES } from '@/lib/constants/goalCategories'
import { num, obj, oneOf, str, type ToolSpec } from '@/lib/buddgy/tools/spec'

const SAVING_CATEGORIES = GOAL_CATEGORIES.map((c) => c.value).filter((v) => v !== 'debt_freedom' && v !== 'spending_control')

export const goalsSpecs: ToolSpec[] = [
  {
    name: 'list_goals',
    domain: 'goals',
    kind: 'read',
    description: 'List goals with target, saved, progress, date and funding.',
    params: obj({}),
  },
  {
    name: 'add_goal',
    domain: 'goals',
    kind: 'write',
    risk: 'approve',
    description: 'Propose a savings goal. It gets its own pocket.',
    params: obj(
      {
        name: str(),
        target: num(),
        currency: str('ISO code; default is the base currency'),
        date: str('YYYY-MM-DD target date'),
        category: oneOf(SAVING_CATEGORIES, 'default custom'),
        saved: num('already set aside, in the goal currency'),
      },
      ['name', 'target'],
    ),
  },
  {
    name: 'update_goal',
    domain: 'goals',
    kind: 'write',
    risk: 'approve',
    description: 'Propose changes to one goal. Send only what changes.',
    params: obj(
      {
        goal: str('ref or exact name'),
        name: str(),
        target: num('target amount, or the monthly limit of a spending goal'),
        date: str('YYYY-MM-DD'),
        funding: oneOf(['share', 'fixed', 'manual']),
        sharePct: num('1-100, for funding share'),
        monthly: num('amount per month, for funding fixed'),
      },
      ['goal'],
    ),
  },
  {
    name: 'add_to_goal',
    domain: 'goals',
    kind: 'write',
    risk: 'approve',
    description: "Propose putting money into a goal's pocket.",
    params: obj(
      {
        goal: str('ref or exact name'),
        amount: num(),
        currency: str('default is the goal currency'),
        mode: oneOf(['allocate', 'declare'], 'allocate = from this month budget (default); declare = money already owned'),
      },
      ['goal', 'amount'],
    ),
  },
  {
    name: 'achieve_goal',
    domain: 'goals',
    kind: 'write',
    risk: 'approve',
    description: 'Propose marking a goal as achieved.',
    params: obj({ goal: str('ref or exact name') }, ['goal']),
  },
  {
    name: 'delete_goal',
    domain: 'goals',
    kind: 'write',
    risk: 'strong',
    description: 'Propose deleting a goal. Its pocket and money stay.',
    params: obj({ goal: str('ref or exact name') }, ['goal']),
  },
]
