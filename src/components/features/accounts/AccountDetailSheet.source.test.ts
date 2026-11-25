import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(join(__dirname, 'AccountDetailSheet.tsx'), 'utf8')
const activity = readFileSync(join(__dirname, 'SheetActivity.tsx'), 'utf8')

describe('AccountDetailSheet guards (QA bugs 4, 14, 15)', () => {
  it('bug 4: the sheet scroller cannot pan sideways (the carousel slots overflow it on purpose)', () => {
    const scroller = src.match(/className="min-h-0 flex-1 space-y-5 overflow-y-auto[^"]*"/)?.[0] ?? ''
    expect(scroller).toContain('overflow-x-hidden')
    expect(scroller).toContain('touch-pan-y')
  })

  it('bug 14: a Recent row opens the shared expense editor', () => {
    expect(src).toContain('<SheetActivity')
    expect(activity).toMatch(/setActiveModal\('editExpense'\)/)
    expect(activity).toContain('onClick={() => { onLeave(); setEditingExpenseId(e.id); setActiveModal(\'editExpense\') }}')
  })

  it('bug 15: Cash offers its currency change instead of no edit at all', () => {
    expect(src).toContain('cashCopy.menuItem')
  })
})
