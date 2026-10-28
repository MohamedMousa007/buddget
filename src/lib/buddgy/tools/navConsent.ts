/** Moving the user between screens needs one yes per session; after that Buddgy may navigate directly. */
let consented = false

export const hasNavConsent = (): boolean => consented
export const grantNavConsent = (): void => {
  consented = true
}
export const resetNavConsent = (): void => {
  consented = false
}
