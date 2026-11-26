import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChatHeaderButton } from './ChatHeaderButton'

const read = (f: string) => readFileSync(join(__dirname, f), 'utf8')

describe('Buddgy chat header buttons are 44x44 boxes (QA: "Your chats", "New chat", "Close chat", "Back to the chat" measured 32x32)', () => {
  const html = renderToStaticMarkup(h(ChatHeaderButton, { label: 'Close chat', onClick: () => undefined, children: 'x' }))

  it('the button box is 44px and keeps the 32px circle inside it', () => {
    const button = html.match(/<button[^>]*>/)![0]
    expect(button).toContain('aria-label="Close chat"')
    expect(button).toMatch(/\bsize-11\b/)
    expect(button).not.toMatch(/\bsize-8\b/)
    expect(html).toMatch(/<span aria-hidden="true" class="[^"]*\bsize-8\b[^"]*rounded-full/)
  })

  it('gives the extra 6px a side back, so the header layout does not move', () => {
    expect(html.match(/<button[^>]*>/)![0]).toMatch(/\s-m-1\.5\b/)
  })

  it('the tinted circle stays on tokens', () => {
    expect(html).toContain('bg-[var(--color-brand-elevated)]')
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('every header action in the chat and the chat list uses it (no 32px IconButton left in those headers)', () => {
    const header = read('AIChatHeader.tsx')
    expect(header).not.toContain('<IconButton')
    expect(header.match(/<ChatHeaderButton/g)).toHaveLength(3)
    const list = read('AIChatList.tsx')
    expect(list).toMatch(/<ChatHeaderButton onClick=\{onBack\} label=\{copy\.back\}/)
  })
})
