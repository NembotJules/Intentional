import type { ReactNode } from 'react';
import { View, Text } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import type { MetaGoal, DailyAction } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { getGoalTint } from '@/utils/goalColors';
import { Colors, Surface } from '@/constants/design';

type ActionRowProps = {
  goal: MetaGoal;
  action: DailyAction;
  progress: number;
  isCompleted: boolean;
  isHabitDone: boolean;
  /** Minutes logged today from focus sessions (sessions only). */
  minutesLoggedToday?: number;
  toneColor?: string;
  onStart?: () => void;
  onHabitToggle?: (done: boolean) => void;
};

function formatTargetMinutes(mins: number) {
  if (mins >= 60) {
    const hours = mins / 60;
    return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
  }
  return `${mins}m`;
}

function toRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function RowChrome({ children, opacity }: { children: ReactNode; opacity: number }) {
  return (
    <View
      className="min-h-[64px] rounded-lg px-3 py-3 overflow-hidden"
      style={{
        backgroundColor: Surface.container,
        borderWidth: 0,
        marginBottom: 6,
        opacity,
      }}
    >
      {children}
    </View>
  );
}

/** US-014 · v1.1 addendum — surface shift, no card border; 2px goal accent bar */
export function ActionRow({
  goal,
  action,
  progress,
  isCompleted,
  isHabitDone,
  minutesLoggedToday = 0,
  toneColor = '#8B5CF6',
  onStart,
  onHabitToggle,
}: ActionRowProps) {
  const isSession = action.type === 'session';
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const statusColor = Colors.textMuted;
  const titleColor = Colors.textSecondary;
  const toneBorder = toRgba(toneColor, 0.28);
  const targetTint = getGoalTint(goal.id);

  const typeLabel = isSession ? 'SESSION' : 'HABIT';
  let todayLine: string;
  if (isSession) {
    todayLine = `${minutesLoggedToday}m / ${formatTargetMinutes(action.target_minutes)} today`;
  } else {
    todayLine = isHabitDone ? 'Done today · tap to undo' : 'Not done · tap to log';
  }

  const rowOpacity = isCompleted ? 0.45 : 1;

  const inner = (
    <>
      <View className="absolute left-3 top-3 bottom-3 w-0.5 rounded-full" style={{ backgroundColor: toneColor }} />
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3 pl-4">
          <Text className="text-[11px]" style={{ color: titleColor, fontWeight: '500' }}>
            {action.name}
          </Text>
          <Text className="text-[8px] mt-0.5 tracking-[0.4px]" style={{ color: statusColor }}>
            {typeLabel} · {isSession ? `${formatTargetMinutes(action.target_minutes)} target` : 'binary'}
          </Text>
          <Text className="text-[8px] mt-0.5 tracking-[0.3px]" style={{ color: toneColor, opacity: 0.9 }}>
            {todayLine}
          </Text>
        </View>

        {isCompleted ? (
          <View className="w-4 h-4 rounded-full items-center justify-center" style={{ backgroundColor: toneColor }}>
            <Text className="text-[8px] font-bold text-black">✓</Text>
          </View>
        ) : isSession && clampedProgress > 0 ? (
          <Text className="text-[8px] font-medium" style={{ color: toneColor }}>{Math.round(clampedProgress * 100)}%</Text>
        ) : !isSession ? (
          <View className="items-center justify-center" pointerEvents="none">
            <Ionicons
              name={isHabitDone ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={isHabitDone ? toneColor : Colors.textDim}
            />
          </View>
        ) : onStart ? (
          <TouchableOpacity onPress={onStart} className="rounded-sm px-2 py-1" style={{ borderWidth: 0.5, borderColor: toneBorder }}>
            <Text className="text-[7px]" style={{ color: toneColor, letterSpacing: 1.5 }}>START</Text>
          </TouchableOpacity>
        ) : (
          <Ionicons name="ellipse-outline" size={16} color={Colors.textDim} />
        )}
      </View>

      {isSession ? (
        <View className="mt-1.5 h-[3px] rounded-full overflow-hidden ml-4" style={{ backgroundColor: targetTint }}>
          <View
            className="h-full rounded-full"
            style={{
              width: `${Math.round(clampedProgress * 100)}%`,
              backgroundColor: toneColor,
            }}
          />
        </View>
      ) : null}
    </>
  );

  if (!isSession) {
    return (
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => onHabitToggle?.(!isHabitDone)}
        className="mb-0"
      >
        <RowChrome opacity={rowOpacity}>{inner}</RowChrome>
      </TouchableOpacity>
    );
  }

  return <RowChrome opacity={rowOpacity}>{inner}</RowChrome>;
}
