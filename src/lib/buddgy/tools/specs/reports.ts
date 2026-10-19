import { int, num, obj, oneOf, str, type ToolSpec } from '@/lib/buddgy/tools/spec'

export const reportsSpecs: ToolSpec[] = [
  {
    name: 'get_summary',
    domain: 'reports',
    kind: 'read',
    description: 'Month figures: income, spent, left to spend, safe daily amount, pace, budget, top categories, savings and debt totals.',
    params: obj({ month: str('YYYY-MM; default is the month on screen') }),
  },
  {
    name: 'search_expenses',
    domain: 'expenses',
    kind: 'read',
    description: 'Find expenses. Returns refs, totals and the largest matches. Use refs for edits.',
    params: obj({
      q: str('text in the description'),
      category: str(),
      method: str('payment method name or ref'),
      from: str('YYYY-MM-DD'),
      to: str('YYYY-MM-DD'),
      min: num('minimum amount in base currency'),
      max: num('maximum amount in base currency'),
      sort: oneOf(['recent', 'largest']),
      limit: int('max rows, default 8, at most 15'),
    }),
  },
  {
    name: 'spend_breakdown',
    domain: 'reports',
    kind: 'read',
    description: 'Spending grouped by category, payment method, month, day or merchant for a date range.',
    params: obj(
      {
        by: oneOf(['category', 'method', 'month', 'day', 'merchant']),
        from: str('YYYY-MM-DD'),
        to: str('YYYY-MM-DD'),
      },
      ['by'],
    ),
  },
]
