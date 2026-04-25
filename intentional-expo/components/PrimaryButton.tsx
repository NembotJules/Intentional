import { Text, Pressable, ViewStyle } from 'react-native';
import { Colors, FontFamily, Radius, ghostBorder, goalBorderColor, Surface } from '@/constants/design';

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
 * Quiet Ledger primary action:
 * - filled: ink pill with warm paper text
 * - goalOutline: transparent + soft pillar border
 * - ghost: quiet bordered control for secondary actions
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

  const wantsArrow = showArrow !== false && size === 'default' && appearance === 'goalOutline';
  const label = wantsArrow ? `${title.toUpperCase()} ->` : title.toUpperCase();

  const isFilled = appearance === 'filled';
  const isGoalOutline = appearance === 'goalOutline';

  let backgroundColor: string = 'transparent';
  let borderWidth = 0;
  let borderColor: string = 'transparent';
  let textColor: string = Colors.textPrimary;

  if (disabled) {
    backgroundColor = isFilled ? Surface.surfaceRaised : 'transparent';
    textColor = Colors.textMuted;
    if (isGoalOutline || appearance === 'ghost') {
      borderWidth = 1;
      borderColor = ghostBorder;
    }
  } else if (isFilled) {
    backgroundColor = Surface.ink;
    textColor = Surface.surface;
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

  const py = size === 'default' ? 16 : 11;
  const fontSize = 11;
  const letterSpacing = 1.4;

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
          paddingHorizontal: size === 'default' ? 22 : 16,
          borderRadius: Radius.full,
          minHeight: size === 'default' ? 50 : 42,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: textColor,
          fontFamily: FontFamily.monoSemiBold,
          fontSize,
          letterSpacing,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
