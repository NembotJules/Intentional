/**
 * US-037: Browse all past weekly reviews, reverse chronological.
 * Append-only — no editing of past entries.
 */
import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as api from '@/db/api';
import type { WeeklyReview } from '@/types';
import { Accent, FontFamily, Surface } from '@/constants/design';
import { CTA } from '@/components/onboarding/parts';

function weekLabel(weekStart: string): string {
  const d = new Date(weekStart + 'T12:00:00Z');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const FIELD_LABELS: Record<keyof Pick<WeeklyReview, 'went_well' | 'improve' | 'adjustments'>, string> = {
  went_well: 'What went well',
  improve: 'What to improve',
  adjustments: 'Next week',
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
    <SafeAreaView style={{ flex: 1, backgroundColor: Surface.canvas }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: bottomPad }}>
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Surface.surfaceRaised, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}
        >
          <Ionicons name="chevron-back" size={22} color={Surface.ink} />
        </Pressable>
        <Text accessibilityRole="header" style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 28, lineHeight: 34, letterSpacing: -0.3 }}>
          Past reviews
        </Text>
        <Text style={{ color: Surface.muted, fontFamily: FontFamily.body, fontSize: 16, lineHeight: 22, marginTop: 4, marginBottom: 20 }}>
          What each week taught you, newest first.
        </Text>

        {reviews.length === 0 ? (
          <View style={{ backgroundColor: Surface.surfaceRaised, borderRadius: 20, paddingVertical: 28, paddingHorizontal: 22, alignItems: 'center' }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: Surface.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Ionicons name="journal-outline" size={26} color={Surface.muted} />
            </View>
            <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 20, marginBottom: 6 }}>No reviews yet</Text>
            <Text style={{ color: Surface.muted, fontFamily: FontFamily.body, fontSize: 16, lineHeight: 22, marginBottom: 22, textAlign: 'center' }}>
              Write your first weekly review and it will show up here.
            </Text>
            <View style={{ alignSelf: 'stretch' }}>
              <CTA label="Write this week's review" onPress={() => router.push('/weekly-review')} />
            </View>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {reviews.map((r) => (
              <View key={r.id} style={{ backgroundColor: Surface.surfaceRaised, borderRadius: 20, padding: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Ionicons name="calendar-outline" size={17} color={Accent.blue} />
                  <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 18 }}>Week of {weekLabel(r.week_start)}</Text>
                </View>

                {(['went_well', 'improve', 'adjustments'] as const).map((key) => {
                  const val = r[key].trim();
                  if (!val) return null;
                  return (
                    <View key={key} style={{ backgroundColor: Surface.surface, borderRadius: 14, padding: 14, marginBottom: 8 }}>
                      <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodyBold, fontSize: 13, marginBottom: 4 }}>{FIELD_LABELS[key]}</Text>
                      <Text style={{ color: Surface.ink, fontFamily: FontFamily.body, fontSize: 16, lineHeight: 23 }}>{val}</Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
