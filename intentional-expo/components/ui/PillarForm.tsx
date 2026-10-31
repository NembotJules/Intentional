/**
 * Shared form controls for creating and editing pillars and their habits,
 * used by the Goals sheet and the Goal Detail screen.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { Check, type LucideIcon } from 'lucide-react-native';
import { Colors, FontFamily, Radius, Surface, hexToRgba } from '@/constants/design';
import { PressableScale } from '@/components/ui/motion';
import { PILLAR_ICONS, PILLAR_ICON_KEYS, customEmoji, resolvePillarIconKey } from '@/components/ui/PillarIcon';
import { firstEmoji } from '@/services/pillarIcons';
import { formatDaysMask } from '@/services/habitSchedule';
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

/** US-068 habit duration chips (minutes). */
export const MINUTE_PRESETS = [5, 15, 30, 45, 60, 90];

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

/** The icon grid, plus "None fit? Use any emoji" so every pillar can have its own sign. */
export function IconPicker({ icon, name, color, onChange }: { icon: string; name: string; color: string; onChange: (key: string) => void }) {
  const emoji = customEmoji(icon);
  const selectedKey = emoji ? null : resolvePillarIconKey(icon, name);
  const [emojiText, setEmojiText] = useState(emoji ?? '');
  useEffect(() => setEmojiText(emoji ?? ''), [emoji]);
  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {PILLAR_ICON_KEYS.map((key) => {
          const Glyph = PILLAR_ICONS[key];
          const selected = selectedKey === key;
          return (
            <PressableScale
              key={key}
              onPress={() => {
                setEmojiText('');
                onChange(key);
              }}
              accessibilityLabel={`Icon ${key}`}
              aria-selected={selected}
              accessibilityState={{ selected }}
              scaleTo={0.9}
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected ? color : Surface.surfaceRaised,
              }}
            >
              <Glyph size={19} color={selected ? Surface.surface : Surface.muted} strokeWidth={selected ? 2.1 : 1.8} />
            </PressableScale>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
        <TextInput
          value={emojiText}
          onChangeText={(t) => {
            const e = firstEmoji(t);
            setEmojiText(e ?? '');
            // Clearing the field goes back to the glyph the name suggests.
            onChange(e ?? resolvePillarIconKey('', name));
          }}
          placeholder="🙂"
          placeholderTextColor={Surface.faint}
          accessibilityLabel="Use an emoji as the icon"
          style={{
            width: 54,
            height: 46,
            borderRadius: 23,
            textAlign: 'center',
            fontSize: 22,
            backgroundColor: emoji ? color : Surface.surfaceRaised,
            color: Surface.ink,
          }}
        />
        <Text style={{ flex: 1, fontFamily: FontFamily.bodySemiBold, fontSize: 14, lineHeight: 19, color: Surface.muted }}>
          None fit? Type any emoji here and it becomes the pillar's icon.
        </Text>
      </View>
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
            aria-selected={selected}
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
      aria-selected={on}
      accessibilityState={{ selected: on }}
      style={{ paddingHorizontal: 16, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? Surface.ink : Surface.surfaceRaised }}
    >
      <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: on ? Surface.surface : Surface.ink }}>{label}</Text>
    </PressableScale>
  );
}

/** Minimum habit duration: every habit is a real block of focus time (US-068). */
export const MIN_HABIT_MINUTES = 5;

/** Clamp a duration to the habit minimum (5 min). */
export function clampHabitMinutes(m: number): number {
  return Math.max(MIN_HABIT_MINUTES, Math.round(Number.isFinite(m) ? m : 0));
}

/** Preset minute chips (5 · 15 · 30 · 45 · 60 · 90) plus a "Custom" field (minimum 5). `color` is kept for API compatibility. */
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
  const [draft, setDraft] = useState('');
  const isPreset = MINUTE_PRESETS.includes(minutes);
  const custom = !isPreset || inputFocused;
  const draftN = Number(draft || '0');
  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {MINUTE_PRESETS.map((m) => (
          <Chip key={m} label={`${m} min`} on={minutes === m && !inputFocused} onPress={() => onChange(m)} />
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
            style={{ width: 64, paddingVertical: 4, textAlign: 'center', fontFamily: FontFamily.bodyBold, fontSize: 15, color: Surface.ink }}
            keyboardType="number-pad"
            accessibilityLabel="Custom minutes"
            placeholder="Custom"
            placeholderTextColor={Surface.muted}
            maxLength={3}
            value={inputFocused ? draft : !isPreset && minutes > 0 ? String(minutes) : ''}
            onChangeText={(t) => {
              const digits = t.replace(/\D/g, '');
              setDraft(digits);
              const n = Number(digits || '0');
              if (n >= MIN_HABIT_MINUTES) onChange(n);
            }}
            onFocus={() => {
              setDraft(!isPreset && minutes > 0 ? String(minutes) : '');
              setInputFocused(true);
              onInputFocus?.();
            }}
            onBlur={() => {
              setInputFocused(false);
              if (draft !== '' && draftN < MIN_HABIT_MINUTES) onChange(MIN_HABIT_MINUTES);
            }}
          />
          <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: Surface.muted }}>min</Text>
        </View>
      </View>
      {inputFocused && draft !== '' && draftN < MIN_HABIT_MINUTES ? (
        <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: Surface.muted, marginTop: 8 }}>At least {MIN_HABIT_MINUTES} min, so it counts.</Text>
      ) : null}
    </View>
  );
}

const DAY_LETTER = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export { formatDaysMask };

/** "7:00" from "07:00"; "Anytime" when unset. */
export function formatStartTime(time: string | null | undefined): string {
  if (!time) return 'Anytime';
  const [h, mm] = time.split(':');
  return `${Number(h)}:${mm}`;
}

/** US-069 schedule line: "Mon–Sat · 7:00 · 30 min" / "Every day · Anytime · 15 min". */
export function habitScheduleText(a: { type: string; target_minutes: number; reminder_time: string | null; days_mask?: number | null }): string {
  const duration = a.type === 'session' ? `${a.target_minutes} min` : 'no duration yet';
  return `${formatDaysMask(a.days_mask ?? 127)} · ${formatStartTime(a.reminder_time)} · ${duration}`;
}

/** US-069 weekday picker (M T W T F S S). The last selected day can't be turned off: a habit needs at least one day. */
export function WeekdayPicker({
  mask,
  color,
  onChange,
  emptyHint = "Tap the days you'll do it.",
}: {
  mask: number;
  color: string;
  onChange: (mask: number) => void;
  emptyHint?: string;
}) {
  const m = mask & 127;
  // Nothing is coloured until a day is tapped: what's coloured is exactly when the habit happens.
  const shortcut = (label: string, value: number) => (
    <PressableScale
      onPress={() => {
        hapticLight();
        onChange(value);
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-selected={m === value}
      accessibilityState={{ selected: m === value }}
      style={{ height: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: 'center', backgroundColor: m === value ? hexToRgba(color, 0.14) : Surface.surfaceRaised }}
    >
      <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 13, color: m === value ? color : Surface.muted }}>{label}</Text>
    </PressableScale>
  );
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {DAY_LETTER.map((day, idx) => {
          const bit = 1 << idx;
          const isSelected = (m & bit) !== 0;
          return (
            <PressableScale
              key={idx}
              onPress={() => {
                hapticLight();
                onChange(isSelected ? m & ~bit : m | bit);
              }}
              accessibilityRole="button"
              accessibilityLabel={DAY_LONG[idx]!}
              aria-selected={isSelected}
              accessibilityState={{ selected: isSelected }}
              style={{
                flex: 1,
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: Radius.md,
                backgroundColor: isSelected ? color : Surface.surface,
                borderWidth: 2,
                borderColor: isSelected ? color : Surface.rule,
              }}
            >
              <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: isSelected ? Surface.surface : Surface.muted }}>{day}</Text>
            </PressableScale>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <Text style={{ flex: 1, minWidth: 120, fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: m ? Surface.muted : Surface.ink }}>
          {m ? formatDaysMask(m) : emptyHint}
        </Text>
        {shortcut('Every day', 127)}
        {shortcut('Weekdays', 31)}
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
            aria-selected={active}
            accessibilityState={{ selected: active }}
            style={{
              flex: 1,
              borderRadius: Radius.md,
              padding: 14,
              borderWidth: 2,
              borderColor: active ? Surface.ink : 'transparent',
              backgroundColor: active ? Surface.surface : Surface.surfaceRaised,
            }}
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
