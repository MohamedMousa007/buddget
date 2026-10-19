/**
 * What an amount box should show while its number is also stored elsewhere: the text being typed
 * ("1.", "", "0.50") for as long as it still means the stored number, otherwise the stored number.
 */
export function reconcileTyped(typed: string, stored: number): string {
  return (Number(typed) || 0) === stored ? typed : String(stored)
}
