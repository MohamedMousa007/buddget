/** Inserts at the caret of a text field and tells React, so controlled inputs pick the change up. */
export function insertAtCursor(el: HTMLInputElement | HTMLTextAreaElement, text: string): void {
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? start
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, el.value.slice(0, start) + text + el.value.slice(end))
  el.selectionStart = el.selectionEnd = start + text.length
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.focus()
}
