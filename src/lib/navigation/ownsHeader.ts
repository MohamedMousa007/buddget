/**
 * Routes that draw their own header right under the status bar (Paydays and Subscriptions, with their back
 * button), so the shell's mobile wordmark bar steps aside. Flow keeps the bar: its month
 * row is a sub-header below it.
 */
const OWN_HEADER = new Set(['/paydays', '/subscriptions'])

export function ownsHeader(path: string): boolean {
  return OWN_HEADER.has(path)
}
