/**
 * SuggestionCard — US-040
 *
 * A compact, dismissable nudge card shown on the Today screen.
 *
 * Props
 * ─────
 * suggestion  — the Suggestion object from services/suggestions
 * onCta       — called when the main CTA button is pressed
 * onDismiss   — called when the ✕ button is pressed
 */

import { View, Text, Pressable } from 'react-native';
import Animated, { FadeOutUp } from 'react-native-reanimated';
import { ArrowRight, CircleAlert, Clock, Flame, Hourglass, TrendingUp, X, type LucideIcon } from 'lucide-react-native';
import { Colors, Elevation, FontFamily, Radius, Surface, Type, hexToRgba } from '@/constants/design';
import { PressableScale, enter } from '@/components/ui/motion';
import type { Suggestion, SuggestionType } from '@/services/suggestions';

const TYPE_ICON: Record<SuggestionType, { Icon: LucideIcon; color: string }> = {
  streak_at_risk: { Icon: Flame, color: Colors.pillarCraft },
  best_time: { Icon: Clock, color: Colors.pillarMind },
  overdue: { Icon: Hourglass, color: Surface.muted },
  goal_neglect: { Icon: CircleAlert, color: Colors.accentDanger },
  momentum: { Icon: TrendingUp, color: Colors.pillarMoney },
};

interface SuggestionCardProps {
  suggestion: Suggestion;
  onCta: () => void;
  onDismiss: () => void;
}

export function SuggestionCard({ suggestion, onCta, onDismiss }: SuggestionCardProps) {
  const { Icon, color } = TYPE_ICON[suggestion.type];

  return (
    <Animated.View
      entering={enter(2)}
      exiting={FadeOutUp.duration(200)}
      style={{ marginHorizontal: 20, borderRadius: Radius.lg, backgroundColor: Surface.surface, padding: 18, ...Elevation.card }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: hexToRgba(color, 0.14),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={19} color={color} strokeWidth={2} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={Type.heading} numberOfLines={1}>
            {suggestion.headline}
          </Text>
          <Text style={[Type.body, { fontSize: 15, lineHeight: 21, marginTop: 3 }]} numberOfLines={2}>
            {suggestion.body}
          </Text>
        </View>

        <Pressable
          onPress={onDismiss}
          hitSlop={10}
          accessibilityLabel="Dismiss suggestion"
          style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: Surface.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={14} color={Surface.muted} strokeWidth={2.4} />
        </Pressable>
      </View>

      <PressableScale
        onPress={onCta}
        style={{
          marginTop: 14,
          alignSelf: 'flex-start',
          marginLeft: 52,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          height: 38,
          paddingHorizontal: 16,
          borderRadius: Radius.full,
          backgroundColor: Surface.ink,
        }}
      >
        <Text style={{ color: Surface.surface, fontFamily: FontFamily.bodyBold, fontSize: 15 }}>{suggestion.ctaLabel}</Text>
        <ArrowRight size={15} color={Surface.surface} strokeWidth={2.4} />
      </PressableScale>
    </Animated.View>
  );
}
