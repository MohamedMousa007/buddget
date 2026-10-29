const counts = new Map<Element, number>()

/** Makes everything outside the dialog (and outside the toast region / exempt nodes) inert, ref-counted across stacked dialogs; returns the undo. */
export function inertBackground(panel: HTMLElement): () => void {
  const marked: HTMLElement[] = []
  const walk = (parent: HTMLElement) => {
    for (const child of Array.from(parent.children)) {
      if (
        !(child instanceof HTMLElement) ||
        child.contains(panel) ||
        child.hasAttribute('data-modal-layer') ||
        child.hasAttribute('data-inert-exempt')
      ) continue
      if (child.querySelector('[data-toast-region]')) walk(child)
      else if (!child.hasAttribute('data-toast-region')) {
        counts.set(child, (counts.get(child) ?? 0) + 1)
        child.setAttribute('inert', '')
        marked.push(child)
      }
    }
  }
  walk(document.body)
  return () => {
    for (const n of marked) {
      const next = (counts.get(n) ?? 1) - 1
      if (next > 0) counts.set(n, next)
      else {
        counts.delete(n)
        n.removeAttribute('inert')
      }
    }
  }
}
