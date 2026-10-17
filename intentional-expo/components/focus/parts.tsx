import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useEffect, useState, type ReactNode } from 'react';

import { FontFamily, Surface } from '@/constants/design';
import { Mascot } from '@/components/onboarding/Mascot';

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
      style={{
        flex: 1,
        height: 58,
        borderRadius: 29,
        backgroundColor: bg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: 1,
      }}
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
      style={{
        height: 40,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: on ? Surface.ink : Surface.surfaceRaised,
        alignItems: 'center',
        justifyContent: 'center',
      }}
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
      style={{
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: Surface.surfaceRaised,
        alignItems: 'center',
        justifyContent: 'center',
      }}
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

/**
 * "Leave now?" — shown when someone taps End mid-session. Keep going is the big, easy button;
 * ending is small and only unlocks after a few seconds, long enough for the urge to pass.
 */
export function LeaveSessionSheet({
  pillar,
  pillarColor,
  givenMins,
  remainingMins,
  onStay,
  onLeave,
}: {
  pillar: string;
  pillarColor: string;
  givenMins: number;
  remainingMins: number;
  onStay: () => void;
  onLeave: () => void;
}) {
  const WAIT = 5;
  const [left, setLeft] = useState(WAIT);
  useEffect(() => {
    const id = setInterval(() => setLeft((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);
  const locked = left > 0;
  return (
    <View
      accessibilityViewIsModal
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,18,17,0.96)', paddingHorizontal: 24, justifyContent: 'center' }}
    >
      <View style={{ alignItems: 'center' }}>
        <Mascot mood="sad" size={130} intensity={0.25} />
        <Text style={{ color: Surface.focusText, fontFamily: FontFamily.bodyBold, fontSize: 30, lineHeight: 36, textAlign: 'center', marginTop: 14 }}>
          Leave now?
        </Text>
        <Text style={{ color: Surface.focusMuted, fontFamily: FontFamily.bodySemiBold, fontSize: 17, lineHeight: 24, textAlign: 'center', marginTop: 10 }}>
          {remainingMins <= 10 ? (
            <>
              Only <Text style={{ color: Surface.focusText }}>{remainingMins} min</Text> left. You're almost there for{' '}
              <Text style={{ color: pillarColor }}>{pillar}</Text>.
            </>
          ) : givenMins > 0 ? (
            <>
              You've already given <Text style={{ color: Surface.focusText }}>{givenMins} min</Text> to <Text style={{ color: pillarColor }}>{pillar}</Text>.
              {' '}{remainingMins} min to go.
            </>
          ) : (
            <>
              This time was meant for <Text style={{ color: pillarColor }}>{pillar}</Text>.
            </>
          )}
        </Text>
        <Text style={{ color: Surface.focusFaint, fontFamily: FontFamily.body, fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 14 }}>
          The urge to stop usually fades in a minute or two. Flick only grows if you stay.
        </Text>
      </View>
      <View style={{ marginTop: 34, gap: 12 }}>
        <Pressable
          onPress={onStay}
          accessibilityRole="button"
          accessibilityLabel="Keep going"
          style={{ height: 58, borderRadius: 29, backgroundColor: Surface.focusText, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: Surface.focusCanvas, fontFamily: FontFamily.bodyBold, fontSize: 18 }}>Keep going</Text>
        </Pressable>
        <Pressable
          onPress={locked ? undefined : onLeave}
          disabled={locked}
          accessibilityRole="button"
          accessibilityLabel="End session anyway"
          accessibilityState={{ disabled: locked }}
          style={{ height: 48, alignItems: 'center', justifyContent: 'center', opacity: locked ? 0.45 : 1 }}
        >
          <Text style={{ color: Surface.focusMuted, fontFamily: FontFamily.bodySemiBold, fontSize: 15, textDecorationLine: locked ? 'none' : 'underline' }}>
            {locked ? `End anyway in ${left}…` : 'End anyway'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
