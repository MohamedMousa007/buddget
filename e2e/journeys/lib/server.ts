/* eslint-disable @typescript-eslint/no-explicit-any -- test code reads untyped store and PostgREST JSON */
import { expect } from '@playwright/test'
import { rows } from './admin'

/** Polls a synthetic user's server rows until `ok` holds (the client flushes on a ~500 ms debounce). */
export async function serverRows<T = any>(table: string, userId: string, query: string, ok: (r: T[]) => boolean, timeout = 30_000): Promise<T[]> {
  let last: T[] = []
  await expect
    .poll(async () => {
      last = await rows<T>(table, userId, query)
      return ok(last)
    }, { timeout, message: `server ${table} ${query}` })
    .toBe(true)
  return last
}

/** Single read without waiting. */
export const serverNow = rows
