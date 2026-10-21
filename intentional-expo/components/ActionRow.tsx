import { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Check, Flame, Play } from 'lucide-react-native';
import type { MetaGoal, DailyAction, Objective } from '@/types';
import { FontFamily, Motion, Radius, Surface, Type, hexToRgba } from '@/constants/design';
import { PressableScale, ProgressBar } from '@/components/ui/motion';

type ActionRowProps = {
  goal: MetaGoal;
  action: DailyAction;
  progress: number;
  isCompleted: boolean;
  isHabitDone: boolean;
  /** Minutes logged today from focus sessions (sessions only). */
  minutesLoggedToday?: number;
  toneColor?: string;
  streak?: number;
  /** US-068: linked objective (goal) */
  objective?: Objective | null;
  /** US-069: set only on the single next habit that starts soon ("in 25 min"). */
  minutesUntilStart?: number;
  onStart?: () => void;
  onHabitToggle?: (done: boolean) => void;
  onLongPress?: () => void;
};

function formatTarget(mins: number) {
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const rest = Math.round(mins % 60);
    return rest ? `${hours}h ${rest}m` : `${hours}h`;
  }
  return `${mins} min`;
}

function formatShort(mins: number) {
  const m = Math.max(0, Math.floor(mins));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}

/** "07:00" → "7:00"; null/invalid → "Anytime". */
export function formatStartTime(time: string | null | undefined): string {
  if (!time) return 'Anytime';
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return 'Anytime';
  const h = Number(m[1]);
  if (h > 23 || Number(m[2]) > 59) return 'Anytime';
  return `${h}:${m[2]}`;
}

/** Round check that fills with the pillar color and pops the tick in. */
function HabitCheck({ done, color }: { done: boolean; color: string }) {
  const fill = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    fill.value = withSpring(done ? 1 : 0, Motion.spring);
  }, [done, fill]);

  const fillStyle = useAnimatedStyle(() => ({
    opacity: fill.value,
    transform: [{ scale: 0.5 + fill.value * 0.5 }],
  }));

  return (
    <View
      style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 2,
        borderColor: done ? color : hexToRgba(color, 0.45),
        backgroundColor: Surface.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={[
          { position: 'absolute', top: -2, left: -2, width: 34, height: 34, borderRadius: 17, backgroundColor: color, alignItems: 'center', justifyContent: 'center' },
          fillStyle,
        ]}
      >
        <Check size={18} color={Surface.surface} strokeWidth={3} />
      </Animated.View>
    </View>
  );
}

export function ActionRow({
  action,
  progress,
  isCompleted,
  isHabitDone,
  minutesLoggedToday = 0,
  toneColor = Surface.ink,
  streak = 0,
  objective,
  minutesUntilStart,
  onStart,
  onHabitToggle,
  onLongPress,
}: ActionRowProps) {
  const isSession = action.type === 'session';
  const dim = useSharedValue(isCompleted ? 1 : 0);
  useEffect(() => {
    dim.value = withTiming(isCompleted ? 1 : 0, { duration: Motion.duration });
  }, [isCompleted, dim]);
  const dimStyle = useAnimatedStyle(() => ({ opacity: 1 - dim.value * 0.4 }));

  // US-069: every habit due today reads "7:00 · 30 min" (or "Anytime · 30 min"); only the next one adds "in 25 min".
  const duration = isSession
    ? minutesLoggedToday > 0
      ? `${formatShort(minutesLoggedToday)} of ${formatTarget(action.target_minutes)}`
      : formatTarget(action.target_minutes)
    : action.target_minutes > 0
      ? formatTarget(action.target_minutes)
      : 'Check-off';
  const startsSoon = minutesUntilStart !== undefined && minutesUntilStart > 0 && !isCompleted;
  const meta = `${formatStartTime(action.reminder_time)} · ${duration}`;

  const onPress = isSession ? onStart : () => onHabitToggle?.(!isHabitDone);

  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={450}
      accessibilityRole="button"
      accessibilityLabel={isSession ? `Start ${action.name}` : `${isHabitDone ? 'Undo' : 'Complete'} ${action.name}`}
      style={{ marginBottom: 10 }}
    >
      <Animated.View
        style={[
          {
            backgroundColor: Surface.surfaceRaised,
            borderRadius: Radius.md,
            paddingHorizontal: 16,
            paddingVertical: 15,
          },
          dimStyle,
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          {!isSession && <HabitCheck done={isHabitDone} color={toneColor} />}

          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: objective ? 2 : 0 }}>
              <Text
                numberOfLines={1}
                style={[Type.heading, { flex: 1 }, isCompleted && !isSession ? { textDecorationLine: 'line-through', color: Surface.muted } : null]}
              >
                {action.name}
              </Text>
              {/* US-068: goal tag */}
              {objective && (
                <View style={{ backgroundColor: hexToRgba(toneColor, 0.14), borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text numberOfLines={1} style={{ fontFamily: FontFamily.bodyBold, fontSize: 12, color: toneColor, maxWidth: 100 }}>
                    {objective.title}
                  </Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 }}>
              <Text numberOfLines={1} style={[Type.number, { flexShrink: 1, fontFamily: FontFamily.bodySemiBold, fontSize: 14 }]}>
                {meta}
                {startsSoon ? <Text style={{ color: toneColor, fontFamily: FontFamily.bodyBold }}>{` · in ${minutesUntilStart} min`}</Text> : null}
              </Text>
              {streak >= 2 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Flame size={13} color={toneColor} strokeWidth={2.2} />
                  <Text style={[Type.number, { color: toneColor, fontSize: 14 }]}>{streak}</Text>
                </View>
              )}
            </View>
          </View>

          {isSession &&
            (isCompleted ? (
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: toneColor, alignItems: 'center', justifyContent: 'center' }}>
                <Check size={18} color={Surface.surface} strokeWidth={3} />
              </View>
            ) : (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  height: 34,
                  paddingHorizontal: 14,
                  borderRadius: 17,
                  backgroundColor: Surface.ink,
                }}
              >
                <Play size={12} color={Surface.surface} fill={Surface.surface} strokeWidth={2} />
                <Text style={{ color: Surface.surface, fontFamily: FontFamily.bodyBold, fontSize: 14, lineHeight: 17 }}>Start</Text>
              </View>
            ))}
        </View>

        {isSession && (
          <View style={{ marginTop: 13 }}>
            <ProgressBar progress={progress} color={toneColor} trackColor={hexToRgba(toneColor, 0.14)} height={8} />
          </View>
        )}
      </Animated.View>
    </PressableScale>
  );
}
