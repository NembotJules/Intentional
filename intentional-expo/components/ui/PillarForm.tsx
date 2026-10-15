/**
 * Shared form controls for creating and editing pillars and their actions,
 * used by the Goals sheet and the Goal Detail screen.
 */
import { useState, type ReactNode } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { Check, type LucideIcon } from 'lucide-react-native';
import { Colors, FontFamily, Radius, Surface } from '@/constants/design';
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

/** Bold little section label, as in onboarding ("How do you track it?"). */
export function FieldLabel({ children }: { children: string }) {
  return <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, lineHeight: 20, color: Surface.ink, marginBottom: 10 }}>{children}</Text>;
}

/** The sand text field from onboarding: 58 tall, radius 16, bold ink text. */
export const sandInputStyle = {
  minHeight: 58,
  borderRadius: 16,
  backgroundColor: Surface.surfaceRaised,
  paddingHorizontal: 18,
  fontFamily: FontFamily.bodyBold,
  fontSize: 19,
  color: Surface.ink,
} as const;

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
            accessibilityState={{ selected }}
            scaleTo={0.9}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? color : Surface.surfaceRaised,
            }}
          >
            <Glyph size={20} color={selected ? '#FFFFFF' : Surface.muted} strokeWidth={selected ? 2.1 : 1.8} />
          </PressableScale>
        );
      })}
    </View>
  );
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {GOAL_COLOR_PRESETS.map((c) => {
        const selected = value === c;
        return (
          <PressableScale
            key={c}
            onPress={() => onChange(c)}
            accessibilityLabel={`Color ${c}`}
            accessibilityState={{ selected }}
            scaleTo={0.88}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              borderWidth: 2,
              borderColor: selected ? Surface.ink : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c, alignItems: 'center', justifyContent: 'center' }}>
              {selected && <Check size={16} color={Surface.surface} strokeWidth={3} />}
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** A 40px pill chip: ink when on, sand when off. */
export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <PressableScale
      onPress={() => {
        hapticLight();
        onPress();
      }}
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={{ paddingHorizontal: 16, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? Surface.ink : Surface.surfaceRaised }}
    >
      <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: on ? Surface.surface : Surface.ink }}>{label}</Text>
    </PressableScale>
  );
}

/** Preset minute chips plus a free-entry field. `color` is kept for API compatibility. */
export function DurationPicker({
  minutes,
  onChange,
  onInputFocus,
}: {
  minutes: number;
  color?: string;
  onChange: (m: number) => void;
  onInputFocus?: () => void;
}) {
  const [inputFocused, setInputFocused] = useState(false);
  const custom = !MINUTE_PRESETS.includes(minutes) || inputFocused;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {MINUTE_PRESETS.map((m) => (
        <Chip key={m} label={m < 60 ? `${m} min` : `${m / 60}h`} on={minutes === m && !inputFocused} onPress={() => onChange(m)} />
      ))}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          height: 40,
          paddingHorizontal: 12,
          borderRadius: 20,
          backgroundColor: custom ? Surface.surface : Surface.surfaceRaised,
          borderWidth: 2,
          borderColor: custom ? Surface.ink : 'transparent',
        }}
      >
        <TextInput
          style={{ width: 40, paddingVertical: 4, textAlign: 'center', fontFamily: FontFamily.bodyBold, fontSize: 15, color: Surface.ink }}
          keyboardType="number-pad"
          accessibilityLabel="Custom minutes"
          value={minutes > 0 ? String(minutes) : ''}
          onChangeText={(t) => onChange(Number(t.replace(/\D/g, '') || '0'))}
          onFocus={() => {
            setInputFocused(true);
            onInputFocus?.();
          }}
          onBlur={() => setInputFocused(false)}
        />
        <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: Surface.muted }}>min</Text>
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
        width: boxed ? 36 : 22,
        height: boxed ? 36 : 20,
        borderRadius: boxed ? 18 : 6,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: boxed ? Surface.surface : 'transparent',
        opacity: disabled ? 0.25 : 1,
      }}
    >
      {children}
    </PressableScale>
  );
}

/**
 * Two (or more) option cards, as in onboarding's "How do you track it?":
 * sand when off, white with a 2px ink border when on. `color` tints the icon.
 */
export function Segmented({
  value,
  options,
  color,
  onChange,
}: {
  value: string;
  options: { value: string; label: string; hint?: string; Icon: LucideIcon }[];
  color: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              hapticLight();
              onChange(o.value);
            }}
            accessibilityRole="button"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: active }}
            style={({ pressed }) => ({
              flex: 1,
              borderRadius: Radius.md,
              padding: 14,
              borderWidth: 2,
              borderColor: active ? Surface.ink : 'transparent',
              backgroundColor: active ? Surface.surface : Surface.surfaceRaised,
              transform: [{ scale: pressed ? 0.985 : 1 }],
            })}
          >
            <o.Icon size={22} color={active ? color : Surface.ink} strokeWidth={2} />
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: Surface.ink, marginTop: 6 }}>{o.label}</Text>
            {o.hint ? <Text style={{ fontFamily: FontFamily.body, fontSize: 13, lineHeight: 17, color: Surface.muted, marginTop: 2 }}>{o.hint}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
