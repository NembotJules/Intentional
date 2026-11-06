/**
 * US-098 · The shared building blocks of the "Flick's world" design: one card, one pair of pill buttons,
 * a stat tile, a big number. Every new screen uses these instead of hand-rolled styles.
 */
import type { ReactNode } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { AnimatedNumber, PressableScale, ProgressBar } from '@/components/ui/motion';
import { Elevation, FontFamily, Radius, Surface, Type } from '@/constants/design';

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
  tone?: 'white' | 'sand' | 'ink';
}) {
  const base: ViewStyle = {
    borderRadius: Radius.card,
    padding: 16,
    backgroundColor: tone === 'ink' ? Surface.ink : tone === 'sand' ? Surface.surfaceRaised : Surface.surface,
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

/** Pill buttons: primary = ink, secondary = sand. `size="lg"` is the 58-tall CTA. */
export function PillButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled,
  accessibilityLabel,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'inverse';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const h = size === 'lg' ? 58 : size === 'sm' ? 36 : 46;
  const bg = variant === 'primary' ? Surface.ink : variant === 'inverse' ? Surface.surface : Surface.surfaceRaised;
  const fg = variant === 'primary' ? Surface.surface : Surface.ink;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      style={[
        {
          height: h,
          borderRadius: h / 2,
          paddingHorizontal: size === 'sm' ? 14 : 20,
          backgroundColor: bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: disabled ? 0.35 : 1,
        },
        style,
      ]}
    >
      {icon}
      <Text style={{ color: fg, fontFamily: FontFamily.bodyBold, fontSize: size === 'lg' ? 18 : size === 'sm' ? 14 : 16 }}>{label}</Text>
    </PressableScale>
  );
}

/** A small square of truth: a big value and a short label. */
export function StatTile({ value, label, accessibilityLabel, accent }: { value: string; label: string; accessibilityLabel?: string; accent?: string }) {
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? `${label}: ${value}`}
      style={{ flex: 1, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 12, backgroundColor: Surface.surface, ...Elevation.card, alignItems: 'center' }}
    >
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
