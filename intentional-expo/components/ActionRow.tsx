import { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Check, Flame, Play } from 'lucide-react-native';
import type { MetaGoal, DailyAction } from '@/types';
import { Elevation, Motion, Radius, Surface, Type, hexToRgba } from '@/constants/design';
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
    const hours = mins / 60;
    return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
  }
  return `${mins} min`;
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
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1.5,
        borderColor: done ? color : Surface.ruleStrong,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={[
          { position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: color, alignItems: 'center', justifyContent: 'center' },
          fillStyle,
        ]}
      >
        <Check size={16} color={Surface.surface} strokeWidth={2.75} />
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
      ? `${minutesLoggedToday} of ${formatTarget(action.target_minutes)}`
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
            backgroundColor: Surface.surface,
            borderRadius: Radius.md + 2,
            paddingHorizontal: 16,
            paddingVertical: 14,
            ...Elevation.card,
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
              <Text style={Type.number}>{meta}</Text>
              {streak >= 2 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Flame size={13} color={toneColor} strokeWidth={2} />
                  <Text style={[Type.number, { color: toneColor }]}>{streak}</Text>
                </View>
              )}
            </View>
          </View>

          {isSession &&
            (isCompleted ? (
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: toneColor, alignItems: 'center', justifyContent: 'center' }}>
                <Check size={18} color={Surface.surface} strokeWidth={2.75} />
              </View>
            ) : (
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: hexToRgba(toneColor, 0.12),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Play size={16} color={toneColor} fill={toneColor} strokeWidth={2} style={{ marginLeft: 2 }} />
              </View>
            ))}
        </View>

        {isSession && (
          <View style={{ marginTop: 12 }}>
            <ProgressBar progress={progress} color={toneColor} trackColor={hexToRgba(toneColor, 0.12)} height={5} />
          </View>
        )}
      </Animated.View>
    </PressableScale>
  );
}
