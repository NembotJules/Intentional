import { Text, ViewStyle } from 'react-native';
import { PressableScale } from '@/components/ui/motion';
import { CTA, Colors, FontFamily, Radius, Surface, hexToRgba } from '@/constants/design';

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
 * Spark buttons (the onboarding look):
 * - filled: the one primary — full-width ink pill, 58 tall, bold white label
 * - ghost: sand pill with ink (or `color`) label for secondary actions
 * - goalOutline: soft pillar-tinted pill with the pillar colour label
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
  const label = wantsArrow ? `${title} →` : title;

  const isFilled = appearance === 'filled';
  const isGoalOutline = appearance === 'goalOutline';

  let backgroundColor: string;
  let textColor: string;
  if (isFilled) {
    backgroundColor = Surface.ink;
    textColor = Surface.surface;
  } else if (isGoalOutline) {
    backgroundColor = color === Colors.textPrimary ? Surface.surfaceRaised : hexToRgba(color, 0.12);
    textColor = color;
  } else {
    backgroundColor = Surface.surfaceRaised;
    textColor = color;
  }

  const isDefault = size === 'default';
  const height = isDefault ? CTA.height : 44;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      scaleTo={0.98}
      style={[
        {
          backgroundColor,
          opacity: disabled ? 0.35 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
          paddingHorizontal: isDefault ? 24 : 18,
          borderRadius: isDefault ? CTA.radius : Radius.full,
          minHeight: height,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: textColor,
          fontFamily: FontFamily.bodyBold,
          fontSize: isDefault ? 18 : 16,
        }}
      >
        {label}
      </Text>
    </PressableScale>
  );
}
