import { useCallback, useState, useEffect, useMemo } from 'react';
import { View, Text, Platform, Alert, RefreshControl } from 'react-native';
import { ScrollView, Swipeable, TouchableOpacity } from 'react-native-gesture-handler';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { EyeOff, Plus, Timer } from 'lucide-react-native';
import { ActionRow } from '@/components/ActionRow';
import { PrimaryButton } from '@/components/PrimaryButton';
import { AnimatedNumber, PressableScale, ProgressRing, enter } from '@/components/ui/motion';
import { PillarIcon } from '@/components/ui/PillarIcon';
import { Elevation, Radius, Surface, Type } from '@/constants/design';
import { useTodaySections } from '@/db/hooks';
import * as api from '@/db/api';
import type { MetaGoal, DailyAction } from '@/types';
import { getGoalColor } from '@/utils/goalColors';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { SuggestionCard } from '@/components/SuggestionCard';
import { getTopSuggestion } from '@/services/suggestions';
import { cancelActionReminder } from '@/services/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDayKey } from '@/utils/dates';

function todayStr() {
  return localDayKey();
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
              void cancelActionReminder(action.id);
              await refresh();
              void loadHabitAndMins();
            },
          },
        ]
      );
    },
    [refresh, loadHabitAndMins]
  );

  const [userName, setUserName] = useState('');
  const [suggestionDismissed, setSuggestionDismissed] = useState(true); // start hidden; load async

  const DISMISS_KEY = 'suggestion_dismissed_date';
  const todayDateStr = localDayKey();

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
    return userName ? `${base},\n${userName}` : base;
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
  const dayProgress = hasAnyActions ? completedVisibleActions / totalVisibleActions : 0;
  const truthLine = allDone
    ? 'The ledger is clean.'
    : creditedMinutes > 0
      ? 'One honest session changes the shape of the day.'
      : 'No time credited yet. Start one session.';

  const [refreshing, setRefreshing] = useState(false);
  const onPullRefresh = useCallback(() => {
    setRefreshing(true);
    void refresh()
      .then(() => loadHabitAndMins())
      .finally(() => setRefreshing(false));
  }, [refresh, loadHabitAndMins]);

  let enterIndex = 0;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={Surface.muted} />}
      >
        {/* Header */}
        <Animated.View entering={enter(enterIndex++)} style={{ paddingHorizontal: 20, paddingTop: 16, flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={Type.eyebrow}>{dateStr}</Text>
            <Text style={[Type.title, { marginTop: 6 }]}>{sections.length === 0 ? 'Blank slate.' : greeting}</Text>
          </View>
          <PressableScale
            onPress={() => router.push('/(tabs)/goals?create=1')}
            accessibilityLabel="Add pillar"
            hitSlop={8}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: Surface.surface,
              alignItems: 'center',
              justifyContent: 'center',
              ...Elevation.card,
            }}
          >
            <Plus size={20} color={Surface.ink} strokeWidth={2} />
          </PressableScale>
        </Animated.View>

        {/* Hero: day ring + credited minutes */}
        {sections.length > 0 && (
          <Animated.View entering={enter(enterIndex++)} style={{ alignItems: 'center', paddingTop: 28, paddingBottom: 8 }}>
            <ProgressRing progress={dayProgress} size={212} strokeWidth={9} color={Surface.ink}>
              <AnimatedNumber value={creditedMinutes} format={(n) => formatMinutes(n)} style={Type.hero} />
              <Text style={[Type.meta, { marginTop: 2 }]}>focused today</Text>
            </ProgressRing>
            <Text style={[Type.number, { marginTop: 18, color: Surface.ink }]}>
              {completedVisibleActions} of {totalVisibleActions} done
            </Text>
            <Text style={[Type.body, { marginTop: 4, textAlign: 'center', paddingHorizontal: 40 }]}>{truthLine}</Text>

            <PressableScale
              onPress={() => router.push('/(tabs)/focus')}
              style={{
                marginTop: 20,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingVertical: 10,
                paddingHorizontal: 18,
                borderRadius: Radius.full,
                backgroundColor: Surface.ink,
              }}
            >
              <Timer size={16} color={Surface.surface} strokeWidth={2} />
              <Text style={[Type.heading, { color: Surface.surface, fontSize: 15 }]}>Free session</Text>
            </PressableScale>
          </Animated.View>
        )}

        {/* Pillar filter */}
        {sections.length > 1 && (
          <Animated.View entering={enter(enterIndex++)} style={{ marginTop: 24 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
              {[{ id: 'all' as const, name: 'All', color: Surface.ink }, ...sections.map(({ goal }) => ({ id: goal.id, name: goal.name, color: getGoalColor(goal) }))].map((chip) => {
                const active = selectedGoalId === chip.id;
                return (
                  <PressableScale
                    key={chip.id}
                    onPress={() => setSelectedGoalId(chip.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 7,
                      paddingVertical: 8,
                      paddingHorizontal: 14,
                      borderRadius: Radius.full,
                      backgroundColor: active ? Surface.ink : Surface.surface,
                      borderWidth: 1,
                      borderColor: active ? Surface.ink : Surface.rule,
                    }}
                  >
                    {chip.id !== 'all' && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: chip.color }} />}
                    <Text style={[Type.meta, { color: active ? Surface.surface : Surface.ink, fontSize: 14 }]}>{chip.name}</Text>
                  </PressableScale>
                );
              })}
            </ScrollView>
          </Animated.View>
        )}

        {/* US-040: Smart suggestion card */}
        {suggestion && sections.length > 0 ? (
          <View style={{ marginTop: 20 }}>
            <SuggestionCard suggestion={suggestion} onCta={handleSuggestionCta} onDismiss={handleDismissSuggestion} />
          </View>
        ) : null}

        <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
          {visibleSections.length === 0 ? (
            <Animated.View
              entering={enter(enterIndex++)}
              style={{ backgroundColor: Surface.surface, borderRadius: Radius.lg, padding: 24, marginTop: sections.length === 0 ? 40 : 0, ...Elevation.card }}
            >
              <Text style={Type.title}>{sections.length === 0 ? 'Your ledger is blank.' : 'Nothing left here.'}</Text>
              <Text style={[Type.body, { marginTop: 8 }]}>
                {sections.length === 0
                  ? 'Add a pillar and one daily action. Then every minute you focus gets credited to what matters.'
                  : selectedGoalId === 'all'
                    ? 'No pending actions left. Add more from Goals if you want extra evidence.'
                    : 'No actions left for this pillar today.'}
              </Text>
              {sections.length === 0 && (
                <View style={{ marginTop: 20, gap: 10 }}>
                  <PrimaryButton title="Add a pillar" appearance="filled" onPress={() => router.push('/(tabs)/goals?create=1')} showArrow={false} />
                  <PrimaryButton title="Start focus" appearance="ghost" onPress={() => router.push('/(tabs)/focus')} showArrow={false} />
                </View>
              )}
            </Animated.View>
          ) : (
            visibleSections.map(({ goal, actions }) => {
              const tone = getGoalColor(goal);
              const goalMinutes = actions.reduce((total, action) => total + (sessionMins[action.id] ?? 0), 0);
              const goalTargetMinutes = actions.reduce((total, action) => (action.type === 'session' ? total + action.target_minutes : total), 0);
              return (
                <Animated.View key={goal.id} entering={enter(enterIndex++)} style={{ marginBottom: 18 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <PillarIcon icon={goal.icon} name={goal.name} color={tone} size={30} />
                    <Text style={[Type.heading, { flex: 1 }]}>{goal.name}</Text>
                    {goalTargetMinutes > 0 && (
                      <Text style={Type.number}>
                        {formatMinutes(goalMinutes)} / {formatMinutes(goalTargetMinutes)}
                      </Text>
                    )}
                  </View>

                  {actions.map((action) => {
                    const isSession = action.type === 'session';
                    const mins = sessionMins[action.id] ?? 0;
                    const progress = action.target_minutes > 0 ? Math.min(1, mins / action.target_minutes) : 0;
                    const completed = isSession ? progress >= 1 : !!habitDones[action.id];
                    const row = (
                      <ActionRow
                        goal={goal}
                        action={action}
                        progress={progress}
                        isCompleted={completed}
                        isHabitDone={!!habitDones[action.id]}
                        minutesLoggedToday={mins}
                        toneColor={tone}
                        streak={actionStreaks[action.id] ?? 0}
                        onStart={isSession ? () => onStartSession(goal, action) : undefined}
                        onHabitToggle={!isSession ? (done) => onHabitToggle(action.id, done) : undefined}
                        onLongPress={() => confirmDeactivateAction(action)}
                      />
                    );
                    if (Platform.OS === 'web') return <View key={action.id}>{row}</View>;
                    return (
                      <Swipeable
                        key={action.id}
                        friction={2}
                        overshootRight={false}
                        rightThreshold={32}
                        renderRightActions={() => (
                          <View style={{ justifyContent: 'center', paddingLeft: 10, marginBottom: 10 }}>
                            <TouchableOpacity
                              onPress={() => confirmDeactivateAction(action)}
                              activeOpacity={0.85}
                              style={{ width: 64, height: '100%', minHeight: 64, borderRadius: Radius.md, backgroundColor: Surface.surfaceRaised, alignItems: 'center', justifyContent: 'center', gap: 4 }}
                            >
                              <EyeOff size={18} color={Surface.muted} strokeWidth={1.75} />
                              <Text style={[Type.meta, { fontSize: 12 }]}>Hide</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      >
                        {row}
                      </Swipeable>
                    );
                  })}
                </Animated.View>
              );
            })
          )}

          {visibleSections.length > 0 && (
            <Text style={[Type.meta, { textAlign: 'center', color: Surface.faint, marginTop: 4 }]}>
              {Platform.OS === 'web' ? 'Long-press an action to hide it.' : 'Swipe or long-press an action to hide it.'}
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
