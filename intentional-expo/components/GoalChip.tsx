import { Text, Pressable, View } from 'react-native';
import { FontFamily, Radius, Surface, hexToRgba } from '@/constants/design';
import { PillarIcon } from '@/components/ui/PillarIcon';

type GoalChipProps = {
  name: string;
  color: string;
  icon: string;
  useTint?: boolean;
  active?: boolean;
  onPress?: () => void;
};

/** Spark chip: 40-tall pill — ink when on, sand (or soft pillar tint) when off. */
export function GoalChip({ name, color, icon, useTint = true, active = false, onPress }: GoalChipProps) {
  const backgroundColor = active ? Surface.ink : useTint ? hexToRgba(color, 0.12) : Surface.surfaceRaised;
  const textColor = active ? Surface.surface : Surface.ink;
  const hasIcon = icon.trim().length > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={name}
      style={{
        height: 40,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        backgroundColor,
        borderRadius: Radius.full,
        opacity: 1,
      }}
    >
      {hasIcon ? (
        <PillarIcon icon={icon} name={name} color={active ? Surface.surface : color} size={32} tinted={false} />
      ) : (
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: active ? Surface.surface : color }} />
      )}
      <Text numberOfLines={1} style={{ color: textColor, fontFamily: FontFamily.bodyBold, fontSize: 15, lineHeight: 19 }}>
        {name}
      </Text>
    </Pressable>
  );
}
