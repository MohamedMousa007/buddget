/** Push kinds whose tap must open the review sheet: a body tap never books a transaction. */
export const SMS_REVIEW_PUSH_KINDS: ReadonlySet<string> = new Set(['sms_confirm', 'sms_sender_held'])

export const SMS_SENDER_HELD_PUSH_KIND = 'sms_sender_held'
