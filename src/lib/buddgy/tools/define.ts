import type { ToolSpec } from '@/lib/buddgy/tools/spec'
import { amountArgsError } from '@/lib/buddgy/tools/amountGuard'
import { fail } from '@/lib/buddgy/tools/writeKit'
import type { ReadImpl, ToolEntry, WriteImpl } from '@/lib/buddgy/tools/types'

type Impl = ReadImpl | WriteImpl | ((args: Record<string, unknown>, ctx: import('@/lib/buddgy/tools/types').ToolContext) => { ok: boolean; message: string })

/** Pairs each spec with its executor and fails loudly at load if one is missing or the wrong shape. */
export function defineTools(specs: ToolSpec[], impls: Record<string, Impl>): ToolEntry[] {
  return specs.map((spec) => {
    const impl = impls[spec.name]
    if (!impl) throw new Error(`Buddgy tool "${spec.name}" has a spec but no executor`)
    if (spec.kind === 'read') return { spec, read: impl as ReadImpl }
    if (spec.kind === 'write') {
      const write = impl as WriteImpl
      return {
        spec,
        write: {
          ...write,
          propose: (args, ctx) => {
            const bad = amountArgsError(spec, args)
            return bad ? fail(bad, 'Ask the user for a realistic amount.') : write.propose(args, ctx)
          },
        },
      }
    }
    return { spec, nav: impl as NonNullable<ToolEntry['nav']> }
  })
}
