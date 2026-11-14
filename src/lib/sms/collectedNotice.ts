/**
 * A money-transfer service tells the SENDER that the receiver has collected the transfer. The money left the sender's
 * account when the transfer was sent, so the notice is neither income nor a new expense. A learned template used to read
 * it as a credit (S2b2 P1-5), so the verdict is deterministic and runs before every tier.
 */
import { normalizeDigits } from '@/lib/sms/normalizeDigits'

/** Past or perfect tense only: a future or ready-to-collect wording describes a transfer that was just sent. */
const EN_COLLECTED_VERB = String.raw`\b(?:has|have|had|was|were)\s+(?:been\s+)?(?:successfully\s+)?(?:collected|picked\s+up|cashed\s+out|received\s+by\s+(?:the\s+)?(?:beneficiary|receiver|recipient))\b`
const EN_TRANSFER_COLLECTED = new RegExp(String.raw`\b(?:transfer|remittance|transaction|money|funds)\b[\s\S]{0,100}?${EN_COLLECTED_VERB}`, 'i')

const EN_RECEIVER_COLLECTED =
  /\b(?:beneficiary|receiver|recipient)\b[\s\S]{0,40}?\b(?:has\s+|have\s+)?(?:collected|picked\s+up|received)\b[\s\S]{0,40}?\b(?:transfer|remittance|money|funds)\b/i

const AR_TRANSFER = /حوال[ةه]|تحويل/
const AR_COLLECTED = /تم\s*(?:استلام|صرف)|استلم|استلام/
const AR_RECEIVER = /(?:ل|ال)(?:مستفيد|مستلم)/

/** Wording about a collection that has not happened yet: the message is then the send confirmation, which is spending. */
const FUTURE_COLLECTION = /\b(?:will\s+be|to\s+be|can\s+be|ready\s+(?:for|to)|available\s+for\s+(?:collection|pick\s*up))\b|سيتم/i

/** A sending verb that states THIS message is the send. */
const SENDING = /\b(?:sent|transferred)\b/i

/**
 * "The transfer you sent has been collected" uses the sending verb to name the transfer, not to report a send: a verb
 * that sits in the same sentence right before the collected wording is dropped before the sending test.
 */
const SENDING_THAT_NAMES_THE_TRANSFER = new RegExp(String.raw`\b(?:sent|transferred)\b[^.!?]{0,60}?(?=${EN_COLLECTED_VERB})`, 'gi')

/**
 * Wording that books a movement on the user's own account. A message that says so is a transaction whatever else it
 * mentions, so the notice rule leaves it to the tiers.
 */
const OWN_ACCOUNT_MOVEMENT =
  /\b(?:credited|debited|deducted|withdrawn|charged)\b|\b(?:received|deposited)\s+(?:in|into|to)\s+your\s+account\b|تم\s*(?:إيداع|خصم)|(?:إلى|الى|في|من)\s+حسابك/i

export function isCollectedNotice(rawText: string): boolean {
  const text = normalizeDigits(rawText)
  if (OWN_ACCOUNT_MOVEMENT.test(text) || FUTURE_COLLECTION.test(text)) return false
  if (SENDING.test(text.replace(SENDING_THAT_NAMES_THE_TRANSFER, ''))) return false
  if (EN_TRANSFER_COLLECTED.test(text) || EN_RECEIVER_COLLECTED.test(text)) return true
  return AR_TRANSFER.test(text) && AR_COLLECTED.test(text) && AR_RECEIVER.test(text)
}
