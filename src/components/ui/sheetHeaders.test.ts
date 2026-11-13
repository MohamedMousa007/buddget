/**
 * Every file that opens a ModalShell either uses the standard header (V3SheetHeader: Title for sheets, DialogTitle for
 * decision dialogs) or is on the short, named exemption list below, with the reason. A new sheet that does neither fails
 * here, and so does an exemption that has since moved onto the header (it must leave the list).
 *
 * Header rule: docs/DESIGN_SYSTEM.md, "Sheet header (the rule)".
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, it, expect } from 'vitest'

const ROOT = process.cwd()

type Category = 'popover-menu' | 'wrapper' | 'flow-chrome' | 'primitive'

/** The only sheets allowed to skip the header, and why. Adding one needs a decision, not just a line. */
const EXEMPT: Record<string, { category: Category; reason: string }> = {
  'src/components/modals/QuickAddFAB.tsx': { category: 'popover-menu', reason: 'content-height menu anchored to the add button; no close, tap-outside dismisses' },
  'src/components/modals/AddExpenseSheet.tsx': { category: 'wrapper', reason: 'thin shell around ExpenseSheetForm, whose header is the standard one' },
  'src/components/modals/EditExpenseSheet.tsx': { category: 'wrapper', reason: 'thin shell around ExpenseSheetForm, whose header is the standard one' },
  'src/components/features/goals/new/NewGoalFlow.tsx': { category: 'flow-chrome', reason: 'a multi-step wizard with its own back, step dots and close' },
  'src/components/receipt/ReceiptScanSheet.tsx': { category: 'flow-chrome', reason: 'a capture and review flow with its own camera and step chrome' },
  'src/components/voice/VoiceRecordSheet.tsx': { category: 'flow-chrome', reason: 'a recording flow with its own record and cancel controls' },
  'src/components/modals/ModalTitle.tsx': { category: 'primitive', reason: 'defines the dialog-name hook the standard header uses' },
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.tsx') && !p.endsWith('.test.tsx')) out.push(p)
  }
  return out
}

const shellUsers = walk(join(ROOT, 'src'))
  .map((p) => relative(ROOT, p).split('\\').join('/'))
  .filter((f) => f !== 'src/components/modals/ModalShell.tsx')
  .filter((f) => readFileSync(join(ROOT, f), 'utf8').includes("from '@/components/modals/ModalShell'"))

const read = (f: string) => readFileSync(join(ROOT, f), 'utf8')

describe('every sheet and dialog has the standard header or a named exemption', () => {
  it('finds the sheets', () => {
    expect(shellUsers.length).toBeGreaterThan(30)
  })

  it('no ModalShell file is left on a hand-built header', () => {
    const stray = shellUsers.filter((f) => !f.endsWith('ModalTitle.tsx') && !(f in EXEMPT) && !read(f).includes('V3SheetHeader'))
    expect(stray, `these open a ModalShell without V3SheetHeader or an exemption:\n${stray.join('\n')}`).toEqual([])
  })

  it('a sheet on the standard header does not also build its own title', () => {
    const doubled = shellUsers.filter((f) => !(f in EXEMPT) && /import\s*\{[^}]*\b(ModalTitle|ModalHeading)\b[^}]*\}\s*from/.test(read(f)))
    expect(doubled, `these import ModalTitle or ModalHeading next to V3SheetHeader:\n${doubled.join('\n')}`).toEqual([])
  })

  it('every exemption is real: the file exists, is a ModalShell user, and has not moved onto the header', () => {
    for (const [file, { reason }] of Object.entries(EXEMPT)) {
      expect(reason.length, file).toBeGreaterThan(10)
      expect(shellUsers, `${file} is not a ModalShell file any more; remove it from EXEMPT`).toContain(file)
      if (!file.endsWith('ModalTitle.tsx')) expect(read(file), `${file} uses V3SheetHeader now; remove it from EXEMPT`).not.toContain('V3SheetHeader')
    }
  })

  it('the exemption list stays short', () => {
    expect(Object.keys(EXEMPT).length).toBeLessThanOrEqual(8)
  })
})
