/**
 * Routes that draw their own header right under the status bar (Flow and Paydays), so the
 * shell's mobile wordmark bar steps aside. Includes Flow's Expenses/Income aliases.
 */
const OWN_HEADER = new Set(['/flow', '/expenses', '/income', '/paydays'])

export function ownsHeader(path: string): boolean {
  return OWN_HEADER.has(path)
}
