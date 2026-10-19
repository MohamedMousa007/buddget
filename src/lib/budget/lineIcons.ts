/**
 * Plan lines store a Lucide icon key (kebab-case). Rows created before v2 hold an emoji;
 * this reads either and always returns a key, so the UI has a single icon path.
 */
const EMOJI_TO_KEY: Record<string, string> = {
  '🏠': 'house', '🔨': 'house', '🔑': 'house',
  '🚗': 'car', '🔧': 'car', '⛽': 'fuel', '🚌': 'bus', '🚲': 'bus',
  '🍕': 'utensils-crossed', '🍔': 'utensils-crossed', '☕': 'utensils-crossed', '🥗': 'utensils-crossed',
  '🛒': 'shopping-basket',
  '💡': 'zap', '💧': 'droplets', '📡': 'wifi', '📱': 'smartphone',
  '💊': 'heart-pulse', '🏥': 'heart-pulse', '💪': 'dumbbell',
  '📚': 'graduation-cap', '📖': 'graduation-cap',
  '👗': 'shopping-bag', '🛍': 'shopping-bag', '🧴': 'shopping-bag',
  '✈': 'plane', '🏖': 'plane',
  '🛡': 'shield-check',
  '🎁': 'gift', '👶': 'baby', '🍼': 'baby',
  '💼': 'briefcase', '📈': 'trending-up', '💸': 'banknote', '💳': 'credit-card', '💰': 'coins',
  '🤲': 'hand-heart', '🧾': 'receipt', '🏦': 'landmark', '🎯': 'target',
  '🎮': 'clapperboard', '🎬': 'clapperboard', '🎵': 'clapperboard', '🎨': 'clapperboard',
  '📦': 'package',
}

const KEY_PATTERN = /^[a-z][a-z0-9-]*$/
const VARIATION_SELECTOR = /️/g

export function lineIconKey(icon: string): string {
  if (KEY_PATTERN.test(icon)) return icon
  return EMOJI_TO_KEY[icon.replace(VARIATION_SELECTOR, '')] ?? 'wallet'
}
