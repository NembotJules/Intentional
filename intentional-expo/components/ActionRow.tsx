import type { ReactNode } from 'react';
import { View, Text } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import type { MetaGoal, DailyAction } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { getGoalTint } from '@/utils/goalColors';
import { Colors, FontFamily, Radius, Surface } from '@/constants/design';

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
      className="min-h-[76px] px-4 py-4 overflow-hidden"
      style={{
        backgroundColor: Surface.surface,
        borderWidth: 1,
        borderColor: Surface.rule,
        borderRadius: Radius.md,
        marginBottom: 8,
        opacity,
      }}
    >
      {children}
    </View>
  );
}

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
  const titleColor = Colors.textPrimary;
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
      <View className="absolute left-4 top-4 bottom-4 w-[3px] rounded-full" style={{ backgroundColor: toneColor }} />
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3 pl-4">
          <Text style={{ color: titleColor, fontFamily: FontFamily.bodySemiBold, fontSize: 17, lineHeight: 22 }}>
            {action.name}
          </Text>
          <Text style={{ color: statusColor, fontFamily: FontFamily.monoSemiBold, fontSize: 11, lineHeight: 15, letterSpacing: 0.8, marginTop: 2 }}>
            {typeLabel} - {isSession ? `${formatTargetMinutes(action.target_minutes)} TARGET` : 'BINARY'}
          </Text>
          <Text style={{ color: toneColor, fontFamily: FontFamily.body, fontSize: 15, lineHeight: 20, marginTop: 4 }}>
            {todayLine}
          </Text>
        </View>

        {isCompleted ? (
          <View className="w-11 h-11 rounded-full items-center justify-center" style={{ backgroundColor: toneColor }}>
            <Text style={{ color: Surface.surface, fontFamily: FontFamily.bodyBold, fontSize: 16 }}>✓</Text>
          </View>
        ) : isSession && clampedProgress > 0 ? (
          <Text style={{ color: toneColor, fontFamily: FontFamily.monoSemiBold, fontSize: 11 }}>{Math.round(clampedProgress * 100)}%</Text>
        ) : !isSession ? (
          <View className="w-11 h-11 items-center justify-center" pointerEvents="none">
            <Ionicons
              name={isHabitDone ? 'checkmark-circle' : 'ellipse-outline'}
              size={28}
              color={isHabitDone ? toneColor : Colors.textDim}
            />
          </View>
        ) : onStart ? (
          <TouchableOpacity onPress={onStart} className="px-4 py-2" style={{ borderWidth: 1, borderColor: toneBorder, borderRadius: Radius.full }}>
            <Text style={{ color: toneColor, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1.2 }}>START</Text>
          </TouchableOpacity>
        ) : (
          <Ionicons name="ellipse-outline" size={24} color={Colors.textDim} />
        )}
      </View>

      {isSession ? (
        <View className="mt-3 h-[6px] rounded-full overflow-hidden ml-4" style={{ backgroundColor: targetTint }}>
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
