import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

/**
 * The guard that keeps the button primitives adopted.
 *
 * 359 hand-rolled `<button>` elements existed before {@link IconButton},
 * {@link OptionChip}, {@link SelectableCard}, {@link FieldButton}, {@link AccentTile}
 * and {@link Scrim} were added, in 271 distinct styles. They were not mostly
 * duplicates — nearly every surface invented its own. Primitives alone do not stop
 * that happening again; this does.
 *
 * It fails on a raw `<button>` that carries **visual** classes — a fill, a border, a
 * radius, its own size, its own text colour. Those are the properties a primitive
 * owns, and re-declaring them is how the drift started.
 *
 * It deliberately allows a raw `<button>` whose classes are only about **layout** —
 * `flex-1 text-start min-w-0` on a region that is tappable as a whole. Wrapping that
 * in a component would be ceremony, not consistency.
 *
 * If this fails, the fix is almost always to use the primitive the classes are
 * imitating. Add to ALLOWED only for a control that genuinely has no shared shape,
 * and say why — the reason is the point of the entry.
 */

/**
 * Classes a primitive owns: a fill, a border, a radius, an explicit box size, an
 * elevation. A raw button that sets these is re-inventing one.
 *
 * Padding, text size and font weight are NOT here. They are routinely passed to a
 * primitive through `className`, so flagging them would report noise rather than
 * drift. Neither are variant-prefixed classes (`hover:bg-…`): adding a hover tint to
 * a button is not the same as inventing its resting appearance, so only the base
 * state is checked.
 */
const VISUAL =
  /^(bg-(?!transparent$)|border$|border-(?![0]$)[a-z0-9[]|rounded|h-[1-9]|h-\[|w-[1-9]|w-\[|size-[1-9]|size-\[|min-h-(?!0$)|min-w-(?!0$)|shadow-|ring-[1-9])/

/**
 * A control that genuinely has no shared shape opts out with a prop:
 *
 *     <button data-raw-button-ok="a swipe-action panel, sized by the swipe" ...>
 *
 * A prop rather than a comment or a list of line numbers here, for two reasons.
 * Line numbers rot the first time anyone edits the file above them — the first
 * version of this guard went stale within the hour. And a JSX comment is not legal
 * in every position a button can occupy (directly after `return (`, for one),
 * whereas a prop always is.
 *
 * The value is the reason, and the reason is the point: when it stops being true,
 * the control belongs on a primitive.
 */
const MARKER = 'data-raw-button-ok'

/**
 * `src/components/ui/` is where a raw `<button>` belongs: that is what a primitive
 * is. Admin is the one genuinely desktop-density surface, where a 44px hit overlay
 * would overlap its neighbours and turn a precise click into a misclick.
 */
const EXEMPT_DIRS = ['src/components/ui/', 'src/components/features/admin/']

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) tsxFiles(p, out)
    else if (entry.endsWith('.tsx')) out.push(p)
  }
  return out
}

function classesOf(attr: ts.JsxAttribute): string[] {
  if (!attr.initializer) return []
  const out: string[] = []
  const walk = (n: ts.Node) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push(...n.text.split(/\s+/))
    else if (ts.isTemplateExpression(n)) {
      out.push(...n.head.text.split(/\s+/))
      for (const sp of n.templateSpans) {
        out.push(...sp.literal.text.split(/\s+/))
        walk(sp.expression)
      }
      return
    }
    n.forEachChild(walk)
  }
  walk(attr.initializer)
  return out.filter(Boolean)
}

function findStyledRawButtons() {
  const found: { at: string; classes: string[]; marked: boolean }[] = []
  for (const f of tsxFiles('src')) {
    if (EXEMPT_DIRS.some((d) => f.startsWith(d))) continue
    const src = readFileSync(f, 'utf8')
    if (!src.includes('<button')) continue
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const visit = (n: ts.Node) => {
      const open = ts.isJsxElement(n)
        ? n.openingElement
        : ts.isJsxSelfClosingElement(n)
          ? n
          : null
      if (open && open.tagName.getText() === 'button') {
        const cls = open.attributes.properties.flatMap((a) =>
          ts.isJsxAttribute(a) && a.name.getText() === 'className' ? classesOf(a) : []
        )
        // only the base state — a `hover:` or `sm:` prefix means it is a refinement,
        // not the button's resting identity
        const visual = cls.filter((c) => !c.includes(':') && VISUAL.test(c))
        if (visual.length) {
          const line = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1
          const marked = open.attributes.properties.some(
            (a) => ts.isJsxAttribute(a) && a.name.getText() === MARKER
          )
          found.push({ at: `${f}:${line}`, classes: visual, marked })
        }
      }
      n.forEachChild(visit)
    }
    visit(sf)
  }
  return found
}

describe('raw <button> elements do not re-style what a primitive owns', () => {
  const found = findStyledRawButtons()

  it('has no unmarked styled raw button', () => {
    const unexpected = found
      .filter((b) => !b.marked)
      .map((b) => `${b.at}  [${b.classes.slice(0, 6).join(' ')}]`)
    expect(
      unexpected,
      unexpected.length
        ? `\nUse the primitive these classes are imitating — IconButton for an icon-only\n` +
          `action, OptionChip for a chip, SelectableCard for a card-shaped choice,\n` +
          `FieldButton for a form-shaped trigger, AccentTile for a category tile,\n` +
          `Scrim for a dismiss backdrop, Button for anything with a text label.\n\n` +
          `If the control genuinely has no shared shape, say why on the element:\n` +
          `  ${MARKER}="why this one is not a primitive"\n`
        : undefined
    ).toEqual([])
  })
})
