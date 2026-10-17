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
import { FontFamily, Radius, Surface, Type, hexToRgba } from '@/constants/design';
import { Mascot, type MascotMood } from '@/components/onboarding/Mascot';
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
  const nothingLogged = creditedMinutes === 0 && completedVisibleActions === 0;
  const truthLine = allDone
    ? 'Every pillar got its time today.'
    : creditedMinutes > 0
      ? 'Nice. Give the next hour to a pillar too.'
      : completedVisibleActions > 0
        ? 'Habits ticked. Now give an hour to a pillar.'
        : 'Give your first hour to a pillar.';
  const flickMood: MascotMood = allDone ? 'proud' : nothingLogged ? 'calm' : 'happy';
  const flickIntensity = 0.45 + 0.55 * dayProgress;

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
        <Animated.View entering={enter(enterIndex++)} style={{ paddingHorizontal: 20, paddingTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={Type.eyebrow}>{dateStr}</Text>
            <PressableScale
              onPress={() => router.push('/(tabs)/goals?create=1')}
              accessibilityLabel="Add pillar"
              hitSlop={8}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: Surface.surfaceRaised,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Plus size={20} color={Surface.ink} strokeWidth={2.4} />
            </PressableScale>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 4 }}>
            <Text style={[Type.title, { flex: 1, paddingBottom: 6 }]}>{greeting}</Text>
            {sections.length > 0 && (
              <View accessible accessibilityLabel={allDone ? 'Flick is proud' : 'Flick'} style={{ marginRight: -6 }}>
                <Mascot mood={flickMood} size={92} intensity={flickIntensity} />
              </View>
            )}
          </View>
        </Animated.View>

        {/* Hero: day ring + minutes given */}
        {sections.length > 0 && (
          <Animated.View entering={enter(enterIndex++)} style={{ alignItems: 'center', paddingTop: 16, paddingBottom: 4 }}>
            <ProgressRing progress={dayProgress} size={212} strokeWidth={12} color={Surface.ink} trackColor={Surface.surfaceRaised}>
              <AnimatedNumber value={creditedMinutes} format={(n) => formatMinutes(n)} style={[Type.hero, { fontSize: 50, lineHeight: 56 }]} />
              <Text style={[Type.meta, { marginTop: 0, fontSize: 14 }]}>given to your pillars</Text>
            </ProgressRing>
            <Text style={[Type.heading, { marginTop: 18, fontSize: 18 }]}>
              {completedVisibleActions} of {totalVisibleActions} done
            </Text>
            <Text style={[Type.accent, { marginTop: 4, textAlign: 'center', paddingHorizontal: 40 }]}>{truthLine}</Text>

            <PressableScale
              onPress={() => router.push('/(tabs)/focus')}
              accessibilityRole="button"
              accessibilityLabel="Free session"
              style={{
                marginTop: 18,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                height: 44,
                paddingHorizontal: 20,
                borderRadius: Radius.full,
                backgroundColor: Surface.surfaceRaised,
              }}
            >
              <Timer size={17} color={Surface.ink} strokeWidth={2.4} />
              <Text style={[Type.heading, { fontSize: 16 }]}>Free session</Text>
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
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={chip.name}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 7,
                      height: 40,
                      paddingHorizontal: 16,
                      borderRadius: Radius.full,
                      backgroundColor: active ? Surface.ink : Surface.surfaceRaised,
                    }}
                  >
                    {chip.id !== 'all' && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: chip.color }} />}
                    <Text style={{ color: active ? Surface.surface : Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 15 }}>{chip.name}</Text>
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
            sections.length === 0 ? (
              <Animated.View entering={enter(enterIndex++)} style={{ alignItems: 'center', marginTop: 28 }}>
                <Mascot mood="wave" size={132} intensity={0.55} />
                <Text style={[Type.title, { marginTop: 18, textAlign: 'center' }]}>Give your first hour to a pillar.</Text>
                <Text style={[Type.body, { marginTop: 10, textAlign: 'center', paddingHorizontal: 12 }]}>
                  Pick what matters to you (body, mind, craft, etc.) and add one daily action. Every minute you focus gets given to it.
                </Text>
                <View style={{ marginTop: 28, gap: 10, alignSelf: 'stretch' }}>
                  <PrimaryButton title="Add a pillar" appearance="filled" onPress={() => router.push('/(tabs)/goals?create=1')} showArrow={false} />
                  <PrimaryButton title="Start a free session" appearance="ghost" onPress={() => router.push('/(tabs)/focus')} showArrow={false} />
                </View>
              </Animated.View>
            ) : (
              <Animated.View entering={enter(enterIndex++)} style={{ backgroundColor: Surface.surfaceRaised, borderRadius: Radius.lg, padding: 22 }}>
                <Text style={[Type.heading, { fontSize: 20, lineHeight: 26 }]}>Nothing left here.</Text>
                <Text style={[Type.body, { marginTop: 6 }]}>
                  {selectedGoalId === 'all'
                    ? 'No pending actions left. Add more from Goals if you want to give a pillar extra time.'
                    : 'No actions left for this pillar today.'}
                </Text>
              </Animated.View>
            )
          ) : (
            visibleSections.map(({ goal, actions }) => {
              const tone = getGoalColor(goal);
              const goalMinutes = actions.reduce((total, action) => total + (sessionMins[action.id] ?? 0), 0);
              const goalTargetMinutes = actions.reduce((total, action) => (action.type === 'session' ? total + action.target_minutes : total), 0);
              return (
                <Animated.View key={goal.id} entering={enter(enterIndex++)} style={{ marginBottom: 22 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: hexToRgba(tone, 0.14),
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <PillarIcon icon={goal.icon} name={goal.name} color={tone} size={40} tinted={false} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={[Type.heading, { fontSize: 19, lineHeight: 24 }]}>
                        {goal.name}
                      </Text>
                      {goalTargetMinutes > 0 && (
                        <Text style={[Type.meta, { marginTop: 1 }]}>
                          <Text style={{ color: tone, fontFamily: FontFamily.bodyBold }}>{formatMinutes(goalMinutes)}</Text> given of {formatMinutes(goalTargetMinutes)}
                        </Text>
                      )}
                    </View>
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
                              style={{ width: 64, height: '100%', minHeight: 64, borderRadius: Radius.md, backgroundColor: Surface.hill, alignItems: 'center', justifyContent: 'center', gap: 4 }}
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
            <Text style={[Type.meta, { textAlign: 'center', color: Surface.faint, marginTop: 2 }]}>
              {Platform.OS === 'web' ? 'Long-press an action to hide it.' : 'Swipe or long-press an action to hide it.'}
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
