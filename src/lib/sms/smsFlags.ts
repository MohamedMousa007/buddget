export const SMS_FLAGS = ['possible_duplicate', 'date_unsure', 'refund_unmatched', 'model_kind_unproven', 'cash_deposit'] as const

export type SmsFlag = (typeof SMS_FLAGS)[number]

/** The known flags the server stamped on a row that the user has not dismissed. Unknown flag names are ignored. */
export function openSmsFlags(row: { smsFlags?: string[]; smsFlagsAck?: string[] }): SmsFlag[] {
  const stamped = row.smsFlags ?? []
  const acked = row.smsFlagsAck ?? []
  return SMS_FLAGS.filter((f) => stamped.includes(f) && !acked.includes(f))
}
