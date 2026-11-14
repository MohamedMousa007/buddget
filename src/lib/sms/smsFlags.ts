export const SMS_FLAGS = [
  'possible_duplicate',
  'date_unsure',
  'refund_unmatched',
  'model_kind_unproven',
  'cash_deposit',
  'card_load',
  'wallet_unregistered',
  'topup_repaired',
] as const

export type SmsFlag = (typeof SMS_FLAGS)[number]

export type StampedFlag = SmsFlag

/** Prefix of the data entry a repaired top-up carries beside `topup_repaired`: the category the row had before. Not a flag. */
export const TOPUP_PREV_PREFIX = 'topup_prev:'

/** The known flags the server stamped on a row that the user has not dismissed. Unknown entries (new flags, `topup_prev:` data) are ignored. */
export function openSmsFlags(row: { smsFlags?: string[]; smsFlagsAck?: string[] }): SmsFlag[] {
  const stamped = row.smsFlags ?? []
  const acked = row.smsFlagsAck ?? []
  return SMS_FLAGS.filter((f) => stamped.includes(f) && !acked.includes(f))
}

/** The category a repaired top-up had before the repair, from its `topup_prev:` entry, or null. */
export function repairedPrevCategory(flags: readonly string[] | null | undefined): string | null {
  const entry = (flags ?? []).find((f) => f.startsWith(TOPUP_PREV_PREFIX))
  const value = entry?.slice(TOPUP_PREV_PREFIX.length)
  return value ? value : null
}
