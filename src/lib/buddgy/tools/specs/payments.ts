import { CARD_SETUP_TYPES } from '@/lib/payment/paymentMethodDefaults'
import { bool, obj, oneOf, str, type ToolSpec } from '@/lib/buddgy/tools/spec'

export const paymentsSpecs: ToolSpec[] = [
  {
    name: 'list_payment_methods',
    domain: 'payments',
    kind: 'read',
    description: 'The user\'s payment methods with refs, types and which is the default.',
    params: obj({}),
  },
  {
    name: 'add_payment_method',
    domain: 'payments',
    kind: 'write',
    risk: 'approve',
    description: 'Propose a new payment method (a card, wallet or similar). A credit card also creates its debt. Bank accounts are added from the Accounts page, not here.',
    params: obj(
      {
        name: str('provider or bank, e.g. CIB'),
        type: oneOf(CARD_SETUP_TYPES),
        last4: str('4 digits, cards and accounts only'),
        currency: str('ISO code; default is the base currency'),
        makeDefault: bool(),
        color: str('#RRGGBB'),
      },
      ['name', 'type'],
    ),
  },
  {
    name: 'update_payment_method',
    domain: 'payments',
    kind: 'write',
    risk: 'approve',
    description: 'Propose changes to one payment method. Send only what changes.',
    params: obj({ ref: str('ref or exact name'), name: str(), last4: str('empty string removes it'), color: str('#RRGGBB'), makeDefault: bool() }, ['ref']),
  },
  {
    name: 'delete_payment_method',
    domain: 'payments',
    kind: 'write',
    risk: 'strong',
    description: 'Propose deleting a payment method; its expenses move to Cash.',
    params: obj({ ref: str('ref or exact name') }, ['ref']),
  },
]
