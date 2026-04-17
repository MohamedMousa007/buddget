/**
 * Generate a cheerful, pronounceable nickname for a guest session.
 * Format: `<Adjective><Animal>` in CamelCase, e.g. "SwiftOtter", "HappyPenguin".
 * English only by design — locale-agnostic so the nickname is stable across
 * language switches. Anyone who dislikes theirs can edit it in the display-name
 * step during guest onboarding.
 */

const ADJECTIVES = [
  'Swift', 'Happy', 'Brave', 'Cosy', 'Quiet', 'Gentle', 'Bright', 'Curious',
  'Lively', 'Merry', 'Nimble', 'Plucky', 'Proud', 'Royal', 'Spry', 'Sunny',
  'Wise', 'Witty', 'Zesty', 'Bold', 'Calm', 'Chirpy', 'Clever', 'Dapper',
  'Eager', 'Fancy', 'Fuzzy', 'Glad', 'Hardy', 'Jolly', 'Keen', 'Lucky',
  'Mellow', 'Noble', 'Peppy', 'Quirky', 'Sharp', 'Sleek', 'Spry', 'Velvet',
] as const

const ANIMALS = [
  'Otter', 'Penguin', 'Panda', 'Fox', 'Koala', 'Lynx', 'Badger', 'Beaver',
  'Dolphin', 'Falcon', 'Hedgehog', 'Heron', 'Hippo', 'Iguana', 'Jaguar',
  'Lemur', 'Lion', 'Mantis', 'Narwhal', 'Octopus', 'Owl', 'Platypus',
  'Quokka', 'Rabbit', 'Raccoon', 'Seal', 'Sparrow', 'Squirrel', 'Tiger',
  'Turtle', 'Walrus', 'Whale', 'Wolf', 'Wombat', 'Yak', 'Zebra', 'Bison',
  'Capybara', 'Cheetah', 'Chipmunk',
] as const

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

export function generateGuestNickname(): string {
  return `${pick(ADJECTIVES)}${pick(ANIMALS)}`
}
