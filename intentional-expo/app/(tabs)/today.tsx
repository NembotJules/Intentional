import { useCallback, useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ActionRow } from '@/components/ActionRow';
import { TodayScoreRing } from '@/components/TodayScoreRing';
import { Colors } from '@/constants/design';
import { useTodaySections, useTodayScore } from '@/db/hooks';
import * as api from '@/db/api';
import type { MetaGoal, DailyAction } from '@/types';
import { getGoalColor } from '@/utils/goalColors';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function TodayScreen() {
  const router = useRouter();
  const { sections, refresh } = useTodaySections();
  const score = useTodayScore(sections);
  const [selectedGoalId, setSelectedGoalId] = useState<string | 'all'>('all');
  const [habitDones, setHabitDones] = useState<Record<string, boolean>>({});
  const [sessionMins, setSessionMins] = useState<Record<string, number>>({});

  const loadHabitAndMins = useCallback(async () => {
    const date = todayStr();
    const nextHabit: Record<string, boolean> = {};
    const nextMins: Record<string, number> = {};
    for (const { actions } of sections) {
      for (const a of actions) {
        if (a.type === 'habit') nextHabit[a.id] = await api.isHabitDoneToday(a.id);
        else {
          const sessions = await api.getSessionsForActionToday(a.id, date);
          nextMins[a.id] = Math.floor(sessions.reduce((s, x) => s + x.duration_seconds, 0) / 60);
        }
      }
    }
    setHabitDones(nextHabit);
    setSessionMins(nextMins);
  }, [sections]);

  useEffect(() => {
    loadHabitAndMins();
  }, [loadHabitAndMins]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const onHabitToggle = useCallback(
    async (actionId: string, done: boolean) => {
      await api.setHabitCompletion(actionId, todayStr(), done);
      setHabitDones((prev) => ({ ...prev, [actionId]: done }));
      refresh();
      loadHabitAndMins();
    },
    [refresh, loadHabitAndMins]
  );

  const onStartSession = useCallback(
    (goal: MetaGoal, action: DailyAction) => {
      router.push(`/(tabs)/focus?goalId=${encodeURIComponent(goal.id)}&actionId=${encodeURIComponent(action.id)}`);
    },
    [router]
  );

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();
  const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const visibleSections = selectedGoalId === 'all' ? sections : sections.filter(({ goal }) => goal.id === selectedGoalId);
  const totalVisibleActions = visibleSections.reduce((acc, s) => acc + s.actions.length, 0);
  const completedVisibleActions = visibleSections.reduce((acc, s) => {
    return acc + s.actions.reduce((inner, action) => {
      const isSession = action.type === 'session';
      const mins = sessionMins[action.id] ?? 0;
      const progress = action.target_minutes > 0 ? Math.min(1, mins / action.target_minutes) : 0;
      const completed = isSession ? progress >= 1 : !!habitDones[action.id];
      return inner + (completed ? 1 : 0);
    }, 0);
  }, 0);
  const hasAnyActions = totalVisibleActions > 0;
  const allDone = hasAnyActions && completedVisibleActions === totalVisibleActions;

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        <View className="px-4 pt-2 pb-1">
          <View className="h-[44px] flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View className="w-8 h-8 rounded-full border border-separator items-center justify-center" style={{ backgroundColor: '#111111' }}>
                <Ionicons name="person-outline" size={16} color={Colors.textSecondary} />
              </View>
              <Text className="text-title2 font-bold text-text-primary">
                {greeting}, Alex
              </Text>
            </View>
            <Ionicons name="refresh" size={18} color={Colors.textTertiary} />
          </View>
        </View>

        <View className="px-4 pt-3 pb-6">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-[9px] tracking-[2.4px] uppercase mb-1" style={{ color: '#333333' }}>{dateStr}</Text>
              <Text className="text-title1 font-bold tracking-tight text-text-primary">
                Your Path.
              </Text>
            </View>
            <TodayScoreRing score={score} size={80} lineWidth={8} />
          </View>
        </View>

        <View className="h-[44px] justify-center mb-2">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, alignItems: 'center' }}>
            <Pressable
              onPress={() => setSelectedGoalId('all')}
              className="h-[30px] px-4 rounded-md items-center justify-center"
              style={{
                backgroundColor: selectedGoalId === 'all' ? '#1A1A1A' : 'transparent',
                borderWidth: 0.5,
                borderColor: selectedGoalId === 'all' ? '#2A2A2A' : '#1E1E1E',
              }}
            >
              <Text
                className="text-[9px] uppercase"
                style={{ color: selectedGoalId === 'all' ? Colors.textPrimary : Colors.textSecondary, letterSpacing: 1.6 }}
              >
                All
              </Text>
            </Pressable>
            {sections.map(({ goal }) => {
              const active = selectedGoalId === goal.id;
              return (
                <Pressable
                  key={goal.id}
                  onPress={() => setSelectedGoalId(goal.id)}
                  className="h-[30px] px-4 rounded-md items-center justify-center"
                  style={{
                    backgroundColor: active ? '#1A1A1A' : 'transparent',
                    borderWidth: 0.5,
                    borderColor: active ? '#2A2A2A' : '#1E1E1E',
                  }}
                >
                  <Text className="text-[9px] uppercase" style={{ color: active ? Colors.textPrimary : Colors.textSecondary, letterSpacing: 1.6 }}>
                    {goal.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View className="px-4 pt-3 pb-2">
          <Text className="text-[7px] uppercase tracking-[3px]" style={{ color: '#333333' }}>▶ Today&apos;s Actions</Text>
        </View>

        <View className="px-4">
          {visibleSections.length === 0 ? (
            <View className="items-center py-16">
              <Ionicons name="checkmark-done-circle" size={56} color={Colors.textPrimary} />
              <Text className="text-title2 font-semibold text-text-primary mt-4">You crushed today.</Text>
              <Text className="text-subheadline text-text-secondary mt-1 text-center px-8">
                {selectedGoalId === 'all'
                  ? 'No pending actions left. Add more from Goals if you want extra momentum.'
                  : 'No actions left for this goal today.'}
              </Text>
            </View>
          ) : (
            visibleSections.map(({ goal, actions }) => (
              <View key={goal.id} className="mb-3">
                <Text className="text-[9px] uppercase tracking-[2.5px] mb-1" style={{ color: getGoalColor(goal.id) }}>
                  ●{goal.name}
                </Text>
                {actions.map((action) => {
                  const isSession = action.type === 'session';
                  const mins = sessionMins[action.id] ?? 0;
                  const progress = action.target_minutes > 0 ? Math.min(1, mins / action.target_minutes) : 0;
                  const completed = isSession ? progress >= 1 : !!habitDones[action.id];
                  return (
                    <ActionRow
                      key={action.id}
                      goal={goal}
                      action={action}
                      progress={progress}
                      isCompleted={completed}
                      isHabitDone={!!habitDones[action.id]}
                      toneColor={getGoalColor(goal.id)}
                      onStart={isSession ? () => onStartSession(goal, action) : undefined}
                      onHabitToggle={!isSession ? (done) => onHabitToggle(action.id, done) : undefined}
                    />
                  );
                })}
              </View>
            ))
          )}

          {hasAnyActions && !allDone ? (
            <View
              className="mt-6 rounded-3xl p-6 flex-row items-center justify-between"
              style={{ backgroundColor: '#1A1A1A', borderWidth: 0.5, borderColor: '#222222' }}
            >
              <View className="flex-1 pr-4">
                <Text className="text-title2 font-bold mb-1 text-text-primary">
                  Consistency pays off.
                </Text>
                <Text className="text-subheadline text-text-secondary">
                  You&apos;ve hit 4 days in a row for
                  {'\n'}
                  &apos;Skills&apos;. Keep it up!
                </Text>
              </View>
              <View className="w-16 h-16 rounded-2xl items-center justify-center bg-bg-primary">
                <Ionicons name="flame" size={24} color={Colors.goalMind} />
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <Pressable
        onPress={() => router.push('/(tabs)/goals?create=1')}
        accessibilityLabel="Add goal"
        className="absolute right-6 bottom-[90px] w-12 h-12 rounded-full items-center justify-center"
        style={{
          backgroundColor: '#1A1A1A',
          borderWidth: 0.5,
          borderColor: '#2A2A2A',
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 10,
          elevation: 4,
        }}
      >
        <Ionicons name="add" size={20} color={Colors.textPrimary} />
      </Pressable>
    </SafeAreaView>
  );
}
