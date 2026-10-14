/**
 * Pillar icons — a curated Lucide line set. A goal's `icon` column stores one
 * of the keys below; legacy emoji values are mapped by emoji, then by goal name.
 */
import { View } from 'react-native';
import {
  Bike,
  BookOpen,
  Brain,
  Briefcase,
  Camera,
  Code,
  Coffee,
  Dumbbell,
  Flame,
  Footprints,
  Globe,
  GraduationCap,
  Hammer,
  Heart,
  House,
  Languages,
  Leaf,
  Moon,
  Mountain,
  Music,
  Palette,
  PenTool,
  Rocket,
  Sparkles,
  Target,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { hexToRgba } from '@/constants/design';

export const PILLAR_ICONS: Record<string, LucideIcon> = {
  target: Target,
  dumbbell: Dumbbell,
  footprints: Footprints,
  bike: Bike,
  heart: Heart,
  brain: Brain,
  book: BookOpen,
  graduation: GraduationCap,
  languages: Languages,
  wallet: Wallet,
  briefcase: Briefcase,
  rocket: Rocket,
  hammer: Hammer,
  pen: PenTool,
  code: Code,
  palette: Palette,
  music: Music,
  camera: Camera,
  users: Users,
  house: House,
  leaf: Leaf,
  mountain: Mountain,
  moon: Moon,
  coffee: Coffee,
  globe: Globe,
  flame: Flame,
  sparkles: Sparkles,
};

export const PILLAR_ICON_KEYS = Object.keys(PILLAR_ICONS);

const EMOJI_TO_KEY: Record<string, string> = {
  '💪': 'dumbbell', '🏋️': 'dumbbell', '🏃': 'footprints', '🚴': 'bike', '❤️': 'heart',
  '🧠': 'brain', '📚': 'book', '📖': 'book', '🎓': 'graduation', '💰': 'wallet', '💵': 'wallet',
  '💼': 'briefcase', '🚀': 'rocket', '🔨': 'hammer', '🛠️': 'hammer', '✍️': 'pen', '💻': 'code',
  '🎨': 'palette', '🎵': 'music', '📷': 'camera', '👨‍👩‍👧': 'users', '👪': 'users', '🏠': 'house',
  '🌱': 'leaf', '🧘': 'leaf', '⛰️': 'mountain', '🌙': 'moon', '☕': 'coffee', '🌍': 'globe',
  '🔥': 'flame', '✨': 'sparkles',
};

const NAME_HINTS: [RegExp, string][] = [
  [/body|physi|health|fit|gym|sport|train/i, 'dumbbell'],
  [/run|walk/i, 'footprints'],
  [/mind|mental|medit|calm|spirit/i, 'brain'],
  [/read|book|learn|study|skill/i, 'book'],
  [/money|financ|wealth|invest|income/i, 'wallet'],
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
];

export function resolvePillarIconKey(icon: string | null | undefined, name = ''): string {
  if (icon && PILLAR_ICONS[icon]) return icon;
  if (icon && EMOJI_TO_KEY[icon]) return EMOJI_TO_KEY[icon];
  for (const [re, key] of NAME_HINTS) if (re.test(name)) return key;
  return 'target';
}

/** Pillar glyph inside a soft tinted tile. */
export function PillarIcon({
  icon,
  name,
  color,
  size = 36,
  tinted = true,
}: {
  icon?: string | null;
  name?: string;
  color: string;
  size?: number;
  tinted?: boolean;
}) {
  const Glyph = PILLAR_ICONS[resolvePillarIconKey(icon, name)];
  const glyphSize = Math.round(size * 0.5);
  if (!tinted) return <Glyph size={glyphSize} color={color} strokeWidth={1.75} />;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: hexToRgba(color, 0.12),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Glyph size={glyphSize} color={color} strokeWidth={1.75} />
    </View>
  );
}
