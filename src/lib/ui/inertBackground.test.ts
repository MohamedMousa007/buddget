import { describe, it, expect, afterEach } from 'vitest'
import { inertBackground } from './inertBackground'

type Attrs = Record<string, string>
class El {
  attrs: Attrs = {}
  children: El[] = []
  constructor(attrs: Attrs = {}) { this.attrs = { ...attrs } }
  hasAttribute(k: string) { return k in this.attrs }
  setAttribute(k: string, v: string) { this.attrs[k] = v }
  removeAttribute(k: string) { delete this.attrs[k] }
  contains(o: El): boolean { return o === this || this.children.some((c) => c.contains(o)) }
  querySelector(sel: string): El | null {
    const m = /\[(.+)\]/.exec(sel)?.[1]
    for (const c of this.children) {
      if (m && c.hasAttribute(m)) return c
      const r = c.querySelector(sel)
      if (r) return r
    }
    return null
  }
}

const g = globalThis as unknown as { HTMLElement: unknown; document: unknown }
const origHTMLElement = g.HTMLElement
const origDocument = g.document

function setup(children: El[]) {
  const body = new El()
  body.children = children
  g.HTMLElement = El
  g.document = { body }
}

afterEach(() => {
  g.HTMLElement = origHTMLElement
  g.document = origDocument
})

describe('inertBackground', () => {
  it('ref-counts: inert is removed only when the last dialog closes', () => {
    const root = new El()
    const a = new El({ 'data-modal-layer': '' })
    const b = new El({ 'data-modal-layer': '' })
    setup([root, a, b])
    const undoA = inertBackground(a as never)
    const undoB = inertBackground(b as never)
    expect(root.hasAttribute('inert')).toBe(true)
    undoA()
    expect(root.hasAttribute('inert')).toBe(true)
    undoB()
    expect(root.hasAttribute('inert')).toBe(false)
  })

  it('skips modal layers, exempt nodes and toast regions', () => {
    const root = new El()
    const layer = new El({ 'data-modal-layer': '' })
    const exempt = new El({ 'data-inert-exempt': '' })
    const toast = new El({ 'data-toast-region': '' })
    const panel = new El()
    setup([root, layer, exempt, toast, panel])
    inertBackground(panel as never)
    expect(root.hasAttribute('inert')).toBe(true)
    expect(layer.hasAttribute('inert')).toBe(false)
    expect(exempt.hasAttribute('inert')).toBe(false)
    expect(toast.hasAttribute('inert')).toBe(false)
  })
})
