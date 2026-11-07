/**
 * US-098 · The shared building blocks of the "Flick's world" design: one card, one pair of pill buttons,
 * a stat tile, a big number. Every new screen uses these instead of hand-rolled styles.
 */
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { hapticLight } from '@/utils/haptics';
import { AnimatedNumber, PressableScale, ProgressBar } from '@/components/ui/motion';
import { Accent, Elevation, FontFamily, Radius, Surface, Type } from '@/constants/design';
import { Sticker, type StickerName } from '@/components/ui/Sticker';

/** The one card: white on the cream canvas, 24 radius, soft paper shadow. Pressable when given onPress. */
export function Card({
  children,
  onPress,
  style,
  accessibilityLabel,
  tone = 'white',
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** US-111: 'ground' = a translucent dark card for white text on Flick's ground. */
  tone?: 'white' | 'sand' | 'ink' | 'ground';
}) {
  const base: ViewStyle = {
    borderRadius: Radius.card,
    padding: 16,
    backgroundColor: tone === 'ink' ? Surface.ink : tone === 'ground' ? 'rgba(0,0,0,0.13)' : tone === 'sand' ? Surface.surfaceRaised : Surface.surface,
    ...(tone === 'white' ? Elevation.card : null),
  };
  if (!onPress)
    return (
      <View style={[base, style]} accessibilityLabel={accessibilityLabel}>
        {children}
      </View>
    );
  return (
    <PressableScale onPress={onPress} scaleTo={0.985} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={[base, style]}>
      {children}
    </PressableScale>
  );
}

/**
 * Pill buttons. US-110: primary is the blue 3D button (a darker base shows under the face, the face sinks on press);
 * secondary is a flat light-grey pill; inverse is white. `size="lg"` is the 58-tall CTA.
 */
export function PillButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled,
  accessibilityLabel,
  style,
  color,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'inverse' | 'ink';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  /** Face colour for a primary button (default blue). */
  color?: string;
}) {
  const h = size === 'lg' ? 58 : size === 'sm' ? 36 : 46;
  const raised = variant === 'primary' || variant === 'ink';
  const face = variant === 'primary' ? color ?? Accent.blue : variant === 'ink' ? Surface.ink : variant === 'inverse' ? Surface.surface : Surface.track;
  const base = variant === 'primary' ? (color ? shade(color, 0.22) : Accent.blueDeep) : '#000000';
  const fg = raised ? Surface.surface : Surface.ink;
  const edge = raised ? (size === 'sm' ? 3 : 4) : 0;
  const [down, setDown] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setDown(true)}
      onPressOut={() => setDown(false)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      style={[{ height: h + edge, borderRadius: h / 2, backgroundColor: raised ? base : 'transparent', opacity: disabled ? 0.35 : 1 }, style]}
    >
      <View
        style={{
          height: h,
          borderRadius: h / 2,
          paddingHorizontal: size === 'sm' ? 14 : 20,
          backgroundColor: face,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          transform: [{ translateY: down && raised ? edge - 1 : 0 }],
        }}
      >
        {icon}
        <Text style={{ color: fg, fontFamily: FontFamily.bodyBold, fontSize: size === 'lg' ? 18 : size === 'sm' ? 14 : 16 }}>{label}</Text>
      </View>
    </Pressable>
  );
}

/** Darkens a #rrggbb colour by `k` (0–1), for the base of a 3D button. */
export function shade(hex: string, k: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const c = (v: number) => Math.max(0, Math.round(v * (1 - k)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('')}`;
}

/** US-110 · Segmented control: a light-grey track, the chosen option is a filled pill. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  color = Accent.blue,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  color?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', padding: 4, borderRadius: 999, backgroundColor: Surface.track }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              hapticLight();
              onChange(o.value);
            }}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            aria-selected={on}
            style={{ flex: 1, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? color : 'transparent' }}
          >
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: on ? Surface.surface : Surface.greyText }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** US-110 · The text-field look: light grey, rounded, a hairline border. Spread into a TextInput's style. */
export const fieldStyle = {
  minHeight: 54,
  borderRadius: 18,
  borderWidth: 1,
  borderColor: Surface.fieldBorder,
  backgroundColor: Surface.field,
  paddingHorizontal: 18,
  fontFamily: FontFamily.bodyBold,
  fontSize: 17,
  color: Surface.ink,
} as const;

/** US-110 · A big heavy number with a small unit after it: "25" + "m", "98" + "%". */
export function Num({ value, unit, size = 44, color = Surface.ink, unitColor }: { value: string; unit?: string; size?: number; color?: string; unitColor?: string }) {
  return (
    <Text style={{ fontFamily: FontFamily.bodyBlack, fontSize: size, lineHeight: Math.round(size * 1.12), color, letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}>
      {value}
      {unit ? <Text style={{ fontSize: Math.round(size * 0.48), color: unitColor ?? color, letterSpacing: 0 }}>{unit}</Text> : null}
    </Text>
  );
}

/** Splits "1h 25m" / "25m" / "4" into the big part and its unit for <Num>: "1h 25" + "m". */
export function splitUnit(s: string): { value: string; unit: string } {
  const m = /^(.*?\d)([a-zA-Z%]+)$/.exec(s.trim());
  return m ? { value: m[1], unit: m[2] } : { value: s, unit: '' };
}

/** A small square of truth: a sticker (US-105), a big value and a short label. */
export function StatTile({
  value,
  label,
  accessibilityLabel,
  accent,
  sticker,
}: {
  value: string;
  label: string;
  accessibilityLabel?: string;
  accent?: string;
  sticker?: StickerName;
}) {
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? `${label}: ${value}`}
      style={{ flex: 1, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 12, backgroundColor: Surface.surface, ...Elevation.card, alignItems: 'center' }}
    >
      {sticker ? (
        <View style={{ marginBottom: 6 }}>
          <Sticker name={sticker} size={30} />
        </View>
      ) : null}
      <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 24, lineHeight: 28, color: accent ?? Surface.ink, letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text numberOfLines={1} style={{ ...Type.meta, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

/** The one big number of a screen, counting up, with an optional bar and a short line under it. */
export function BigNumber({
  value,
  format,
  label,
  progress,
  barColor = Surface.ink,
  accessibilityLabel,
}: {
  value: number;
  format: (n: number) => string;
  label: string;
  progress?: number | null;
  barColor?: string;
  accessibilityLabel?: string;
}) {
  return (
    <View accessible accessibilityLabel={accessibilityLabel ?? `${format(value)} ${label}`}>
      <AnimatedNumber value={value} format={format} style={Type.displayXL} />
      <Text style={{ ...Type.body, color: Surface.muted, marginTop: 2 }}>{label}</Text>
      {progress != null ? (
        <View style={{ marginTop: 12 }}>
          <ProgressBar progress={Math.max(0, Math.min(1, progress))} color={barColor} trackColor={Surface.hill} height={10} />
        </View>
      ) : null}
    </View>
  );
}
