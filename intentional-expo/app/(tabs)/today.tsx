import { useCallback, useState, useEffect, useMemo } from 'react';
import { View, Text, Pressable, Platform, Alert } from 'react-native';
import { ScrollView, Swipeable, TouchableOpacity } from 'react-native-gesture-handler';
import { useRouter, Stack } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ActionRow } from '@/components/ActionRow';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TodayScoreRing } from '@/components/TodayScoreRing';
import { Colors, FontFamily, Radius, Surface } from '@/constants/design';
import { useTodaySections, useTodayScore } from '@/db/hooks';
import * as api from '@/db/api';
import type { MetaGoal, DailyAction } from '@/types';
import { getGoalColor } from '@/utils/goalColors';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { SuggestionCard } from '@/components/SuggestionCard';
import { getTopSuggestion } from '@/services/suggestions';
import AsyncStorage from '@react-native-async-storage/async-storage';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatMinutes(totalMinutes: number): string {
  const mins = Math.max(0, Math.floor(totalMinutes));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
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
  const [suggestionDismissed, setSuggestionDismissed] = useState(true); // start hidden; load async

  const DISMISS_KEY = 'suggestion_dismissed_date';
  const todayDateStr = new Date().toISOString().slice(0, 10);

  // Load dismiss state on focus
  useFocusEffect(
    useCallback(() => {
      setUserName(api.getSetting('user_name')?.trim() ?? '');
      void AsyncStorage.getItem(DISMISS_KEY).then((stored) => {
        setSuggestionDismissed(stored === todayDateStr);
      });
    }, [todayDateStr])
  );

  const handleDismissSuggestion = useCallback(() => {
    setSuggestionDismissed(true);
    void AsyncStorage.setItem(DISMISS_KEY, todayDateStr);
  }, [todayDateStr]);

  // All active actions flattened (for the suggestion engine)
  const allActiveActions = useMemo(
    () => sections.flatMap((s) => s.actions),
    [sections],
  );
  // All goals from sections
  const allGoals = useMemo(
    () => sections.map((s) => s.goal),
    [sections],
  );

  const suggestion = useMemo(
    () => (suggestionDismissed ? null : getTopSuggestion(allActiveActions, allGoals)),
    [suggestionDismissed, allActiveActions, allGoals],
  );

  const handleSuggestionCta = useCallback(() => {
    if (!suggestion) return;
    if (suggestion.type === 'streak_at_risk' || suggestion.type === 'momentum') {
      // For habit type: mark done directly; for session: go to focus
      const action = allActiveActions.find((a) => a.id === suggestion.actionId);
      if (action?.type === 'habit' && suggestion.actionId) {
        void api.setHabitCompletion(suggestion.actionId, todayDateStr, true).then(() => {
          void refresh();
          void loadHabitAndMins();
          handleDismissSuggestion();
        });
        return;
      }
    }
    // All other types: navigate to Focus screen
    if (suggestion.goalId) {
      const params = suggestion.actionId
        ? `goalId=${encodeURIComponent(suggestion.goalId)}&actionId=${encodeURIComponent(suggestion.actionId)}`
        : `goalId=${encodeURIComponent(suggestion.goalId)}`;
      router.push(`/(tabs)/focus?${params}`);
    }
    handleDismissSuggestion();
  }, [suggestion, allActiveActions, todayDateStr, router, refresh, loadHabitAndMins, handleDismissSuggestion]);

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
  const creditedMinutes = visibleSections.reduce((total, section) => {
    return total + section.actions.reduce((inner, action) => inner + (sessionMins[action.id] ?? 0), 0);
  }, 0);
  const truthLine = creditedMinutes > 0
    ? `${formatMinutes(creditedMinutes)} credited to pillars today. ${allDone ? 'The ledger is clean.' : 'One session away from a balanced day.'}`
    : 'No time credited yet. Start one session and Intentional will show where the day went.';

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <View className="px-6 pt-8 pb-6">
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8 }}>
                {dateStr}
              </Text>
              <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.display, fontSize: 48, lineHeight: 52, letterSpacing: -0.5 }}>
                {sections.length === 0 ? 'Blank slate.' : greeting}
              </Text>
            </View>
            {sections.length > 0 && (
              <Pressable onPress={pullRefresh} hitSlop={12} accessibilityLabel="Refresh today">
                <View
                  className="w-12 h-12 rounded-full items-center justify-center"
                  style={{ 
                    backgroundColor: Surface.surface, 
                    borderWidth: 1, 
                    borderColor: Surface.rule,
                    shadowColor: '#362614',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.04,
                    shadowRadius: 6,
                    elevation: 2,
                  }}
                >
                  <Ionicons name="refresh" size={19} color={Colors.textSecondary} />
                </View>
              </Pressable>
            )}
          </View>
        </View>

        {sections.length > 0 && (
        <View className="px-6 pb-10">
          <View className="items-center pt-6 pb-8">
            <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.display, fontSize: 80, lineHeight: 84, textAlign: 'center', marginBottom: 12, letterSpacing: -1 }}>
              {formatMinutes(creditedMinutes)}
            </Text>
            <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 16, lineHeight: 23, textAlign: 'center', maxWidth: 340, paddingHorizontal: 16 }}>
              {creditedMinutes > 0 
                ? allDone 
                  ? 'The ledger is clean.' 
                  : 'One honest session changes the shape of the day.'
                : 'No time credited yet. Start one session.'}
            </Text>
          </View>
        </View>
        )}

        {sections.length > 0 ? (
          <View className="mb-6">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 24, alignItems: 'center' }}>
              <Pressable
                onPress={() => setSelectedGoalId('all')}
                style={{
                  backgroundColor: selectedGoalId === 'all' ? Surface.ink : Surface.surface,
                  borderWidth: 1,
                  borderColor: selectedGoalId === 'all' ? Surface.ink : Surface.rule,
                  borderRadius: Radius.cta,
                  paddingVertical: 12,
                  paddingHorizontal: 20,
                  shadowColor: '#362614',
                  shadowOffset: { width: 0, height: selectedGoalId === 'all' ? 3 : 1 },
                  shadowOpacity: selectedGoalId === 'all' ? 0.12 : 0.03,
                  shadowRadius: selectedGoalId === 'all' ? 8 : 3,
                  elevation: selectedGoalId === 'all' ? 3 : 1,
                }}
              >
                <Text
                  style={{
                    color: selectedGoalId === 'all' ? Surface.canvas : Colors.textPrimary,
                    fontFamily: FontFamily.bodySemiBold,
                    fontSize: 16,
                    letterSpacing: -0.2,
                  }}
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
                    style={{
                      backgroundColor: active ? Surface.ink : Surface.surface,
                      borderWidth: 1,
                      borderColor: active ? getGoalColor(goal.id) : Surface.rule,
                      borderRadius: Radius.cta,
                      paddingVertical: 12,
                      paddingHorizontal: 20,
                      shadowColor: '#362614',
                      shadowOffset: { width: 0, height: active ? 3 : 1 },
                      shadowOpacity: active ? 0.12 : 0.03,
                      shadowRadius: active ? 8 : 3,
                      elevation: active ? 3 : 1,
                    }}
                  >
                    <Text
                      style={{
                        color: active ? Surface.canvas : Colors.textPrimary,
                        fontFamily: FontFamily.bodySemiBold,
                        fontSize: 16,
                        letterSpacing: -0.2,
                      }}
                    >
                      {goal.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* Primary CTA: Start manual focus (available when Today is populated) */}
        {sections.length > 0 && (
          <View className="px-6 mb-6">
            <PrimaryButton
              title="Start manual focus"
              appearance="goalOutline"
              onPress={() => router.push('/(tabs)/focus')}
              showArrow={false}
            />
          </View>
        )}

        {/* US-040: Smart suggestion card */}
        {suggestion && sections.length > 0 ? (
          <SuggestionCard
            suggestion={suggestion}
            onCta={handleSuggestionCta}
            onDismiss={handleDismissSuggestion}
          />
        ) : null}

        <View className="px-6">
          {visibleSections.length === 0 ? (
            sections.length === 0 ? (
              <View
                className="py-10 px-6"
                style={{ 
                  backgroundColor: Surface.surface, 
                  borderWidth: 1, 
                  borderColor: Surface.rule, 
                  borderRadius: Radius.lg, 
                  marginTop: 48,
                  shadowColor: '#362614',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04,
                  shadowRadius: 8,
                  elevation: 2,
                }}
              >
                <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.display, fontSize: 64, lineHeight: 66, letterSpacing: -1 }}>
                  0m
                </Text>
                <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 16, lineHeight: 24, marginTop: 12, marginBottom: 24 }}>
                  Your ledger is blank. Add one action to a pillar, or start a manual focus session and credit the time honestly.
                </Text>
                <View className="gap-3">
                  <PrimaryButton
                    title="Add action"
                    appearance="filled"
                    onPress={() => router.push('/(tabs)/goals')}
                    showArrow={false}
                  />
                  <PrimaryButton
                    title="Start focus"
                    appearance="goalOutline"
                    onPress={() => router.push('/(tabs)/focus')}
                    showArrow={false}
                  />
                </View>
              </View>
            ) : (
              <View
                className="py-8 px-6"
                style={{ 
                  backgroundColor: Surface.surface, 
                  borderWidth: 1, 
                  borderColor: Surface.rule, 
                  borderRadius: Radius.lg,
                  shadowColor: '#362614',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04,
                  shadowRadius: 8,
                  elevation: 2,
                }}
              >
                <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.display, fontSize: 32, lineHeight: 38, letterSpacing: -0.5 }}>
                  The visible ledger is clear.
                </Text>
                <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 16, lineHeight: 23, marginTop: 12 }}>
                  {selectedGoalId === 'all'
                    ? 'No pending actions left. Add more from Goals if you want extra evidence.'
                    : 'No actions left for this goal today.'}
                </Text>
              </View>
            )
          ) : (
            visibleSections.map(({ goal, actions }) => {
              const goalMinutes = actions.reduce((total, action) => total + (sessionMins[action.id] ?? 0), 0);
              const goalTargetMinutes = actions.reduce((total, action) => {
                if (action.type === 'session') return total + action.target_minutes;
                return total;
              }, 0);
              
              return (
                <View
                  key={goal.id}
                  className="mb-5 p-5"
                  style={{ 
                    backgroundColor: Surface.surface, 
                    borderWidth: 1, 
                    borderColor: Surface.rule, 
                    borderRadius: Radius.lg,
                    shadowColor: '#362614',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.04,
                    shadowRadius: 8,
                    elevation: 2,
                  }}
                >
                  <View className="flex-row items-center justify-between mb-4">
                    <View className="flex-row items-center gap-2.5">
                      <View className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: getGoalColor(goal.id) }} />
                      <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 18, letterSpacing: -0.2 }}>
                        {goal.name}
                      </Text>
                    </View>
                    <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 0.3 }}>
                      {goalTargetMinutes > 0 
                        ? `${formatMinutes(goalMinutes)} / ${formatMinutes(goalTargetMinutes)}`
                        : goalMinutes > 0 
                        ? formatMinutes(goalMinutes)
                        : 'Done'}
                    </Text>
                  </View>
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
                            <Text
                              style={{ color: tone, fontFamily: FontFamily.monoSemiBold, fontSize: 10, letterSpacing: 0.3 }}
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
                            style={{ backgroundColor: Surface.surfaceRaised }}
                          >
                            <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.monoSemiBold, fontSize: 9, textTransform: 'uppercase' }}>Hide</Text>
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
                              className="min-h-[76px] w-[76px] items-center justify-center"
                              style={{ backgroundColor: Surface.surfaceRaised, borderRadius: Radius.md }}
                              activeOpacity={0.85}
                            >
                              <Text style={{ color: Colors.accentDanger, fontFamily: FontFamily.monoSemiBold, fontSize: 10, textTransform: 'uppercase' }}>Off</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      >
                        {row}
                      </Swipeable>
                    );
                  })}
                </View>
              );
            })
          )}

          {sections.length > 0 && visibleSections.length > 0 && (
            <View
              className="mt-6 p-5"
              style={{ 
                backgroundColor: Surface.surface, 
                borderWidth: 1, 
                borderColor: Surface.rule, 
                borderRadius: Radius.lg,
                shadowColor: '#362614',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 10, letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 10 }}>
                Plain truth
              </Text>
              <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 15, lineHeight: 22 }}>
                {creditedMinutes > 0 
                  ? allDone 
                    ? 'The ledger is clean. Everything assigned to today has been logged.' 
                    : visibleSections.length === 1
                    ? `${visibleSections[0].goal.name} has a start. ${visibleSections.length < sections.length ? 'Other pillars are filtered out.' : 'One more session changes the shape of the day.'}`
                    : 'Work is happening across multiple pillars. That is evidence, not vibes.'
                  : 'No time credited yet. Start one session and the accounting begins.'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Pressable
        onPress={() => router.push('/(tabs)/goals?create=1')}
        accessibilityLabel="Add goal"
        className="absolute right-6 bottom-[94px] w-14 h-14 rounded-full items-center justify-center"
        style={{
          backgroundColor: Surface.ink,
          borderWidth: 0,
          shadowColor: '#171411',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.24,
          shadowRadius: 12,
          elevation: 6,
        }}
      >
        <Ionicons name="add" size={24} color={Surface.surface} />
      </Pressable>
    </SafeAreaView>
  );
}
