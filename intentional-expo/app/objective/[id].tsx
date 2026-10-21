/**
 * Objective (Goal) Detail screen — US-061, US-062, US-063, US-064
 *
 * US-061: One place for everything about a goal: deadline, pace, progress, hours (all time + this week),
 *         tasks, linked habits, recent sessions; edit and update the metric.
 * US-062: Complete a goal with a celebration, an optional reflection and a real "what's next" choice.
 * US-063: Drop a goal with a one-line reason (in-app sheet, every platform) and the same follow-up.
 * US-064: Tasks: quick-add with estimate + plan, edit, delete (real delete), check off, reorder.
 */
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { View, Text, ScrollView, TextInput, Modal, useWindowDimensions } from 'react-native';
import { Stack, useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronUp, Clock, Flame, Pencil, Plus, Target, TrendingUp, Trophy } from 'lucide-react-native';
import { hapticLight, hapticSuccess, hapticHeavy } from '@/utils/haptics';
import * as api from '@/db/api';
import * as goalProgress from '@/services/goalProgress';
import type { Objective, Task, MetaGoal, DailyAction } from '@/types';
import { Accent, Elevation, FontFamily, Radius, Surface, Type, hexToRgba } from '@/constants/design';
import { getGoalColor } from '@/utils/goalColors';
import { confirmAsync } from '@/utils/confirm';
import { localDayKey, localDayKeyFromIso, localDayStart, shiftDayKey } from '@/utils/dates';
import { PrimaryButton } from '@/components/PrimaryButton';
import { PressableScale, ProgressBar, enter } from '@/components/ui/motion';
import { PillarIcon } from '@/components/ui/PillarIcon';
import { FieldLabel, habitScheduleText, sandInputStyle } from '@/components/ui/PillarForm';
import { DayPicker, DeadlinePicker, endOfWeekKey, formatDeadline, formatPlannedDay } from '@/components/ui/DayPicker';
import { TextPromptSheet } from '@/components/ui/TextPromptSheet';
import { Mascot, type MascotMood } from '@/components/onboarding/Mascot';
import { Confetti } from '@/components/onboarding/FlickScenes';

const ESTIMATES = [15, 30, 60, 90, 120];
type PlanChoice = 'none' | 'today' | 'tomorrow' | 'week' | 'pick';
const PLAN_CHIPS: { key: PlanChoice; label: string }[] = [
  { key: 'none', label: 'None' },
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'week', label: 'This week' },
  { key: 'pick', label: 'Pick date' },
];

/** "0h", "45m", "1.5h", "12h". */
function formatGoalHours(minutes: number): string {
  if (minutes <= 0) return '0h';
  if (minutes < 60) return `${minutes}m`;
  const h = minutes / 60;
  return h >= 10 ? `${Math.round(h)}h` : `${Number(h.toFixed(1))}h`;
}

/** Calendar week so far: Monday 00:00 (local) → now. */
function thisWeekRange(now: Date = new Date()): { start: string; end: string } {
  const monday = shiftDayKey(localDayKey(now), -((now.getDay() + 6) % 7));
  return { start: localDayStart(monday).toISOString(), end: now.toISOString() };
}

function planChoiceFor(planned: string | null): PlanChoice {
  if (!planned) return 'none';
  const today = localDayKey();
  if (planned === today) return 'today';
  if (planned === shiftDayKey(today, 1)) return 'tomorrow';
  if (planned === endOfWeekKey()) return 'week';
  return 'pick';
}

function planDateFor(choice: PlanChoice, picked: string | null): string | null {
  const today = localDayKey();
  switch (choice) {
    case 'today': return today;
    case 'tomorrow': return shiftDayKey(today, 1);
    case 'week': return endOfWeekKey();
    case 'pick': return picked;
    default: return null;
  }
}

function parseNumber(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—';
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

type FollowUp = { kind: 'completed' | 'dropped'; next: Objective | null };

export default function ObjectiveDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [loaded, setLoaded] = useState(false);
  const [objective, setObjective] = useState<Objective | null>(null);
  const [pillar, setPillar] = useState<MetaGoal | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskMinutes, setTaskMinutes] = useState<Record<string, number>>({});
  const [habits, setHabits] = useState<{ habit: DailyAction; streak: number }[]>([]);
  const [sessions, setSessions] = useState<api.ObjectiveSessionRow[]>([]);
  const [weekMinutes, setWeekMinutes] = useState(0);
  const [lifetimeMinutes, setLifetimeMinutes] = useState(0);
  const [nextPlanned, setNextPlanned] = useState<Objective | null>(null);

  // Edit goal
  const [showEditForm, setShowEditForm] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDoneWhen, setEditDoneWhen] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editHasMetric, setEditHasMetric] = useState(false);
  const [editMetricCurrent, setEditMetricCurrent] = useState('');
  const [editMetricTarget, setEditMetricTarget] = useState('');
  const [editMetricUnit, setEditMetricUnit] = useState('');
  const [editError, setEditError] = useState('');

  // Update metric (quick action)
  const [showMetricUpdate, setShowMetricUpdate] = useState(false);
  const [metricValue, setMetricValue] = useState('');

  // US-062 / US-063
  const [showCelebration, setShowCelebration] = useState(false);
  const [reflection, setReflection] = useState('');
  const [showDropSheet, setShowDropSheet] = useState(false);
  const [followUp, setFollowUp] = useState<FollowUp | null>(null);

  // US-064: task form (add or edit)
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskEstimate, setTaskEstimate] = useState(30);
  const [customEstimate, setCustomEstimate] = useState(false);
  const [customEstimateText, setCustomEstimateText] = useState('');
  const [planChoice, setPlanChoice] = useState<PlanChoice>('none');
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [showDoneTasks, setShowDoneTasks] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const obj = (await api.getObjectives()).find((o) => o.id === id) ?? null;
    setObjective(obj);
    if (!obj) {
      setTasks([]);
      setHabits([]);
      setLoaded(true);
      return;
    }
    setPillar(await api.getGoalById(obj.pillar_id));

    const t = await api.getTasks(obj.id);
    setTasks(t);
    // One rollup per task per load (never per render).
    const mins: Record<string, number> = {};
    for (const task of t) mins[task.id] = api.getMinutesForTask(task.id);
    setTaskMinutes(mins);

    const linked = (await api.getActionsByGoal(obj.pillar_id)).filter((a) => a.objective_id === obj.id);
    setHabits(linked.map((h) => ({ habit: h, streak: api.getActionStreakMetrics(h.id, h.type).current })));

    setWeekMinutes(api.getMinutesForObjective(obj.id, thisWeekRange()));
    setLifetimeMinutes(api.getMinutesForObjective(obj.id));
    setSessions(api.getSessionsForObjective(obj.id, 10));

    const planned = (await api.getObjectives(obj.pillar_id)).filter((o) => o.status === 'planned' && o.id !== obj.id);
    setNextPlanned(planned[0] ?? null);
    setLoaded(true);
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  // ── Edit goal ─────────────────────────────────────────────────────────────
  const openEdit = () => {
    if (!objective) return;
    setEditTitle(objective.title);
    setEditDoneWhen(objective.done_when);
    setEditDeadline(objective.deadline);
    setEditHasMetric(objective.metric_target != null);
    setEditMetricCurrent(objective.metric_current != null ? String(objective.metric_current) : '');
    setEditMetricTarget(objective.metric_target != null ? String(objective.metric_target) : '');
    setEditMetricUnit(objective.metric_unit ?? '');
    setEditError('');
    setShowEditForm(true);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 50);
  };

  const saveEdit = async () => {
    if (!objective || !editTitle.trim()) return;
    if (!api.isValidDayKey(editDeadline)) {
      setEditError('Pick a deadline.');
      return;
    }
    if (editDeadline !== objective.deadline && editDeadline < localDayKey()) {
      setEditError('Pick today or a later day.');
      return;
    }
    let metric: Partial<Objective>;
    if (editHasMetric) {
      const current = parseNumber(editMetricCurrent);
      const target = parseNumber(editMetricTarget);
      if (target === null) {
        setEditError('Add a target number, or turn off "Track a number".');
        return;
      }
      metric = { metric_current: current ?? 0, metric_target: target, metric_unit: editMetricUnit.trim().slice(0, 12) || null };
    } else {
      metric = { metric_current: null, metric_target: null, metric_unit: null, metric_start: null };
    }
    try {
      await api.updateObjective(objective.id, {
        title: editTitle.trim().slice(0, 60),
        done_when: editDoneWhen.trim().slice(0, 140),
        deadline: editDeadline,
        ...metric,
      });
      setShowEditForm(false);
      void load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Could not save.');
    }
  };

  // ── Update metric ─────────────────────────────────────────────────────────
  const saveMetric = async () => {
    if (!objective) return;
    const n = parseNumber(metricValue);
    if (n === null) return;
    await api.updateObjective(objective.id, { metric_current: n });
    hapticLight();
    setShowMetricUpdate(false);
    void load();
  };

  // ── US-062: complete ──────────────────────────────────────────────────────
  const confirmComplete = async () => {
    if (!objective) return;
    const ok = await confirmAsync({
      title: 'Mark as achieved?',
      message: `Celebrate "${objective.title}". Unfinished tasks stay in your history.`,
      confirmLabel: 'Mark achieved',
    });
    if (!ok) return;
    hapticHeavy();
    await api.setObjectiveStatus(objective.id, 'completed');
    setReflection('');
    setFollowUp({ kind: 'completed', next: nextPlanned });
    setShowCelebration(true);
    setTimeout(hapticSuccess, 250);
    void load();
  };

  // ── US-063: drop ──────────────────────────────────────────────────────────
  const dropGoal = async (reason: string) => {
    if (!objective) return;
    setShowDropSheet(false);
    await api.setObjectiveStatus(objective.id, 'dropped', reason);
    void load();
    // Let the reason sheet close before the next sheet opens (iOS presents one modal at a time).
    setTimeout(() => setFollowUp({ kind: 'dropped', next: nextPlanned }), 350);
  };

  // ── Follow-up choices (both flows) ────────────────────────────────────────
  const saveReflection = async () => {
    if (objective && followUp?.kind === 'completed' && reflection.trim()) {
      await api.updateObjective(objective.id, { close_note: reflection.trim().slice(0, 140) });
    }
  };

  const startNext = async (next: Objective) => {
    await saveReflection();
    try {
      await api.setObjectiveStatus(next.id, 'active');
    } catch {
      // Another goal became active meanwhile: open the pillar instead of failing silently.
      setShowCelebration(false);
      setFollowUp(null);
      router.replace(`/goal/${next.pillar_id}`);
      return;
    }
    setShowCelebration(false);
    setFollowUp(null);
    router.replace(`/objective/${next.id}`);
  };

  const setNextGoal = async () => {
    if (!objective) return;
    await saveReflection();
    setShowCelebration(false);
    setFollowUp(null);
    router.replace(`/goal/${objective.pillar_id}?setGoal=1`);
  };

  const notNow = async () => {
    await saveReflection();
    setShowCelebration(false);
    setFollowUp(null);
    void load();
  };

  // ── US-064: tasks ─────────────────────────────────────────────────────────
  const openAddTask = () => {
    setEditingTaskId(null);
    setTaskTitle('');
    setTaskEstimate(30);
    setCustomEstimate(false);
    setCustomEstimateText('');
    setPlanChoice('none');
    setPickedDate(null);
    setTaskFormOpen(true);
  };

  const openEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setTaskTitle(task.title);
    const preset = ESTIMATES.includes(task.estimate_minutes);
    setTaskEstimate(task.estimate_minutes);
    setCustomEstimate(!preset);
    setCustomEstimateText(preset ? '' : String(task.estimate_minutes));
    const choice = planChoiceFor(task.planned_date);
    setPlanChoice(choice);
    setPickedDate(choice === 'pick' ? task.planned_date : null);
    setTaskFormOpen(true);
  };

  const closeTaskForm = () => {
    setTaskFormOpen(false);
    setEditingTaskId(null);
  };

  const estimateValue = customEstimate ? Math.max(5, Math.round(Number(customEstimateText) || 0)) : taskEstimate;
  const planValue = planDateFor(planChoice, pickedDate);
  const taskFormValid = !!taskTitle.trim() && (planChoice !== 'pick' || !!pickedDate);

  const saveTask = async () => {
    if (!objective || !taskFormValid) return;
    const fields = { title: taskTitle.trim().slice(0, 60), estimate_minutes: estimateValue, planned_date: planValue };
    if (editingTaskId) await api.updateTask(editingTaskId, fields);
    else await api.addTask({ objective_id: objective.id, ...fields });
    hapticLight();
    closeTaskForm();
    void load();
  };

  const deleteTask = async (task: Task) => {
    const ok = await confirmAsync({
      title: 'Delete this task?',
      message: `"${task.title}" will be removed. Time already given stays in your hours.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await api.deleteTask(task.id);
    closeTaskForm();
    void load();
  };

  const toggleTaskDone = async (task: Task) => {
    await api.setTaskDone(task.id, task.is_done !== 1);
    hapticLight();
    void load();
  };

  const moveTask = async (openTasks: Task[], idx: number, delta: -1 | 1) => {
    if (!objective) return;
    const j = idx + delta;
    if (j < 0 || j >= openTasks.length) return;
    const reordered = [...openTasks];
    [reordered[idx], reordered[j]] = [reordered[j]!, reordered[idx]!];
    await api.reorderTasks(objective.id, reordered.map((t) => t.id));
    hapticLight();
    void load();
  };

  if (!id || !objective || !pillar) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Surface.canvas, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <Stack.Screen options={{ headerShown: false }} />
        {loaded || !id ? (
          <>
            <Text style={[Type.heading, { textAlign: 'center', fontSize: 20 }]}>{!id ? 'Missing goal.' : 'Goal not found.'}</Text>
            <View style={{ marginTop: 20, alignSelf: 'stretch' }}>
              <PrimaryButton title="Go back" onPress={() => router.back()} />
            </View>
          </>
        ) : null}
      </SafeAreaView>
    );
  }

  const tone = getGoalColor(pillar);
  const now = new Date();
  const isOpen = objective.status === 'active' || objective.status === 'planned';
  const progress = goalProgress.progressOf(objective, tasks);
  const daysLeft = goalProgress.daysLeft(objective, now);
  const pace = isOpen ? goalProgress.paceOf(objective, tasks, now) : 'unknown';
  const paceWord = pace === 'ahead' ? 'Ahead' : pace === 'on_track' ? 'On track' : pace === 'behind' ? 'Behind' : null;
  const paceColor = pace === 'ahead' ? Accent.green : pace === 'behind' ? Accent.amber : Surface.ink;

  // US-061: Flick reads the pace.
  const flickMood: MascotMood =
    objective.status === 'completed' ? 'proud'
      : objective.status === 'dropped' ? 'calm'
        : pace === 'ahead' ? 'proud'
          : pace === 'on_track' ? 'happy'
            : pace === 'behind' ? 'worried'
              : 'calm';
  const flickIntensity = objective.status === 'completed' ? 1 : pace === 'ahead' ? 0.85 : pace === 'on_track' ? 0.7 : pace === 'behind' ? 0.4 : 0.55;

  const openTasks = tasks.filter((t) => !t.is_done);
  const doneTasks = tasks.filter((t) => t.is_done);
  const hasMetric = objective.metric_target != null;

  const deadlineLine =
    !isOpen ? `Deadline ${formatDeadline(objective.deadline)}`
      : daysLeft < 0 ? 'Deadline passed · set a new date'
        : daysLeft === 0 ? `Due today · ${formatDeadline(objective.deadline)}`
          : `Due ${formatDeadline(objective.deadline)} · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;

  const taskForm = (
    <Animated.View
      entering={FadeInDown.springify().damping(20)}
      style={{ backgroundColor: Surface.surface, borderRadius: Radius.lg, padding: 16, marginBottom: 8, ...Elevation.card }}
    >
      <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 17, color: Surface.ink, marginBottom: 10 }}>{editingTaskId ? 'Edit task' : 'New task'}</Text>
      <TextInput
        placeholder="Task title"
        placeholderTextColor={Surface.faint}
        accessibilityLabel="Task title"
        value={taskTitle}
        onChangeText={(t) => setTaskTitle(t.slice(0, 60))}
        maxLength={60}
        autoFocus={!editingTaskId}
        style={[sandInputStyle, { height: 52, marginBottom: 14, fontSize: 17 }]}
      />
      <FieldLabel>Estimate</FieldLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: customEstimate ? 8 : 14 }}>
        {ESTIMATES.map((min) => {
          const on = !customEstimate && taskEstimate === min;
          return (
            <SmallChip key={min} label={`${min}`} a11y={`Estimate ${min} min`} on={on} color={tone} onPress={() => { setCustomEstimate(false); setTaskEstimate(min); }} />
          );
        })}
        <SmallChip label="Custom" a11y="Custom estimate" on={customEstimate} color={tone} onPress={() => setCustomEstimate(true)} />
      </View>
      {customEstimate ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <TextInput
            value={customEstimateText}
            onChangeText={(t) => setCustomEstimateText(t.replace(/\D/g, '').slice(0, 3))}
            keyboardType="number-pad"
            placeholder="45"
            placeholderTextColor={Surface.faint}
            accessibilityLabel="Custom estimate minutes"
            style={[sandInputStyle, { width: 90, minHeight: 44, height: 44, textAlign: 'center', fontSize: 17 }]}
          />
          <Text style={Type.meta}>min{Number(customEstimateText || 0) < 5 ? ' · at least 5' : ''}</Text>
        </View>
      ) : null}
      <FieldLabel>Plan</FieldLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {PLAN_CHIPS.map((c) => (
          <SmallChip key={c.key} label={c.label} a11y={`Plan ${c.label}`} on={planChoice === c.key} color={tone} onPress={() => setPlanChoice(c.key)} />
        ))}
      </View>
      {planChoice === 'pick' ? (
        <View style={{ marginBottom: 10 }}>
          <DayPicker value={pickedDate} onChange={setPickedDate} color={tone} />
        </View>
      ) : null}
      <Text style={[Type.meta, { marginBottom: 14 }]}>
        {estimateValue} min{planValue ? ` · ${formatPlannedDay(planValue)}` : ' · not planned'}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <PrimaryButton title="Cancel" appearance="ghost" color={Surface.muted} size="small" onPress={closeTaskForm} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton title={editingTaskId ? 'Save task' : 'Add task'} size="small" disabled={!taskFormValid} onPress={() => void saveTask()} />
        </View>
      </View>
      {editingTaskId ? (
        <PressableScale
          onPress={() => { const t = tasks.find((x) => x.id === editingTaskId); if (t) void deleteTask(t); }}
          accessibilityLabel="Delete task"
          style={{ height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 6 }}
        >
          <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: Surface.muted }}>Delete task</Text>
        </PressableScale>
      ) : null}
    </Animated.View>
  );

  const followUpChoices = (next: Objective | null, dark: boolean) => (
    <View style={{ width: '100%', gap: 8 }}>
      {dark ? (
        // On the dark celebration the one CTA is a light pill.
        <PressableScale
          onPress={() => void (next ? startNext(next) : setNextGoal())}
          accessibilityRole="button"
          accessibilityLabel={next ? `Start next: ${next.title}` : 'Set your next goal'}
          scaleTo={0.98}
          style={{ height: 58, borderRadius: 29, backgroundColor: Surface.focusText, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}
        >
          <Text numberOfLines={1} style={{ fontFamily: FontFamily.bodyBold, fontSize: 17, color: Surface.ink }}>
            {next ? `Start next: ${next.title}` : 'Set your next goal'}
          </Text>
        </PressableScale>
      ) : next ? (
        <PrimaryButton title={`Start next: ${next.title}`} onPress={() => void startNext(next)} showArrow={false} />
      ) : (
        <PrimaryButton title="Set your next goal" onPress={() => void setNextGoal()} showArrow={false} />
      )}
      <PressableScale onPress={() => void notNow()} accessibilityLabel="Not now" style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: dark ? Surface.focusMuted : Surface.muted }}>Not now</Text>
      </PressableScale>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Surface.canvas }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 44 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <RoundButton label="Back" onPress={() => (showEditForm ? setShowEditForm(false) : router.back())}>
            <ChevronLeft size={22} color={Surface.ink} strokeWidth={2.2} />
          </RoundButton>
          <View style={{ flex: 1 }}>
            {showEditForm ? <Text style={[Type.heading, { fontSize: 20, marginLeft: 6 }]}>Edit goal</Text> : null}
          </View>
          {!showEditForm && isOpen && (
            <RoundButton label="Edit goal" onPress={openEdit}>
              <Pencil size={18} color={Surface.ink} strokeWidth={2} />
            </RoundButton>
          )}
        </View>

        {!showEditForm ? (
          <>
            {/* Pillar chip */}
            <Animated.View entering={enter(0)} style={{ flexDirection: 'row', marginBottom: 14 }}>
              <PressableScale
                onPress={() => router.push(`/goal/${pillar.id}`)}
                accessibilityLabel={`Open ${pillar.name}`}
                style={{ backgroundColor: Surface.surfaceRaised, borderRadius: Radius.full, paddingVertical: 6, paddingLeft: 6, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <PillarIcon icon={pillar.icon} name={pillar.name} color={tone} size={24} />
                <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: Surface.ink }}>{pillar.name}</Text>
              </PressableScale>
            </Animated.View>

            {/* Title, done-when, deadline, pace, progress */}
            <Animated.View entering={enter(1)} style={{ marginBottom: 18 }}>
              {objective.status === 'planned' ? <Text style={[Type.meta, { color: Accent.blue, marginBottom: 4 }]}>Next up</Text> : null}
              <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 28, lineHeight: 34, letterSpacing: -0.3, color: Surface.ink }}>{objective.title}</Text>
              {objective.done_when.trim() ? (
                <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 16, lineHeight: 22, color: Surface.muted, marginTop: 6 }}>Done when: {objective.done_when}</Text>
              ) : null}

              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
                <CalendarDays size={16} color={Surface.muted} strokeWidth={2} />
                {isOpen && daysLeft < 0 ? (
                  <PressableScale onPress={openEdit} accessibilityLabel="Set a new date">
                    <Text style={[Type.meta, { fontSize: 15, color: Accent.amber }]}>{deadlineLine}</Text>
                  </PressableScale>
                ) : (
                  <Text style={[Type.meta, { fontSize: 15, color: Surface.ink }]}>{deadlineLine}</Text>
                )}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <ProgressBar progress={progress ?? 0} color={tone} trackColor={Surface.rule} height={8} />
                </View>
                <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 17, color: Surface.ink, minWidth: 42, textAlign: 'right' }}>
                  {progress !== null ? `${Math.round(progress * 100)}%` : '—'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 }}>
                {paceWord ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <TrendingUp size={15} color={paceColor} strokeWidth={2.2} />
                    <Text style={[Type.meta, { fontSize: 14, color: paceColor }]}>{paceWord}</Text>
                  </View>
                ) : null}
                <Text style={[Type.meta, { fontSize: 14 }]}>
                  {hasMetric
                    ? isOpen ? '' : `${fmtNum(objective.metric_current)} / ${fmtNum(objective.metric_target)}${objective.metric_unit ? ` ${objective.metric_unit}` : ''}`
                    : tasks.length
                      ? `${doneTasks.length} of ${tasks.length} tasks done`
                      : 'Add tasks or a number to see progress'}
                </Text>
              </View>
            </Animated.View>

            {/* Closed banner */}
            {!isOpen ? (
              <View style={{ backgroundColor: objective.status === 'completed' ? Accent.greenSoft : Surface.surfaceRaised, borderRadius: Radius.md, padding: 14, marginBottom: 18 }}>
                <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: Surface.ink }}>
                  {objective.status === 'completed' ? 'Achieved' : 'Dropped'}
                  {objective.closed_at ? ` · ${formatDeadline(localDayKeyFromIso(objective.closed_at))}` : ''}
                </Text>
                {objective.close_note ? <Text style={[Type.body, { fontSize: 15, marginTop: 4 }]}>"{objective.close_note}"</Text> : null}
                {objective.status === 'dropped' ? <Text style={[Type.meta, { marginTop: 4 }]}>Changing course is part of being intentional.</Text> : null}
              </View>
            ) : null}

            {/* Hours + Flick */}
            <Animated.View entering={enter(2)} style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
              <View style={{ flex: 1, backgroundColor: Surface.surface, borderRadius: Radius.lg, padding: 14, ...Elevation.card }}>
                <Clock size={18} color={tone} strokeWidth={2.2} />
                <Text accessibilityLabel={`Hours given ${formatGoalHours(lifetimeMinutes)}`} style={{ fontFamily: FontFamily.bodyBold, fontSize: 28, lineHeight: 32, color: Surface.ink, marginTop: 6 }}>
                  {formatGoalHours(lifetimeMinutes)}
                </Text>
                <Text numberOfLines={1} style={Type.meta}>Hours given</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: Surface.surface, borderRadius: Radius.lg, padding: 14, ...Elevation.card }}>
                <Flame size={18} color={Accent.orange} strokeWidth={2.2} />
                <Text accessibilityLabel={`This week ${formatGoalHours(weekMinutes)}`} style={{ fontFamily: FontFamily.bodyBold, fontSize: 28, lineHeight: 32, color: Surface.ink, marginTop: 6 }}>
                  {formatGoalHours(weekMinutes)}
                </Text>
                <Text numberOfLines={1} style={Type.meta}>This week</Text>
              </View>
              <View style={{ width: 92, borderRadius: Radius.lg, backgroundColor: Surface.surface, alignItems: 'center', justifyContent: 'center', ...Elevation.card }}>
                <Mascot mood={flickMood} size={70} intensity={flickIntensity} />
              </View>
            </Animated.View>

            {/* Metric quick update */}
            {hasMetric && isOpen ? (
              <Animated.View entering={enter(3)} style={{ backgroundColor: Surface.surfaceRaised, borderRadius: Radius.md, padding: 14, marginBottom: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Target size={18} color={tone} strokeWidth={2.2} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: Surface.ink }}>
                      {fmtNum(objective.metric_current)} of {fmtNum(objective.metric_target)}{objective.metric_unit ? ` ${objective.metric_unit}` : ''}
                    </Text>
                    {objective.metric_start != null ? <Text style={Type.meta}>Started at {fmtNum(objective.metric_start)}</Text> : null}
                  </View>
                  {!showMetricUpdate ? (
                    <PressableScale
                      onPress={() => { setMetricValue(objective.metric_current != null ? String(objective.metric_current) : ''); setShowMetricUpdate(true); }}
                      accessibilityLabel="Update metric"
                      style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: Surface.surface, justifyContent: 'center' }}
                    >
                      <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: Surface.ink }}>Update</Text>
                    </PressableScale>
                  ) : null}
                </View>
                {showMetricUpdate ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
                    <TextInput
                      value={metricValue}
                      onChangeText={setMetricValue}
                      keyboardType="decimal-pad"
                      accessibilityLabel="Current value"
                      autoFocus
                      style={[sandInputStyle, { flex: 1, minWidth: 0, minHeight: 44, height: 44, backgroundColor: Surface.surface, fontSize: 17 }]}
                    />
                    <PrimaryButton title="Save value" size="small" fullWidth={false} disabled={parseNumber(metricValue) === null} onPress={() => void saveMetric()} />
                    <PressableScale onPress={() => setShowMetricUpdate(false)} accessibilityLabel="Cancel update" style={{ height: 44, paddingHorizontal: 6, justifyContent: 'center' }}>
                      <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: Surface.muted }}>Cancel</Text>
                    </PressableScale>
                  </View>
                ) : null}
              </Animated.View>
            ) : null}

            {/* US-064: Tasks */}
            <Animated.View entering={enter(4)} style={{ marginBottom: 22 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Text style={{ flex: 1, fontFamily: FontFamily.bodyBold, fontSize: 20, color: Surface.ink }}>Tasks</Text>
                {!taskFormOpen && isOpen && (
                  <PressableScale
                    onPress={openAddTask}
                    accessibilityLabel="Add task"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: Surface.ink }}
                  >
                    <Plus size={15} color={Surface.surface} strokeWidth={2.6} />
                    <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: Surface.surface }}>Add</Text>
                  </PressableScale>
                )}
              </View>

              {tasks.length === 0 && !taskFormOpen ? (
                <Text style={[Type.body, { fontSize: 15, marginBottom: 8 }]}>Break it into definite steps. What's the first one?</Text>
              ) : null}

              {openTasks.map((task, idx) => {
                if (editingTaskId === task.id && taskFormOpen) return <View key={task.id}>{taskForm}</View>;
                const isNext = idx === 0;
                const given = taskMinutes[task.id] ?? 0;
                return (
                  <View key={task.id} style={{ backgroundColor: Surface.surfaceRaised, borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: 10, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ gap: 2 }}>
                      <MiniTap label={`Move ${task.title} up`} disabled={idx === 0} onPress={() => void moveTask(openTasks, idx, -1)}>
                        <ChevronUp size={16} color={Surface.ink} strokeWidth={2.2} />
                      </MiniTap>
                      <MiniTap label={`Move ${task.title} down`} disabled={idx === openTasks.length - 1} onPress={() => void moveTask(openTasks, idx, 1)}>
                        <ChevronDown size={16} color={Surface.ink} strokeWidth={2.2} />
                      </MiniTap>
                    </View>
                    <PressableScale
                      onPress={() => void toggleTaskDone(task)}
                      accessibilityLabel={`Mark ${task.title} done`}
                      hitSlop={6}
                      style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: tone, backgroundColor: Surface.surface }}
                    >
                      <View />
                    </PressableScale>
                    <PressableScale onPress={() => openEditTask(task)} accessibilityLabel={`Edit ${task.title}`} scaleTo={0.99} style={{ flex: 1, minWidth: 0, paddingVertical: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: FontFamily.bodyBold, fontSize: 16, color: Surface.ink }}>{task.title}</Text>
                        {isNext ? (
                          <View style={{ backgroundColor: Accent.blueSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 12, color: Accent.blue }}>Next</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={[Type.meta, { marginTop: 2 }]}>
                        {given} / {task.estimate_minutes} min{task.planned_date ? ` · ${formatPlannedDay(task.planned_date)}` : ''}
                      </Text>
                    </PressableScale>
                    <Pencil size={14} color={Surface.faint} strokeWidth={2} />
                  </View>
                );
              })}

              {taskFormOpen && !editingTaskId ? taskForm : null}

              {doneTasks.length > 0 ? (
                <View style={{ marginTop: 4 }}>
                  <PressableScale
                    onPress={() => setShowDoneTasks(!showDoneTasks)}
                    accessibilityLabel={showDoneTasks ? 'Hide done tasks' : 'Show done tasks'}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 }}
                  >
                    <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: Surface.muted }}>{doneTasks.length} done</Text>
                    {showDoneTasks ? <ChevronUp size={16} color={Surface.muted} strokeWidth={2.2} /> : <ChevronDown size={16} color={Surface.muted} strokeWidth={2.2} />}
                  </PressableScale>
                  {showDoneTasks &&
                    doneTasks.map((task) => (
                      <View key={task.id} style={{ backgroundColor: Surface.surfaceRaised, borderRadius: Radius.md, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: 0.65 }}>
                        <PressableScale
                          onPress={() => void toggleTaskDone(task)}
                          accessibilityLabel={`Mark ${task.title} not done`}
                          style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: tone, alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Check size={16} color={Surface.surface} strokeWidth={3} />
                        </PressableScale>
                        <Text numberOfLines={1} style={{ flex: 1, fontFamily: FontFamily.bodySemiBold, fontSize: 16, color: Surface.ink, textDecorationLine: 'line-through' }}>{task.title}</Text>
                        <Text style={Type.meta}>{taskMinutes[task.id] ?? 0} / {task.estimate_minutes} min</Text>
                      </View>
                    ))}
                </View>
              ) : null}
            </Animated.View>

            {/* Linked habits */}
            <Animated.View entering={enter(5)} style={{ marginBottom: 22 }}>
              <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 20, color: Surface.ink, marginBottom: 10 }}>Habits for this goal</Text>
              {habits.length === 0 ? (
                <Text style={[Type.body, { fontSize: 15 }]}>No linked habits yet. Link one from {pillar.name}.</Text>
              ) : (
                habits.map(({ habit: h, streak }) => (
                  <View key={h.id} style={{ backgroundColor: Surface.surfaceRaised, borderRadius: Radius.md, padding: 12, marginBottom: 8 }}>
                    <Text numberOfLines={1} style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: Surface.ink }}>{h.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 }}>
                      <Text style={Type.meta}>{habitScheduleText(h)}</Text>
                      {streak > 0 ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <Flame size={13} color={Accent.orange} strokeWidth={2.2} />
                          <Text style={[Type.meta, { color: Surface.ink }]}>{streak}-day streak</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </Animated.View>

            {/* Recent sessions */}
            <Animated.View entering={enter(6)} style={{ marginBottom: 24 }}>
              <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 20, color: Surface.ink, marginBottom: 10 }}>Recent sessions</Text>
              {sessions.length === 0 ? (
                <Text style={[Type.body, { fontSize: 15 }]}>No sessions yet</Text>
              ) : (
                <View style={{ backgroundColor: Surface.surface, borderRadius: Radius.md, paddingHorizontal: 14, ...Elevation.card }}>
                  {sessions.map((s, i) => (
                    <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: Surface.rule }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: Surface.ink }}>{s.label}</Text>
                        <Text style={Type.meta}>{formatPlannedDay(localDayKeyFromIso(s.started_at))}</Text>
                      </View>
                      <Text style={[Type.number, { fontSize: 15, color: Surface.ink }]}>{Math.max(1, Math.round(s.duration_seconds / 60))} min</Text>
                    </View>
                  ))}
                </View>
              )}
            </Animated.View>

            {/* US-062/063 */}
            {objective.status === 'active' && (
              <Animated.View entering={enter(7)} style={{ gap: 6 }}>
                <PrimaryButton title="Mark as achieved" onPress={() => void confirmComplete()} showArrow={false} />
                <PressableScale onPress={() => setShowDropSheet(true)} accessibilityLabel="Drop goal" style={{ height: 50, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: Surface.muted }}>Drop goal</Text>
                </PressableScale>
              </Animated.View>
            )}
          </>
        ) : (
          <Animated.View entering={FadeInDown.springify().damping(20)}>
            <FieldLabel>Title</FieldLabel>
            <TextInput
              placeholder="What will you achieve?"
              placeholderTextColor={Surface.faint}
              accessibilityLabel="Goal title"
              value={editTitle}
              onChangeText={(t) => setEditTitle(t.slice(0, 60))}
              maxLength={60}
              style={[sandInputStyle, { height: 58, marginBottom: 18 }]}
            />

            <FieldLabel>Done when</FieldLabel>
            <TextInput
              placeholder="How will you know it's done?"
              placeholderTextColor={Surface.faint}
              accessibilityLabel="Done when"
              value={editDoneWhen}
              onChangeText={(t) => setEditDoneWhen(t.slice(0, 140))}
              maxLength={140}
              multiline
              textAlignVertical="top"
              style={[sandInputStyle, { minHeight: 80, paddingTop: 16, paddingBottom: 16, marginBottom: 18, fontSize: 17 }]}
            />

            <FieldLabel>Deadline</FieldLabel>
            <View style={{ marginBottom: 18 }}>
              <DeadlinePicker value={editDeadline} onChange={(k) => { setEditDeadline(k); setEditError(''); }} color={tone} />
            </View>

            <PressableScale
              onPress={() => setEditHasMetric(!editHasMetric)}
              accessibilityLabel="Track a number"
              accessibilityState={{ checked: editHasMetric }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}
            >
              <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: editHasMetric ? tone : Surface.ruleStrong, backgroundColor: editHasMetric ? tone : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {editHasMetric ? <Check size={14} color={Surface.surface} strokeWidth={3} /> : null}
              </View>
              <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: Surface.ink }}>Track a number</Text>
            </PressableScale>
            {editHasMetric ? (
              <View style={{ marginBottom: 18 }}>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                  <Text style={[Type.meta, { flex: 1, marginLeft: 4 }]}>Now</Text>
                  <Text style={[Type.meta, { flex: 1, marginLeft: 4 }]}>Target</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput placeholder="Now" placeholderTextColor={Surface.faint} accessibilityLabel="Metric now" value={editMetricCurrent} onChangeText={setEditMetricCurrent} keyboardType="decimal-pad" style={[sandInputStyle, { flex: 1, minWidth: 0, height: 50, fontSize: 17 }]} />
                  <TextInput placeholder="Target" placeholderTextColor={Surface.faint} accessibilityLabel="Metric target" value={editMetricTarget} onChangeText={setEditMetricTarget} keyboardType="decimal-pad" style={[sandInputStyle, { flex: 1, minWidth: 0, height: 50, fontSize: 17 }]} />
                </View>
                <TextInput placeholder="Unit (kg, km, €, etc.)" placeholderTextColor={Surface.faint} accessibilityLabel="Metric unit" value={editMetricUnit} onChangeText={(t) => setEditMetricUnit(t.slice(0, 12))} style={[sandInputStyle, { height: 50, marginTop: 8, fontSize: 17 }]} />
                <Text style={[Type.meta, { marginTop: 6 }]}>
                  {objective.metric_start != null && objective.metric_target != null
                    ? `Started at ${fmtNum(objective.metric_start)}${objective.metric_unit ? ` ${objective.metric_unit}` : ''}`
                    : 'Progress is measured from where it stands now.'}
                </Text>
              </View>
            ) : null}

            {editError ? <Text style={[Type.meta, { color: Accent.amber, marginBottom: 12, fontSize: 14 }]}>{editError}</Text> : null}

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <PrimaryButton title="Cancel" appearance="ghost" color={Surface.muted} size="small" onPress={() => setShowEditForm(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton title="Save" size="small" disabled={!editTitle.trim()} onPress={() => void saveEdit()} />
              </View>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* US-063: drop reason (in-app sheet on every platform) */}
      <TextPromptSheet
        visible={showDropSheet}
        title="Drop this goal?"
        message="Changing course is part of being intentional. Your tasks and hours stay in your history."
        placeholder="What changed? (optional)"
        confirmLabel="Drop goal"
        cancelLabel="Keep it"
        onConfirm={(reason) => void dropGoal(reason)}
        onCancel={() => setShowDropSheet(false)}
      />

      {/* US-063: after dropping — what's next */}
      <Modal visible={!!followUp && followUp.kind === 'dropped'} transparent animationType="fade" onRequestClose={() => void notNow()}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: hexToRgba(Surface.ink, 0.38) }}>
          <View style={{ backgroundColor: Surface.canvas, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: 20, paddingBottom: 28, alignItems: 'center', ...Elevation.floating }}>
            <Mascot mood="calm" size={72} intensity={0.55} />
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 22, color: Surface.ink, textAlign: 'center', marginTop: 8 }}>Goal dropped</Text>
            <Text style={[Type.body, { textAlign: 'center', marginTop: 6, marginBottom: 18 }]}>
              {followUp?.next ? `${followUp.next.title} is next up for ${pillar.name}.` : `What would winning look like for ${pillar.name} now?`}
            </Text>
            {followUpChoices(followUp?.next ?? null, false)}
          </View>
        </View>
      </Modal>

      {/* US-062: celebration */}
      <Modal visible={showCelebration} animationType="fade" transparent onRequestClose={() => void notNow()}>
        <View style={{ flex: 1, backgroundColor: hexToRgba(Surface.focusCanvas, 0.95), alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Confetti width={winW} height={winH} />
          <Animated.View entering={FadeIn.delay(250)} style={{ alignItems: 'center', width: '100%', maxWidth: 400 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: Accent.green, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Trophy size={32} color={Surface.surface} strokeWidth={2.2} />
            </View>
            <Mascot mood="proud" size={96} intensity={1} />
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 32, lineHeight: 38, color: Surface.focusText, textAlign: 'center', marginTop: 14 }}>Goal achieved!</Text>
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 19, color: Surface.focusText, textAlign: 'center', marginTop: 6 }}>{objective.title}</Text>
            <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: Surface.focusMuted, textAlign: 'center', marginTop: 6, marginBottom: 18 }}>
              {lifetimeMinutes > 0 ? `${formatGoalHours(lifetimeMinutes)} given to the life you chose.` : 'A definite finish line, crossed.'}
            </Text>
            <View style={{ width: '100%', marginBottom: 18 }}>
              <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: Surface.focusText, marginBottom: 8 }}>What made it work? (optional)</Text>
              <TextInput
                placeholder="One line"
                placeholderTextColor={Surface.focusFaint}
                accessibilityLabel="What made it work?"
                value={reflection}
                onChangeText={(t) => setReflection(t.replace(/\n/g, ' ').slice(0, 140))}
                maxLength={140}
                style={{ height: 52, paddingHorizontal: 16, borderRadius: Radius.md, backgroundColor: Surface.focusSurface, fontFamily: FontFamily.bodySemiBold, fontSize: 16, color: Surface.focusText }}
              />
            </View>
            {followUpChoices(followUp?.next ?? null, true)}
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function RoundButton({ children, onPress, label }: { children: ReactNode; onPress: () => void; label: string }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={6}
      style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Surface.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}
    >
      {children}
    </PressableScale>
  );
}

function MiniTap({ children, onPress, disabled, label }: { children: ReactNode; onPress: () => void; disabled?: boolean; label: string }) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      hitSlop={4}
      scaleTo={0.85}
      style={{ width: 24, height: 20, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.25 : 1 }}
    >
      {children}
    </PressableScale>
  );
}

function SmallChip({ label, a11y, on, color, onPress }: { label: string; a11y: string; on: boolean; color: string; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={a11y}
      aria-selected={on}
      accessibilityState={{ selected: on }}
      scaleTo={0.94}
      style={{ paddingHorizontal: 13, height: 36, justifyContent: 'center', borderRadius: 18, backgroundColor: on ? color : Surface.surfaceRaised }}
    >
      <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: on ? Surface.surface : Surface.ink }}>{label}</Text>
    </PressableScale>
  );
}

