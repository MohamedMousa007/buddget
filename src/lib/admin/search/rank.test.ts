import { describe, expect, it } from 'vitest'
import { normalize, rankEntries, scoreEntry, withinOneEdit } from './rank'

const e = (title: string, ...keywords: string[]) => ({ title, keywords })

describe('admin search ranking', () => {
  it('normalizes case, accents and punctuation', () => {
    expect(normalize('  Équipe & Rôles! ')).toBe('equipe roles')
  })

  it('ranks exact > prefix > word prefix > substring > keyword', () => {
    const list = [e('Feature flags'), e('Flags'), e('Overview', 'flag'), e('Backflags')]
    expect(rankEntries(list, 'flags').map((x) => x.title)).toEqual(['Flags', 'Feature flags', 'Backflags', 'Overview'])
  })

  it('requires every word to match', () => {
    expect(scoreEntry(e('Audit log'), 'audit zzz')).toBe(0)
    expect(scoreEntry(e('Audit log', 'history'), 'audit history')).toBeGreaterThan(0)
  })

  it('matches keywords and synonyms', () => {
    expect(rankEntries([e('Team & roles', 'staff', 'permissions')], 'permis')).toHaveLength(1)
  })

  it('tolerates one typo and loose subsequences', () => {
    expect(withinOneEdit('plans', 'plns')).toBe(true)
    expect(withinOneEdit('plans', 'plxns')).toBe(true)
    expect(withinOneEdit('plans', 'pxxns')).toBe(false)
    expect(rankEntries([e('Maintenance mode')], 'maintanence')).toHaveLength(0)
    expect(rankEntries([e('Maintenance mode')], 'maintenace')).toHaveLength(1)
    expect(rankEntries([e('Announcement')], 'anncmt')).toHaveLength(1)
  })

  it('returns nothing for an empty query and keeps order on ties', () => {
    expect(rankEntries([e('A')], '  ')).toEqual([])
    expect(rankEntries([e('Alpha x'), e('Alpha y')], 'alpha').map((x) => x.title)).toEqual(['Alpha x', 'Alpha y'])
  })

  it('honours the limit', () => {
    expect(rankEntries(Array.from({ length: 10 }, (_, i) => e(`Item ${i}`)), 'item', 3)).toHaveLength(3)
  })
})
