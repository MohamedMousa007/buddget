export const SMS_FLAGS = ['possible_duplicate', 'date_unsure', 'refund_unmatched', 'model_kind_unproven', 'cash_deposit'] as const

export type SmsFlag = (typeof SMS_FLAGS)[number]

/** Stamped by the server but not yet asked about in the app; each joins SMS_FLAGS when its prompt exists. */
export const SERVER_ONLY_FLAGS = ['wallet_unregistered', 'card_load'] as const

export type StampedFlag = SmsFlag | (typeof SERVER_ONLY_FLAGS)[number]

/** The known flags the server stamped on a row that the user has not dismissed. Unknown flag names are ignored. */
export function openSmsFlags(row: { smsFlags?: string[]; smsFlagsAck?: string[] }): SmsFlag[] {
  const stamped = row.smsFlags ?? []
  const acked = row.smsFlagsAck ?? []
  return SMS_FLAGS.filter((f) => stamped.includes(f) && !acked.includes(f))
}
