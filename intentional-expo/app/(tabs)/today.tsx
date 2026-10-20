import { useCallback, useState, useEffect, useMemo } from 'react';
import { View, Text, Platform, Alert, RefreshControl } from 'react-native';
import { ScrollView, Swipeable, TouchableOpacity } from 'react-native-gesture-handler';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Check, ChevronDown, EyeOff, Plus, Timer } from 'lucide-react-native';
import { ActionRow } from '@/components/ActionRow';
import { PrimaryButton } from '@/components/PrimaryButton';
import { AnimatedNumber, PressableScale, ProgressRing, enter } from '@/components/ui/motion';
import { PillarIcon } from '@/components/ui/PillarIcon';
import { FontFamily, Radius, Surface, Type, hexToRgba } from '@/constants/design';
import { Mascot, type MascotMood } from '@/components/onboarding/Mascot';
import { useTodaySections } from '@/db/hooks';
import * as api from '@/db/api';
import * as goalProgress from '@/services/goalProgress';
import type { MetaGoal, DailyAction, Objective, Task } from '@/types';
import { getGoalColor } from '@/utils/goalColors';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { SuggestionCard } from '@/components/SuggestionCard';
import { getTopSuggestion } from '@/services/suggestions';
import { cancelActionReminder } from '@/services/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDayKey } from '@/utils/dates';
import { TODAY_VISIBLE_ACTIONS } from '@/constants/limits';

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

/** Pillars the person folded on Today (goal id → folded). */
const FOLD_KEY = '@intentional/todayFolded';

export default function TodayScreen() {
  const router = useRouter();
  const { sections, refresh } = useTodaySections();
  const [selectedGoalId, setSelectedGoalId] = useState<string | 'all'>('all');
  const [habitDones, setHabitDones] = useState<Record<string, boolean>>({});
  const [sessionMins, setSessionMins] = useState<Record<string, number>>({});
  /** Bonus A: current streak per action (days) */
  const [actionStreaks, setActionStreaks] = useState<Record<string, number>>({});
  /** US-065: objectives and tasks */
  const [objectives, setObjectives] = useState<Record<string, Objective | null>>({});
  const [objectiveTasks, setObjectiveTasks] = useState<Record<string, Task[]>>({});
  const [taskDones, setTaskDones] = useState<Record<string, boolean>>({});
  /**
   * Keeping a long day readable: pillars fold (a finished pillar folds itself), finished actions
   * tuck into a "N done" row, and only the first few open actions show until "Show N more".
   * Manual fold choices are remembered.
   */
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const [showAllOpen, setShowAllOpen] = useState<Record<string, boolean>>({});
  const [showDone, setShowDone] = useState<Record<string, boolean>>({});
  useEffect(() => {
    void AsyncStorage.getItem(FOLD_KEY)
      .then((raw) => {
        if (raw) setFolded(JSON.parse(raw) as Record<string, boolean>);
      })
      .catch(() => {});
  }, []);
  const toggleFold = (goalId: string, current: boolean) => {
    hapticLight();
    setFolded((f) => {
      const next = { ...f, [goalId]: !current };
      void AsyncStorage.setItem(FOLD_KEY, JSON.stringify(next));
      return next;
    });
  };

  const loadHabitAndMins = useCallback(async () => {
    const date = todayStr();
    const nextHabit: Record<string, boolean> = {};
    const nextMins: Record<string, number> = {};
    const nextStreaks: Record<string, number> = {};
    const nextObjectives: Record<string, Objective | null> = {};
    const nextTasks: Record<string, Task[]> = {};
    const nextTaskDones: Record<string, boolean> = {};
    
    for (const { goal, actions } of sections) {
      // US-065: Load active objective for this pillar
      const obj = await api.getActiveObjective(goal.id);
      nextObjectives[goal.id] = obj;
      
      if (obj) {
        // Load tasks for this objective
        const tasks = await api.getTasks(obj.id);
        nextTasks[goal.id] = tasks;
        
        // Track which tasks are done
        for (const t of tasks) {
          nextTaskDones[t.id] = t.is_done === 1;
        }
      }
      
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
    setObjectives(nextObjectives);
    setObjectiveTasks(nextTasks);
    setTaskDones(nextTaskDones);
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
  const totalVisibleActions = visibleSections.reduce((acc, s) => {
    const tasks = objectiveTasks[s.goal.id] ?? [];
    const todayTasks = tasks.filter(t => t.planned_date === todayStr());
    return acc + s.actions.length + todayTasks.length;
  }, 0);
  const completedVisibleActions = visibleSections.reduce((acc, s) => {
    const actionsDone = s.actions.reduce((inner, action) => {
      const isSession = action.type === 'session';
      const mins = sessionMins[action.id] ?? 0;
      const progress = action.target_minutes > 0 ? Math.min(1, mins / action.target_minutes) : 0;
      const completed = isSession ? progress >= 1 : !!habitDones[action.id];
      return inner + (completed ? 1 : 0);
    }, 0);
    const tasks = objectiveTasks[s.goal.id] ?? [];
    const todayTasks = tasks.filter(t => t.planned_date === todayStr());
    const tasksDone = todayTasks.filter(t => taskDones[t.id]).length;
    return acc + actionsDone + tasksDone;
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
            {/* Wraps onto a second line instead of scrolling sideways; centered like the ring above. */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, paddingHorizontal: 20 }}>
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
                      height: 38,
                      maxWidth: '100%',
                      paddingHorizontal: 15,
                      borderRadius: Radius.full,
                      backgroundColor: active ? Surface.ink : Surface.surfaceRaised,
                    }}
                  >
                    {chip.id !== 'all' && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: chip.color }} />}
                    <Text numberOfLines={1} style={{ flexShrink: 1, color: active ? Surface.surface : Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 15 }}>
                      {chip.name}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
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
              const isDone = (a: DailyAction) =>
                a.type === 'session' ? a.target_minutes > 0 && (sessionMins[a.id] ?? 0) >= a.target_minutes : !!habitDones[a.id];
              const open = actions.filter((a) => !isDone(a));
              const done = actions.filter(isDone);
              
              // US-065: Tasks for this pillar
              const obj = objectives[goal.id];
              const tasks = objectiveTasks[goal.id] ?? [];
              const todayTasks = tasks.filter(t => t.planned_date === todayStr());
              const nextTask = obj ? tasks.find(t => t.is_done === 0) : null;
              const openTasks = todayTasks.filter(t => !taskDones[t.id]);
              const doneTasks = todayTasks.filter(t => taskDones[t.id]);
              
              const allDone = actions.length > 0 && open.length === 0 && openTasks.length === 0;
              // Filtering to one pillar always shows it open.
              const isFolded = selectedGoalId === 'all' && (folded[goal.id] ?? allDone);
              const visibleOpen = showAllOpen[goal.id] ? open : open.slice(0, TODAY_VISIBLE_ACTIONS);
              const hiddenOpen = open.length - visibleOpen.length;
              const doneShown = allDone || !!showDone[goal.id];

              const renderAction = (action: DailyAction) => {
                const isSession = action.type === 'session';
                const mins = sessionMins[action.id] ?? 0;
                const progress = action.target_minutes > 0 ? Math.min(1, mins / action.target_minutes) : 0;
                const row = (
                  <ActionRow
                    goal={goal}
                    action={action}
                    progress={progress}
                    isCompleted={isDone(action)}
                    isHabitDone={!!habitDones[action.id]}
                    minutesLoggedToday={mins}
                    toneColor={tone}
                    streak={actionStreaks[action.id] ?? 0}
                    onStart={isSession ? () => onStartSession(goal, action) : undefined}
                    onHabitToggle={!isSession ? (d) => onHabitToggle(action.id, d) : undefined}
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
              };

              return (
                <Animated.View key={goal.id} entering={enter(enterIndex++)} style={{ marginBottom: isFolded ? 10 : 22 }}>
                  <PressableScale
                    onPress={() => toggleFold(goal.id, isFolded)}
                    disabled={selectedGoalId !== 'all'}
                    haptic={false}
                    scaleTo={0.99}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: !isFolded }}
                    accessibilityLabel={`${goal.name}, ${done.length + doneTasks.length} of ${actions.length + todayTasks.length} done`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      marginBottom: isFolded ? 0 : 12,
                      ...(isFolded ? { backgroundColor: Surface.surfaceRaised, borderRadius: Radius.lg, padding: 12 } : null),
                    }}
                  >
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
                      {goalTargetMinutes > 0 ? (
                        <Text style={[Type.meta, { marginTop: 1 }]}>
                          <Text style={{ color: tone, fontFamily: FontFamily.bodyBold }}>{formatMinutes(goalMinutes)}</Text> given of {formatMinutes(goalTargetMinutes)}
                        </Text>
                      ) : isFolded ? (
                        <Text style={[Type.meta, { marginTop: 1 }]}>{allDone ? 'All done for today' : `${open.length} to do`}</Text>
                      ) : null}
                    </View>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        height: 28,
                        paddingHorizontal: 10,
                        borderRadius: Radius.full,
                        backgroundColor: allDone ? hexToRgba(tone, 0.16) : Surface.hill,
                      }}
                    >
                      {allDone ? <Check size={13} color={tone} strokeWidth={3} /> : null}
                      <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 13, color: allDone ? tone : Surface.muted }}>
                        {done.length + doneTasks.length}/{actions.length + todayTasks.length}
                      </Text>
                    </View>
                    {selectedGoalId === 'all' ? (
                      <View style={{ transform: [{ rotate: isFolded ? '0deg' : '180deg' }] }}>
                        <ChevronDown size={20} color={Surface.muted} strokeWidth={2.2} />
                      </View>
                    ) : null}
                  </PressableScale>

                  {isFolded ? null : (
                    <>
                      {/* US-065: Goal line when active objective exists */}
                      {obj ? (
                        <View style={{ marginBottom: 12, padding: 14, backgroundColor: Surface.surfaceRaised, borderRadius: Radius.md }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text numberOfLines={1} style={[Type.heading, { fontSize: 16, lineHeight: 20 }]}>
                                {obj.title}
                              </Text>
                              <Text style={[Type.meta, { marginTop: 2 }]}>
                                {(() => {
                                  const today = new Date(todayStr() + 'T00:00:00');
                                  const daysLeft = goalProgress.daysLeft(obj, today);
                                  const pace = goalProgress.paceOf(obj, tasks, today);
                                  const paceText = pace === 'ahead' ? 'ahead' : pace === 'on_track' ? 'on track' : pace === 'behind' ? 'behind' : '';
                                  const paceColor = pace === 'ahead' ? tone : pace === 'on_track' ? tone : pace === 'behind' ? Surface.muted : Surface.muted;
                                  return (
                                    <>
                                      {daysLeft > 0 ? `${daysLeft} days left` : daysLeft === 0 ? 'Due today' : `${Math.abs(daysLeft)} days overdue`}
                                      {paceText && (
                                        <>
                                          {' · '}
                                          <Text style={{ color: paceColor }}>{paceText}</Text>
                                        </>
                                      )}
                                    </>
                                  );
                                })()}
                              </Text>
                            </View>
                            {(() => {
                              const progress = goalProgress.progressOf(obj, tasks);
                              if (progress === null) return null;
                              return (
                                <View style={{ width: 50, height: 50 }}>
                                  <ProgressRing progress={progress} size={50} strokeWidth={4} color={tone} trackColor={Surface.hill}>
                                    <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 13, color: tone }}>
                                      {Math.round(progress * 100)}%
                                    </Text>
                                  </ProgressRing>
                                </View>
                              );
                            })()}
                          </View>
                        </View>
                      ) : null}

                      {/* US-065: Next task */}
                      {nextTask && !taskDones[nextTask.id] ? (
                        <View style={{ marginBottom: 10, padding: 14, backgroundColor: hexToRgba(tone, 0.08), borderRadius: Radius.md, borderWidth: 1.5, borderColor: hexToRgba(tone, 0.18) }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <PressableScale
                              onPress={() => {
                                hapticMedium();
                                void api.setTaskDone(nextTask.id, true).then(() => {
                                  setTaskDones(prev => ({ ...prev, [nextTask.id]: true }));
                                  void refresh();
                                  void loadHabitAndMins();
                                });
                              }}
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: false }}
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 12,
                                borderWidth: 2,
                                borderColor: tone,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <View />
                            </PressableScale>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 12, color: tone, letterSpacing: 0.5 }}>NEXT</Text>
                                <Text style={[Type.meta, { fontSize: 12 }]}>{nextTask.estimate_minutes}m</Text>
                              </View>
                              <Text numberOfLines={2} style={[Type.heading, { fontSize: 15, marginTop: 2 }]}>
                                {nextTask.title}
                              </Text>
                            </View>
                            <PressableScale
                              onPress={() => {
                                // US-066: Will implement focus on task
                                router.push(`/(tabs)/focus?goalId=${encodeURIComponent(goal.id)}&taskId=${encodeURIComponent(nextTask.id)}`);
                              }}
                              accessibilityRole="button"
                              accessibilityLabel="Start session"
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: tone,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Timer size={18} color={Surface.surface} strokeWidth={2.4} />
                            </PressableScale>
                          </View>
                        </View>
                      ) : null}

                      {/* US-065: Other planned tasks for today */}
                      {openTasks.filter(t => t.id !== nextTask?.id).map(task => (
                        <View key={task.id} style={{ marginBottom: 10, padding: 14, backgroundColor: Surface.surfaceRaised, borderRadius: Radius.md }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <PressableScale
                              onPress={() => {
                                hapticMedium();
                                void api.setTaskDone(task.id, true).then(() => {
                                  setTaskDones(prev => ({ ...prev, [task.id]: true }));
                                  void refresh();
                                  void loadHabitAndMins();
                                });
                              }}
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: false }}
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 12,
                                borderWidth: 2,
                                borderColor: tone,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <View />
                            </PressableScale>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={[Type.meta, { fontSize: 12, marginBottom: 2 }]}>{task.estimate_minutes}m</Text>
                              <Text numberOfLines={2} style={[Type.heading, { fontSize: 15 }]}>
                                {task.title}
                              </Text>
                            </View>
                            <PressableScale
                              onPress={() => {
                                router.push(`/(tabs)/focus?goalId=${encodeURIComponent(goal.id)}&taskId=${encodeURIComponent(task.id)}`);
                              }}
                              accessibilityRole="button"
                              accessibilityLabel="Start session"
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: Surface.surfaceRaised,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Timer size={18} color={Surface.ink} strokeWidth={2.4} />
                            </PressableScale>
                          </View>
                        </View>
                      ))}

                      {visibleOpen.map(renderAction)}
                      {hiddenOpen > 0 ? (
                        <PressableScale
                          onPress={() => setShowAllOpen((m) => ({ ...m, [goal.id]: true }))}
                          accessibilityRole="button"
                          style={{
                            height: 44,
                            borderRadius: Radius.md,
                            borderWidth: 1.5,
                            borderColor: Surface.rule,
                            borderStyle: 'dashed',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 10,
                          }}
                        >
                          <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: Surface.ink }}>Show {hiddenOpen} more</Text>
                        </PressableScale>
                      ) : null}
                      {done.length + doneTasks.length > 0 && !allDone ? (
                        <PressableScale
                          onPress={() => setShowDone((m) => ({ ...m, [goal.id]: !m[goal.id] }))}
                          accessibilityRole="button"
                          accessibilityState={{ expanded: doneShown }}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 4, marginBottom: doneShown ? 6 : 0 }}
                        >
                          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: hexToRgba(tone, 0.16), alignItems: 'center', justifyContent: 'center' }}>
                            <Check size={12} color={tone} strokeWidth={3} />
                          </View>
                          <Text style={{ flex: 1, fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: Surface.muted }}>{done.length + doneTasks.length} done</Text>
                          <View style={{ transform: [{ rotate: doneShown ? '180deg' : '0deg' }] }}>
                            <ChevronDown size={18} color={Surface.faint} strokeWidth={2.2} />
                          </View>
                        </PressableScale>
                      ) : null}
                      {doneShown ? (
                        <>
                          {doneTasks.map(task => (
                            <View key={task.id} style={{ marginBottom: 10, padding: 14, backgroundColor: Surface.surfaceRaised, borderRadius: Radius.md, opacity: 0.6 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <View
                                  style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: 12,
                                    backgroundColor: tone,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Check size={14} color={Surface.surface} strokeWidth={3} />
                                </View>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <Text style={[Type.meta, { fontSize: 12, marginBottom: 2 }]}>{task.estimate_minutes}m</Text>
                                  <Text numberOfLines={2} style={[Type.heading, { fontSize: 15 }]}>
                                    {task.title}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          ))}
                          {done.map(renderAction)}
                        </>
                      ) : null}
                    </>
                  )}
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
