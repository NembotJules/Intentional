import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import type { ReactNode } from 'react';

import { FontFamily, Surface } from '@/constants/design';

/** Progress ring for the dark focus room, drawn in the pillar's colour. */
export function FocusRing({
  size,
  progress,
  color,
  dim,
  children,
}: {
  size: number;
  progress: number;
  color: string;
  dim?: boolean;
  children?: ReactNode;
}) {
  const stroke = 10;
  const r = (size - stroke) / 2 - 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, progress));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,248,238,0.10)" strokeWidth={stroke} fill="rgba(255,248,238,0.03)" />
        {p > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeOpacity={dim ? 0.5 : 1}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${Math.max(0.001, c * p)} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}

type PillVariant = 'light' | 'dark' | 'danger';

/** Pill button for the dark focus room (Pause / Resume / End). */
export function FocusPill({
  label,
  icon,
  variant,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  variant: PillVariant;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const bg = variant === 'light' ? Surface.focusText : Surface.focusSurface;
  const fg = variant === 'light' ? Surface.focusCanvas : variant === 'danger' ? '#FF8A80' : Surface.focusText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        height: 58,
        borderRadius: 29,
        backgroundColor: bg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <Ionicons name={icon} size={19} color={fg} />
      <Text style={{ color: fg, fontFamily: FontFamily.bodyBold, fontSize: 18 }}>{label}</Text>
    </Pressable>
  );
}

/** 40px chip: ink when on, sand when off. */
export function Chip({ label, on, onPress, accessibilityLabel }: { label: string; on: boolean; onPress: () => void; accessibilityLabel?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => ({
        height: 40,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: on ? Surface.ink : Surface.surfaceRaised,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <Text style={{ color: on ? '#FFFFFF' : Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

/** Round sand stepper button (−/+). */
export function StepButton({ icon, onPress, accessibilityLabel }: { icon: 'remove' | 'add'; onPress: () => void; accessibilityLabel: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: pressed ? Surface.ruleStrong : Surface.surfaceRaised,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Ionicons name={icon} size={26} color={Surface.ink} />
    </Pressable>
  );
}

/** Small sand stat tile used on the completion screen. */
export function StatTile({ icon, label, value, color = Surface.ink }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: Surface.surfaceRaised, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name={icon} size={15} color={color} />
        <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodySemiBold, fontSize: 13 }}>{label}</Text>
      </View>
      <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 20, marginTop: 4 }}>{value}</Text>
    </View>
  );
}
