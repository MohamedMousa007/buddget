/** Digits in an emailed one-time code. Must match Supabase Auth > Email OTP length. */
export const EMAIL_OTP_LENGTH = 6

/**
 * What a change to box `i` of the OTP row does. `digits` is the code so far (Latin digits, no gaps); `typed` is the
 * box's new value, already in Latin digits. Returns the new code and the box to focus next.
 */
export function placeOtpDigit(digits: string, i: number, typed: string): { code: string; focus: number } {
  let cleaned = typed.replace(/\D/g, '')
  // Typing over a filled box gives two characters (old + new): keep the new one, it is not an autofill (BUD-111).
  const prev = digits[i]
  if (prev && cleaned.length === 2) cleaned = cleaned.startsWith(prev) ? cleaned[1] : cleaned[0]
  // Autofill / QuickType inserts the whole code into one box: distribute it.
  if (cleaned.length > 1) {
    const code = cleaned.slice(0, EMAIL_OTP_LENGTH)
    return { code, focus: Math.min(code.length, EMAIL_OTP_LENGTH - 1) }
  }
  // The code has no gaps: a digit typed past the first empty box lands in that empty box instead.
  const at = cleaned ? Math.min(i, digits.length) : i
  const padded = (digits + ' '.repeat(EMAIL_OTP_LENGTH)).slice(0, EMAIL_OTP_LENGTH).split('')
  padded[at] = cleaned || ' '
  const code = padded.join('').replace(/ /g, '')
  return { code, focus: cleaned && at < EMAIL_OTP_LENGTH - 1 ? at + 1 : at }
}
