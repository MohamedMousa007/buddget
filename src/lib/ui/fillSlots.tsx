import { Fragment, type ReactNode } from 'react'

/**
 * Fills `{name}` slots in a translated sentence with nodes, so a figure can be styled
 * (bold, mono) without splitting the sentence into fragments a translator can't reorder.
 */
export function fillSlots(template: string, slots: Record<string, ReactNode>): ReactNode {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const m = /^\{(\w+)\}$/.exec(part)
    return <Fragment key={i}>{m && m[1] in slots ? slots[m[1]] : part}</Fragment>
  })
}
