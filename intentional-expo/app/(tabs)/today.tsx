import { useCallback, useState, useEffect, useMemo } from 'react';
import { View, Text, Platform, Modal, Pressable, RefreshControl } from 'react-native';
import { ScrollView, Swipeable, TouchableOpacity } from 'react-native-gesture-handler';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Check, ChevronDown, EyeOff, Play, Plus, Timer } from 'lucide-react-native';
import { ActionRow } from '@/components/ActionRow';
import { PrimaryButton } from '@/components/PrimaryButton';
import { AnimatedNumber, PressableScale, ProgressBar, ProgressRing, enter } from '@/components/ui/motion';
import { PillarIcon } from '@/components/ui/PillarIcon';
import { Accent, FontFamily, Radius, Surface, Type, hexToRgba } from '@/constants/design';
import { Mascot, type MascotMood } from '@/components/onboarding/Mascot';
import * as api from '@/db/api';
import * as goalProgress from '@/services/goalProgress';
import type { MetaGoal, DailyAction, Objective, Task } from '@/types';
import { getGoalColor } from '@/utils/goalColors';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { SuggestionCard } from '@/components/SuggestionCard';
import { getTopSuggestion } from '@/services/suggestions';
import { cancelActionReminder } from '@/services/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDayKey, localDayKeyFromIso, localDayStart, shiftDayKey, dayKeyDiff, timeToMinutes } from '@/utils/dates';
import { getDismissedNudges, dismissNudge, isNudgeSnoozed } from '@/utils/goalNudges';
import { confirmAsync } from '@/utils/confirm';
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

/** "from Tue" for a task planned on a past day (a date when it's more than a week ago). */
function rolloverLabel(plannedDate: string, today: string): string {
  const d = localDayStart(plannedDate);
  if (dayKeyDiff(plannedDate, today) <= 6) return `from ${d.toLocaleDateString('en-US', { weekday: 'short' })}`;
  return `from ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function daysLeftLabel(days: number): string {
  if (days < 0) return 'Deadline passed';
  if (days === 0) return 'Due today';
  return days === 1 ? '1 day left' : `${days} days left`;
}

/** Pillars the person folded on Today (pillar id → folded). */
const FOLD_KEY = '@intentional/todayFolded';

type PillarSection = { goal: MetaGoal; habits: DailyAction[] };

type TaskCardProps = {
  task: Task;
  tone: string;
  isNext: boolean;
  today: string;
  optionsOpen: boolean;
  onToggleOptions: () => void;
  onDone: () => void;
  onStart: () => void;
  onReplan: (date: string | null) => void;
};

/** A task on Today: ○ check · title + estimate (+ quiet "from Tue") · ▶ start. */
function TaskCard({ task, tone, isNext, today, optionsOpen, onToggleOptions, onDone, onStart, onReplan }: TaskCardProps) {
  const rolled = !!task.planned_date && task.planned_date < today;
  const label = rolled ? rolloverLabel(task.planned_date!, today) : null;
  return (
    <View
      style={{
        marginBottom: 10,
        paddingVertical: 13,
        paddingHorizontal: 14,
        borderRadius: Radius.md,
        backgroundColor: isNext ? hexToRgba(tone, 0.08) : Surface.surfaceRaised,
        borderWidth: isNext ? 1.5 : 0,
        borderColor: hexToRgba(tone, 0.2),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <PressableScale
          onPress={onDone}
          haptic={false}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: false }}
          accessibilityLabel={`Mark ${task.title} done`}
          style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: hexToRgba(tone, 0.6), backgroundColor: Surface.surface }}
        >
          <View />
        </PressableScale>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8 }}>
            {isNext ? <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 12, color: tone, letterSpacing: 0.6 }}>NEXT</Text> : null}
            <Text style={[Type.meta, { fontSize: 12 }]}>{task.estimate_minutes} min</Text>
            {label ? (
              <PressableScale
                onPress={onToggleOptions}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityState={{ expanded: optionsOpen }}
                accessibilityLabel={`${task.title}, planned ${label.replace('from ', '')}. Change day`}
              >
                <Text style={[Type.meta, { fontSize: 12, textDecorationLine: 'underline', textDecorationColor: Surface.ruleStrong }]}>{label}</Text>
              </PressableScale>
            ) : null}
          </View>
          <Text numberOfLines={2} style={[Type.heading, { fontSize: 16, lineHeight: 21, marginTop: 2 }]}>
            {task.title}
          </Text>
        </View>
        <PressableScale
          onPress={onStart}
          accessibilityRole="button"
          accessibilityLabel={`Start ${task.title}`}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: isNext ? tone : Surface.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Play size={14} color={isNext ? Surface.surface : Surface.ink} fill={isNext ? Surface.surface : Surface.ink} strokeWidth={2} />
        </PressableScale>
      </View>
      {/* US-067: one tap on "from Tue" offers the three choices, quietly. */}
      {label && optionsOpen ? (
        <Animated.View entering={FadeIn.duration(180)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, marginLeft: 40 }}>
          {(
            [
              ['Do today', today],
              ['Move to tomorrow', shiftDayKey(today, 1)],
              ['Unplan', null],
            ] as const
          ).map(([text, date]) => (
            <PressableScale
              key={text}
              onPress={() => onReplan(date)}
              accessibilityRole="button"
              accessibilityLabel={`${text}: ${task.title}`}
              style={{ height: 32, paddingHorizontal: 12, borderRadius: Radius.full, backgroundColor: Surface.surface, justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: Surface.ink }}>{text}</Text>
            </PressableScale>
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

export default function TodayScreen() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [pillars, setPillars] = useState<MetaGoal[]>([]);
  const [sections, setSections] = useState<PillarSection[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string | 'all'>('all');
  const [habitDones, setHabitDones] = useState<Record<string, boolean>>({});
  /** pillar id → minutes given today, from every session (habits, tasks, free time) */
  const [pillarMinutes, setPillarMinutes] = useState<Record<string, number>>({});
  const [sessionMins, setSessionMins] = useState<Record<string, number>>({});
  /** Current streak per habit (scheduled days only). */
  const [actionStreaks, setActionStreaks] = useState<Record<string, number>>({});
  /** US-065: the active goal per pillar and all its tasks (progress, pace, next task). */
  const [objectives, setObjectives] = useState<Record<string, Objective | null>>({});
  const [objectiveTasks, setObjectiveTasks] = useState<Record<string, Task[]>>({});
  /** US-067: open tasks of active goals planned for today or a past day. */
  const [plannedTasks, setPlannedTasks] = useState<Task[]>([]);
  /** US-068: goal lookup for habit tags. */
  const [objectiveById, setObjectiveById] = useState<Record<string, Objective>>({});
  /** US-074: the one pillar that gets a "Set a goal" nudge right now. */
  const [nudgePillarId, setNudgePillarId] = useState<string | null>(null);
  const [rolloverOpenId, setRolloverOpenId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  /**
   * Keeping a long day readable: pillars fold (a finished pillar folds itself), finished items
   * tuck into a "N done" row, and only the first few open items show until "Show N more".
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

  const load = useCallback(async () => {
    const date = todayStr();
    setPillarMinutes(api.getMinutesByPillarForDay(date));
    const goals = await api.getGoals();
    const planned = (await api.getOpenPlannedTasks()).filter((t) => t.planned_date! <= date);
    const maintenance = api.getMaintenancePillars();
    const dismissed = await getDismissedNudges();
    const nextSections: PillarSection[] = [];
    const nextHabit: Record<string, boolean> = {};
    const nextMins: Record<string, number> = {};
    const nextStreaks: Record<string, number> = {};
    const nextObjectives: Record<string, Objective | null> = {};
    const nextTasks: Record<string, Task[]> = {};
    const nextObjectiveById: Record<string, Objective> = {};
    let nudge: string | null = null;

    for (const goal of goals) {
      const obj = await api.getActiveObjective(goal.id);
      nextObjectives[goal.id] = obj;
      const all = await api.getObjectives(goal.id);
      for (const o of all) if (o.status === 'active' || o.status === 'planned') nextObjectiveById[o.id] = o;
      if (obj) nextTasks[goal.id] = await api.getTasks(obj.id);
      // US-074: first goal-less pillar that isn't "runs on habits" and wasn't snoozed.
      const hasGoal = all.some((o) => o.status === 'active' || o.status === 'planned');
      if (!nudge && !hasGoal && !maintenance.has(goal.id) && !isNudgeSnoozed(dismissed, goal.id)) nudge = goal.id;

      // US-069: only habits scheduled today, in time order.
      const habits = (await api.getActionsByGoal(goal.id))
        .filter((a) => api.isScheduledOn(a.days_mask ?? 127, date))
        .sort((a, b) => timeToMinutes(a.reminder_time) - timeToMinutes(b.reminder_time) || a.sort_order - b.sort_order);
      for (const a of habits) {
        if (a.type === 'habit') nextHabit[a.id] = await api.isHabitDoneToday(a.id);
        else {
          const sessions = await api.getSessionsForActionToday(a.id, date);
          nextMins[a.id] = Math.floor(sessions.reduce((s, x) => s + x.duration_seconds, 0) / 60);
        }
        nextStreaks[a.id] = api.getActionStreakMetrics(a.id, a.type).current;
      }
      if (habits.length > 0 || obj) nextSections.push({ goal, habits });
    }
    setPillars(goals);
    setSections(nextSections);
    setPlannedTasks(planned);
    setHabitDones(nextHabit);
    setSessionMins(nextMins);
    setActionStreaks(nextStreaks);
    setObjectives(nextObjectives);
    setObjectiveTasks(nextTasks);
    setObjectiveById(nextObjectiveById);
    setNudgePillarId(nudge);
    setLoaded(true);
  }, []);

  /** If the selected pillar is gone, avoid an empty view with a stale filter. */
  useEffect(() => {
    if (selectedGoalId === 'all' || !loaded) return;
    if (!sections.some(({ goal }) => goal.id === selectedGoalId)) setSelectedGoalId('all');
  }, [sections, selectedGoalId, loaded]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onHabitToggle = useCallback(
    async (actionId: string, done: boolean) => {
      done ? hapticMedium() : hapticLight();
      setHabitDones((prev) => ({ ...prev, [actionId]: done }));
      await api.setHabitCompletion(actionId, todayStr(), done);
      await load();
    },
    [load]
  );

  const onTaskDone = useCallback(
    async (task: Task) => {
      hapticMedium();
      await api.setTaskDone(task.id, true);
      await load();
    },
    [load]
  );

  const onReplan = useCallback(
    async (task: Task, date: string | null) => {
      hapticLight();
      setRolloverOpenId(null);
      await api.updateTask(task.id, { planned_date: date });
      await load();
    },
    [load]
  );

  const onStartSession = useCallback(
    (goal: MetaGoal, action: DailyAction) => {
      router.push(`/(tabs)/focus?goalId=${encodeURIComponent(goal.id)}&actionId=${encodeURIComponent(action.id)}`);
    },
    [router]
  );

  const confirmDeactivateAction = useCallback(
    async (action: DailyAction) => {
      const yes = await confirmAsync({
        title: 'Hide this habit?',
        message: `"${action.name}" will disappear from Today. Open Goals, tap the pillar, then tap Restore on the paused habit.`,
        confirmLabel: 'Hide',
      });
      if (!yes) return;
      await api.updateAction(action.id, { is_active: 0 });
      void cancelActionReminder(action.id);
      await load();
    },
    [load]
  );

  const [userName, setUserName] = useState('');
  const [suggestionDismissed, setSuggestionDismissed] = useState(true); // start hidden; load async

  const DISMISS_KEY = 'suggestion_dismissed_date';
  const todayDateStr = localDayKey();

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

  const allActiveActions = useMemo(() => sections.flatMap((s) => s.habits), [sections]);
  const allGoals = useMemo(() => sections.map((s) => s.goal), [sections]);

  const suggestion = useMemo(
    () => (suggestionDismissed ? null : getTopSuggestion(allActiveActions, allGoals)),
    [suggestionDismissed, allActiveActions, allGoals]
  );

  const handleSuggestionCta = useCallback(() => {
    if (!suggestion) return;
    if (suggestion.type === 'streak_at_risk' || suggestion.type === 'momentum') {
      const action = allActiveActions.find((a) => a.id === suggestion.actionId);
      if (action?.type === 'habit' && suggestion.actionId) {
        void api.setHabitCompletion(suggestion.actionId, todayDateStr, true).then(() => {
          void load();
          handleDismissSuggestion();
        });
        return;
      }
    }
    if (suggestion.goalId) {
      const params = suggestion.actionId
        ? `goalId=${encodeURIComponent(suggestion.goalId)}&actionId=${encodeURIComponent(suggestion.actionId)}`
        : `goalId=${encodeURIComponent(suggestion.goalId)}`;
      router.push(`/(tabs)/focus?${params}`);
    }
    handleDismissSuggestion();
  }, [suggestion, allActiveActions, todayDateStr, router, load, handleDismissSuggestion]);

  const isHabitDone = (a: DailyAction) =>
    a.type === 'session' ? a.target_minutes > 0 && (sessionMins[a.id] ?? 0) >= a.target_minutes : !!habitDones[a.id];

  /**
   * One definition of "today" for a pillar, used by the header, the badges, the fold and "N done":
   * habits due today + the goal's next task + open tasks planned for today or rolled over
   * (+ tasks checked off today, so finishing one counts as done instead of vanishing).
   */
  const today = todayStr();
  const dayOf = (goal: MetaGoal, habits: DailyAction[]) => {
    const obj = objectives[goal.id] ?? null;
    const tasks = obj ? objectiveTasks[goal.id] ?? [] : [];
    const nextTask = tasks.find((t) => t.is_done === 0) ?? null;
    const planned = obj ? plannedTasks.filter((t) => t.objective_id === obj.id && t.id !== nextTask?.id) : [];
    const openTasks = nextTask ? [nextTask, ...planned] : planned;
    const doneTasks = tasks.filter((t) => t.is_done === 1 && !!t.done_at && localDayKeyFromIso(t.done_at) === today);
    const openHabits = habits.filter((a) => !isHabitDone(a));
    const doneHabits = habits.filter(isHabitDone);
    const total = habits.length + openTasks.length + doneTasks.length;
    const done = doneHabits.length + doneTasks.length;
    return { obj, tasks, nextTask, openTasks, doneTasks, openHabits, doneHabits, total, done };
  };

  const visibleSections = selectedGoalId === 'all' ? sections : sections.filter(({ goal }) => goal.id === selectedGoalId);
  const days = visibleSections.map((s) => ({ ...s, day: dayOf(s.goal, s.habits) }));
  const totalVisibleActions = days.reduce((acc, s) => acc + s.day.total, 0);
  const completedVisibleActions = days.reduce((acc, s) => acc + s.day.done, 0);
  const hasAnyActions = totalVisibleActions > 0;
  const allDone = hasAnyActions && completedVisibleActions === totalVisibleActions;
  // Every session counts toward "given to your pillars": habits, tasks and free time.
  const creditedMinutes = visibleSections.reduce((total, section) => total + (pillarMinutes[section.goal.id] ?? 0), 0);
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

  // US-069: "in 25 min" only on the single next habit that starts within two hours.
  const nowDate = new Date();
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  let upcoming: { id: string; inMin: number } | null = null;
  for (const s of days) {
    for (const a of s.day.openHabits) {
      const start = timeToMinutes(a.reminder_time);
      if (start === 9999) continue;
      const diff = start - nowMinutes;
      if (diff > 0 && diff <= 120 && (!upcoming || diff < upcoming.inMin)) upcoming = { id: a.id, inMin: diff };
    }
  }

  const nudgePillar = nudgePillarId ? pillars.find((p) => p.id === nudgePillarId) ?? null : null;
  const nudgeInSection = !!nudgePillar && visibleSections.some((s) => s.goal.id === nudgePillar.id);
  const showStandaloneNudge = !!nudgePillar && !nudgeInSection && (selectedGoalId === 'all' || selectedGoalId === nudgePillar.id);

  const greeting = (() => {
    const h = new Date().getHours();
    const base = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    return userName ? `${base},\n${userName}` : base;
  })();
  const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const [refreshing, setRefreshing] = useState(false);
  const onPullRefresh = useCallback(() => {
    setRefreshing(true);
    void load().finally(() => setRefreshing(false));
  }, [load]);

  const renderNudge = (pillar: MetaGoal) => {
    const tone = getGoalColor(pillar);
    return (
      <View
        key={`nudge-${pillar.id}`}
        style={{ marginBottom: 12, padding: 14, backgroundColor: Surface.surface, borderRadius: Radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Surface.rule }}
      >
        <Text style={[Type.body, { fontSize: 15, lineHeight: 21, color: Surface.muted }]}>
          <Text style={{ color: tone, fontFamily: FontFamily.bodyBold }}>{pillar.name}</Text> has no goal yet. What would winning look like?
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <PressableScale
            onPress={() => router.push(`/goal/${encodeURIComponent(pillar.id)}?setGoal=1`)}
            accessibilityRole="button"
            accessibilityLabel={`Set a goal for ${pillar.name}`}
            style={{ height: 34, paddingHorizontal: 14, borderRadius: Radius.full, backgroundColor: Surface.ink, justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: Surface.surface }}>Set a goal</Text>
          </PressableScale>
          <PressableScale
            onPress={() => {
              void dismissNudge(pillar.id).then(() => load());
            }}
            accessibilityRole="button"
            accessibilityLabel={`Not now, ${pillar.name}`}
            style={{ height: 34, paddingHorizontal: 12, borderRadius: Radius.full, justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: Surface.muted }}>Not now</Text>
          </PressableScale>
        </View>
      </View>
    );
  };

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
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Surface.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}
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
        {pillars.length > 0 && (
          <Animated.View entering={enter(enterIndex++)} style={{ alignItems: 'center', paddingTop: 16, paddingBottom: 4 }}>
            <ProgressRing progress={dayProgress} size={212} strokeWidth={12} color={Surface.ink} trackColor={Surface.surfaceRaised}>
              <AnimatedNumber value={creditedMinutes} format={(n) => formatMinutes(n)} style={[Type.hero, { fontSize: 50, lineHeight: 56 }]} />
              <Text style={[Type.meta, { marginTop: 0, fontSize: 14 }]}>given to your pillars</Text>
            </ProgressRing>
            <Text style={[Type.heading, { marginTop: 18, fontSize: 18 }]}>
              {completedVisibleActions} of {totalVisibleActions} done
            </Text>
            <Text style={[Type.accent, { marginTop: 4, textAlign: 'center', paddingHorizontal: 40 }]}>{truthLine}</Text>

            {/* US-070: free session → pick a pillar first (in-app, every platform). */}
            <PressableScale
              onPress={() => setPickerOpen(true)}
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
          {/* US-074: at most one nudge; here when its pillar has nothing on Today. */}
          {showStandaloneNudge && nudgePillar ? renderNudge(nudgePillar) : null}

          {visibleSections.length === 0 ? (
            !loaded ? null : pillars.length === 0 ? (
              <Animated.View entering={enter(enterIndex++)} style={{ alignItems: 'center', marginTop: 28 }}>
                <Mascot mood="wave" size={132} intensity={0.55} />
                <Text style={[Type.title, { marginTop: 18, textAlign: 'center' }]}>Give your first hour to a pillar.</Text>
                <Text style={[Type.body, { marginTop: 10, textAlign: 'center', paddingHorizontal: 12 }]}>
                  Pick what matters to you (body, mind, craft, etc.) and add one habit. Every minute you focus gets given to it.
                </Text>
                <View style={{ marginTop: 28, gap: 10, alignSelf: 'stretch' }}>
                  <PrimaryButton title="Add a pillar" appearance="filled" onPress={() => router.push('/(tabs)/goals?create=1')} showArrow={false} />
                </View>
              </Animated.View>
            ) : (
              <Animated.View entering={enter(enterIndex++)} style={{ backgroundColor: Surface.surfaceRaised, borderRadius: Radius.lg, padding: 22 }}>
                <Text style={[Type.heading, { fontSize: 20, lineHeight: 26 }]}>Nothing left here.</Text>
                <Text style={[Type.body, { marginTop: 6 }]}>
                  {selectedGoalId === 'all'
                    ? 'No habits or tasks for today. Add more from Goals if you want to give a pillar extra time.'
                    : 'No habits or tasks left for this pillar today.'}
                </Text>
              </Animated.View>
            )
          ) : (
            days.map(({ goal, habits, day }) => {
              const tone = getGoalColor(goal);
              const goalMinutes = pillarMinutes[goal.id] ?? 0;
              const goalTargetMinutes = habits.reduce((total, action) => (action.type === 'session' ? total + action.target_minutes : total), 0);
              const { obj, tasks, nextTask, openTasks, doneTasks, openHabits, doneHabits, total, done } = day;
              const pillarDone = total > 0 && done === total;
              // Filtering to one pillar always shows it open.
              const isFolded = selectedGoalId === 'all' && (folded[goal.id] ?? pillarDone);
              const openCount = openTasks.length + openHabits.length;
              const visibleLimit = showAllOpen[goal.id] ? Infinity : TODAY_VISIBLE_ACTIONS;
              const visibleTasks = openTasks.slice(0, visibleLimit);
              const visibleHabits = openHabits.slice(0, Math.max(0, visibleLimit - visibleTasks.length));
              const hiddenOpen = openCount - visibleTasks.length - visibleHabits.length;
              const doneShown = pillarDone || !!showDone[goal.id];

              const renderAction = (action: DailyAction) => {
                const isSession = action.type === 'session';
                const mins = sessionMins[action.id] ?? 0;
                const progress = action.target_minutes > 0 ? Math.min(1, mins / action.target_minutes) : 0;
                const linkedObjective = action.objective_id ? objectiveById[action.objective_id] : null;
                const row = (
                  <ActionRow
                    goal={goal}
                    action={action}
                    progress={progress}
                    isCompleted={isHabitDone(action)}
                    isHabitDone={!!habitDones[action.id]}
                    minutesLoggedToday={mins}
                    toneColor={tone}
                    streak={actionStreaks[action.id] ?? 0}
                    objective={linkedObjective}
                    minutesUntilStart={upcoming?.id === action.id ? upcoming.inMin : undefined}
                    onStart={isSession ? () => onStartSession(goal, action) : undefined}
                    onHabitToggle={!isSession ? (d) => void onHabitToggle(action.id, d) : undefined}
                    onLongPress={() => void confirmDeactivateAction(action)}
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
                          onPress={() => void confirmDeactivateAction(action)}
                          activeOpacity={0.85}
                          accessibilityLabel={`Hide ${action.name}`}
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

              const renderTask = (task: Task) => {
                const isNext = task.id === nextTask?.id;
                const card = (
                  <TaskCard
                    task={task}
                    tone={tone}
                    isNext={isNext}
                    today={today}
                    optionsOpen={rolloverOpenId === task.id}
                    onToggleOptions={() => setRolloverOpenId((id) => (id === task.id ? null : task.id))}
                    onDone={() => void onTaskDone(task)}
                    onStart={() => router.push(`/(tabs)/focus?taskId=${encodeURIComponent(task.id)}`)}
                    onReplan={(date) => void onReplan(task, date)}
                  />
                );
                // US-065: when the next task advances, the new one slides in.
                return isNext ? (
                  <Animated.View key={task.id} entering={enter(0)} exiting={FadeOut.duration(160)} layout={LinearTransition}>
                    {card}
                  </Animated.View>
                ) : (
                  <Animated.View key={task.id} layout={LinearTransition}>
                    {card}
                  </Animated.View>
                );
              };

              // US-065: goal line — title · days left · progress bar · pace.
              const goalLine = (() => {
                if (!obj) return null;
                const todayDate = localDayStart(today);
                const left = goalProgress.daysLeft(obj, todayDate);
                const progress = goalProgress.progressOf(obj, tasks);
                const pace = goalProgress.paceOf(obj, tasks, new Date());
                const paceText = pace === 'ahead' ? 'ahead' : pace === 'on_track' ? 'on track' : pace === 'behind' ? 'behind' : null;
                const paceColor = pace === 'behind' ? Accent.amber : tone;
                return (
                  <PressableScale
                    onPress={() => router.push(`/goal/${encodeURIComponent(goal.id)}`)}
                    scaleTo={0.99}
                    accessibilityRole="button"
                    accessibilityLabel={`Goal: ${obj.title}, ${daysLeftLabel(left)}${paceText ? `, ${paceText}` : ''}`}
                    style={{ marginBottom: 10, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: Surface.surfaceRaised, borderRadius: Radius.md }}
                  >
                    <Text numberOfLines={1} style={[Type.heading, { fontSize: 16, lineHeight: 21 }]}>
                      {obj.title}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
                      <Text style={[Type.meta, { fontSize: 13 }]}>{daysLeftLabel(left)}</Text>
                      <View style={{ flex: 1, minWidth: 24 }}>
                        {progress !== null ? <ProgressBar progress={progress} color={tone} trackColor={hexToRgba(tone, 0.16)} height={5} /> : null}
                      </View>
                      {paceText ? (
                        <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 13, color: paceColor }}>{paceText}</Text>
                      ) : null}
                    </View>
                  </PressableScale>
                );
              })();

              return (
                <Animated.View key={goal.id} entering={enter(enterIndex++)} style={{ marginBottom: isFolded ? 10 : 22 }}>
                  <PressableScale
                    onPress={() => toggleFold(goal.id, isFolded)}
                    disabled={selectedGoalId !== 'all'}
                    haptic={false}
                    scaleTo={0.99}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: !isFolded }}
                    accessibilityLabel={`${goal.name}, ${done} of ${total} done`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      marginBottom: isFolded ? 0 : 12,
                      ...(isFolded ? { backgroundColor: Surface.surfaceRaised, borderRadius: Radius.lg, padding: 12 } : null),
                    }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: hexToRgba(tone, 0.14), alignItems: 'center', justifyContent: 'center' }}>
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
                        <Text style={[Type.meta, { marginTop: 1 }]}>{pillarDone ? 'All done for today' : `${openCount} to do`}</Text>
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
                        backgroundColor: pillarDone ? hexToRgba(tone, 0.16) : Surface.hill,
                      }}
                    >
                      {pillarDone ? <Check size={13} color={tone} strokeWidth={3} /> : null}
                      <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 13, color: pillarDone ? tone : Surface.muted }}>
                        {done}/{total}
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
                      {goalLine}
                      {nudgeInSection && nudgePillar?.id === goal.id ? renderNudge(nudgePillar) : null}
                      {visibleTasks.map(renderTask)}
                      {visibleHabits.map(renderAction)}
                      {hiddenOpen > 0 ? (
                        <PressableScale
                          onPress={() => setShowAllOpen((m) => ({ ...m, [goal.id]: true }))}
                          accessibilityRole="button"
                          accessibilityLabel={`Show ${hiddenOpen} more in ${goal.name}`}
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
                      {done > 0 && !pillarDone ? (
                        <PressableScale
                          onPress={() => setShowDone((m) => ({ ...m, [goal.id]: !m[goal.id] }))}
                          accessibilityRole="button"
                          accessibilityLabel={`${done} done in ${goal.name}`}
                          accessibilityState={{ expanded: doneShown }}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 4, marginBottom: doneShown ? 6 : 0 }}
                        >
                          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: hexToRgba(tone, 0.16), alignItems: 'center', justifyContent: 'center' }}>
                            <Check size={12} color={tone} strokeWidth={3} />
                          </View>
                          <Text style={{ flex: 1, fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: Surface.muted }}>{done} done</Text>
                          <View style={{ transform: [{ rotate: doneShown ? '180deg' : '0deg' }] }}>
                            <ChevronDown size={18} color={Surface.faint} strokeWidth={2.2} />
                          </View>
                        </PressableScale>
                      ) : null}
                      {doneShown ? (
                        <>
                          {doneTasks.map((task) => (
                            <View key={task.id} style={{ marginBottom: 10, paddingVertical: 13, paddingHorizontal: 14, backgroundColor: Surface.surfaceRaised, borderRadius: Radius.md, opacity: 0.6 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: tone, alignItems: 'center', justifyContent: 'center' }}>
                                  <Check size={15} color={Surface.surface} strokeWidth={3} />
                                </View>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <Text style={[Type.meta, { fontSize: 12, marginBottom: 2 }]}>{task.estimate_minutes} min</Text>
                                  <Text numberOfLines={2} style={[Type.heading, { fontSize: 16, textDecorationLine: 'line-through', color: Surface.muted }]}>
                                    {task.title}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          ))}
                          {doneHabits.map(renderAction)}
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
              {Platform.OS === 'web' ? 'Long-press a habit to hide it.' : 'Swipe or long-press a habit to hide it.'}
            </Text>
          )}
        </View>
      </ScrollView>

      {/* US-070: pillar picker for a free session (works on web, iOS and Android). */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: hexToRgba(Surface.ink, 0.45) }}
            onPress={() => setPickerOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close pillar picker"
          />
          <View style={{ backgroundColor: Surface.canvas, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 34 }}>
            <Text style={[Type.heading, { fontSize: 20, lineHeight: 26 }]}>Give time to which pillar?</Text>
            <Text style={[Type.meta, { marginTop: 4, marginBottom: 14, fontSize: 14 }]}>A free session counts for the pillar you pick.</Text>
            <View style={{ gap: 8 }}>
              {pillars.map((p) => {
                const tone = getGoalColor(p);
                return (
                  <PressableScale
                    key={p.id}
                    onPress={() => {
                      setPickerOpen(false);
                      router.push(`/(tabs)/focus?goalId=${encodeURIComponent(p.id)}`);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Free session for ${p.name}`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 56, paddingHorizontal: 12, borderRadius: Radius.md, backgroundColor: Surface.surfaceRaised }}
                  >
                    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: hexToRgba(tone, 0.14), alignItems: 'center', justifyContent: 'center' }}>
                      <PillarIcon icon={p.icon} name={p.name} color={tone} size={34} tinted={false} />
                    </View>
                    <Text numberOfLines={1} style={[Type.heading, { flex: 1, fontSize: 17 }]}>
                      {p.name}
                    </Text>
                    <Play size={14} color={Surface.muted} fill={Surface.muted} strokeWidth={2} />
                  </PressableScale>
                );
              })}
            </View>
            <PressableScale
              onPress={() => setPickerOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel free session"
              style={{ marginTop: 12, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: Surface.muted }}>Cancel</Text>
            </PressableScale>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
