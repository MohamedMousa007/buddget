import { defineTools } from '@/lib/buddgy/tools/define'
import { memoryLabels } from '@/lib/buddgy/tools/exec/memoryCopy'
import { refOf, resolveRef } from '@/lib/buddgy/tools/refs'
import { memorySpecs } from '@/lib/buddgy/tools/specs/memory'
import { fin, ui } from '@/lib/buddgy/tools/stores'
import type { ReadImpl, WriteImpl } from '@/lib/buddgy/tools/types'
import { fail, makeProposal, ok, text } from '@/lib/buddgy/tools/writeKit'
import { MEMORY_CAP, MEMORY_MAX_CHARS } from '@/lib/store/useFinanceStore'
import type { BuddgyMemory } from '@/lib/store/types'

const KINDS: BuddgyMemory['kind'][] = ['fact', 'preference', 'constraint']

const active = (): BuddgyMemory[] => fin().buddgyMemories.filter((m) => m.status === 'active')

const get_memories: ReadImpl = () => ({
  learning: ui().buddgyLearning,
  memories: active().map((m) => ({ ref: refOf(m.id), text: m.text, kind: m.kind })),
})

const remember: WriteImpl = {
  propose(args, ctx) {
    const L = memoryLabels(ctx.locale)
    if (!ui().buddgyLearning) return fail('Memory is paused in settings, so nothing can be saved.', 'Tell the user they can turn learning back on in settings.')
    const note = text(args.text, 10_000)
    if (!note) return fail('There is nothing to remember.')
    if (note.length > MEMORY_MAX_CHARS) return fail(`Too long: keep it under ${MEMORY_MAX_CHARS} characters.`, 'Shorten it to one sentence.')
    const kind = (args.kind ?? 'fact') as BuddgyMemory['kind']
    if (!KINDS.includes(kind)) return fail('Kind must be fact, preference or constraint.')
    const existing = fin().buddgyMemories
    if (existing.some((m) => m.text.toLowerCase() === note.toLowerCase())) return fail('Already remembered.')
    if (existing.length >= MEMORY_CAP) {
      return fail(
        `Memory is full (${MEMORY_CAP} items).`,
        'Ask the user which item to forget first.',
        existing.slice(0, 15).map((m) => ({ id: refOf(m.id), label: m.text })),
      )
    }
    return ok(
      makeProposal({
        tool: 'remember',
        args: { text: note, kind },
        risk: 'approve',
        summary: `Pending approval: remember "${note}".`,
        preview: {
          domain: 'memory',
          tone: 'add',
          title: L.remember,
          rows: [
            { label: L.note, value: note },
            { label: L.kind, value: L.kinds[kind] },
          ],
          fields: [{ key: 'text', label: L.note, kind: 'text', value: note }],
        },
      }),
    )
  },
  apply(proposal, ctx) {
    const again = remember.propose(proposal.args, ctx)
    if (!again.ok) return { ok: false, error: again.error }
    const a = again.proposal.args
    const id = fin().addBuddgyMemory(a.text as string, 'chat', a.kind as BuddgyMemory['kind'])
    if (!id) return { ok: false, error: 'Memory could not be saved.' }
    return { ok: true, message: a.text as string, undo: () => fin().removeBuddgyMemory(id) }
  },
}

const forget_memory: WriteImpl = {
  propose(args, ctx) {
    const L = memoryLabels(ctx.locale)
    const hit = resolveRef(active(), args.ref)
    if (hit.kind === 'none') return fail('No memory has that ref.', 'Find it with get_memories first.')
    if (hit.kind === 'many') return fail('That ref matches several memories.', 'Use a longer ref from get_memories.')
    const m = hit.item
    return ok(
      makeProposal({
        tool: 'forget_memory',
        args: { ref: refOf(m.id) },
        risk: 'approve',
        summary: `Pending approval: forget "${m.text}".`,
        preview: {
          domain: 'memory',
          tone: 'danger',
          title: L.forget,
          rows: [
            { label: L.note, value: m.text },
            { label: L.kind, value: L.kinds[m.kind] },
          ],
        },
      }),
    )
  },
  apply(proposal, ctx) {
    const again = forget_memory.propose(proposal.args, ctx)
    if (!again.ok) return { ok: false, error: again.error }
    const hit = resolveRef(active(), again.proposal.args.ref)
    if (hit.kind !== 'one') return { ok: false, error: 'That memory no longer exists.' }
    const m = hit.item
    fin().removeBuddgyMemory(m.id)
    return {
      ok: true,
      message: m.text,
      undo: () => {
        if (ui().buddgyLearning) fin().addBuddgyMemory(m.text, m.source, m.kind)
      },
    }
  },
}

export const memoryTools = defineTools(memorySpecs, { get_memories, remember, forget_memory })
