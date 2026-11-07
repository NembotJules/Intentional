/**
 * Pillar icons — US-105: glossy 3D stickers (components/ui/Sticker, Fluent Emoji, MIT) instead of Lucide line glyphs.
 * A pillar's `icon` column stores a key from services/pillarIcons (every key is a sticker); legacy emoji map to a
 * key, then the pillar's name does; any other emoji is drawn as is.
 */
import { Image, Text, View } from 'react-native';
import { hexToRgba } from '@/constants/design';
import { STICKERS } from '@/components/ui/Sticker';
import { PILLAR_ICON_KEYS, customEmoji, resolvePillarIconKey, type PillarIconKey } from '@/services/pillarIcons';

/** Every pillar key is a sticker of the same name. */
export const PILLAR_STICKERS: Record<PillarIconKey, (typeof STICKERS)[keyof typeof STICKERS]> = Object.fromEntries(
  PILLAR_ICON_KEYS.map((k) => [k, STICKERS[k]]),
) as Record<PillarIconKey, (typeof STICKERS)[keyof typeof STICKERS]>;

export { PILLAR_ICON_KEYS, customEmoji, resolvePillarIconKey };

/**
 * The pillar's sticker on a soft circle of its colour. `variant="solid"` uses a stronger tint;
 * `tinted={false}` renders the bare sticker (a little smaller than the circle would be).
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
  const emoji = customEmoji(icon);
  const inner = Math.round(size * (tinted ? 0.62 : 0.8));
  const glyph = emoji ? (
    <Text style={{ fontSize: Math.round(inner * 0.82), lineHeight: Math.round(inner * 1.05), textAlign: 'center' }}>{emoji}</Text>
  ) : (
    <Image source={PILLAR_STICKERS[resolvePillarIconKey(icon, name)]} style={{ width: inner, height: inner }} resizeMode="contain" />
  );
  if (!tinted) return <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>{glyph}</View>;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: hexToRgba(color.startsWith('#') ? color : '#F27B2E', variant === 'solid' ? 0.2 : 0.12),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {glyph}
    </View>
  );
}
