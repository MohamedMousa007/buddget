import { bool, num, obj, oneOf, str, type ToolSpec } from '@/lib/buddgy/tools/spec'

export const profileSpecs: ToolSpec[] = [
  {
    name: 'get_profile',
    domain: 'profile',
    kind: 'read',
    description: 'Name, country, city, household, lifestyle and rent. No contact details.',
    params: obj({}),
  },
  {
    name: 'update_profile',
    domain: 'profile',
    kind: 'write',
    risk: 'approve',
    description: 'Propose profile changes. Send only what changes.',
    params: obj({
      name: str(),
      country: str('country name or ISO code'),
      city: str('empty string clears it'),
      household: oneOf(['solo', 'couple', 'family']),
      lifestyleTier: oneOf(['minimal', 'balanced', 'comfortable']),
      foodFrequency: oneOf(['everyday', 'mostdays', 'sometimes', 'rarely']),
      transportMode: oneOf(['public', 'car', 'taxi', 'walk']),
      monthlyRent: num('in the base currency'),
      rentIncludesUtilities: bool(),
    }),
  },
]
