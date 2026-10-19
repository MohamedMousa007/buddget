import { EXPENSE_ENTRY_CATEGORIES } from '@/lib/constants/finance'
import { bool, int, num, obj, oneOf, str, type ToolSpec } from '@/lib/buddgy/tools/spec'

const CYCLES = ['monthly', 'quarterly', 'semiannual', 'yearly', 'weekly']
const sub = str('ref or exact name')

export const subscriptionsSpecs: ToolSpec[] = [
  {
    name: 'list_subscriptions',
    domain: 'subscriptions',
    kind: 'read',
    description: 'Subscriptions with price, cycle, status, next charge date and monthly cost, plus the monthly total.',
    params: obj({ status: oneOf(['active', 'trial', 'paused', 'cancelled', 'ended', 'all'], 'default: all except ended') }),
  },
  {
    name: 'add_subscription',
    domain: 'subscriptions',
    kind: 'write',
    risk: 'approve',
    description: 'Propose a recurring subscription. For a free trial, firstCharge is the day the trial ends.',
    params: obj(
      {
        name: str(),
        amount: num('price per cycle'),
        currency: str('ISO code; default is the base currency'),
        cycle: oneOf(CYCLES),
        firstCharge: str('YYYY-MM-DD; default today. Sets the billing day'),
        trial: bool(),
        plan: str(),
        category: oneOf(EXPENSE_ENTRY_CATEGORIES as string[], 'default Enjoyment'),
        method: str('payment method ref or exact name; default is the usual one'),
        tracking: oneOf(['sms', 'ask', 'log'], 'how charges get recorded; default sms'),
        notes: str(),
      },
      ['name', 'amount', 'cycle'],
    ),
  },
  {
    name: 'update_subscription',
    domain: 'subscriptions',
    kind: 'write',
    risk: 'approve',
    description: 'Propose changes to a subscription. Send only what changes.',
    params: obj(
      {
        sub,
        name: str(),
        amount: num(),
        currency: str(),
        cycle: oneOf(CYCLES),
        billingDay: int('1-31'),
        category: oneOf(EXPENSE_ENTRY_CATEGORIES as string[]),
        method: str('payment method ref or exact name'),
        tracking: oneOf(['sms', 'ask', 'log']),
        notes: str(),
      },
      ['sub'],
    ),
  },
  {
    name: 'pause_subscription',
    domain: 'subscriptions',
    kind: 'write',
    risk: 'approve',
    description: 'Propose pausing a subscription; no charges are expected while paused.',
    params: obj({ sub }, ['sub']),
  },
  {
    name: 'resume_subscription',
    domain: 'subscriptions',
    kind: 'write',
    risk: 'approve',
    description: 'Propose resuming a paused subscription, or re-subscribing a cancelled one.',
    params: obj({ sub }, ['sub']),
  },
  {
    name: 'cancel_subscription',
    domain: 'subscriptions',
    kind: 'write',
    risk: 'approve',
    description: 'Propose cancelling in Buddgy. The user must still cancel with the service itself.',
    params: obj({ sub, endsOn: str('last day of access, YYYY-MM-DD; default end of the paid cycle') }, ['sub']),
  },
  {
    name: 'mark_subscription_paid',
    domain: 'subscriptions',
    kind: 'write',
    risk: 'approve',
    description: 'Propose recording the current cycle charge as an expense. Once per cycle.',
    params: obj({ sub }, ['sub']),
  },
  {
    name: 'adopt_subscription_price',
    domain: 'subscriptions',
    kind: 'write',
    risk: 'approve',
    description: 'Propose adopting the price rise detected from the latest charge.',
    params: obj({ sub }, ['sub']),
  },
  {
    name: 'delete_subscription',
    domain: 'subscriptions',
    kind: 'write',
    risk: 'strong',
    description: 'Propose deleting a subscription and its planned recurring expense.',
    params: obj({ sub }, ['sub']),
  },
]
