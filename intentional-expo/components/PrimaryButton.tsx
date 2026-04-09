import { Text, Pressable, ViewStyle } from 'react-native';
import { Colors, ghostBorder, goalBorderColor, Surface } from '@/constants/design';

export type PrimaryButtonAppearance = 'filled' | 'ghost' | 'goalOutline';

type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  /** Goal / accent color for ghost & goalOutline */
  color?: string;
  appearance?: PrimaryButtonAppearance;
  /** @deprecated use appearance */
  variant?: 'filled' | 'ghost';
  size?: 'default' | 'small';
  disabled?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
  /** Append spec arrow (v1.1 CTA) */
  showArrow?: boolean;
};

/**
 * v1.1 addendum §7:
 * - filled: solid white, dark text (primary decision)
 * - goalOutline: transparent + goal border 30% + goal text
 * - ghost: bordered with `color` (legacy / tonal)
 */
export function PrimaryButton({
  title,
  onPress,
  color = Colors.textPrimary,
  appearance: appearanceProp,
  variant,
  size = 'default',
  disabled = false,
  style,
  fullWidth = true,
  showArrow = true,
}: PrimaryButtonProps) {
  const appearance: PrimaryButtonAppearance =
    appearanceProp ?? (variant === 'ghost' ? 'ghost' : 'filled');

  const wantsArrow =
    showArrow !== false &&
    size === 'default' &&
    (appearance === 'filled' || appearance === 'goalOutline');
  const label = wantsArrow ? `${title.toUpperCase()} →` : title;

  const isFilled = appearance === 'filled';
  const isGoalOutline = appearance === 'goalOutline';

  let backgroundColor: string = 'transparent';
  let borderWidth = 0;
  let borderColor: string = 'transparent';
  let textColor: string = Colors.textPrimary;

  if (disabled) {
    backgroundColor = isFilled ? Surface.highest : 'transparent';
    textColor = Colors.textMuted;
    if (isGoalOutline || appearance === 'ghost') {
      borderWidth = 1;
      borderColor = ghostBorder;
    }
  } else if (isFilled) {
    backgroundColor = '#ffffff';
    textColor = Colors.textInverse;
    borderWidth = 0;
  } else if (isGoalOutline) {
    borderWidth = 1;
    borderColor = goalBorderColor(color);
    textColor = color;
  } else {
    /* ghost */
    borderWidth = 1;
    borderColor = color;
    textColor = color;
  }

  const py = size === 'default' ? (isFilled ? 18 : 16) : 12;
  const fontSize = 11;
  const letterSpacing = 3.5;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          backgroundColor,
          borderWidth,
          borderColor,
          opacity: disabled ? 0.75 : pressed ? 0.88 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
          paddingVertical: py,
          paddingHorizontal: size === 'default' ? 20 : 16,
          borderRadius: 6,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: textColor,
          fontFamily: 'SpaceMono',
          fontSize,
          letterSpacing,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
