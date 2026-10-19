import { refOf, resolveByRefOrName } from '@/lib/buddgy/tools/refs'
import type { EditableField } from '@/lib/buddgy/tools/proposal'
import type { Plan } from '@/lib/buddgy/tools/exec/planKit'
import { fail } from '@/lib/buddgy/tools/writeKit'
import type { FinanceStore } from '@/lib/store/types'

export function methodField(s: FinanceStore, currentId: string, label: string): EditableField {
  return {
    key: 'method',
    label,
    kind: 'select',
    value: currentId ? refOf(currentId) : '',
    options: s.paymentMethods.map((m) => ({ value: refOf(m.id), label: m.name })),
  }
}

/** A named method must match exactly; only an omitted one falls back to the usual method. */
export function resolveMethod(s: FinanceStore, input: unknown): Plan<{ id: string }> {
  if (input === undefined || input === null || input === '') {
    return { id: (s.paymentMethods.find((m) => m.isDefault) ?? s.paymentMethods[0])?.id ?? '' }
  }
  const hit = resolveByRefOrName(s.paymentMethods, input, (m) => m.name)
  if (hit.kind === 'one') return { id: hit.item.id }
  const choices = (hit.kind === 'many' ? hit.items : s.paymentMethods).map((m) => ({ id: refOf(m.id), label: m.name }))
  return {
    error: fail(
      hit.kind === 'many' ? 'Several payment methods match.' : 'No payment method matches.',
      'Ask which one, or omit method to use the usual one.',
      choices,
    ),
  }
}
