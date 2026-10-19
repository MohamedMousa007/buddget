import type { ToolSpec } from '@/lib/buddgy/tools/spec'
import type { ReadImpl, ToolEntry, WriteImpl } from '@/lib/buddgy/tools/types'

type Impl = ReadImpl | WriteImpl | ((args: Record<string, unknown>, ctx: import('@/lib/buddgy/tools/types').ToolContext) => { ok: boolean; message: string })

/** Pairs each spec with its executor and fails loudly at load if one is missing or the wrong shape. */
export function defineTools(specs: ToolSpec[], impls: Record<string, Impl>): ToolEntry[] {
  return specs.map((spec) => {
    const impl = impls[spec.name]
    if (!impl) throw new Error(`Buddgy tool "${spec.name}" has a spec but no executor`)
    if (spec.kind === 'read') return { spec, read: impl as ReadImpl }
    if (spec.kind === 'write') return { spec, write: impl as WriteImpl }
    return { spec, nav: impl as NonNullable<ToolEntry['nav']> }
  })
}
