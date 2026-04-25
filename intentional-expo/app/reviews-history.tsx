/**
 * US-037: Browse all past weekly reviews, reverse chronological.
 * Append-only — no editing of past entries.
 */
import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as api from '@/db/api';
import type { WeeklyReview } from '@/types';
import { Colors, Surface } from '@/constants/design';
import { shadows } from '@/styles/shadows';

function weekLabel(weekStart: string): string {
  const d = new Date(weekStart + 'T12:00:00Z');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const FIELD_LABELS: Record<keyof Pick<WeeklyReview, 'went_well' | 'improve' | 'adjustments'>, string> = {
  went_well: 'What went well',
  improve: 'What I would improve',
  adjustments: 'Goal adjustments',
};

export default function ReviewsHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [reviews, setReviews] = useState<WeeklyReview[]>([]);

  useFocusEffect(
    useCallback(() => {
      setReviews(api.getWeeklyReviews());
    }, [])
  );

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/insights');
  };

  const bottomPad = insets.bottom + 24;

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: bottomPad }}
      >
        <View className="flex-row items-center gap-3 mb-6">
          <Pressable onPress={handleBack} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={Colors.textSecondary} />
          </Pressable>
          <Text className="text-title2 font-bold text-text-primary flex-1">Past Reviews</Text>
        </View>

        {reviews.length === 0 ? (
          <View className="items-center py-20">
            <Ionicons name="journal-outline" size={48} color={Colors.textLabel} style={{ marginBottom: 16 }} />
            <Text className="text-title3 font-semibold text-text-primary mb-2">No reviews yet</Text>
            <Text className="text-body text-text-secondary text-center max-w-[260px] mb-6">
              Complete your first weekly review and it will appear here.
            </Text>
            <Pressable
              onPress={() => router.push('./weekly-review')}
              className="py-3 px-6 rounded-xl"
              style={{ backgroundColor: Surface.container }}
            >
              <Text className="text-subheadline font-semibold text-text-primary">Write this week's review</Text>
            </Pressable>
          </View>
        ) : (
          reviews.map((r) => (
            <View
              key={r.id}
              className="rounded-xl p-4 mb-4"
              style={[shadows.card, { backgroundColor: Surface.container }]}
            >
              <Text className="text-subheadline font-bold text-text-primary mb-3">
                Week of {weekLabel(r.week_start)}
              </Text>

              {(['went_well', 'improve', 'adjustments'] as const).map((key) => {
                const val = r[key].trim();
                if (!val) return null;
                return (
                  <View key={key} className="mb-3">
                    <Text className="text-caption uppercase tracking-wider text-text-tertiary mb-1">
                      {FIELD_LABELS[key]}
                    </Text>
                    <Text className="text-body text-text-secondary leading-6">{val}</Text>
                  </View>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
