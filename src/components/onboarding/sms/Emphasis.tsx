/** *segments* in a line render bold; `boldClassName` styles them (teal emphasis by default). */
export function Emphasis({ text, boldClassName = 'font-bold text-[var(--color-brand-primary-ink)]' }: { text: string; boldClassName?: string }) {
  return <>{text.split('*').map((part, i) => (i % 2 === 1 ? <b key={i} className={boldClassName}>{part}</b> : part))}</>
}
