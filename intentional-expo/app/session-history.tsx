import { useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Stack, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as api from '@/db/api';
import type { MetaGoal, SessionHistoryListItem } from '@/types';
import { Accent, FontFamily, Surface } from '@/constants/design';
import { getGoalColor } from '@/utils/goalColors';

type Range = 'week' | 'month' | 'all';

const RANGE_LABELS: Record<Range, string> = { week: 'WK', month: 'MO', all: 'ALL' };

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m <= 0) return `${seconds}s`;
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

function formatSessionWhen(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso.slice(0, 16);
  }
}

export default function SessionHistoryScreen() {
  const params = useLocalSearchParams<{ goalId?: string | string[] }>();
  const initialGoalId = useMemo(() => {
    const g = params.goalId;
    if (!g) return 'all';
    const v = Array.isArray(g) ? g[0] : g;
    return decodeURIComponent(v);
  }, [params.goalId]);

  const [range, setRange] = useState<Range>('week');
  const [goalFilter, setGoalFilter] = useState<string | 'all'>(() =>
    initialGoalId && initialGoalId !== 'all' ? initialGoalId : 'all'
  );
  const [goals, setGoals] = useState<MetaGoal[]>([]);
  const [rows, setRows] = useState<SessionHistoryListItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const g = await api.getGoals();
        const list = api.getSessionHistoryList({ timeRange: range, goalId: goalFilter });
        if (!cancelled) {
          setGoals(g);
          setRows(list);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [range, goalFilter])
  );

  const totalSeconds = rows.reduce((a, r) => a + r.duration_seconds, 0);

  const chip = (active: boolean, activeBg: string = Surface.ink) => ({
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: active ? activeBg : Surface.surfaceRaised,
  });
  const chipText = (active: boolean) => ({
    color: active ? Surface.surface : Surface.muted,
    fontFamily: FontFamily.bodyBold,
    fontSize: 14,
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Surface.canvas }} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Session history',
          headerStyle: { backgroundColor: Surface.canvas },
          headerTintColor: Surface.ink,
          headerTitleStyle: { color: Surface.ink, fontFamily: FontFamily.bodyBold },
          headerShadowVisible: false,
        }}
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 }}>
        <Text accessibilityRole="header" style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 28, lineHeight: 34, letterSpacing: -0.3 }}>
          Your sessions
        </Text>
        <Text style={{ color: Surface.muted, fontFamily: FontFamily.body, fontSize: 16, lineHeight: 22, marginTop: 4, marginBottom: 18 }}>
          {rows.length
            ? `${rows.length} ${rows.length === 1 ? 'session' : 'sessions'} · ${formatDuration(totalSeconds)} given to your pillars`
            : 'Every focus session you finish lands here.'}
        </Text>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          {(['week', 'month', 'all'] as const).map((r) => {
            const active = range === r;
            return (
              <Pressable
                key={r}
                onPress={() => setRange(r)}
                accessibilityRole="button"
                accessibilityLabel={`Time range ${RANGE_LABELS[r]}`}
                accessibilityState={{ selected: active }}
                style={chip(active)}
              >
                <Text style={chipText(active)}>{RANGE_LABELS[r]}</Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18, marginHorizontal: -20 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
          <Pressable
            onPress={() => setGoalFilter('all')}
            accessibilityRole="button"
            accessibilityLabel="All goals"
            accessibilityState={{ selected: goalFilter === 'all' }}
            style={chip(goalFilter === 'all')}
          >
            <Text style={chipText(goalFilter === 'all')}>All pillars</Text>
          </Pressable>
          {goals.map((g) => {
            const active = goalFilter === g.id;
            const tone = getGoalColor(g);
            return (
              <Pressable
                key={g.id}
                onPress={() => setGoalFilter(g.id)}
                accessibilityRole="button"
                accessibilityLabel={g.name}
                accessibilityState={{ selected: active }}
                style={[chip(active, tone), { flexDirection: 'row', gap: 7, maxWidth: 200 }]}
              >
                {!active ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone }} /> : null}
                <Text style={chipText(active)} numberOfLines={1}>
                  {g.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {rows.length === 0 ? (
          <View style={{ backgroundColor: Surface.surfaceRaised, borderRadius: 20, paddingVertical: 28, paddingHorizontal: 22, alignItems: 'center' }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: Surface.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="time-outline" size={26} color={Surface.muted} />
            </View>
            <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 20, marginTop: 14 }}>No sessions here yet</Text>
            <Text style={{ color: Surface.muted, fontFamily: FontFamily.body, fontSize: 16, lineHeight: 22, marginTop: 6, textAlign: 'center' }}>
              Finish a focus session and it will show up here.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {rows.map((item) => {
              const tone = getGoalColor({ id: item.goal_id, color: item.goal_color });
              const complete = item.was_completed === 1;
              return (
                <View key={item.id} style={{ backgroundColor: Surface.surfaceRaised, borderRadius: 18, padding: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                    <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: tone }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 17, lineHeight: 22 }} numberOfLines={2}>
                        {item.action_name}
                      </Text>
                      <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodySemiBold, fontSize: 14, marginTop: 2 }} numberOfLines={1}>
                        {item.goal_name} · {formatSessionWhen(item.started_at)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 20, lineHeight: 24 }}>{formatDuration(item.duration_seconds)}</Text>
                      <View
                        style={{
                          marginTop: 6,
                          paddingHorizontal: 9,
                          paddingVertical: 3,
                          borderRadius: 10,
                          backgroundColor: complete ? Accent.greenSoft : Accent.orangeSoft,
                        }}
                      >
                        <Text style={{ color: complete ? Accent.green : Accent.orange, fontFamily: FontFamily.bodyBold, fontSize: 12 }}>
                          {complete ? 'Complete' : 'Partial'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {item.note && item.note.trim().length > 0 ? (
                    <View style={{ marginTop: 12, backgroundColor: Surface.surface, borderRadius: 12, padding: 12 }}>
                      <Text style={{ color: Surface.ink, fontFamily: FontFamily.body, fontSize: 15, lineHeight: 21 }}>
                        &ldquo;{item.note}&rdquo;
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
