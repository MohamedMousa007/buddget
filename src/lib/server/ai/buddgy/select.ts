import type { WireMessage } from '@/lib/buddgy/protocol'
import type { ToolDomain, ToolSpec } from '@/lib/buddgy/tools/spec'

/**
 * Sending all 66 tools costs ~7k tokens every turn. Reads, navigation and memory always go;
 * write tools go for the domains the message, the screen or the conversation points at. When
 * nothing points anywhere the full set goes, so a vague request never loses a capability.
 */
const ALWAYS: ReadonlySet<ToolDomain> = new Set(['reports', 'navigation', 'memory'])

type WriteDomain = Exclude<ToolDomain, 'reports' | 'navigation' | 'memory'>

const HINTS: Record<WriteDomain, RegExp> = {
  expenses: /expense|spen[dt]|bought|buy|purchase|receipt|paid for|cost|groceries|lunch|dinner|coffee|مصروف|مصاريف|صرفت|اشتريت|دفعت|إيصال|فاتورة|غدا|عشا|قهوة/i,
  income: /income|salary|payday|paycheck|earn|wage|bonus|راتب|دخل|مرتب|قبضت|استلمت|مكافأة/i,
  debts: /debt|owe|loan|lend|lent|borrow|installment|instalment|credit card|bnpl|دين|ديون|قسط|أقساط|سلف|بطاقة ائتمان|مديون|استلفت|أقرضت|قرض/i,
  subscriptions: /subscri|netflix|spotify|recurring|renew|trial|اشتراك|تجديد/i,
  goals: /goal|target|saving for|save for|هدف|أهداف|ادخر/i,
  savings: /saving|deposit|withdraw|transfer|pocket|vault|gold|crypto|stock|invest|net worth|wealth|مدخرات|ادخار|إيداع|سحب|تحويل|ذهب|استثمار|ثروة|جيب/i,
  budget: /budget|plan|cap|limit|ميزانية|خطة|سقف|حد/i,
  payments: /payment method|card|wallet|bank|cash|طريقة دفع|بطاقة|محفظة|بنك|كاش/i,
  settings: /setting|currency|language|theme|dark mode|light mode|pay cycle|month start|notification|reminder|إعدادات|اعدادات|عملة|لغة|مظهر|إشعار|تذكير|بداية الشهر/i,
  profile: /profile|my name|city|country|household|lifestyle|rent|الاسم|مدينة|دولة|إيجار|أسرة/i,
}

const ROUTES: [string, WriteDomain][] = [
  ['/expenses', 'expenses'],
  ['/income', 'income'],
  ['/paydays', 'income'],
  ['/debts', 'debts'],
  ['/subscriptions', 'subscriptions'],
  ['/goals', 'goals'],
  ['/savings', 'savings'],
  ['/wealth', 'savings'],
  ['/budget', 'budget'],
  ['/settings', 'settings'],
]

function lastUserText(messages: WireMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role === 'user') return m.text
  }
  return ''
}

/** Domains of tools already called in this turn, so a tool loop keeps the tools it started with. */
function calledDomains(messages: WireMessage[], domainOf: (tool: string) => ToolDomain | undefined): Set<ToolDomain> {
  const out = new Set<ToolDomain>()
  for (const m of messages) {
    if (m.role !== 'model' || !m.parts) continue
    for (const p of m.parts as { functionCall?: { name?: string } }[]) {
      const d = p.functionCall?.name ? domainOf(p.functionCall.name) : undefined
      if (d) out.add(d)
    }
  }
  return out
}

export function selectSpecs(all: readonly ToolSpec[], req: { messages: WireMessage[]; context: string }): ToolSpec[] {
  const domainOf = (name: string) => all.find((s) => s.name === name)?.domain
  const wanted = new Set<ToolDomain>(calledDomains(req.messages, domainOf))

  const text = lastUserText(req.messages)
  for (const [domain, re] of Object.entries(HINTS) as [WriteDomain, RegExp][]) if (re.test(text)) wanted.add(domain)

  const route = /\bon (\/\S*)/.exec(req.context)?.[1]
  const routed = route ? ROUTES.find(([prefix]) => route === prefix || route.startsWith(`${prefix}/`)) : undefined
  if (routed) wanted.add(routed[1])

  const anyWrite = [...wanted].some((d) => !ALWAYS.has(d))
  if (!anyWrite) return [...all]
  // Almost any money sentence can turn out to be an expense ("log my rent"), so it rides along.
  wanted.add('expenses')
  return all.filter((s) => s.kind !== 'write' || wanted.has(s.domain))
}
