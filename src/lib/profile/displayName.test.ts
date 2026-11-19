import { describe, expect, it } from 'vitest'
import { cleanName, displayName, firstName, NAME_BUDGET } from './displayName'

describe('firstName', () => {
  it.each([
    ['Mohamed Ahmed Abdel Rahman El Sayed', 'Mohamed'],
    ['Mohamed Ali', 'Mohamed'],
    ['Mohamed Ahmed', 'Mohamed'],
    ['Abdel Rahman Ali', 'Abdel Rahman'],
    ['Abdul Aziz Khan', 'Abdul Aziz'],
    ['Abd El Rahman Said', 'Abd El Rahman'],
    ['Nour El Din Hassan', 'Nour El Din'],
    ['Saif Eldin Hassan', 'Saif'],
    ['Saif El Din Omar', 'Saif El Din'],
    ['El Sayed Ahmed', 'El Sayed'],
    ['Al Hassan Omar', 'Al Hassan'],
    ['Abu Bakr Mahmoud Ibrahim', 'Abu Bakr'],
    ['Umm Kulthum Ali', 'Umm Kulthum'],
    ['Layla Hassan', 'Layla'],
    ['Layla', 'Layla'],
    ['عبد الرحمن محمد', 'عبد الرحمن'],
    ['عبدالرحمن محمد علي', 'عبدالرحمن'],
    ['أبو بكر الصديق', 'أبو بكر'],
    ['نور الدين حسن', 'نور الدين'],
    ['محمد علي', 'محمد'],
    ['  Layla   😀 Hassan ', 'Layla'],
    ['Ömer Çelik', 'Ömer'],
    ['', ''],
  ])('%s → %s', (full, first) => expect(firstName(full)).toBe(first))

  it('never goes past three tokens', () => {
    expect(firstName('Abdel El Rahman Zaki Ahmed').split(' ').length).toBeLessThanOrEqual(3)
  })
})

describe('displayName', () => {
  it('keeps a name that fits, exactly as typed', () => {
    expect(displayName('Layla Hassan', NAME_BUDGET.menu)).toBe('Layla Hassan')
    expect(displayName('layla HASSAN', NAME_BUDGET.menu)).toBe('layla HASSAN')
  })
  it('falls back to the first name, never an initial', () => {
    expect(displayName('Mohamed Ahmed Abdel Rahman El Sayed', NAME_BUDGET.menu)).toBe('Mohamed')
    expect(displayName('Abdel Rahman Ali Mahmoud Hassan', NAME_BUDGET.menu)).toBe('Abdel Rahman')
  })
  it('the settings row allows a longer name than the menu', () => {
    const name = 'Layla Hassan Abdelrahman'
    expect(displayName(name, NAME_BUDGET.menu)).toBe('Layla')
    expect(displayName(name, NAME_BUDGET.row)).toBe(name)
  })
  it('counts code points, not UTF-16 units', () => {
    expect(displayName('𝔏𝔞𝔶𝔩𝔞 𝔥𝔞𝔰𝔰𝔞𝔫', 12)).toBe('𝔏𝔞𝔶𝔩𝔞 𝔥𝔞𝔰𝔰𝔞𝔫')
  })
  it('strips emoji and joiners from what it shows', () => {
    expect(cleanName('Layla 👩‍💻 Hassan')).toBe('Layla Hassan')
  })
})
