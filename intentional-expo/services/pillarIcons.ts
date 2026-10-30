/**
 * Pillar icon keys (US-012 → feedback round 2): which glyph a pillar shows. A pillar's `icon` column stores one of
 * PILLAR_ICON_KEYS, a legacy emoji (mapped to a key), or any other emoji the user picked when no glyph fits.
 * Pure, so it's unit-tested; components/ui/PillarIcon.tsx draws the glyphs.
 */

/** Grouped so the grid reads by theme: body, mind, money, work, making, people, the rest of life. */
export const PILLAR_ICON_KEYS = [
  'target',
  'dumbbell',
  'footprints',
  'bike',
  'heart',
  'apple',
  'salad',
  'stethoscope',
  'moon',
  'brain',
  'book',
  'graduation',
  'languages',
  'sun',
  'church',
  'wallet',
  'piggybank',
  'banknote',
  'coins',
  'trending',
  'landmark',
  'briefcase',
  'rocket',
  'laptop',
  'hammer',
  'pen',
  'code',
  'palette',
  'music',
  'mic',
  'camera',
  'film',
  'users',
  'handheart',
  'baby',
  'house',
  'dog',
  'utensils',
  'coffee',
  'plane',
  'globe',
  'mountain',
  'leaf',
  'sprout',
  'gamepad',
  'trophy',
  'gem',
  'smile',
  'flame',
  'sparkles',
] as const;

export type PillarIconKey = (typeof PILLAR_ICON_KEYS)[number];

const KEY_SET = new Set<string>(PILLAR_ICON_KEYS);
export const isIconKey = (icon: string | null | undefined): icon is PillarIconKey => !!icon && KEY_SET.has(icon);

const EMOJI_TO_KEY: Record<string, PillarIconKey> = {
  '💪': 'dumbbell', '🏋️': 'dumbbell', '🏃': 'footprints', '🚴': 'bike', '❤️': 'heart',
  '🧠': 'brain', '📚': 'book', '📖': 'book', '🎓': 'graduation', '💰': 'wallet', '💵': 'wallet',
  '💼': 'briefcase', '🚀': 'rocket', '🔨': 'hammer', '🛠️': 'hammer', '✍️': 'pen', '💻': 'code',
  '🎨': 'palette', '🎵': 'music', '📷': 'camera', '👨‍👩‍👧': 'users', '👪': 'users', '🏠': 'house',
  '🌱': 'sprout', '🧘': 'leaf', '🐷': 'piggybank', '🪙': 'coins', '📈': 'trending', '🏦': 'landmark',
  '✈️': 'plane', '🍳': 'utensils', '🍎': 'apple', '🥗': 'salad', '👶': 'baby', '🐶': 'dog', '🎮': 'gamepad',
  '🏆': 'trophy', '🎤': 'mic', '🎬': 'film', '🙏': 'church', '☀️': 'sun', '💎': 'gem', '😊': 'smile', '⛰️': 'mountain', '🌙': 'moon', '☕': 'coffee', '🌍': 'globe',
  '🔥': 'flame', '✨': 'sparkles',
};

const NAME_HINTS: [RegExp, PillarIconKey][] = [
  [/body|physi|health|fit|gym|sport|train/i, 'dumbbell'],
  [/run|walk/i, 'footprints'],
  [/mind|mental|medit|calm|spirit/i, 'brain'],
  [/read|book|learn|study|skill/i, 'book'],
  [/invest|stock|trading/i, 'trending'],
  [/sav(e|ing)/i, 'piggybank'],
  [/money|financ|wealth|income|cash|budget|debt/i, 'wallet'],
  [/business|career|work|job/i, 'briefcase'],
  [/craft|build|make/i, 'hammer'],
  [/writ|journal/i, 'pen'],
  [/code|dev|program/i, 'code'],
  [/art|design|creat/i, 'palette'],
  [/music|piano|guitar/i, 'music'],
  [/family|friend|relation|social|love/i, 'users'],
  [/home/i, 'house'],
  [/sleep|rest/i, 'moon'],
  [/language|french|english|spanish/i, 'languages'],
  [/faith|god|pray|church|spiritual/i, 'church'],
  [/travel|trip/i, 'plane'],
  [/cook|food|diet|\beat/i, 'utensils'],
  [/kid|child|parent|baby/i, 'baby'],
  [/game/i, 'gamepad'],
  [/video|film|youtube/i, 'film'],
];

/**
 * A pillar can carry any emoji when no glyph fits ("or use an emoji" in the picker). Emoji we have a glyph for
 * still map to it (legacy data); any other non-key value that isn't plain letters is drawn as the emoji itself.
 */
export function customEmoji(icon: string | null | undefined): string | null {
  if (!icon || isIconKey(icon) || EMOJI_TO_KEY[icon]) return null;
  return /\p{Extended_Pictographic}/u.test(icon) ? icon : null;
}

export function resolvePillarIconKey(icon: string | null | undefined, name = ''): PillarIconKey {
  if (isIconKey(icon)) return icon;
  if (icon && EMOJI_TO_KEY[icon]) return EMOJI_TO_KEY[icon];
  for (const [re, key] of NAME_HINTS) if (re.test(name)) return key;
  return 'target';
}


/** The first emoji in what was typed ("🧗‍♂️ climbing" → "🧗‍♂️"), or null: the picker's "use an emoji" field. */
export function firstEmoji(text: string): string | null {
  const m = text.match(/\p{Extended_Pictographic}(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}]|\u200D\p{Extended_Pictographic}\uFE0F?)*/u);
  return m ? m[0] : null;
}
