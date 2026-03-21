import { Text, Pressable, ViewStyle } from 'react-native';
import { Colors } from '@/constants/design';

type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  color?: string;
  variant?: 'filled' | 'ghost';
  size?: 'default' | 'small';
  disabled?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
};

export function PrimaryButton({
  title,
  onPress,
  color = Colors.accentBlue,
  variant = 'filled',
  size = 'default',
  disabled = false,
  style,
  fullWidth = true,
}: PrimaryButtonProps) {
  const isFilled = variant === 'filled' && !disabled;
  const backgroundColor = disabled
    ? '#2A2A2A'
    : isFilled
      ? color
      : 'transparent';
  const borderWidth = variant === 'ghost' && !disabled ? 1.5 : 0;
  const textColor = disabled
    ? Colors.textPrimary
    : variant === 'ghost'
      ? color
      : Colors.textInverse;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          backgroundColor,
          borderWidth,
          borderColor: color,
          opacity: disabled ? 0.8 : pressed ? 0.85 : 1,
          transform: [{ scale: disabled ? 1 : pressed ? 0.97 : 1 }],
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
        style,
      ]}
      className={`rounded-full justify-center items-center
        ${size === 'default' ? 'h-[50px] px-6' : 'h-9 px-4 min-w-[80px]'}`}
    >
      <Text
        style={{ color: textColor }}
        className={`font-semibold ${size === 'small' ? 'text-[15px]' : 'text-[17px]'}`}
      >
        {title}
      </Text>
    </Pressable>
  );
}
