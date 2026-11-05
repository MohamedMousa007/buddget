import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return sourceFiles(p)
    return /\.tsx$/.test(name) ? [p] : []
  })
}

describe('sheet titles name their dialog', () => {
  it('no file reads the shell title id in the same component that renders the shell', () => {
    // The id lives in a context provided INSIDE ModalShell: read from the component that renders it, it is undefined and the dialog has no name.
    const bad = sourceFiles(join(process.cwd(), 'src')).filter((f) => !f.endsWith('ModalTitle.tsx')).filter((f) => {
      const s = readFileSync(f, 'utf8')
      return s.includes('<ModalShell') && s.includes('id={useModalTitleId()}')
    })
    expect(bad).toEqual([])
  })
})
