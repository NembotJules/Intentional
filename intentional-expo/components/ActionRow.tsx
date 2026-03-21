import { View, Text, Pressable } from 'react-native';
import type { MetaGoal, DailyAction } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { getGoalTint } from '@/utils/goalColors';

type ActionRowProps = {
  goal: MetaGoal;
  action: DailyAction;
  progress: number;
  isCompleted: boolean;
  isHabitDone: boolean;
  toneColor?: string;
  onStart?: () => void;
  onHabitToggle?: (done: boolean) => void;
};

function formatTargetMinutes(mins: number) {
  if (mins >= 60) {
    const hours = mins / 60;
    return Number.isInteger(hours) ? `${hours}h target` : `${hours.toFixed(1)}h target`;
  }
  return `${mins}m target`;
}

function toRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function ActionRow({
  goal,
  action,
  progress,
  isCompleted,
  isHabitDone,
  toneColor = '#8B5CF6',
  onStart,
  onHabitToggle,
}: ActionRowProps) {
  const isSession = action.type === 'session';
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const statusColor = '#555555';
  const titleColor = '#D8D4CC';
  const cardColor = '#161616';
  const borderColor = '#222222';
  const targetText = `${formatTargetMinutes(action.target_minutes)} • ${goal.name}`;
  const toneBorder = toRgba(toneColor, 0.28);
  const targetTint = getGoalTint(goal.id);

  return (
    <Pressable
      onPress={isSession && onStart && !isCompleted ? onStart : undefined}
      className="min-h-[64px] rounded-lg px-[10px] py-2 mb-1 overflow-hidden"
      style={{ backgroundColor: cardColor, borderWidth: 0.5, borderColor }}
    >
      <View className="absolute left-[8px] top-[18px] bottom-[18px] w-[2px] rounded-full" style={{ backgroundColor: toneColor }} />
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3 pl-3">
          <Text className="text-[11px]" style={{ color: titleColor, fontWeight: '500' }}>
            {action.name}
          </Text>
          <Text className="text-[8px] mt-0.5 tracking-[0.4px]" style={{ color: statusColor }}>
            {targetText}
          </Text>
        </View>

        {isCompleted ? (
          <View className="w-4 h-4 rounded-full items-center justify-center" style={{ backgroundColor: toneColor }}>
            <Text className="text-[8px] font-bold text-black">✓</Text>
          </View>
        ) : isSession && clampedProgress > 0 ? (
          <Text className="text-[8px] font-medium" style={{ color: toneColor }}>{Math.round(clampedProgress * 100)}%</Text>
        ) : !isSession ? (
          <Pressable onPress={() => onHabitToggle?.(!isHabitDone)} hitSlop={8}>
            <Ionicons
              name={isHabitDone ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={isHabitDone ? toneColor : '#333333'}
            />
          </Pressable>
        ) : onStart ? (
          <Pressable
            onPress={onStart}
            className="rounded-sm px-2 py-1"
            style={{ borderWidth: 0.5, borderColor: toneBorder || toneColor }}
          >
            <Text className="text-[7px]" style={{ color: toneColor, letterSpacing: 1.5 }}>START</Text>
          </Pressable>
        ) : (
          <Ionicons name="ellipse-outline" size={16} color="#333333" />
        )}
      </View>

      <View className="mt-1.5 h-[3px] rounded-full overflow-hidden ml-3" style={{ backgroundColor: targetTint }}>
        <View
          className="h-full rounded-full"
          style={{
            width: `${Math.round(clampedProgress * 100)}%`,
            backgroundColor: toneColor,
          }}
        />
      </View>
    </Pressable>
  );
}
