import { createElement } from 'react'
import { lineIconComponent } from './lineIconMap'

export function LineIcon({ name, className }: { name: string; className?: string }) {
  return createElement(lineIconComponent(name), { className, 'aria-hidden': true })
}
