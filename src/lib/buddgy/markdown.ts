/**
 * The only markdown Buddgy writes: paragraphs, "- " bullets, "1." lists and **bold**.
 * Parsing is tolerant of half-written input so it can run on every streamed chunk.
 */

export interface Span {
  text: string
  bold: boolean
}

export type Block =
  | { type: 'p'; lines: Span[][] }
  | { type: 'ul'; items: Span[][] }
  | { type: 'ol'; items: Span[][] }

const BULLET = /^\s*(?:[-*•])\s+(.*)$/
const ORDERED = /^\s*\d+[.)]\s+(.*)$/

export function parseInline(line: string): Span[] {
  const parts = line.split('**')
  const spans: Span[] = []
  parts.forEach((text, i) => {
    if (text !== '') spans.push({ text, bold: i % 2 === 1 })
  })
  return spans
}

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = []

  for (const raw of source.replace(/\r\n/g, '\n').split('\n')) {
    if (raw.trim() === '') {
      // An empty paragraph is the separator: whatever follows starts a new block.
      blocks.push({ type: 'p', lines: [] })
      continue
    }
    const last = blocks[blocks.length - 1]
    const bullet = BULLET.exec(raw)
    const ordered = bullet ? null : ORDERED.exec(raw)
    if (bullet) {
      if (last?.type === 'ul') last.items.push(parseInline(bullet[1]))
      else blocks.push({ type: 'ul', items: [parseInline(bullet[1])] })
    } else if (ordered) {
      if (last?.type === 'ol') last.items.push(parseInline(ordered[1]))
      else blocks.push({ type: 'ol', items: [parseInline(ordered[1])] })
    } else if (last?.type === 'p') {
      last.lines.push(parseInline(raw.trim()))
    } else {
      blocks.push({ type: 'p', lines: [parseInline(raw.trim())] })
    }
  }
  return blocks.filter((b) => (b.type === 'p' ? b.lines.length > 0 : b.items.length > 0))
}
