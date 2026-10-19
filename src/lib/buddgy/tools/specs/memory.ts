import { obj, oneOf, str, type ToolSpec } from '@/lib/buddgy/tools/spec'

export const memorySpecs: ToolSpec[] = [
  {
    name: 'get_memories',
    domain: 'memory',
    kind: 'read',
    description: 'What Buddgy remembers about the user, with refs.',
    params: obj({}),
  },
  {
    name: 'remember',
    domain: 'memory',
    kind: 'write',
    risk: 'approve',
    description: 'Propose saving one short lasting fact or preference about the user.',
    params: obj({ text: str('one sentence, at most 280 characters'), kind: oneOf(['fact', 'preference', 'constraint']) }, ['text']),
  },
  {
    name: 'forget_memory',
    domain: 'memory',
    kind: 'write',
    risk: 'approve',
    description: 'Propose removing one remembered item found with get_memories.',
    params: obj({ ref: str() }, ['ref']),
  },
]
