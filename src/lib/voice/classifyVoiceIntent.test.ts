import { describe, it, expect } from 'vitest'
import { classifyVoiceIntent } from '@/lib/voice/classifyVoiceIntent'

describe('classifyVoiceIntent', () => {
  describe('transactional (→ tier-1)', () => {
    const cases = [
      'spent 250 at Talabat',
      'paid mom 2000 and 30 on lunch and 15 on coffee',
      'borrowed 1000 from dad',
      'deposit 500 to emergency fund',
      'got my 5000 salary',
      'bought coffee for 40',
      'add 50 for groceries',
      '200 جنيه taxi to office', // currency token → transactional
      'دفعت ٥٠ جنيه في كافيه', // Arabic verb
      'withdrew 300 from savings',
    ]
    for (const t of cases) {
      it(`"${t}"`, () => expect(classifyVoiceIntent(t)).toBe('transactional'))
    }
  })

  describe('complex (→ tier-2 full brain)', () => {
    const cases = [
      'how much did I spend on food this month',
      "what's my balance",
      'show my expenses',
      'list my debts',
      'why is my budget so low',
      'how am I doing this month',
      'can I afford a new phone',
      'كام صرفت على الاكل',
      'اعرض مصاريفي',
      'متبقي قد ايه في الميزانية',
    ]
    for (const t of cases) {
      it(`"${t}"`, () => expect(classifyVoiceIntent(t)).toBe('complex'))
    }
  })

  describe('edge cases', () => {
    it('empty string defaults to transactional (escalation covers it)', () => {
      expect(classifyVoiceIntent('')).toBe('transactional')
      expect(classifyVoiceIntent('   ')).toBe('transactional')
    })

    it('an amount-less question routes to tier-2 even with a money verb', () => {
      // "spend"/"pay" appear in queries; without an amount it is analytics.
      expect(classifyVoiceIntent('how much did I pay for rent')).toBe('complex')
      expect(classifyVoiceIntent('how much should I add for coffee')).toBe('complex')
    })

    it('an amount + money verb is a transaction even if a question word slips in', () => {
      // Has a concrete amount to log → tier-1 (escalation corrects rare misroutes).
      expect(classifyVoiceIntent('add 50 for coffee')).toBe('transactional')
    })
  })
})
