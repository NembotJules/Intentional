/**
 * SuggestionCard — US-040
 *
 * A compact, dismissable nudge card shown on the Today screen.
 * The card slides in from above the action list on mount and slides
 * out when dismissed.
 *
 * Props
 * ─────
 * suggestion  — the Suggestion object from services/suggestions
 * onCta       — called when the main CTA button is pressed
 * onDismiss   — called when the ✕ button is pressed
 */

import { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, Radius, Surface, goalBorderColor } from '@/constants/design';
import type { Suggestion, SuggestionType } from '@/services/suggestions';

// ── Icon per suggestion type ──────────────────────────────────────────────────
const TYPE_ICON: Record<SuggestionType, { name: React.ComponentProps<typeof Ionicons>['name']; color: string }> = {
  streak_at_risk: { name: 'flame',               color: Colors.pillarCraft },
  best_time:      { name: 'time-outline',         color: Colors.pillarMind },
  overdue:        { name: 'hourglass-outline',    color: Colors.textMuted },
  goal_neglect:   { name: 'alert-circle-outline', color: Colors.accentDanger },
  momentum:       { name: 'trending-up-outline',  color: Colors.pillarMoney },
};

// ── Component ─────────────────────────────────────────────────────────────────
interface SuggestionCardProps {
  suggestion: Suggestion;
  onCta: () => void;
  onDismiss: () => void;
}

export function SuggestionCard({ suggestion, onCta, onDismiss }: SuggestionCardProps) {
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Slide + fade in on mount
  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 200 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [slideAnim, opacityAnim]);

  const { name: iconName, color: iconColor } = TYPE_ICON[suggestion.type];

  return (
    <Animated.View
      style={{
        transform: [{ translateY: slideAnim }],
        opacity: opacityAnim,
        marginHorizontal: 20,
        marginBottom: 12,
        borderRadius: Radius.lg,
        backgroundColor: Surface.surface,
        borderWidth: 1,
        borderColor: Surface.rule,
        overflow: 'hidden',
      }}
    >
      {/* Top accent stripe keyed to icon color */}
      <View style={{ height: 2, backgroundColor: iconColor, opacity: 0.7 }} />

      <View style={{ padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        {/* Icon */}
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: `${iconColor}18`,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: 1,
          }}
        >
          <Ionicons name={iconName} size={18} color={iconColor} />
        </View>

        {/* Text */}
        <View style={{ flex: 1 }}>
          <Text
          style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 16, lineHeight: 21, marginBottom: 2 }}
            numberOfLines={1}
          >
            {suggestion.headline}
          </Text>
          <Text
            style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 15, lineHeight: 20 }}
            numberOfLines={2}
          >
            {suggestion.body}
          </Text>
        </View>

        {/* Dismiss button */}
        <Pressable
          onPress={onDismiss}
          hitSlop={10}
          style={{ padding: 2, flexShrink: 0 }}
          accessibilityLabel="Dismiss suggestion"
        >
          <Ionicons name="close" size={16} color={Colors.textTertiary} />
        </Pressable>
      </View>

      {/* CTA */}
      <Pressable
        onPress={onCta}
        style={({ pressed }) => ({
          marginHorizontal: 14,
          marginBottom: 14,
          paddingVertical: 9,
          borderRadius: Radius.full,
          backgroundColor: pressed ? `${iconColor}28` : `${iconColor}18`,
          borderWidth: 1,
          borderColor: goalBorderColor(iconColor),
          alignItems: 'center',
        })}
      >
        <Text style={{ color: iconColor, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 0.9 }}>
          {suggestion.ctaLabel.toUpperCase()}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
