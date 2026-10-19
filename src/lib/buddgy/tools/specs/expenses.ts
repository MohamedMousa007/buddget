import { EXPENSE_ENTRY_CATEGORIES } from '@/lib/constants/finance'
import { bool, num, obj, oneOf, str, type ToolSpec } from '@/lib/buddgy/tools/spec'

export const expensesSpecs: ToolSpec[] = [
  {
    name: 'add_expense',
    domain: 'expenses',
    kind: 'write',
    risk: 'auto',
    description: 'Propose a new expense. Category is a standard one or an active budget row name.',
    params: obj(
      {
        description: str(),
        amount: num(),
        currency: str('ISO code; default is the base currency'),
        category: oneOf(EXPENSE_ENTRY_CATEGORIES as string[]),
        date: str('YYYY-MM-DD; default today'),
        method: str('payment method ref or exact name; default is the usual one'),
        notes: str(),
        recurring: bool(),
      },
      ['description', 'amount', 'category'],
    ),
  },
  {
    name: 'update_expense',
    domain: 'expenses',
    kind: 'write',
    risk: 'approve',
    description: 'Propose changes to one expense found with search_expenses. Send only what changes.',
    params: obj(
      {
        ref: str(),
        description: str(),
        amount: num(),
        currency: str(),
        category: str(),
        date: str('YYYY-MM-DD'),
        method: str('payment method ref or exact name'),
        notes: str(),
      },
      ['ref'],
    ),
  },
  {
    name: 'delete_expense',
    domain: 'expenses',
    kind: 'write',
    risk: 'strong',
    description: 'Propose deleting one expense found with search_expenses.',
    params: obj({ ref: str() }, ['ref']),
  },
]
