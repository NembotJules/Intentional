import { Text, Pressable } from 'react-native';
import { Colors, FontFamily, Radius, Surface, goalBorderColor } from '@/constants/design';

type GoalChipProps = {
  name: string;
  color: string;
  icon: string;
  useTint?: boolean;
  active?: boolean;
  onPress?: () => void;
};

export function GoalChip({ name, color, icon, useTint = true, active = false, onPress }: GoalChipProps) {
  const backgroundColor = active ? Surface.surfaceRaised : useTint ? color + '1F' : Surface.surface;
  const borderColor = active ? goalBorderColor(color) : useTint ? goalBorderColor(color) : Surface.rule;
  const textColor = active ? Colors.textPrimary : color;
  const hasIcon = icon.trim().length > 0;

  return (
    <Pressable
      onPress={onPress}
      className={`min-h-[34px] px-3 border flex-row items-center ${hasIcon ? 'gap-1' : ''}`}
      style={({ pressed }) => ({
        backgroundColor,
        borderColor,
        borderRadius: Radius.full,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {hasIcon ? (
        <Text style={{ color: textColor }} className="text-xs">
          {icon}
        </Text>
      ) : null}
      <Text
        numberOfLines={1}
        style={{ color: textColor, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 0.6, lineHeight: 15 }}
      >
        {name}
      </Text>
    </Pressable>
  );
}
