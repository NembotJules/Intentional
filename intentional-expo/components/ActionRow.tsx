import type { ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import type { MetaGoal, DailyAction } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { getGoalTint } from '@/utils/goalColors';

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
      className="min-h-[64px] rounded-lg px-[10px] py-2 mb-1 overflow-hidden"
      style={{ backgroundColor: '#161616', borderWidth: 0.5, borderColor: '#222222', opacity }}
    >
      {children}
    </View>
  );
}

/** US-014: type + target/habit + today's logged time, completed opacity 0.45 · US-015: START only (no double-fire) · US-016: whole-row habit tap */
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
  const statusColor = '#555555';
  const titleColor = '#D8D4CC';
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
      <View className="absolute left-[8px] top-[18px] bottom-[18px] w-[2px] rounded-full" style={{ backgroundColor: toneColor }} />
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3 pl-3">
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
              color={isHabitDone ? toneColor : '#333333'}
            />
          </View>
        ) : onStart ? (
          <TouchableOpacity onPress={onStart} className="rounded-sm px-2 py-1" style={{ borderWidth: 0.5, borderColor: toneBorder || toneColor }}>
            <Text className="text-[7px]" style={{ color: toneColor, letterSpacing: 1.5 }}>START</Text>
          </TouchableOpacity>
        ) : (
          <Ionicons name="ellipse-outline" size={16} color="#333333" />
        )}
      </View>

      {isSession ? (
        <View className="mt-1.5 h-[3px] rounded-full overflow-hidden ml-3" style={{ backgroundColor: targetTint }}>
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
    /** RNGH TouchableOpacity so parent Swipeable can still receive horizontal pan (RN Pressable blocks it). */
    return (
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => onHabitToggle?.(!isHabitDone)}
        className="mb-1"
      >
        <RowChrome opacity={rowOpacity}>{inner}</RowChrome>
      </TouchableOpacity>
    );
  }

  return <RowChrome opacity={rowOpacity}>{inner}</RowChrome>;
}
