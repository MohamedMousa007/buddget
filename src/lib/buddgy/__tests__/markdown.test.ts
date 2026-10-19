import { describe, expect, it } from 'vitest'
import { parseInline, parseMarkdown } from '@/lib/buddgy/markdown'

describe('parseInline', () => {
  it('splits bold spans', () => {
    expect(parseInline('You spent **EGP 7,400** so far')).toEqual([
      { text: 'You spent ', bold: false },
      { text: 'EGP 7,400', bold: true },
      { text: ' so far', bold: false },
    ])
  })

  it('renders an unclosed bold optimistically while streaming', () => {
    expect(parseInline('Total **EGP 7')).toEqual([
      { text: 'Total ', bold: false },
      { text: 'EGP 7', bold: true },
    ])
  })

  it('leaves single asterisks alone', () => {
    expect(parseInline('a * b')).toEqual([{ text: 'a * b', bold: false }])
  })
})

describe('parseMarkdown', () => {
  it('groups paragraphs, bullets and numbered lists', () => {
    const blocks = parseMarkdown('Intro line\nsecond line\n\n- one\n- **two**\n\n1. first\n2. second')
    expect(blocks.map((b) => b.type)).toEqual(['p', 'ul', 'ol'])
    expect(blocks[0]).toMatchObject({ lines: [[{ text: 'Intro line' }], [{ text: 'second line' }]] })
    expect(blocks[1]).toMatchObject({ items: [[{ text: 'one' }], [{ text: 'two', bold: true }]] })
    expect(blocks[2]).toMatchObject({ items: [[{ text: 'first' }], [{ text: 'second' }]] })
  })

  it('accepts • and * bullets and starts a new list after a paragraph', () => {
    const blocks = parseMarkdown('Do this:\n• a\n* b')
    expect(blocks.map((b) => b.type)).toEqual(['p', 'ul'])
  })

  it('never produces raw html: markup stays text', () => {
    const [b] = parseMarkdown('<script>alert(1)</script>')
    expect(b).toMatchObject({ type: 'p', lines: [[{ text: '<script>alert(1)</script>', bold: false }]] })
  })

  it('returns nothing for blank input', () => {
    expect(parseMarkdown('  \n\n ')).toEqual([])
  })
})
