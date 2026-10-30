/**
 * Pillar icons — a curated Lucide line set (keys and matching in services/pillarIcons). A pillar's `icon` column
 * stores one of the keys; legacy emoji map to a key, then the pillar's name does; any other emoji is drawn as is.
 */
import { Text, View } from 'react-native';
import {
  Apple,
  Baby,
  Banknote,
  Bike,
  BookOpen,
  Brain,
  Briefcase,
  Camera,
  Church,
  Code,
  Coffee,
  Coins,
  Dog,
  Dumbbell,
  Film,
  Flame,
  Footprints,
  Gamepad2,
  Gem,
  Globe,
  GraduationCap,
  Hammer,
  HandHeart,
  Heart,
  House,
  Landmark,
  Languages,
  Laptop,
  Leaf,
  Mic,
  Moon,
  Mountain,
  Music,
  Palette,
  PenTool,
  PiggyBank,
  Plane,
  Rocket,
  Salad,
  Smile,
  Sparkles,
  Sprout,
  Stethoscope,
  Sun,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Utensils,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { hexToRgba } from '@/constants/design';
import { PILLAR_ICON_KEYS, customEmoji, resolvePillarIconKey, type PillarIconKey } from '@/services/pillarIcons';

export const PILLAR_ICONS: Record<PillarIconKey, LucideIcon> = {
  target: Target,
  dumbbell: Dumbbell,
  footprints: Footprints,
  bike: Bike,
  heart: Heart,
  apple: Apple,
  salad: Salad,
  stethoscope: Stethoscope,
  moon: Moon,
  brain: Brain,
  book: BookOpen,
  graduation: GraduationCap,
  languages: Languages,
  sun: Sun,
  church: Church,
  wallet: Wallet,
  piggybank: PiggyBank,
  banknote: Banknote,
  coins: Coins,
  trending: TrendingUp,
  landmark: Landmark,
  briefcase: Briefcase,
  rocket: Rocket,
  laptop: Laptop,
  hammer: Hammer,
  pen: PenTool,
  code: Code,
  palette: Palette,
  music: Music,
  mic: Mic,
  camera: Camera,
  film: Film,
  users: Users,
  handheart: HandHeart,
  baby: Baby,
  house: House,
  dog: Dog,
  utensils: Utensils,
  coffee: Coffee,
  plane: Plane,
  globe: Globe,
  mountain: Mountain,
  leaf: Leaf,
  sprout: Sprout,
  gamepad: Gamepad2,
  trophy: Trophy,
  gem: Gem,
  smile: Smile,
  flame: Flame,
  sparkles: Sparkles,
};

export { PILLAR_ICON_KEYS, customEmoji, resolvePillarIconKey };

/**
 * Pillar glyph in a round coloured circle (the onboarding look): solid pillar
 * colour with a white glyph. `variant="soft"` keeps a pale tinted circle with a
 * coloured glyph; `tinted={false}` renders the bare glyph.
 */
export function PillarIcon({
  icon,
  name,
  color,
  size = 36,
  tinted = true,
  variant = 'solid',
}: {
  icon?: string | null;
  name?: string;
  color: string;
  size?: number;
  tinted?: boolean;
  variant?: 'solid' | 'soft';
}) {
  const Glyph = PILLAR_ICONS[resolvePillarIconKey(icon, name)];
  const emoji = customEmoji(icon);
  const glyphSize = Math.round(size * 0.52);
  const emojiGlyph = emoji ? <Text style={{ fontSize: Math.round(size * 0.5), lineHeight: Math.round(size * 0.62), textAlign: 'center' }}>{emoji}</Text> : null;
  if (!tinted) return emojiGlyph ?? <Glyph size={glyphSize} color={color} strokeWidth={1.9} />;
  const solid = variant === 'solid';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: solid ? color : hexToRgba(color, 0.14),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {emojiGlyph ?? <Glyph size={glyphSize} color={solid ? '#FFFFFF' : color} strokeWidth={solid ? 2.1 : 1.9} />}
    </View>
  );
}
