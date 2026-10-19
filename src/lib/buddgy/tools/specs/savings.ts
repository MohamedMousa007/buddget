import { num, obj, oneOf, str, type ToolSpec } from '@/lib/buddgy/tools/spec'

const POCKET = str('pocket ref or exact name')
const HOLDING = str('asset ref or exact name')
const CCY = str('ISO code; default is the base currency')

export const savingsSpecs: ToolSpec[] = [
  {
    name: 'list_savings',
    domain: 'savings',
    kind: 'read',
    description: 'List savings pockets and investment assets with balances and values.',
    params: obj({}),
  },
  {
    name: 'get_net_worth',
    domain: 'savings',
    kind: 'read',
    description: 'Net worth with savings, investments, debt and this month flow.',
    params: obj({}),
  },
  {
    name: 'add_savings_account',
    domain: 'savings',
    kind: 'write',
    risk: 'approve',
    description: 'Propose a new savings pocket.',
    params: obj(
      {
        name: str(),
        kind: oneOf(['bank', 'wallet', 'cash', 'other']),
        currency: CCY,
        balance: num('what is in it now'),
      },
      ['name', 'kind'],
    ),
  },
  {
    name: 'deposit_to_savings',
    domain: 'savings',
    kind: 'write',
    risk: 'approve',
    description: 'Propose adding money to a pocket.',
    params: obj(
      {
        pocket: POCKET,
        amount: num(),
        currency: CCY,
        mode: oneOf(['allocate', 'declare'], 'allocate = from this month budget, lowers left to spend (default); declare = money already owned'),
        note: str(),
      },
      ['pocket', 'amount'],
    ),
  },
  {
    name: 'withdraw_from_savings',
    domain: 'savings',
    kind: 'write',
    risk: 'approve',
    description: 'Propose taking money out of a pocket.',
    params: obj(
      {
        pocket: POCKET,
        amount: num(),
        currency: CCY,
        purpose: oneOf(['income', 'spend'], 'income = becomes this month income; spend = leaves savings, no income'),
        note: str(),
      },
      ['pocket', 'amount', 'purpose'],
    ),
  },
  {
    name: 'transfer_between_pockets',
    domain: 'savings',
    kind: 'write',
    risk: 'approve',
    description: 'Propose moving money from one pocket to another.',
    params: obj({ from: POCKET, to: POCKET, amount: num('in the source pocket currency'), note: str() }, ['from', 'to', 'amount']),
  },
  {
    name: 'correct_savings_balance',
    domain: 'savings',
    kind: 'write',
    risk: 'approve',
    description: 'Propose setting a pocket balance to the real figure.',
    params: obj({ pocket: POCKET, balance: num('the correct balance'), note: str() }, ['pocket', 'balance']),
  },
  {
    name: 'delete_savings_account',
    domain: 'savings',
    kind: 'write',
    risk: 'strong',
    description: 'Propose deleting a pocket with its history.',
    params: obj({ pocket: POCKET }, ['pocket']),
  },
  {
    name: 'add_investment_holding',
    domain: 'savings',
    kind: 'write',
    risk: 'approve',
    description: 'Propose an owned asset: gold, crypto, stock or property.',
    params: obj(
      {
        type: oneOf(['gold', 'crypto', 'stock', 'property']),
        quantity: num('gold amount, coins or shares'),
        unit: oneOf(['grams', 'pounds', 'ounces'], 'gold only; default grams'),
        karat: oneOf(['24', '22', '21', '18'], 'gold only'),
        symbol: str('coin or ticker'),
        value: num('property worth, in the base currency'),
        size: num('property m2'),
        paid: num('total cost'),
        date: str('purchase date YYYY-MM-DD'),
        name: str(),
      },
      ['type'],
    ),
  },
  {
    name: 'update_investment_holding',
    domain: 'savings',
    kind: 'write',
    risk: 'approve',
    description: 'Propose changing an owned asset. Send only what changes.',
    params: obj({ asset: HOLDING, quantity: num('gold in grams'), value: num('property worth'), name: str() }, ['asset']),
  },
  {
    name: 'delete_investment_holding',
    domain: 'savings',
    kind: 'write',
    risk: 'strong',
    description: 'Propose deleting an owned asset.',
    params: obj({ asset: HOLDING }, ['asset']),
  },
]
