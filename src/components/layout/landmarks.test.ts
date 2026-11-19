import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8')

// axe round 2: the page rail and the sidebar were two unnamed complementary landmarks, and the screen-reader h1 of
// Flow/Paydays-style screens sat outside every landmark.
describe('layout landmarks', () => {
  it('names the sidebar <aside> so it differs from the page rail <aside>', () => {
    expect(src('./Sidebar.tsx')).toMatch(/<aside aria-label=\{t\.common\.mainNavigation\}/)
  })
  it('keeps the visually hidden section h1 inside a <header>', () => {
    expect(src('./DesktopHeaderBar.tsx')).toContain('<header className="sr-only lg:hidden"><h1>{sectionTitle}</h1></header>')
  })
})
