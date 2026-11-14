/**
 * createSmsTransaction — the single classification dispatcher for SMS-parsed
 * transactions. Evaluates in a strict order so money-movements are never
 * mis-booked as spend or income:
 *  -1. ledger-sign guard (a credit is never booked as spend, whatever the tier said)
 *   0. own-wallet top-up (puts both legs in the transfer family)
 *   1. own-account reclassification (before the income branch)
 *   2. transfer / FX pairing (two-leg reconciliation)
 *   3. CC payoff → debt payment
 *   4. income → salary dedup
 *   5. ATM withdrawal → non-spend
 *   6. subscription-linked purchase
 *   7. default purchase
 *
 * Used by both /api/sms/parse (auto) and /api/sms/confirm (user-confirmed).
 */
import type { ServiceClient } from '@/lib/supabase/service'
import type { Database } from '@/lib/supabase/database.types'
import type {PostgrestError} from '@supabase/supabase-js'
import { bumpTemplateFailure } from '@/lib/sms/bumpTemplateFailure'
import {
  createSmsExpense,
  createSmsDebtPayment,
  createSmsInstallmentPayment,
  markExpenseRefunded,
  findRefundedTwin,
  mapKindToCategory,
  isIncomeKind,
  resolveExactPaymentMethod,
  providerOf,
  completeFxEvent,
  type SmsRowData,
  type SmsExpenseKind,
} from './createSmsExpense'
import {
  isOwnAccountTransfer,
  hasOppositeLegOnSameAccount,
  findOwnTransferCandidate,
  transferFeeTolerance,
  publishTransferLeg,
  pauseForSibling,
  countersOwnAccountDigits,
  rememberedOwnAnswer,
  recordOwnTransferEvidence,
  isOwnTopUpTarget,
  namesOwnStoredValue,
  retagSiblingAsTransfer,
  tryPairLeg,
  reconcileSibling,
  reconcileCcPayoffFundingLeg,
  attributeFundingToPayoff,
  type CcPayoffFundingLeg,
  type PairSibling,
} from './pairing'
import { detectLegDirection, guardDirection } from './directionGuard'
import { fxLegAction } from './fxEvent'
import { decideOwnTransfer } from './ownTransferDecision'
import { isDeclineMessage, findDeclineTwin, findRefundOriginal } from './refundMatch'
import { normalizeDigits } from './normalizeDigits'
import { matchSalary } from './matchSalary'
import { matchSubscription } from './matchSubscription'

export type SmsTxOutcome =
  | 'expense'
  | 'subscription'
  | 'atm'
  | 'income'
  | 'income_matched'
  | 'refund_matched'
  | 'refund_unmatched'
  | 'debt_payment'
  | 'transfer_single'
  | 'transfer_paired'
  | 'awaiting_confirmation'

export interface SmsTxResult {
  outcome: SmsTxOutcome
  /**
   * The kind AFTER reclassification, for the caller to persist.
   *
   * Load-bearing, not bookkeeping: `sms_try_pair` matches candidate legs on the
   * `kind` COLUMN, so a leg reclassified here is invisible to its own sibling
   * unless the new kind reaches the row. Persisting only `parsed.kind` silently
   * disables pairing for every leg step 0 or step 1 relabels.
   */
  kind: SmsExpenseKind
  expenseId: string | null
  incomeId: string | null
  debtPaymentId: string | null
  /** Final category applied (for logging/notification copy), when an expense was posted. */
  category: string | null
  /** Set for outcome 'awaiting_confirmation' — why confirmation is needed. */
  confirmReason: 'cc_ambiguous' | 'salary' | null
  /** Salary income source the SMS matched/should confirm against. */
  matchedSourceId: string | null
  /** Subscription the expense was linked to, if any. */
  linkedSubscriptionId: string | null
  error: PostgrestError | null
}

/** Ignore rounding noise; only post a fee that is actually a fee. */
const MIN_FEE = 0.5

/**
 * Posts the funding bank's transfer fee as its own row.
 *
 * The funding leg debits payoff + fee (12,012 for a 12,000 payoff). The payoff is
 * non-spend — the purchases it settles were already counted — but the fee is money
 * genuinely consumed and must hit spend. Splitting them keeps one payoff transaction
 * while staying accurate; the fee is knowable only by differencing the two legs.
 *
 * Takes both sides explicitly rather than reading them off `row`, because `row` is the
 * payoff leg in one arrival order and the funding leg in the other.
 */
async function postTransferFee(
  service: ServiceClient,
  row: SmsRowData,
  pair: { fundingLast4: string | null; fundingAmount: number | null; payoffAmount: number | null },
): Promise<void> {
  if (pair.fundingAmount == null || pair.payoffAmount == null) return
  const fee = pair.fundingAmount - pair.payoffAmount
  // Guard the sign too: a negative difference means the legs are not what we think, and
  // inventing a refund would be worse than skipping the fee.
  if (!(fee >= MIN_FEE)) return

  await service.from('expenses').insert({
    user_id: row.userId,
    expense_date: row.day,
    description: 'Transfer fee',
    category: 'Other',
    amount: fee,
    // Validated upstream by resolveCurrency; the column is an enum.
    currency: row.currency as Database['public']['Enums']['currency_code'],
    payment_method_id: await resolveExactPaymentMethod(service, row.userId, pair.fundingLast4),
    sms_log_id: row.logId ?? null,
  })
}

function base(outcome: SmsTxOutcome, kind: SmsExpenseKind): SmsTxResult {
  return {
    outcome,
    kind,
    expenseId: null,
    incomeId: null,
    debtPaymentId: null,
    category: null,
    confirmReason: null,
    matchedSourceId: null,
    linkedSubscriptionId: null,
    error: null,
  }
}

/**
 * The IPN reference both legs of an account-to-account transfer carry ("with reference
 * b3abc23b", "Ref# b3abc23b"). Anchored on the keyword so amounts and phone numbers
 * ("call 16607") never match; 6+ chars keeps it collision-safe (real refs are 8-hex).
 */
const IPN_REFERENCE =
  /(?:\bref(?:erence)?\b(?:\s+(?:number|no\.?))?|رقم\s*مرجع[يى]?)\s*#?\s*:?\s*(?=[a-z0-9]*\d)([a-z0-9]{6,})(?![a-z0-9])/i
/** An 8-digit token that reads as a calendar date (YYYYMMDD or DDMMYYYY) is a date, not a reference. */
const DATE_DIGITS =
  /^(?:(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])|(?:0[1-9]|[12]\d|3[01])(?:0[1-9]|1[0-2])(?:19|20)\d{2})$/
export function extractIpnReference(body: string): string | null {
  const ref = normalizeDigits(body).match(IPN_REFERENCE)?.[1] ?? null
  return ref && DATE_DIGITS.test(ref) ? null : ref
}

/**
 * Reconciles a claimed sibling into a single non-spend Transfer, whichever leg arrived first.
 * Shared by the wallet-movement block (step 0) and the IPN reference/fallback steps (1b/1c).
 */
async function finalizeOwnTransferPair(
  service: ServiceClient,
  row: SmsRowData,
  sibling: PairSibling,
  logId: string,
): Promise<SmsTxResult> {
  const { needsPost } = await reconcileSibling(service, sibling, logId)
  if (!needsPost) {
    // The sibling already carries the row. If it was the provisional Remittance of an outbound
    // leg, that guess is now disproved — retag it, or a transfer to your own account stays
    // booked as spending.
    if (sibling.siblingKind === 'instant_transfer_out') {
      await retagSiblingAsTransfer(service, sibling)
    }
    return base('transfer_paired', 'own_transfer')
  }
  // Sibling was booked as income (now soft-deleted) — post one visible non-spend row.
  const posted = await createSmsExpense(service, { ...row, kind: 'own_transfer' })
  return {
    ...base('transfer_paired', 'own_transfer'),
    expenseId: posted.expenseId,
    category: 'Transfer',
    error: posted.error,
  }
}

export async function createSmsTransaction(
  service: ServiceClient,
  parsedRow: SmsRowData,
  opts: { exchangeRates: Record<string, number>; userConfirmed?: boolean },
): Promise<SmsTxResult> {
  // -1. The bank's own ledger sign beats the tier's reading of the wording. A tier that got
  //     the direction wrong also wrote a title describing that wrong direction ("Transfer to
  //     103-104***-110" for an inbound wire), so the title goes with it. A named counterparty
  //     is still true either way and keeps precedence; only when there is none does the bank
  //     name get a direction-correct wrapper, so the row doesn't land in the ledger as "HSBC".
  const guardedKind = guardDirection(parsedRow.kind, normalizeDigits(parsedRow.rawBody))

  // N1 — a free, deterministic health oracle. The guard runs on every tier, so when it has to
  // override a TEMPLATE-parsed row the template's `kind` is provably wrong: the bank's own
  // ledger sign contradicts it. Until now the guard silently fixed such rows, which meant a
  // defective template kept its reputation while the guard quietly cleaned up after it. One hit
  // is enough to quarantine, where a shadow comparison decides its fate without user friction.
  if (guardedKind !== parsedRow.kind && parsedRow.matchedTemplateId) {
    try {
      await bumpTemplateFailure(service, {
        templateId: parsedRow.matchedTemplateId,
        hard: true,
        reason: `direction_guard_override: ${parsedRow.kind} -> ${guardedKind}`,
        userId: parsedRow.userId,
      })
    } catch (e) {
      // Health accounting must never break the transaction it is observing.
      console.warn('[sms/dispatch] direction-guard oracle failed', e)
    }
  }

  const row: SmsRowData =
    guardedKind === parsedRow.kind
      ? parsedRow
      : {
          ...parsedRow,
          kind: guardedKind,
          cleanTitle:
            guardedKind === 'instant_transfer_in' && !parsedRow.merchant && parsedRow.bankName
              ? `Transfer from ${parsedRow.bankName}`
              : null,
        }

  let kind: SmsExpenseKind = row.kind

  // 0. Movements involving the user's own STORED-VALUE methods (wallets, prepaid cards).
  //    Topping one up, and cashing one out, are neither spend nor income — but each emits
  //    two SMS that look like both:
  //      top-up:     bank "Online Purchase ... From: barq" + wallet "Money Added ..."
  //      withdrawal: wallet "Withdrawal ... to your bank" + bank "... credited from Barq"
  //    A wallet may have no card, so step 1's counterparty-last4 join often cannot see
  //    either leg — the method's NAME is the only handle. See docs/MONEY_MOVEMENT.md.
  if (
    (kind === 'purchase' || kind === 'online_purchase') &&
    (await isOwnTopUpTarget(service, row.userId, row.merchant, row.rawBody))
  ) {
    // Nobody buys goods from their own wallet, so this leg is unambiguous. It becomes a
    // transfer whether or not the wallet's own SMS ever arrives, and — because the caller
    // persists `kind` — becomes findable as a sibling by that SMS when it does.
    kind = 'own_transfer'
  } else if (
    (kind === 'income' || kind === 'instant_transfer_in' || kind === 'instant_transfer_out') &&
    (await namesOwnStoredValue(service, row.userId, row.rawBody))
  ) {
    // The stored-value method's OWN SMS. Not unambiguous in either direction: money added
    // to your wallet is real income when no card of yours funded it, and money leaving it
    // is a real remittance when it went to a person rather than to your own bank. So this
    // leg only becomes a transfer if the sibling is actually there to prove it.
    //
    // It has to ask here rather than fall through to step 2, which is reachable only from
    // own_transfer — and step 1 cannot promote it, because these SMS carry the OTHER
    // side's card number, which the template tier never maps to counterpartyLast4 at all.
    const outbound = kind === 'instant_transfer_out'
    // Keep a kind that is in matchKinds either way, so the sibling can find THIS leg in
    // the opposite arrival order.
    if (!outbound) kind = 'instant_transfer_in'
    if (row.logId && row.receivedAtIso) {
      const sibling = await tryPairLeg(service, {
        userId: row.userId,
        logId: row.logId,
        receivedAtIso: row.receivedAtIso,
        amount: row.amount,
        accountLast4: row.last4 ?? null,
        // 'own_transfer' for the exact-amount rule; a wallet movement has no fee to absorb.
        kind: 'own_transfer',
        // No cc_payoff: a payoff is settled by step 3, which needs its own funding leg. The
        // RPC claims whatever it matches, so merely ignoring a payoff here would still burn
        // its one pairing slot and leave it unable to ever find that leg — the double-count
        // a34d517 fixed. Excluding it means it is never claimed in the first place.
        matchKinds: ['own_transfer', 'instant_transfer_in', 'instant_transfer_out'],
      })
      if (sibling) return finalizeOwnTransferPair(service, row, sibling, row.logId)
    }
    // No sibling: genuine income (inbound) or a real remittance (outbound). Falls through.
  }

  // 1. Own-account reclassification — an inbound/outbound transfer whose
  //    counterparty is a registered own account is a Transfer, not income/spend.
  //    Only an account the user confirmed counts here. The counterparty being the user by NAME never settles
  //    anything: it is one supporting signal of the decision in 1b, where it can only raise a question.
  /** The reclassified leg is the receiving side, so its own account is the transfer's destination. */
  let destinationLeg = false
  if (
    (kind === 'instant_transfer_in' || kind === 'instant_transfer_out') &&
    (await isOwnAccountTransfer(service, row.userId, row.counterpartyLast4 ?? null))
  ) {
    destinationLeg = kind === 'instant_transfer_in'
    kind = 'own_transfer'
  }

  // 1b/1c. Account-to-account IPN transfer between the user's OWN accounts. IPN SMS identify the
  //   counterparty only by name (outbound) or not at all (inbound), so step 1's last4 join never
  //   sees them and the transfer was booked as Remittance + income. Both paths below only claim
  //   a sibling that actually exists — a real remittance to someone else has no inbound leg on
  //   this phone, so it stays spend.
  if (
    (kind === 'instant_transfer_in' || kind === 'instant_transfer_out') &&
    row.logId &&
    row.receivedAtIso
  ) {
    // Opposite direction only, plus own_transfer (a sibling the last4 path already promoted).
    // Never cc_payoff (step 3 owns its funding leg) or plain income (a salary is not a transfer).
    const matchKinds =
      kind === 'instant_transfer_out'
        ? ['instant_transfer_in', 'own_transfer']
        : ['instant_transfer_out', 'own_transfer']

    // 1b. Several signals decide, never one (ownTransferDecision.ts). The candidate is only READ here; it is claimed
    //     below and only when the evidence is strong. Everything found is logged with both rows either way.
    const reference = extractIpnReference(row.rawBody)
    // Two legs arriving together each look before the other has persisted anything: publish this leg first, and
    // look a second time after a short pause when the first look finds nothing.
    await publishTransferLeg(service, { logId: row.logId, kind, amount: row.amount, accountLast4: row.last4 ?? null, counterpartyHash: row.counterpartyHash ?? null })
    const lookFor = { userId: row.userId, logId: row.logId, receivedAtIso: row.receivedAtIso, amount: row.amount, kind, reference }
    const candidate = (await findOwnTransferCandidate(service, lookFor)) ?? (await pauseForSibling().then(() => findOwnTransferCandidate(service, lookFor)))
    const mine = row.last4 ?? null
    const theirs = candidate?.accountLast4 ?? null
    const decision = decideOwnTransfer({
      differentAccounts: !!mine && !!theirs && mine !== theirs,
      // The same account on both legs is money passing through the user: never an own transfer.
      sameAccount: (!!mine && !!theirs && mine === theirs) ||
        (await hasOppositeLegOnSameAccount(service, { userId: row.userId, logId: row.logId, receivedAtIso: row.receivedAtIso, amount: row.amount, accountLast4: mine, kind })),
      sameDevice: !!candidate && !!row.deviceId && !!candidate.deviceId && row.deviceId === candidate.deviceId,
      amountsEqual: !!candidate && Math.abs(candidate.amount - row.amount) < 0.005,
      withinFee: !!candidate && Math.abs(candidate.amount - row.amount) <= transferFeeTolerance(Math.max(candidate.amount, row.amount)),
      sameReference: candidate?.sameReference ?? false,
      sameCounterpartyHash: !!candidate && !!row.counterpartyHash && row.counterpartyHash === candidate.counterpartyHash,
      counterpartyIsOwnAccount: await countersOwnAccountDigits(service, row.userId, row.counterpartyLast4 ?? null),
      counterpartyIsProfileName: row.counterpartyIsSelf === true,
      answered: candidate ? await rememberedOwnAnswer(service, row.userId, mine, theirs) : null,
    })
    await recordOwnTransferEvidence(service, row.logId, candidate?.id ?? null, decision)

    let sibling: PairSibling | null = null
    if (decision.verdict === 'settle' && candidate) {
      sibling = await tryPairLeg(service, {
        userId: row.userId,
        logId: row.logId,
        receivedAtIso: row.receivedAtIso,
        amount: row.amount,
        accountLast4: mine,
        matchKinds,
        // By reference when both legs carry it (the amounts may differ by the fee); otherwise the exact amount.
        ...(candidate.sameReference && reference ? { kind, reference } : { kind: 'own_transfer' as const }),
      })
    }

    if (sibling) return finalizeOwnTransferPair(service, row, sibling, row.logId)
    // No sibling: genuine income (inbound) or a real remittance (outbound). Falls through.
  }

  // 2a. Currency exchange: one event, one row. The debited account is its source and the credited account its
  //     destination, whichever message arrives first; the credit leg never books the account the money left.
  if (kind === 'currency_exchange') {
    const direction = detectLegDirection(normalizeDigits(row.rawBody))
    const sibling = row.logId && row.receivedAtIso
      ? await tryPairLeg(service, {
          userId: row.userId,
          logId: row.logId,
          receivedAtIso: row.receivedAtIso,
          amount: row.amount,
          accountLast4: row.last4 ?? null,
          kind,
          currency: row.currency,
          direction,
        })
      : null
    const action = fxLegAction(direction, !!sibling?.siblingExpenseId)
    if (sibling?.siblingExpenseId && action.type === 'complete') {
      await completeFxEvent(service, row, sibling.siblingExpenseId, action.set)
      return base('transfer_paired', kind)
    }
    // A sibling that was booked as income is retracted; this leg then posts the one row.
    if (sibling && row.logId) await reconcileSibling(service, sibling, row.logId)
    const posted = await createSmsExpense(service, { ...row, kind, destinationLeg: direction === 'credit' })
    return {
      ...base(sibling ? 'transfer_paired' : 'transfer_single', kind),
      expenseId: posted.expenseId,
      category: 'Currency Exchange',
      error: posted.error,
    }
  }

  // 2. Own transfer — pair the two legs, represent the pair once (non-spend).
  if (kind === 'own_transfer') {
    if (row.logId && row.receivedAtIso) {
      const sibling = await tryPairLeg(service, {
        userId: row.userId,
        logId: row.logId,
        receivedAtIso: row.receivedAtIso,
        amount: row.amount,
        accountLast4: row.last4 ?? null,
        kind,
      })
      if (sibling) {
        // This leg funded a credit-card payoff that already posted. The payoff row is the
        // better representation (it drives the debt payment), so post no Transfer row —
        // otherwise the user sees the same money twice, which is the whole bug. Back-fill
        // the funding account the payoff could not know, and keep the fee it took on top.
        if (sibling.siblingKind === 'cc_payoff') {
          const fundingPmId = await resolveExactPaymentMethod(service, row.userId, row.last4, providerOf(row))
          const { payoffAmount } = await attributeFundingToPayoff(service, sibling, fundingPmId)
          await postTransferFee(service, row, {
            fundingLast4: row.last4 ?? null,
            // This leg IS the funding side, so the fee is what it debited beyond the payoff.
            fundingAmount: row.amount,
            payoffAmount,
          })
          return base('transfer_paired', kind)
        }

        const { needsPost } = await reconcileSibling(service, sibling, row.logId)
        if (!needsPost) return base('transfer_paired', kind)
        // Income sibling was removed — post a single visible non-spend row.
        const posted = await createSmsExpense(service, { ...row, kind, destinationLeg })
        return {
          ...base('transfer_paired', kind),
          expenseId: posted.expenseId,
          category: 'Transfer',
          error: posted.error,
        }
      }
    }
    const res = await createSmsExpense(service, { ...row, kind, destinationLeg })
    return {
      ...base('transfer_single', kind),
      expenseId: res.expenseId,
      category: 'Transfer',
      error: res.error,
    }
  }

  // 3. CC payoff → debt payment, funded from the paired bank leg.
  if (kind === 'cc_payoff') {
    // Claim the funding leg. Paying a card by Instapay emits two SMS — the funding bank
    // ("12,012 sent to ••2016", which step 1 reclassifies to own_transfer because the
    // counterparty is the user's own card) and the card bank ("12,000 received"). They
    // are the same money, so without this the user sees the payoff twice; the amounts
    // differ only by the transfer fee, which `pairAmountTolerance` allows for.
    let funding: CcPayoffFundingLeg | null = null
    if (row.logId && row.receivedAtIso) {
      const sibling = await tryPairLeg(service, {
        userId: row.userId,
        logId: row.logId,
        receivedAtIso: row.receivedAtIso,
        amount: row.amount,
        accountLast4: row.last4 ?? null,
        kind,
      })
      if (sibling) funding = await reconcileCcPayoffFundingLeg(service, sibling, row.logId)
    }

    const res = await createSmsDebtPayment(service, row, { fundingLast4: funding?.fundingLast4 })
    if (res.needsConfirm) {
      // Ambiguous (several cards, foreign currency, gold, overpay): never guess a debt. The row waits for the user
      // (pending confirmation); /confirm re-runs this with userConfirmed and then takes the plain fallback below.
      if (!opts.userConfirmed) return { ...base('awaiting_confirmation', kind), confirmReason: 'cc_ambiguous' }
      // Confirmed: post a non-spend CC Payoff expense with NO card linkage (last4 null) so spend
      // totals stay correct and the card balance isn't wrongly inflated. The
      // debt is not auto-reduced; the user can attach it.
      const fb = await createSmsExpense(service, { ...row, kind, last4: null })
      return { ...base('expense', kind), expenseId: fb.expenseId, category: 'CC Payoff', error: fb.error }
    }

    // The fee the funding bank took on top. It is real spend and must count — only the
    // payoff itself is non-spend. Derivable only from the pair. Here `row` is the payoff.
    await postTransferFee(service, row, {
      fundingLast4: funding?.fundingLast4 ?? null,
      fundingAmount: funding?.fundingAmount ?? null,
      payoffAmount: row.amount,
    })

    return {
      ...base('debt_payment', kind),
      expenseId: res.expenseId,
      debtPaymentId: res.debtPaymentId,
      category: 'CC Payoff',
      error: res.error,
    }
  }

  // 3b. Installment payment → debt payment against a matching installment plan.
  if (kind === 'installment_payment') {
    const res = await createSmsInstallmentPayment(service, row)
    if (res.needsConfirm) {
      // Couldn't confidently pick a plan: wait for the user (pending confirmation). Once confirmed, book a plain
      // non-spend Installment expense (no debt reduced); the user assigns it to a plan via
      // the in-view banner / review UI. Never guess which plan a payment belongs to.
      if (!opts.userConfirmed) return { ...base('awaiting_confirmation', kind), confirmReason: 'cc_ambiguous' }
      const fb = await createSmsExpense(service, { ...row, kind, last4: null })
      return { ...base('expense', kind), expenseId: fb.expenseId, category: 'Installment', error: fb.error }
    }
    return {
      ...base('debt_payment', kind),
      expenseId: res.expenseId,
      debtPaymentId: res.debtPaymentId,
      category: 'Installment',
      error: res.error,
    }
  }

  // 3.5 Decline / refund. A decline moved no money: it never reads or changes a row it did not create (I2), and books
  //     one net-zero row of its own. A refund (reversal wording included) stamps one earlier message's row, matched
  //     from messages (I1), and with no match is booked outside income and outside spending, flagged, and asks.
  if (kind === 'refund' || kind === 'declined') {
    if (isDeclineMessage(kind, row.rawBody)) {
      // A repeat of the same decline within 3 days acknowledges against the earlier decline's own row, only.
      const twin = await findDeclineTwin(service, row)
      if (twin) {
        return { ...base('refund_matched', kind), expenseId: twin.id, category: twin.category }
      }
      // Booked as kind `declined` even when the tier said refund: a refund-kind row would take the income path.
      const res = await createSmsExpense(service, {
        ...row,
        kind: 'declined',
        refundMark: { refundKind: 'declined', day: row.day },
        noProvisionalAccount: true,
      })
      return {
        ...base('expense', 'declined'),
        expenseId: res.expenseId,
        category: mapKindToCategory('declined', row.categoryHint, row.rawBody),
        error: res.error,
      }
    }
    // Duplicate guard: the same refund re-sent as differently-worded SMS. A refund of the same amount on the same
    // card was already stamped within ±3 days, so ack against it instead of reversing a second unrelated charge.
    const twin = await findRefundedTwin(service, row)
    if (twin) {
      return { ...base('refund_matched', kind), expenseId: twin.id, category: twin.category }
    }
    const original = await findRefundOriginal(service, row)
    if (original) {
      const { error } = await markExpenseRefunded(service, original.id, 'refunded', row.day, row.logId)
      return { ...base('refund_matched', kind), expenseId: original.id, category: original.category, error }
    }
    const res = await createSmsExpense(service, { ...row, kind, unmatchedRefund: true, smsFlags: ['refund_unmatched'] })
    return {
      ...base('refund_unmatched', kind),
      expenseId: res.expenseId,
      category: mapKindToCategory(kind, row.categoryHint, row.rawBody),
      error: res.error,
    }
  }

  // 4. Income → salary matching. A confident match posts the ACTUAL received
  //    amount as an event LINKED to the recurring template (templateId), so the
  //    income tab can show projected vs actual (on-time/late/±Δ). A close-but-off
  //    match (e.g. a raise) asks the user first; on confirm we post it linked too.
  //    Only a genuinely new credit is captured as unlinked one-time income.
  if (isIncomeKind(kind)) {
    const decision = await matchSalary(service, {
      userId: row.userId,
      amount: row.amount,
      currency: row.currency,
      day: row.day,
      exchangeRates: opts.exchangeRates,
      body: row.rawBody,
      counterparty: row.merchant ?? null,
    })
    if (decision.outcome === 'matched' || (decision.outcome === 'confirm' && opts.userConfirmed)) {
      // Stamping the payday is what makes the event pair deterministically. Without it
      // `buildOccurrences` falls back to POSITIONAL pairing, and a paycheck banked days
      // late fills the wrong month's payday while its own shows as missed.
      const res = await createSmsExpense(service, {
        ...row,
        kind,
        templateId: decision.sourceId,
        occurrenceDate: decision.occurrenceDate,
      })
      return { ...base('income', kind), incomeId: res.incomeId, matchedSourceId: decision.sourceId, error: res.error }
    }
    if (decision.outcome === 'confirm') {
      return { ...base('income_matched', kind), matchedSourceId: decision.sourceId, confirmReason: 'salary' }
    }
    const res = await createSmsExpense(service, { ...row, kind })
    return { ...base('income', kind), incomeId: res.incomeId, error: res.error }
  }

  // 5. ATM withdrawal → non-spend (category mapped in createSmsExpense).
  if (kind === 'atm_withdrawal') {
    const res = await createSmsExpense(service, { ...row, kind })
    return { ...base('atm', kind), expenseId: res.expenseId, category: 'ATM Cash Withdrawal', error: res.error }
  }

  // 6. Purchase / online purchase → subscription linking, then expense.
  let linkedSubscriptionId: string | null = null
  if (kind === 'purchase' || kind === 'online_purchase') {
    const sub = await matchSubscription(service, {
      userId: row.userId,
      merchant: row.merchant,
      merchantNormalized: row.merchantNormalized,
      amount: row.amount,
      currency: row.currency,
      day: row.day,
      exchangeRates: opts.exchangeRates,
    })
    if (sub) {
      linkedSubscriptionId = sub.subscriptionId
      // The charge matched a DIFFERENT catalog plan. Never auto-applied (a proration or
      // promo can look like a switch) — park it on the row so the app can prompt, and only
      // when nothing is already pending so a re-charge doesn't overwrite an earlier detection.
      if (sub.planChange) {
        await service
          .from('subscriptions')
          .update({
            pending_plan_id: sub.planChange.planId,
            pending_amount: sub.planChange.chargedAmount,
            pending_plan_from: row.day,
          })
          .eq('id', sub.subscriptionId)
          .is('pending_plan_id', null)
      }
    }
  }

  const res = await createSmsExpense(service, {
    ...row,
    kind,
    linkedSubscriptionId,
    categoryOverride: linkedSubscriptionId ? 'Subscription' : null,
  })
  return {
    ...base(linkedSubscriptionId ? 'subscription' : 'expense', kind),
    expenseId: res.expenseId,
    category: linkedSubscriptionId ? 'Subscription' : null,
    linkedSubscriptionId,
    error: res.error,
  }
}
