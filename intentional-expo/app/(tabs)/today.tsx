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
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 132 }} showsVerticalScrollIndicator={false}>
        <View className="px-5 pt-6 pb-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                {dateStr}
              </Text>
              <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.display, fontSize: 44, lineHeight: 48, marginTop: 6 }}>
                {sections.length === 0 ? 'Blank slate.' : greeting}
              </Text>
            </View>
            {sections.length > 0 && (
              <Pressable onPress={pullRefresh} hitSlop={12} accessibilityLabel="Refresh today">
                <View
                  className="w-11 h-11 rounded-full items-center justify-center"
                  style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule }}
                >
                  <Ionicons name="refresh" size={18} color={Colors.textSecondary} />
                </View>
              </Pressable>
            )}
          </View>
        </View>

        {sections.length > 0 && (
        <View className="px-5 pb-8">
          <View className="items-center pt-8 pb-10">
            <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.display, fontSize: 76, lineHeight: 76, textAlign: 'center', marginBottom: 8 }}>
              {formatMinutes(creditedMinutes)}
            </Text>
            <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 17, lineHeight: 24, textAlign: 'center', maxWidth: 340 }}>
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
          <View className="mb-5">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 20, alignItems: 'center' }}>
              <Pressable
                onPress={() => setSelectedGoalId('all')}
                style={{
                  backgroundColor: selectedGoalId === 'all' ? Surface.ink : Surface.surface,
                  borderWidth: 1.5,
                  borderColor: selectedGoalId === 'all' ? Surface.ink : Surface.rule,
                  borderRadius: Radius.cta,
                  paddingVertical: 14,
                  paddingHorizontal: 24,
                }}
              >
                <Text
                  style={{
                    color: selectedGoalId === 'all' ? Surface.canvas : Colors.textPrimary,
                    fontFamily: FontFamily.bodySemiBold,
                    fontSize: 17,
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
                      borderWidth: 1.5,
                      borderColor: active ? getGoalColor(goal.id) : Surface.rule,
                      borderRadius: Radius.cta,
                      paddingVertical: 14,
                      paddingHorizontal: 24,
                    }}
                  >
                    <Text
                      style={{
                        color: active ? Surface.canvas : Colors.textPrimary,
                        fontFamily: FontFamily.bodySemiBold,
                        fontSize: 17,
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

        {/* US-040: Smart suggestion card */}
        {suggestion && sections.length > 0 ? (
          <SuggestionCard
            suggestion={suggestion}
            onCta={handleSuggestionCta}
            onDismiss={handleDismissSuggestion}
          />
        ) : null}

        <View className="px-5">
          {visibleSections.length === 0 ? (
            sections.length === 0 ? (
              <View
                className="py-8 px-5"
                style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.lg, marginTop: 64 }}
              >
                <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.display, fontSize: 56, lineHeight: 58 }}>
                  0m
                </Text>
                <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 17, lineHeight: 24, marginTop: 10 }}>
                  Your ledger is blank. Add one action to a pillar, or start a manual focus session and credit the time honestly.
                </Text>
                <View className="mt-6 gap-3">
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
                className="py-8 px-5"
                style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.lg }}
              >
                <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.display, fontSize: 34, lineHeight: 36 }}>
                  The visible ledger is clear.
                </Text>
                <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 17, lineHeight: 24, marginTop: 10 }}>
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
                  className="mb-4 p-4"
                  style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.lg }}
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center gap-2">
                      <View className="w-[9px] h-[9px] rounded-full" style={{ backgroundColor: getGoalColor(goal.id) }} />
                      <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 17 }}>
                        {goal.name}
                      </Text>
                    </View>
                    <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoMedium, fontSize: 11 }}>
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
              className="mt-2 p-4"
              style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.lg }}
            >
              <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 8 }}>
                Plain truth
              </Text>
              <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 16, lineHeight: 22 }}>
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
        className="absolute right-6 bottom-[90px] w-12 h-12 rounded-full items-center justify-center"
        style={{
          backgroundColor: Surface.ink,
          borderWidth: 1,
          borderColor: Surface.ink,
          shadowColor: 'rgba(54, 38, 20, 0.16)',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.18,
          shadowRadius: 12,
          elevation: 4,
        }}
      >
        <Ionicons name="add" size={20} color={Surface.surface} />
      </Pressable>
    </SafeAreaView>
  );
}
