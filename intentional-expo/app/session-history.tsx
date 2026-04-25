import { useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as api from '@/db/api';
import type { MetaGoal, SessionHistoryListItem } from '@/types';
import { Colors, FontFamily, Radius, Surface } from '@/constants/design';
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

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Session history',
          headerStyle: { backgroundColor: Surface.canvas },
          headerTintColor: Colors.textPrimary,
          headerTitleStyle: { color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold },
          headerShadowVisible: false,
        }}
      />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28 }}>
        <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>
          Ledger
        </Text>
        <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.display, fontSize: 44, lineHeight: 46, marginBottom: 18 }}>
          Sessions kept.
        </Text>

        <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' }}>
          Time range
        </Text>
        <View className="w-[138px] h-10 p-1 flex-row mb-5" style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.full }}>
          {(['week', 'month', 'all'] as const).map((r) => {
            const active = range === r;
            return (
              <Pressable
                key={r}
                onPress={() => setRange(r)}
                className="flex-1 justify-center items-center"
                style={{ backgroundColor: active ? Surface.surfaceRaised : 'transparent', borderRadius: Radius.full }}
              >
                <Text style={{ color: active ? Colors.textPrimary : Colors.textSecondary, fontFamily: FontFamily.monoSemiBold, fontSize: 10, letterSpacing: 0.8 }}>
                  {RANGE_LABELS[r]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>Goal</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5" contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          <Pressable
            onPress={() => setGoalFilter('all')}
            className="px-3 py-2"
            style={{
              backgroundColor: goalFilter === 'all' ? Surface.ink : Surface.surface,
              borderWidth: 1,
              borderColor: goalFilter === 'all' ? Surface.ink : Surface.rule,
              borderRadius: Radius.full,
            }}
          >
            <Text
              style={{ color: goalFilter === 'all' ? Surface.surface : Colors.textSecondary, fontFamily: FontFamily.monoSemiBold, fontSize: 11 }}
            >
              All goals
            </Text>
          </Pressable>
          {goals.map((g) => {
            const active = goalFilter === g.id;
            const tone = getGoalColor(g.id);
            return (
              <Pressable
                key={g.id}
                onPress={() => setGoalFilter(g.id)}
                className="px-3 py-2 max-w-[200px]"
                style={{
                  backgroundColor: active ? tone : Surface.surface,
                  borderWidth: 1,
                  borderColor: active ? tone : Surface.rule,
                  borderRadius: Radius.full,
                }}
              >
                <Text
                  style={{ color: active ? Surface.surface : Colors.textSecondary, fontFamily: FontFamily.monoSemiBold, fontSize: 11 }}
                  numberOfLines={1}
                >
                  {g.icon} {g.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {rows.length === 0 ? (
          <View className="py-8 px-5" style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.lg }}>
            <Ionicons name="time-outline" size={32} color={Colors.textMuted} />
            <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 17, marginTop: 14 }}>
              No sessions in this range
            </Text>
            <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 15, lineHeight: 21, marginTop: 4 }}>
              Complete a focus block and it will appear here as ledger evidence.
            </Text>
          </View>
        ) : (
          rows.map((item) => {
            const tone = getGoalColor(item.goal_id);
            const complete = item.was_completed === 1;
            return (
              <View key={item.id} className="p-4 mb-3 border-l-[3px]" style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderLeftColor: tone, borderRadius: Radius.lg }}>
                <View className="flex-row justify-between items-start gap-2">
                  <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoMedium, fontSize: 11, flex: 1 }}>{formatSessionWhen(item.started_at)}</Text>
                  <View
                    className="px-2 py-0.5"
                    style={{ backgroundColor: complete ? 'rgba(46,125,87,0.12)' : 'rgba(176,122,43,0.14)', borderRadius: Radius.full }}
                  >
                    <Text style={{ color: complete ? Colors.accentSuccess : Colors.accentWarning, fontFamily: FontFamily.monoSemiBold, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                      {complete ? 'Complete' : 'Partial'}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 18, marginTop: 10 }} numberOfLines={2}>
                  {item.action_name}
                </Text>
                <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 15, marginTop: 2 }} numberOfLines={1}>
                  {item.goal_name}
                </Text>
                <Text style={{ color: tone, fontFamily: FontFamily.monoSemiBold, fontSize: 13, marginTop: 10 }}>
                  {formatDuration(item.duration_seconds)}
                </Text>
                {item.note && item.note.trim().length > 0 ? (
                  <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 16, lineHeight: 22, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Surface.rule }}>
                    &ldquo;{item.note}&rdquo;
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
