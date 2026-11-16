// A sign-out the app makes on purpose mid-flow (e.g. dropping the password session before the 2FA email code)
// must not read as "your session expired". Set it right before signOut; AuthProvider consumes it on SIGNED_OUT.
let expected = false

export function expectSignOut(): void {
  expected = true
}

export function consumeExpectedSignOut(): boolean {
  const was = expected
  expected = false
  return was
}
