import { arr, int, num, obj, oneOf, str, type ToolSpec } from '@/lib/buddgy/tools/spec'

const TYPES = ['salary', 'bonus', 'side_hustle', 'rental', 'investment', 'gift', 'refund', 'other']

export const incomeSpecs: ToolSpec[] = [
  {
    name: 'list_income',
    domain: 'income',
    kind: 'read',
    description: 'Income sources with refs and this cycle\'s paydays (received, awaiting, late, missed) plus one-time income.',
    params: obj({ month: str('YYYY-MM; default is the month on screen') }),
  },
  {
    name: 'add_income',
    domain: 'income',
    kind: 'write',
    risk: 'approve',
    description: 'Propose income: a recurring source with payday days, or money received once.',
    params: obj(
      {
        name: str(),
        amount: num('per paycheck for biweekly and weekly'),
        currency: str('ISO code; default is the base currency'),
        frequency: oneOf(['monthly', 'biweekly', 'weekly', 'one_time']),
        paydayDays: arr(int(), 'days of the month, 1-31; recurring only'),
        date: str('YYYY-MM-DD received; one_time only, default today'),
        type: oneOf(TYPES),
        method: str('payment method ref or exact name; default is the usual one'),
        notes: str(),
      },
      ['name', 'amount', 'frequency'],
    ),
  },
  {
    name: 'update_income',
    domain: 'income',
    kind: 'write',
    risk: 'approve',
    description: 'Propose changes to a recurring income source from list_income. Send only what changes.',
    params: obj(
      {
        ref: str('ref or exact name'),
        name: str(),
        amount: num(),
        currency: str(),
        frequency: oneOf(['monthly', 'biweekly', 'weekly']),
        paydayDays: arr(int(), 'days of the month, 1-31'),
        type: oneOf(TYPES),
        method: str('payment method ref or exact name'),
        notes: str(),
      },
      ['ref'],
    ),
  },
  {
    name: 'delete_income',
    domain: 'income',
    kind: 'write',
    risk: 'strong',
    description: 'Propose deleting a recurring income source from list_income.',
    params: obj({ ref: str('ref or exact name') }, ['ref']),
  },
  {
    name: 'mark_payday_received',
    domain: 'income',
    kind: 'write',
    risk: 'approve',
    description: 'Propose logging a payday as received (full or partial) for a recurring income source.',
    params: obj(
      {
        ref: str('source ref or exact name'),
        payday: str('YYYY-MM-DD scheduled payday from list_income; optional when only one is open'),
        amount: num('amount received; default is the expected amount'),
        date: str('YYYY-MM-DD received; default today'),
      },
      ['ref'],
    ),
  },
]
