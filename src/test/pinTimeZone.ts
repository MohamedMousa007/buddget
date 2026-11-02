import { afterAll, beforeAll } from 'vitest'

/** Runs a test file in one time zone whatever the runner's, then puts the runner's zone back. For fixtures written around a fixed wall clock. */
export function pinTimeZone(zone: string): void {
  const before = process.env.TZ
  beforeAll(() => {
    process.env.TZ = zone
  })
  afterAll(() => {
    if (before === undefined) delete process.env.TZ
    else process.env.TZ = before
  })
}
