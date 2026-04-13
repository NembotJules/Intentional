import { useCallback, useState, useEffect } from 'react';
import { View, Text, Pressable, Platform, Alert } from 'react-native';
import { ScrollView, Swipeable, TouchableOpacity } from 'react-native-gesture-handler';
import { useRouter, Stack } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ActionRow } from '@/components/ActionRow';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TodayScoreRing } from '@/components/TodayScoreRing';
import { Colors } from '@/constants/design';
import { useTodaySections, useTodayScore } from '@/db/hooks';
import * as api from '@/db/api';
import type { MetaGoal, DailyAction } from '@/types';
import { getGoalColor } from '@/utils/goalColors';
import { hapticLight, hapticMedium } from '@/utils/haptics';

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
  /** Bonus A: current streak per action (days) */
  const [actionStreaks, setActionStreaks] = useState<Record<string, number>>({});

  const loadHabitAndMins = useCallback(async () => {
    const date = todayStr();
    const nextHabit: Record<string, boolean> = {};
    const nextMins: Record<string, number> = {};
    const nextStreaks: Record<string, number> = {};
    for (const { actions } of sections) {
      for (const a of actions) {
        if (a.type === 'habit') nextHabit[a.id] = await api.isHabitDoneToday(a.id);
        else {
          const sessions = await api.getSessionsForActionToday(a.id, date);
          nextMins[a.id] = Math.floor(sessions.reduce((s, x) => s + x.duration_seconds, 0) / 60);
        }
        // Bonus A: load current streak for every action
        nextStreaks[a.id] = api.getActionStreakMetrics(a.id, a.type).current;
      }
    }
    setHabitDones(nextHabit);
    setSessionMins(nextMins);
    setActionStreaks(nextStreaks);
  }, [sections]);

  useEffect(() => {
    loadHabitAndMins();
  }, [loadHabitAndMins]);

  /** If the selected goal no longer has active actions, avoid an empty view with a stale filter. */
  useEffect(() => {
    if (selectedGoalId === 'all') return;
    if (!sections.some(({ goal }) => goal.id === selectedGoalId)) {
      setSelectedGoalId('all');
    }
  }, [sections, selectedGoalId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const onHabitToggle = useCallback(
    async (actionId: string, done: boolean) => {
      done ? hapticMedium() : hapticLight();
      await api.setHabitCompletion(actionId, todayStr(), done);
      setHabitDones((prev) => ({ ...prev, [actionId]: done }));
      await refresh();
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

  const confirmDeactivateAction = useCallback(
    (action: DailyAction) => {
      Alert.alert(
        'Deactivate action?',
        `"${action.name}" will disappear from Today. Open Goals, tap the goal, then tap Restore on the paused action.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Deactivate',
            style: 'destructive',
            onPress: async () => {
              await api.updateAction(action.id, { is_active: 0 });
              await refresh();
              void loadHabitAndMins();
            },
          },
        ]
      );
    },
    [refresh, loadHabitAndMins]
  );

  const pullRefresh = useCallback(() => {
    void refresh().then(() => loadHabitAndMins());
  }, [refresh, loadHabitAndMins]);

  const [userName, setUserName] = useState('');

  useFocusEffect(
    useCallback(() => {
      setUserName(api.getSetting('user_name')?.trim() ?? '');
    }, [])
  );

  const greeting = (() => {
    const h = new Date().getHours();
    const base = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    return userName ? `${base}, ${userName}` : base;
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
              <View
                className="w-8 h-8 rounded-full items-center justify-center"
                style={{ backgroundColor: '#1f1f1f' }}
              >
                <Ionicons name="person-outline" size={16} color={Colors.textSecondary} />
              </View>
              <Text className="text-title2 font-bold text-text-primary">
                {greeting}
              </Text>
            </View>
            <Pressable onPress={pullRefresh} hitSlop={12} accessibilityLabel="Refresh today">
              <Ionicons name="refresh" size={18} color={Colors.textTertiary} />
            </Pressable>
          </View>
        </View>

        <View className="px-4 pt-3 pb-6">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-[9px] uppercase mb-1 text-text-label" style={{ letterSpacing: 2.5 }}>{dateStr}</Text>
              <Text className="text-title1 font-bold tracking-tight text-text-primary">
                Your Path.
              </Text>
            </View>
            <TodayScoreRing score={score} size={80} lineWidth={8} />
          </View>
        </View>

        {sections.length > 0 ? (
          <View className="h-[44px] justify-center mb-2">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, alignItems: 'center' }}>
              <Pressable
                onPress={() => setSelectedGoalId('all')}
                className="h-[30px] px-4 rounded-md items-center justify-center"
                style={{
                  backgroundColor: selectedGoalId === 'all' ? '#2a2a2a' : 'transparent',
                  borderWidth: 0.5,
                  borderColor: 'rgba(255,255,255,0.15)',
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
                      backgroundColor: active ? '#2a2a2a' : 'transparent',
                      borderWidth: 0.5,
                      borderColor: 'rgba(255,255,255,0.15)',
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
        ) : null}

        <View className="px-4 pt-3 pb-2">
          <Text className="text-[7px] uppercase text-text-label" style={{ letterSpacing: 2.5 }}>▶ Today&apos;s Actions</Text>
        </View>

        <View className="px-4">
          {visibleSections.length === 0 ? (
            sections.length === 0 ? (
              <View className="items-center py-16 px-4">
                <Ionicons name="flag-outline" size={56} color={Colors.textTertiary} />
                <Text className="text-title2 font-semibold text-text-primary mt-4 text-center">
                  Start by adding your first pillar
                </Text>
                <Text className="text-subheadline text-text-secondary mt-2 text-center max-w-[300px]">
                  Create a goal and attach daily actions so Today can track what matters.
                </Text>
                <View className="mt-8 w-full max-w-[280px]">
                  <PrimaryButton
                    title="SET UP GOALS"
                    onPress={() => router.push('/(tabs)/goals')}
                    showArrow={false}
                  />
                </View>
              </View>
            ) : (
              <View className="items-center py-16">
                <Ionicons name="checkmark-done-circle" size={56} color={Colors.textPrimary} />
                <Text className="text-title2 font-semibold text-text-primary mt-4">You crushed today.</Text>
                <Text className="text-subheadline text-text-secondary mt-1 text-center px-8">
                  {selectedGoalId === 'all'
                    ? 'No pending actions left. Add more from Goals if you want extra momentum.'
                    : 'No actions left for this goal today.'}
                </Text>
              </View>
            )
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
                  const streak = actionStreaks[action.id] ?? 0;
                  const tone = getGoalColor(goal.id);
                  const row = (
                    <View>
                      {streak >= 2 && (
                        <View className="flex-row items-center gap-1 mb-0.5 pl-4">
                          <Text style={{ fontSize: 10 }}>🔥</Text>
                          <Text
                            className="text-[9px] font-semibold"
                            style={{ color: tone, letterSpacing: 0.3 }}
                          >
                            {streak}d streak
                          </Text>
                        </View>
                      )}
                      <ActionRow
                        goal={goal}
                        action={action}
                        progress={progress}
                        isCompleted={completed}
                        isHabitDone={!!habitDones[action.id]}
                        minutesLoggedToday={mins}
                        toneColor={tone}
                        onStart={isSession ? () => onStartSession(goal, action) : undefined}
                        onHabitToggle={!isSession ? (done) => onHabitToggle(action.id, done) : undefined}
                      />
                    </View>
                  );
                  if (Platform.OS === 'web') {
                    return (
                      <View key={action.id} className="flex-row items-stretch gap-1 mb-1">
                        <View className="flex-1 min-w-0">{row}</View>
                        <Pressable
                          onPress={() => confirmDeactivateAction(action)}
                          className="w-11 rounded-lg items-center justify-center"
                          style={{ backgroundColor: '#1f1f1f' }}
                        >
                          <Text className="text-[7px] uppercase text-text-tertiary text-center px-0.5">Hide</Text>
                        </Pressable>
                      </View>
                    );
                  }
                  return (
                    <Swipeable
                      key={action.id}
                      friction={2}
                      overshootRight={false}
                      enableTrackpadTwoFingerGesture
                      rightThreshold={32}
                      renderRightActions={() => (
                        <View className="justify-center mb-1 pl-2">
                          <TouchableOpacity
                            onPress={() => confirmDeactivateAction(action)}
                            className="min-h-[64px] w-[76px] rounded-lg items-center justify-center"
                            style={{ backgroundColor: '#2a2a2a' }}
                            activeOpacity={0.85}
                          >
                            <Text className="text-[8px] uppercase font-semibold text-accent-danger">Off</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    >
                      {row}
                    </Swipeable>
                  );
                })}
              </View>
            ))
          )}

          {hasAnyActions && !allDone ? (() => {
            // Find the action with the longest current streak to feature
            const bestEntry = Object.entries(actionStreaks).reduce<{ id: string; streak: number } | null>(
              (best, [id, s]) => (!best || s > best.streak ? { id, streak: s } : best),
              null
            );
            const bestAction = bestEntry && bestEntry.streak >= 2
              ? visibleSections.flatMap((s) => s.actions).find((a) => a.id === bestEntry.id)
              : null;
            if (!bestAction || !bestEntry) return null;
            const bestGoal = visibleSections.find((s) => s.actions.some((a) => a.id === bestAction.id))?.goal;
            const tone = bestGoal ? getGoalColor(bestGoal.id) : Colors.goalMind;
            return (
              <View
                className="mt-6 rounded-3xl p-6 flex-row items-center justify-between"
                style={{ backgroundColor: '#1f1f1f' }}
              >
                <View className="flex-1 pr-4">
                  <Text className="text-title2 font-bold mb-1 text-text-primary">
                    Consistency pays off.
                  </Text>
                  <Text className="text-subheadline text-text-secondary">
                    {`${bestEntry.streak} days in a row for "${bestAction.name}". Keep it up!`}
                  </Text>
                </View>
                <View className="w-16 h-16 rounded-2xl items-center justify-center bg-bg-primary">
                  <Ionicons name="flame" size={24} color={tone} />
                </View>
              </View>
            );
          })() : null}
        </View>
      </ScrollView>

      <Pressable
        onPress={() => router.push('/(tabs)/goals?create=1')}
        accessibilityLabel="Add goal"
        className="absolute right-6 bottom-[90px] w-12 h-12 rounded-full items-center justify-center"
        style={{
          backgroundColor: '#2a2a2a',
          borderWidth: 0.5,
          borderColor: 'rgba(255,255,255,0.15)',
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
