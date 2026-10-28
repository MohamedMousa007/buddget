export const nf = (n: number) => Math.round(n).toLocaleString('en-US')

/** Replaces {name} placeholders. */
export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))
}
