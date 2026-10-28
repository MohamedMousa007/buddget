import { describe, expect, it } from 'vitest'
import { en } from './dictionaries/en'
import { ar } from './dictionaries/ar'

type Leaf = string | ((...args: never[]) => string)

function leaves(node: unknown, path: string, out: Map<string, Leaf>) {
  if (typeof node === 'string' || typeof node === 'function') {
    out.set(path, node as Leaf)
    return
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) leaves(v, path ? `${path}.${k}` : k, out)
  }
}

const enLeaves = new Map<string, Leaf>()
const arLeaves = new Map<string, Leaf>()
leaves(en, '', enLeaves)
leaves(ar, '', arLeaves)

describe('dictionary parity', () => {
  it('every English key has an Arabic key and vice versa', () => {
    const missingInAr = [...enLeaves.keys()].filter((k) => !arLeaves.has(k))
    const missingInEn = [...arLeaves.keys()].filter((k) => !enLeaves.has(k))
    expect({ missingInAr, missingInEn }).toEqual({ missingInAr: [], missingInEn: [] })
  })

  it('string and function leaves agree between languages', () => {
    const mismatched = [...enLeaves].filter(([k, v]) => typeof v !== typeof arLeaves.get(k)).map(([k]) => k)
    expect(mismatched).toEqual([])
  })

  it('areas translated in this pass contain Arabic script', () => {
    const arabic = /[؀-ۿ]/
    for (const area of ['voice', 'receiptScan', 'savingsForms', 'systemPages', 'inlineCopy', 'catalogs']) {
      const strings = [...arLeaves].filter(([k, v]) => k.startsWith(`${area}.`) && typeof v === 'string').map(([, v]) => v as string)
      const noArabic = strings.filter((s) => !arabic.test(s))
      expect(noArabic, area).toEqual([])
    }
  })

  it('function leaves return strings for sample args in both languages', () => {
    const bad: string[] = []
    for (const [name, map] of [['en', enLeaves], ['ar', arLeaves]] as const) {
      for (const [k, v] of map) {
        if (typeof v !== 'function') continue
        const ok = [[1, 2, 3], [5, 'x', 'y'], ['x', 'y', 'z']].some((args) => {
          try {
            return typeof (v as (...a: unknown[]) => unknown)(...args) === 'string'
          } catch {
            return false
          }
        })
        if (!ok) bad.push(`${name}.${k}`)
      }
    }
    expect(bad).toEqual([])
  })
})
