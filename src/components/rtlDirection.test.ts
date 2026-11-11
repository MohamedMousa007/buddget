import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (f: string) => readFileSync(join(__dirname, f), 'utf8')

describe('TZL-6: direction icons flip in RTL', () => {
  it.each([
    ['features/settings/SettingsRow.tsx', /<ChevronRight[^>]*rtl:rotate-180/],
    ['features/settings/SettingsSubPageShell.tsx', /<ChevronLeft[^>]*rtl:rotate-180/],
    ['ui/UnifiedDatePicker.tsx', /<ChevronLeft className="rtl:rotate-180"/],
    ['ui/UnifiedDatePicker.tsx', /<ChevronRight className="rtl:rotate-180"/],
    ['features/income/PaydaysPage.tsx', /<ChevronLeft[^>]*rtl:rotate-180/],
    ['features/income/PaydayDetail.tsx', /<ChevronLeft[^>]*rtl:rotate-180/],
    ['features/budget/PlanHistoryPage.tsx', /<ChevronLeft[^>]*rtl:rotate-180/],
  ])('%s', (f, re) => expect(read(f)).toMatch(re))
})

describe('TZL-7: the chip row fade follows the reading direction', () => {
  it('has a right-to-left gradient variant', () => {
    expect(read('features/income/IncomeTypeChipSlider.tsx')).toContain('rtl:bg-[linear-gradient(to_right')
  })
})

describe('TZL-8: logical spacing instead of physical left/right', () => {
  it.each(['expenses/ExpenseDayList.tsx', 'features/savings-v3/ZakatSheet.tsx', 'features/savings-v3/PocketFormSheet.tsx'])('%s', (f) => {
    expect(read(f)).not.toMatch(/\b(ml|mr)-(\[82px\]|1)\b|text-left/)
  })
})
