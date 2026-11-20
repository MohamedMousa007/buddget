/**
 * Moving the user needs a yes per chat and per place (BDG-015): approving "Open Debts" never authorises "Budget Builder".
 * New chat and sign-out forget every yes.
 */
const consented = new Set<string>()

/** The place a navigation call goes to: the tool plus its target (screen, setting or sheet). */
export const navKey = (tool: string, args: Record<string, unknown>): string => `${tool}:${String(args.screen ?? args.setting ?? args.sheet ?? '')}`

export const hasNavConsent = (key: string): boolean => consented.has(key)
export const grantNavConsent = (key: string): void => {
  consented.add(key)
}
export const resetNavConsent = (): void => {
  consented.clear()
}
