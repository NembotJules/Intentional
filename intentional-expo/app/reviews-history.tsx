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
import { Colors, FontFamily, Radius, Surface } from '@/constants/design';

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
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: bottomPad }}
      >
        <View className="flex-row items-start gap-3 mb-6">
          <Pressable onPress={handleBack} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={Colors.textSecondary} />
          </Pressable>
          <View className="flex-1">
            <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
              Weekly reviews
            </Text>
            <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.display, fontSize: 44, lineHeight: 46, marginTop: 4 }}>
              Past accounts.
            </Text>
          </View>
        </View>

        {reviews.length === 0 ? (
          <View className="py-8 px-5" style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.lg }}>
            <Ionicons name="journal-outline" size={32} color={Colors.textMuted} style={{ marginBottom: 14 }} />
            <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 17, marginBottom: 6 }}>No reviews yet</Text>
            <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 16, lineHeight: 22, marginBottom: 20 }}>
              Complete your first weekly review and it will appear here.
            </Text>
            <Pressable
              onPress={() => router.push('./weekly-review')}
              className="py-3 px-6 items-center"
              style={{ backgroundColor: Surface.ink, borderRadius: Radius.full }}
            >
              <Text style={{ color: Surface.surface, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>Write this week's review</Text>
            </Pressable>
          </View>
        ) : (
          reviews.map((r) => (
            <View
              key={r.id}
              className="p-4 mb-4"
              style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.lg }}
            >
              <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 17, marginBottom: 12 }}>
                Week of {weekLabel(r.week_start)}
              </Text>

              {(['went_well', 'improve', 'adjustments'] as const).map((key) => {
                const val = r[key].trim();
                if (!val) return null;
                return (
                  <View key={key} className="mb-3">
                    <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 10, letterSpacing: 0.8, marginBottom: 4, textTransform: 'uppercase' }}>
                      {FIELD_LABELS[key]}
                    </Text>
                    <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 16, lineHeight: 23 }}>{val}</Text>
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
