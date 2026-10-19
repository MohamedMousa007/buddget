import { describe, expect, it } from 'vitest'
import { formatLocalAnswer, matchLocalQuestion, type LocalAnswerId } from '../localAnswers'

const matches: [string, 'en' | 'ar', LocalAnswerId][] = [
  ['How much did I spend this month?', 'en', 'spent_month'],
  ["how much have i spent so far", 'en', 'spent_month'],
  ['how much did I spend this month', 'en', 'spent_month'],
  ['my spending this month', 'en', 'spent_month'],
  ["What's my total spending so far?", 'en', 'spent_month'],
  ['كم صرفت هذا الشهر؟', 'ar', 'spent_month'],
  ['كام صرفت الشهر ده', 'ar', 'spent_month'],
  ['صرفت كام لحد دلوقتي؟', 'ar', 'spent_month'],
  ['مصاريفي الشهر دا', 'ar', 'spent_month'],
  ["What's left to spend?", 'en', 'left_to_spend'],
  ['how much do I have left this month?', 'en', 'left_to_spend'],
  ['how much is left', 'en', 'left_to_spend'],
  ['whats left?', 'en', 'left_to_spend'],
  ['كام فاضل معايا؟', 'ar', 'left_to_spend'],
  ['فاضل كام الشهر ده', 'ar', 'left_to_spend'],
  ['كم تبقى لي هذا الشهر؟', 'ar', 'left_to_spend'],
  ['How much can I spend per day?', 'en', 'safe_daily'],
  ["what's my daily budget", 'en', 'safe_daily'],
  ['safe daily amount', 'en', 'safe_daily'],
  ['اقدر اصرف كام النهاردة؟', 'ar', 'safe_daily'],
  ['كام اقدر اصرف يوميا', 'ar', 'safe_daily'],
  ['ميزانيتي اليومية', 'ar', 'safe_daily'],
  ["what's my top category this month?", 'en', 'top_category'],
  ['where does my money go', 'en', 'top_category'],
  ['what did I spend the most on?', 'en', 'top_category'],
  ['اكتر حاجة صرفت عليها الشهر ده', 'ar', 'top_category'],
  ['فلوسي بتروح فين؟', 'ar', 'top_category'],
]

const nulls: [string, 'en' | 'ar'][] = [
  ['', 'en'],
  ['how much did I spend on coffee this month?', 'en'],
  ['how much did I spend last month?', 'en'],
  ['how much did I spend', 'en'],
  ['how much is left on my credit card', 'en'],
  ['what is left of my debt to ahmed', 'en'],
  ['coffee 45', 'en'],
  ['should I spend less this month', 'en'],
  ['كم صرفت على القهوة الشهر ده', 'ar'],
  ['كم صرفت الشهر اللي فات', 'ar'],
  ['hello', 'en'],
]

describe('matchLocalQuestion', () => {
  it.each(matches)('%s -> %s', (text, locale, id) => {
    expect(matchLocalQuestion(text, locale)).toEqual({ id, read: { tool: 'get_summary', args: {} } })
  })

  it.each(nulls)('null: %j', (text, locale) => {
    expect(matchLocalQuestion(text, locale)).toBeNull()
  })

  it('matches the other language as a fallback', () => {
    expect(matchLocalQuestion('كم صرفت هذا الشهر', 'en')?.id).toBe('spent_month')
  })
})

describe('formatLocalAnswer', () => {
  const summary = {
    currency: 'EGP',
    spent: 4200,
    left_to_spend: 8800,
    safe_daily: 650,
    days_left: 13,
    income_declared: true,
    top_categories: [{ name: 'Food', spent: 1500 }],
  }

  it('renders each id in English', () => {
    expect(formatLocalAnswer('spent_month', summary, 'en')).toBe("You've spent 4,200 EGP this month.")
    expect(formatLocalAnswer('left_to_spend', summary, 'en')).toBe('You have 8,800 EGP left to spend this month.')
    expect(formatLocalAnswer('safe_daily', summary, 'en')).toBe('You can safely spend 650 EGP a day for the next 13 days.')
    expect(formatLocalAnswer('top_category', summary, 'en')).toBe('Your top category this month is Food at 1,500 EGP.')
  })

  it('renders Arabic', () => {
    expect(formatLocalAnswer('spent_month', summary, 'ar')).toContain('4,200 EGP')
  })

  it('reports overspend', () => {
    expect(formatLocalAnswer('left_to_spend', { ...summary, left_to_spend: -300 }, 'en')).toBe("You're over by 300 EGP this month.")
  })

  it('declines when the data cannot support an answer', () => {
    expect(formatLocalAnswer('left_to_spend', { ...summary, income_declared: false }, 'en')).toBeNull()
    expect(formatLocalAnswer('top_category', { ...summary, top_categories: [] }, 'en')).toBeNull()
    expect(formatLocalAnswer('spent_month', { currency: 'EGP' }, 'en')).toBeNull()
    expect(formatLocalAnswer('next_payday', summary, 'en')).toBeNull()
  })
})
