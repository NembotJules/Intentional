import { Text, Pressable } from 'react-native';
import { Colors } from '@/constants/design';

type GoalChipProps = {
  name: string;
  color: string;
  icon: string;
  useTint?: boolean;
  active?: boolean;
  onPress?: () => void;
};

export function GoalChip({ name, color, icon, useTint = true, active = false, onPress }: GoalChipProps) {
  const backgroundColor = active ? color : useTint ? color + '1A' : 'transparent';
  const borderColor = active ? color : color;
  const textColor = active ? Colors.textInverse : color;
  const hasIcon = icon.trim().length > 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor,
        borderColor,
        opacity: pressed ? 0.85 : 1,
      })}
      className={`min-h-[24px] px-2.5 rounded-full border flex-row items-center ${hasIcon ? 'gap-1' : ''}`}
    >
      {hasIcon ? (
        <Text style={{ color: textColor }} className="text-xs">
          {icon}
        </Text>
      ) : null}
      <Text
        numberOfLines={1}
        style={{ color: textColor, lineHeight: 14 }}
        className="text-[13px] font-semibold"
      >
        {name}
      </Text>
    </Pressable>
  );
}
