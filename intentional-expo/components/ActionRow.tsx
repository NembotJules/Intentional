import { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Check, Flame, Play } from 'lucide-react-native';
import type { MetaGoal, DailyAction } from '@/types';
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

  const meta = isSession
    ? minutesLoggedToday > 0
      ? `${formatShort(minutesLoggedToday)} of ${formatShort(action.target_minutes)} given`
      : formatTarget(action.target_minutes)
    : isHabitDone
      ? 'Done today'
      : 'Daily habit';

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
            <Text
              numberOfLines={1}
              style={[Type.heading, isCompleted && !isSession ? { textDecorationLine: 'line-through', color: Surface.muted } : null]}
            >
              {action.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 }}>
              <Text style={[Type.number, { fontFamily: FontFamily.bodySemiBold, fontSize: 14 }]}>{meta}</Text>
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
