import { useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as api from '@/db/api';
import type { MetaGoal, SessionHistoryListItem } from '@/types';
import { Colors } from '@/constants/design';
import { shadows } from '@/styles/shadows';
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
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Session history',
          headerStyle: { backgroundColor: Colors.backgroundPrimary },
          headerTintColor: Colors.textPrimary,
          headerTitleStyle: { color: Colors.textPrimary, fontWeight: '700' },
          headerShadowVisible: false,
        }}
      />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 }}>
        <Text className="text-footnote uppercase tracking-wider text-text-tertiary mb-3">Time range</Text>
        <View className="w-[132px] h-8 bg-bg-tertiary rounded-lg p-1 flex-row border border-separator mb-5">
          {(['week', 'month', 'all'] as const).map((r) => {
            const active = range === r;
            return (
              <Pressable
                key={r}
                onPress={() => setRange(r)}
                className={`flex-1 justify-center items-center rounded-md ${active ? 'bg-bg-primary' : ''}`}
                style={active ? shadows.card : undefined}
              >
                <Text className={`text-[9px] font-bold tracking-wider ${active ? 'text-text-primary' : 'text-text-tertiary'}`}>
                  {RANGE_LABELS[r]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text className="text-footnote uppercase tracking-wider text-text-tertiary mb-2">Goal</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5" contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          <Pressable
            onPress={() => setGoalFilter('all')}
            className="px-3 py-2 rounded-full border"
            style={{
              backgroundColor: goalFilter === 'all' ? Colors.textPrimary : Colors.backgroundSecondary,
              borderColor: goalFilter === 'all' ? Colors.textPrimary : Colors.separator,
            }}
          >
            <Text
              className="text-caption font-semibold"
              style={{ color: goalFilter === 'all' ? Colors.textInverse : Colors.textSecondary }}
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
                className="px-3 py-2 rounded-full border max-w-[200px]"
                style={{
                  backgroundColor: active ? tone : Colors.backgroundSecondary,
                  borderColor: active ? tone : Colors.separator,
                }}
              >
                <Text
                  className="text-caption font-semibold"
                  style={{ color: active ? '#080808' : Colors.textSecondary }}
                  numberOfLines={1}
                >
                  {g.icon} {g.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {rows.length === 0 ? (
          <View className="items-center py-16 px-4">
            <Ionicons name="time-outline" size={48} color={Colors.textTertiary} />
            <Text className="text-subheadline text-text-secondary text-center mt-4">No sessions in this range</Text>
          </View>
        ) : (
          rows.map((item) => {
            const tone = getGoalColor(item.goal_id);
            const complete = item.was_completed === 1;
            return (
              <View key={item.id} className="bg-bg-secondary rounded-xl p-4 mb-3 border-l-[3px]" style={[shadows.card, { borderLeftColor: tone }]}>
                <View className="flex-row justify-between items-start gap-2">
                  <Text className="text-caption text-text-tertiary flex-1">{formatSessionWhen(item.started_at)}</Text>
                  <View
                    className="px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: complete ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)' }}
                  >
                    <Text className="text-[10px] font-bold uppercase tracking-wide" style={{ color: complete ? '#22C55E' : '#F59E0B' }}>
                      {complete ? 'Complete' : 'Partial'}
                    </Text>
                  </View>
                </View>
                <Text className="text-headline font-semibold text-text-primary mt-2" numberOfLines={2}>
                  {item.action_name}
                </Text>
                <Text className="text-footnote text-text-secondary mt-0.5" numberOfLines={1}>
                  {item.goal_name}
                </Text>
                <Text className="text-subheadline font-semibold mt-2" style={{ color: tone }}>
                  {formatDuration(item.duration_seconds)}
                </Text>
                {item.note && item.note.trim().length > 0 ? (
                  <Text className="text-body text-text-secondary mt-2 italic border-t border-separator pt-2">&ldquo;{item.note}&rdquo;</Text>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
