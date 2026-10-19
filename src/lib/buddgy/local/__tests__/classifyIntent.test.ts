import { describe, expect, it } from 'vitest'
import type { BuddgyIntent } from '@/lib/buddgy/protocol'
import { classifyIntent } from '../classifyIntent'

const cases: [string, BuddgyIntent][] = [
  ['add coffee 45', 'action'],
  ['Please add a coffee for 45', 'action'],
  ['can you delete my last expense?', 'action'],
  ['log salary 15k', 'action'],
  ['I spent 200 on groceries', 'action'],
  ['paid rent 5000', 'action'],
  ['change the lunch to 120', 'action'],
  ['cancel my netflix', 'action'],
  ['transfer 500 to savings', 'action'],
  ['coffee 45', 'action'],
  ['أضف قهوة 45', 'action'],
  ['سجل راتب ١٥ ألف', 'action'],
  ['صرفت 200 على السوبر ماركت', 'action'],
  ['دفعت الايجار', 'action'],
  ['احذف آخر مصروف', 'action'],
  ['غير الفئة', 'action'],
  ['حول 500 للادخار', 'action'],
  ['how much did I spend this month?', 'answer'],
  ['how much have I spent on food', 'answer'],
  ["what's left to spend", 'answer'],
  ['when is my next payday', 'answer'],
  ['did I pay rent?', 'answer'],
  ['show my budget', 'answer'],
  ['كم صرفت هذا الشهر؟', 'answer'],
  ['كام فاضل معايا', 'answer'],
  ['هل دفعت الايجار؟', 'answer'],
  ['hello', 'answer'],
  ['should I buy a car?', 'advice'],
  ['how can I save more money', 'advice'],
  ['why am I overspending?', 'advice'],
  ['help me build a budget', 'advice'],
  ['create a budget for next month', 'advice'],
  ['compare renting and buying', 'advice'],
  ['how should I invest my savings', 'advice'],
  ['make a plan to pay off my debt', 'advice'],
  ['can I afford a new phone', 'advice'],
  ['optimize my spending', 'advice'],
  ['انصحني في الميزانية', 'advice'],
  ['عايز خطة للادخار', 'advice'],
  ['ازاي اوفر فلوس', 'advice'],
  ['ليه بصرف كتير', 'advice'],
]

describe('classifyIntent', () => {
  it.each(cases)('%s -> %s', (text, expected) => {
    expect(classifyIntent(text)).toBe(expected)
  })
})
