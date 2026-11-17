import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ rpc }) }))
import { applyCosmetic, buyShopItem, fetchCredits, fetchWeekSummary, formatFounderNumber, keepWeek, requestCreditName } from './loyaltyApi'

beforeEach(() => rpc.mockReset())

describe('loyaltyApi', () => {
  it('pads the founder number to three digits', () => {
    expect(formatFounderNumber(23)).toBe('#023')
    expect(formatFounderNumber(100)).toBe('#100')
  })
  it('keepWeek passes the week through and returns the server result', async () => {
    rpc.mockResolvedValue({ data: { status: 'kept', streak: 3, points: 10, freezes: 0 }, error: null })
    expect(await keepWeek('2026-11-09')).toEqual({ status: 'kept', streak: 3, points: 10, freezes: 0 })
    expect(rpc).toHaveBeenCalledWith('loyalty_record_week_check', { p_week: '2026-11-09' })
  })
  it('a failed call is an error result, never a thrown one', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'x' } })
    expect(await keepWeek('2026-11-09')).toEqual({ status: 'error' })
    expect(await fetchWeekSummary()).toBeNull()
    expect(await fetchCredits()).toEqual([])
    expect(await requestCreditName('Name')).toBe('error')
  })
  it('buys from the shop and applies a cosmetic through the server', async () => {
    rpc.mockResolvedValue({ data: { status: 'ok', balance: 40, week: null }, error: null })
    expect(await buyShopItem('streak_freeze')).toEqual({ status: 'ok', balance: 40, week: null })
    expect(rpc).toHaveBeenCalledWith('loyalty_shop_buy', { p_item: 'streak_freeze' })
    rpc.mockResolvedValue({ data: 'not_owned', error: null })
    expect(await applyCosmetic('card_finish', 'aurora')).toBe('not_owned')
    rpc.mockResolvedValue({ data: null, error: { message: 'x' } })
    expect(await buyShopItem('streak_freeze')).toEqual({ status: 'error' })
  })
  it('requests a name and reads the list', async () => {
    rpc.mockResolvedValue({ data: 'pending', error: null })
    expect(await requestCreditName('A name')).toBe('pending')
    rpc.mockResolvedValue({ data: [{ number: 1, credit_name: null }], error: null })
    expect(await fetchCredits()).toEqual([{ number: 1, credit_name: null }])
  })
})
