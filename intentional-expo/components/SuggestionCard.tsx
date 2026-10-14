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
import { Colors, Elevation, Radius, Surface, Type, hexToRgba } from '@/constants/design';
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
      style={{ marginHorizontal: 20, borderRadius: Radius.lg, backgroundColor: Surface.surface, padding: 16, ...Elevation.card }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: hexToRgba(color, 0.12),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={18} color={color} strokeWidth={1.9} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={Type.heading} numberOfLines={1}>
            {suggestion.headline}
          </Text>
          <Text style={[Type.body, { fontSize: 15, lineHeight: 20, marginTop: 2 }]} numberOfLines={2}>
            {suggestion.body}
          </Text>
        </View>

        <Pressable onPress={onDismiss} hitSlop={10} accessibilityLabel="Dismiss suggestion" style={{ padding: 2 }}>
          <X size={16} color={Surface.faint} strokeWidth={2} />
        </Pressable>
      </View>

      <PressableScale
        onPress={onCta}
        style={{
          marginTop: 14,
          alignSelf: 'flex-start',
          marginLeft: 48,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: Radius.full,
          backgroundColor: hexToRgba(color, 0.12),
        }}
      >
        <Text style={[Type.meta, { color, fontSize: 14 }]}>{suggestion.ctaLabel}</Text>
        <ArrowRight size={14} color={color} strokeWidth={2} />
      </PressableScale>
    </Animated.View>
  );
}
