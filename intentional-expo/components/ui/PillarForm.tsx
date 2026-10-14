/**
 * Shared form controls for creating and editing pillars and their actions,
 * used by the Goals sheet and the Goal Detail screen.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Check, type LucideIcon } from 'lucide-react-native';
import { Colors, Elevation, FontFamily, Motion, Radius, Surface, Type, hexToRgba } from '@/constants/design';
import { PressableScale } from '@/components/ui/motion';
import { PILLAR_ICONS, PILLAR_ICON_KEYS, resolvePillarIconKey } from '@/components/ui/PillarIcon';
import { hapticLight } from '@/utils/haptics';

/** The four onboarding pillar colors, plus four quieter companions for pillars five and up. */
export const GOAL_COLOR_PRESETS = [
  Colors.goalPhysique,
  Colors.goalFinances,
  Colors.goalMind,
  Colors.goalSkills,
  '#8E4FA8',
  '#1F8A8A',
  '#C2456E',
  '#4F5D6B',
];

export const MINUTE_PRESETS = [25, 45, 60, 90];

export function FieldLabel({ children }: { children: string }) {
  return <Text style={[Type.meta, { marginBottom: 10 }]}>{children}</Text>;
}

export function IconPicker({ icon, name, color, onChange }: { icon: string; name: string; color: string; onChange: (key: string) => void }) {
  const selectedKey = resolvePillarIconKey(icon, name);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {PILLAR_ICON_KEYS.map((key) => {
        const Glyph = PILLAR_ICONS[key];
        const selected = selectedKey === key;
        return (
          <PressableScale
            key={key}
            onPress={() => onChange(key)}
            accessibilityLabel={`Icon ${key}`}
            scaleTo={0.9}
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? hexToRgba(color, 0.14) : Surface.surface,
              borderWidth: 1.5,
              borderColor: selected ? color : 'transparent',
            }}
          >
            <Glyph size={20} color={selected ? color : Surface.muted} strokeWidth={1.8} />
          </PressableScale>
        );
      })}
    </View>
  );
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {GOAL_COLOR_PRESETS.map((c) => {
        const selected = value === c;
        return (
          <PressableScale
            key={c}
            onPress={() => onChange(c)}
            accessibilityLabel={`Color ${c}`}
            scaleTo={0.88}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: c,
              alignItems: 'center',
              justifyContent: 'center',
              ...(selected ? { shadowColor: c, shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 } : null),
            }}
          >
            {selected && <Check size={16} color={Surface.surface} strokeWidth={3} />}
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Preset minute chips plus a free-entry field. */
export function DurationPicker({
  minutes,
  color,
  onChange,
  onInputFocus,
}: {
  minutes: number;
  color: string;
  onChange: (m: number) => void;
  onInputFocus?: () => void;
}) {
  const [inputFocused, setInputFocused] = useState(false);
  const custom = !MINUTE_PRESETS.includes(minutes) || inputFocused;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {MINUTE_PRESETS.map((m) => {
        const selected = minutes === m && !inputFocused;
        return (
          <PressableScale
            key={m}
            onPress={() => onChange(m)}
            scaleTo={0.92}
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: selected ? color : Surface.canvas }}
          >
            <Text style={[Type.meta, { color: selected ? Surface.surface : Surface.ink, fontSize: 14 }]}>{m < 60 ? `${m}m` : `${m / 60}h`}</Text>
          </PressableScale>
        );
      })}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 12,
          borderRadius: Radius.full,
          backgroundColor: Surface.canvas,
          borderWidth: 1.5,
          borderColor: custom ? color : 'transparent',
        }}
      >
        <TextInput
          style={{ width: 40, paddingVertical: 6, textAlign: 'center', fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: Surface.ink }}
          keyboardType="number-pad"
          value={minutes > 0 ? String(minutes) : ''}
          onChangeText={(t) => onChange(Number(t.replace(/\D/g, '') || '0'))}
          onFocus={() => {
            setInputFocused(true);
            onInputFocus?.();
          }}
          onBlur={() => setInputFocused(false)}
        />
        <Text style={Type.meta}>min</Text>
      </View>
    </View>
  );
}

/** Small round icon button used for row-level controls. */
export function IconTap({
  children,
  onPress,
  disabled,
  label,
  boxed,
}: {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  label: string;
  boxed?: boolean;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      scaleTo={0.85}
      hitSlop={4}
      style={{
        width: boxed ? 34 : 22,
        height: boxed ? 34 : 20,
        borderRadius: boxed ? 17 : 6,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: boxed ? Surface.canvas : 'transparent',
        opacity: disabled ? 0.25 : 1,
      }}
    >
      {children}
    </PressableScale>
  );
}

/** Two-option pill switch whose highlight slides between options. */
export function Segmented({
  value,
  options,
  color,
  onChange,
}: {
  value: string;
  options: { value: string; label: string; Icon: LucideIcon }[];
  color: string;
  onChange: (v: string) => void;
}) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segment = width > 0 ? (width - 8) / options.length : 0;
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withSpring(index * segment, Motion.spring);
  }, [index, segment, x]);
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', padding: 4, borderRadius: Radius.full, backgroundColor: Surface.canvas }}
    >
      {segment > 0 && (
        <Animated.View
          style={[
            { position: 'absolute', top: 4, left: 4, bottom: 4, width: segment, borderRadius: Radius.full, backgroundColor: Surface.surface, ...Elevation.card },
            pillStyle,
          ]}
        />
      )}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              hapticLight();
              onChange(o.value);
            }}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9 }}
          >
            <o.Icon size={15} color={active ? color : Surface.muted} strokeWidth={2} />
            <Text style={[Type.meta, { color: active ? Surface.ink : Surface.muted, fontSize: 14 }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
