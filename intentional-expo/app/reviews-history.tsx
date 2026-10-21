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
import { localDayStart } from '@/utils/dates';
import { CTA } from '@/components/onboarding/parts';

function weekLabel(weekStart: string): string {
  return localDayStart(weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

type OnTrack = 'yes' | 'behind' | 'rethink';
type SavedGoal = { objective_id: string; on_track: OnTrack; hours: number; title?: string };

const ON_TRACK_LABEL: Record<OnTrack, string> = { yes: 'On track', behind: 'Behind', rethink: 'Rethink' };

function formatHM(hours: number): string {
  const mins = Math.round(Math.max(0, Number(hours) || 0) * 60);
  if (mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function parseGoals(json: string | null | undefined): SavedGoal[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as SavedGoal[]).filter((g) => g && g.objective_id && ON_TRACK_LABEL[g.on_track]) : [];
  } catch {
    return [];
  }
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
  /** Current goal titles, for reviews saved before titles were stored in goals_data. */
  const [titles, setTitles] = useState<Record<string, string>>({});

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      // One card per week: if a store ever holds two rows for a week, the latest save wins.
      const latest = new Map<string, WeeklyReview>();
      for (const r of api.getWeeklyReviews()) {
        const prev = latest.get(r.week_start);
        if (!prev || r.created_at > prev.created_at) latest.set(r.week_start, r);
      }
      setReviews([...latest.values()].sort((a, b) => (a.week_start < b.week_start ? 1 : -1)));
      void api.getObjectives().then((list) => {
        if (mounted) setTitles(Object.fromEntries(list.map((o) => [o.id, o.title])));
      });
      return () => {
        mounted = false;
      };
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

                {parseGoals(r.goals_data).length > 0 ? (
                  <View style={{ backgroundColor: Surface.surface, borderRadius: 14, padding: 14, marginBottom: 8, gap: 8 }}>
                    <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodyBold, fontSize: 13 }}>Goals</Text>
                    {parseGoals(r.goals_data).map((g) => (
                      <View key={g.objective_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodySemiBold, fontSize: 15, flex: 1 }} numberOfLines={1}>
                          {g.title || titles[g.objective_id] || 'A past goal'}
                        </Text>
                        <Text
                          style={{
                            color: g.on_track === 'yes' ? Accent.green : g.on_track === 'behind' ? Accent.amber : Surface.muted,
                            fontFamily: FontFamily.bodyBold,
                            fontSize: 13,
                          }}
                        >
                          {ON_TRACK_LABEL[g.on_track]}
                        </Text>
                        <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodySemiBold, fontSize: 13, minWidth: 44, textAlign: 'right' }}>
                          {formatHM(g.hours)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

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
