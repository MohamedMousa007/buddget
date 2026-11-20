import type { Snapshot } from './snapshot'

type Accounts = Snapshot['savingsAccounts']
type Ledger = Snapshot['savingsTransactions']

const effect = (t: Ledger[number]) => `${t.accountId}|${t.type}|${t.amount}`

/**
 * The server builds a pocket's balance from its ledger rows (0227): a new pocket is stored at 0 and its opening deposit
 * raises it, a withdrawal lowers it when its row arrives. A pocket copy read before this device's ledger rows landed
 * (a pull that overlaps a flush, or one that follows a flush whose ledger write failed) therefore shows a balance
 * without them. For those pockets the merge keeps the balance this device computed; the server row changes again when
 * the rows land, so the next pull brings its figure.
 *
 * Only rows that move money count: new ones, and ones whose pocket, direction or amount differ from the delivered copy.
 * ponytail: a ledger row deleted here and not yet delivered is not covered (the baseline diff gives ids only); add it if a delete is ever seen to bounce.
 */
export function holdUnsentBalances(merged: Accounts, local: Pick<Snapshot, 'savingsAccounts' | 'savingsTransactions'>, delivered: Ledger | undefined): Accounts {
  if (!delivered) return merged
  const sent = new Map(delivered.map((t) => [t.id, effect(t)]))
  const open = new Set(local.savingsTransactions.filter((t) => sent.get(t.id) !== effect(t)).map((t) => t.accountId))
  if (open.size === 0) return merged
  const mine = new Map(local.savingsAccounts.map((a) => [a.id, a.currentBalance]))
  return merged.map((a) => {
    const balance = open.has(a.id) ? mine.get(a.id) : undefined
    return balance === undefined || balance === a.currentBalance ? a : { ...a, currentBalance: balance }
  })
}
