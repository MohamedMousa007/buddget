/**
 * Generates cfg.dtsPropsFor for components whose props the converter can't auto-extract.
 *
 * design-sync's extractor looks for an exported `<Name>Props` interface. Most Buddget
 * components instead type their parameter with a file-local `interface Props` or an inline
 * object literal, so they emit `[key: string]: unknown` stubs — a useless API contract for
 * the design agent. This lifts the real member text (JSDoc included) out of the declarations
 * emitted into ds-types/ and writes it into .design-sync/config.json.
 *
 * Re-run after changing any synced component's props:
 *   npx tsc -p .design-sync/tsconfig.dts.json && node .design-sync/gen-dts-props.mjs
 */
import { Project, Node } from '../.ds-sync/node_modules/ts-morph/dist/ts-morph.js'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const cfg = JSON.parse(readFileSync('.design-sync/config.json', 'utf8'))
const project = new Project({ skipAddingFilesFromTsConfig: true, compilerOptions: { skipLibCheck: true, strict: false } })
project.addSourceFilesAtPaths(['ds-types/**/*.d.ts'])

/** Members of an object-literal or interface, as source text (keeps JSDoc). */
const membersOf = (node) =>
  node.getMembers().map((m) => m.getFullText().trim()).join('\n')

const out = {}
const unresolved = []

for (const [name, srcPath] of Object.entries(cfg.componentSrcMap)) {
  const dts = resolve('ds-types', srcPath.replace(/^src\//, '').replace(/\.tsx?$/, '.d.ts'))
  if (!existsSync(dts)) { unresolved.push(`${name}: no emitted d.ts at ${dts}`); continue }
  const sf = project.getSourceFile(dts)
  if (!sf) { unresolved.push(`${name}: d.ts not in project`); continue }

  // An exported `<Name>Props` already works — leave those to the converter.
  if (sf.getInterface(`${name}Props`)) continue

  const fn = sf.getFunction(name) ?? sf.getVariableDeclaration(name)
  const param = fn?.getParameters?.()[0]
  if (!param) { unresolved.push(`${name}: no first parameter`); continue }

  const typeNode = param.getTypeNode()
  if (!typeNode) { unresolved.push(`${name}: parameter has no type node`); continue }

  // Case 1: inline object literal — `{ a: string; b?: number }`
  if (Node.isTypeLiteral(typeNode)) { out[name] = membersOf(typeNode); continue }

  // Case 2: a named type in the same file — usually a file-local `interface Props`.
  if (Node.isTypeReference(typeNode)) {
    const ref = typeNode.getTypeName().getText()
    const decl = sf.getInterface(ref) ?? sf.getTypeAlias(ref)
    if (decl && Node.isInterfaceDeclaration(decl)) { out[name] = membersOf(decl); continue }
    if (decl && Node.isTypeAliasDeclaration(decl)) {
      const t = decl.getTypeNode()
      if (t && Node.isTypeLiteral(t)) { out[name] = membersOf(t); continue }
    }
  }
  unresolved.push(`${name}: ${typeNode.getText().slice(0, 90)}`)
}

cfg.dtsPropsFor = { ...out, ...(cfg.dtsPropsFor ?? {}) } // never clobber hand-written entries
writeFileSync('.design-sync/config.json', JSON.stringify(cfg, null, 2) + '\n')
console.log(`generated ${Object.keys(out).length} prop bodies`)
if (unresolved.length) console.log(`\nstill unresolved (${unresolved.length}) — hand-write these:\n  ` + unresolved.join('\n  '))
