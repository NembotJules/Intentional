/**
 * Goal Detail screen — US-012, US-013, US-021, US-059
 *
 * US-012: Inline name / color / why editing (saves immediately on blur / toggle).
 * US-013: Shows both current streak and best streak; actions reorderable inline.
 * US-021: Action edit form embedded directly on this screen.
 * US-059: Set a goal (objective) for a pillar with deadline and optional metric.
 */
import { useCallback, useState, useRef, type ReactNode } from 'react';
import { View, Text, ScrollView, TextInput, KeyboardAvoidingView, Platform, ActionSheetIOS, Switch } from 'react-native';
import { Stack, useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import {
  Archive,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  Clock,
  Flame,
  History,
  ImageIcon,
  Pause,
  Pencil,
  Play,
  Plus,
  Quote,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from 'lucide-react-native';
import { hapticWarning, hapticLight } from '@/utils/haptics';
import * as api from '@/db/api';
import type { DailyAction, MetaGoal, Objective, ObjectiveStatus, Task } from '@/types';
import { Accent, Elevation, FontFamily, Radius, Surface, Type, hexToRgba } from '@/constants/design';
import * as goalProgress from '@/services/goalProgress';
import { confirmAsync } from '@/utils/confirm';
import { getGoalColor } from '@/utils/goalColors';
import { PrimaryButton } from '@/components/PrimaryButton';
import { AnimatedNumber, PressableScale, ProgressBar, enter } from '@/components/ui/motion';
import { PillarIcon } from '@/components/ui/PillarIcon';
import { ColorPicker, DurationPicker, FieldLabel, IconPicker, IconTap, WeekdayPicker, clampHabitMinutes, habitScheduleText, sandInputStyle } from '@/components/ui/PillarForm';
import { DeadlinePicker, formatDeadline } from '@/components/ui/DayPicker';
import { CTA } from '@/components/onboarding/parts';
import { Mascot, type MascotMood } from '@/components/onboarding/Mascot';
import { parseReminderTime } from '@/services/notifications';
import { syncHabits } from '@/services/habitSync';
import * as appBlocking from '@/services/appBlocking';
import { setSetting } from '@/db';
import { GoalWallpaperSheet } from '@/components/GoalWallpaperSheet';

/** "0h", "45m", "1.5h", "12h". */
/** US-077: set once the person was asked to pick the apps strict mode blocks. */
const PICKER_OFFERED_KEY = 'strict_picker_offered';

function formatHours(minutes: number): string {
  if (minutes <= 0) return '0h';
  if (minutes < 60) return `${minutes}m`;
  const h = minutes / 60;
  return h >= 10 ? `${Math.round(h)}h` : `${Number(h.toFixed(1))}h`;
}

export default function GoalDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; setGoal?: string; addHabit?: string; editHabit?: string }>();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const wantsSetGoal = first(params.setGoal) === '1';
  // The Goals tab sends habit add/edit here, so there is ONE habit form (weekdays, time, goal link).
  const wantsAddHabit = first(params.addHabit) === '1';
  const editHabitId = first(params.editHabit);

  const [goal, setGoal] = useState<MetaGoal | null>(null);
  const [actions, setActions] = useState<DailyAction[]>([]);
  const [lifetimeSec, setLifetimeSec] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);

  // US-059: objectives
  const [activeObjective, setActiveObjective] = useState<Objective | null>(null);
  const [plannedObjectives, setPlannedObjectives] = useState<Objective[]>([]);
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [activeMinutes, setActiveMinutes] = useState(0);
  const [objectiveNotice, setObjectiveNotice] = useState('');
  const [objectiveError, setObjectiveError] = useState('');
  // US-074: maintenance pillar ("runs on habits")
  const [isMaintenance, setIsMaintenance] = useState(false);

  // US-012: inline edit fields
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editWhy, setEditWhy] = useState('');
  const [editingGoalFields, setEditingGoalFields] = useState(false);

  // US-038: wallpaper sheet
  const [showWallpaper, setShowWallpaper] = useState(false);

  // US-021: action composer · US-068: goal link · US-069: schedule
  const [showActionForm, setShowActionForm] = useState(false);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [actionName, setActionName] = useState('');
  /** US-068: editing a legacy check-type habit; saving converts it to timed. */
  const [editingWasCheck, setEditingWasCheck] = useState(false);
  const [actionMinutes, setActionMinutes] = useState(30);
  const [actionReminderEnabled, setActionReminderEnabled] = useState(false);
  const [actionReminderTime, setActionReminderTime] = useState('08:00');
  const [actionObjectiveId, setActionObjectiveId] = useState<string | null>(null);
  const [actionDaysMask, setActionDaysMask] = useState(127); // US-069: bit 0 = Monday, default all days
  /** US-077: strict mode (apps blocked automatically at the start time), on by default. */
  const [actionStrict, setActionStrict] = useState(true);

  // US-059: objective form
  const [showObjectiveForm, setShowObjectiveForm] = useState(false);
  const [objectiveTitle, setObjectiveTitle] = useState('');
  const [objectiveDoneWhen, setObjectiveDoneWhen] = useState('');
  const [objectiveDeadline, setObjectiveDeadline] = useState('');
  const [objectiveHasMetric, setObjectiveHasMetric] = useState(false);
  const [objectiveMetricCurrent, setObjectiveMetricCurrent] = useState('');
  const [objectiveMetricTarget, setObjectiveMetricTarget] = useState('');
  const [objectiveMetricUnit, setObjectiveMetricUnit] = useState('');

  const scrollRef = useRef<ScrollView>(null);
  /** US-077: strict mode needs the native Screen Time module (iOS dev/prod build); hidden on Expo Go, web and Android. */
  const blockingAvailable = appBlocking.isAvailable();

  const load = useCallback(async () => {
    if (!id) return;
    const g = await api.getGoalById(id);
    setGoal(g);
    if (!g) { setActions([]); setActiveObjective(null); setPlannedObjectives([]); return; }
    const acts = await api.getActionsByGoal(g.id, true);
    setActions(acts);
    setLifetimeSec(api.getTotalFocusSecondsForGoal(g.id));
    setBestStreak(api.getGoalBestStreakDays(g.id));

    // US-013: current streak = max current streak across all actions
    let maxCurrent = 0;
    for (const a of acts) {
      const m = api.getActionStreakMetrics(a.id, a.type);
      if (m.current > maxCurrent) maxCurrent = m.current;
    }
    setCurrentStreak(maxCurrent);

    // US-059: load objectives
    const active = await api.getActiveObjective(g.id);
    setActiveObjective(active);
    setActiveTasks(active ? await api.getTasks(active.id) : []);
    setActiveMinutes(active ? api.getMinutesForObjective(active.id) : 0);
    const all = await api.getObjectives(g.id);
    const planned = all.filter((o) => o.status === 'planned');
    setPlannedObjectives(planned);
    setIsMaintenance(api.getMaintenancePillars().has(g.id));

    // seed edit fields
    setEditName(g.name);
    setEditColor(g.color);
    setEditIcon(g.icon);
    setEditWhy(g.why_statement ?? '');
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  /** `/goal/<id>?setGoal=1` (e.g. after completing or dropping a goal) opens the set-goal form on arrival. */
  useFocusEffect(
    useCallback(() => {
      if (!wantsSetGoal || !goal) return;
      const t = setTimeout(() => {
        openNewObjectiveRef.current();
        router.setParams({ setGoal: undefined });
      }, 0);
      return () => clearTimeout(t);
    }, [wantsSetGoal, goal, router])
  );

  useFocusEffect(
    useCallback(() => {
      if (!goal || (!wantsAddHabit && !editHabitId)) return;
      const target = editHabitId ? actions.find((a) => a.id === editHabitId) : null;
      if (editHabitId && !target) return; // wait for the habits to load
      const t = setTimeout(() => {
        if (target) openEditActionRef.current(target);
        else openNewActionRef.current();
        router.setParams({ addHabit: undefined, editHabit: undefined });
      }, 0);
      return () => clearTimeout(t);
    }, [wantsAddHabit, editHabitId, goal, actions, router])
  );

  // ── Bonus C: archive from Goal Detail ────────────────────────────────────
  const confirmArchive = () => {
    const doArchive = async () => {
      hapticWarning();
      await api.archiveGoal(goal!.id);
      // Archived pillars' habits drop out of the alerts and strict windows.
      void syncHabits();
      router.back();
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Keep the history.',
          message: `Archiving ${goal?.name} removes it from active planning. Every hour you gave it stays in your history.`,
          options: ['Keep active', `Archive ${goal?.name}`],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 0,
        },
        (idx) => { if (idx === 1) void doArchive(); }
      );
    } else {
      void confirmAsync({
        title: 'Keep the history.',
        message: `Archiving ${goal?.name} removes it from active planning. Every hour you gave it stays in your history.`,
        confirmLabel: `Archive ${goal?.name}`,
        cancelLabel: 'Keep active',
        destructive: true,
      }).then((ok) => { if (ok) void doArchive(); });
    }
  };

  // ── US-012: save goal edits ──────────────────────────────────────────────
  const saveGoalEdits = async () => {
    if (!goal || !editName.trim()) return;
    await api.updateGoal(goal.id, {
      name: editName.trim().slice(0, 30),
      color: editColor,
      icon: editIcon,
      why_statement: editWhy.slice(0, 140),
    });
    setEditingGoalFields(false);
    void load();
  };

  // ── US-021: action form helpers · US-068: goal link · US-069: schedule ───
  const resetActionForm = () => {
    setShowActionForm(false);
    setEditingActionId(null);
    setActionName('');
    setEditingWasCheck(false);
    setActionMinutes(30);
    setActionReminderEnabled(false);
    setActionReminderTime('08:00');
    setActionObjectiveId(null);
    setActionDaysMask(127);
    setActionStrict(true);
  };

  const openNewAction = () => {
    resetActionForm();
    setShowActionForm(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
  };

  const openEditAction = (a: DailyAction) => {
    setEditingActionId(a.id);
    setActionName(a.name);
    // US-068: a check-type habit gets a duration ("Give it 15 min so it counts") and is saved as timed.
    const wasCheck = a.type === 'habit';
    setEditingWasCheck(wasCheck);
    setActionMinutes(wasCheck ? 15 : clampHabitMinutes(a.target_minutes || 30));
    setActionReminderEnabled(!!a.reminder_time);
    setActionReminderTime(a.reminder_time || '08:00');
    setActionObjectiveId(a.objective_id);
    setActionDaysMask(a.days_mask ?? 127);
    setActionStrict((a.strict ?? 1) === 1);
    setShowActionForm(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
  };

  const openNewActionRef = useRef(openNewAction);
  openNewActionRef.current = openNewAction;
  const openEditActionRef = useRef(openEditAction);
  openEditActionRef.current = openEditAction;

  const saveAction = async () => {
    if (!goal || !actionName.trim()) return;
    const reminderTime =
      actionReminderEnabled && parseReminderTime(actionReminderTime)
        ? actionReminderTime.trim()
        : null;

    // Every habit is timed (US-068): type 'session', at least 5 minutes, at least one day.
    const minutes = clampHabitMinutes(actionMinutes);
    const daysMask = actionDaysMask & 127 ? actionDaysMask : 127;
    // US-077: the toggle is hidden where blocking is unavailable; the stored value then stays as it was (new habits: on).
    const strict = blockingAvailable ? (actionStrict ? 1 : 0) : undefined;
    if (editingActionId) {
      await api.updateAction(editingActionId, {
        name: actionName.trim(),
        type: 'session',
        target_minutes: minutes,
        reminder_time: reminderTime,
        objective_id: actionObjectiveId,
        days_mask: daysMask,
        strict,
      });
    } else {
      await api.addAction({
        goal_id: goal.id, name: actionName.trim(), type: 'session',
        target_minutes: minutes,
        reminder_time: reminderTime, is_active: 1, sort_order: actions.length,
        objective_id: actionObjectiveId, days_mask: daysMask,
        strict,
      });
    }
    resetActionForm();
    void load();
    // US-075 → US-077: notifications and strict-mode windows follow the saved habit.
    void syncHabits();
    if (strict === 1 && reminderTime) void offerAppPicker(reminderTime);
  };

  /**
   * US-077: the first strict habit with a start time, while no apps are picked yet, asks once
   * for the apps to block (until then the block is skipped and the notification says so).
   */
  const offerAppPicker = async (startTime: string) => {
    if (!appBlocking.isAvailable() || appBlocking.hasSelection()) return;
    if (api.getSetting(PICKER_OFFERED_KEY) === '1') return;
    setSetting(PICKER_OFFERED_KEY, '1');
    const ok = await confirmAsync({
      title: 'Pick the apps to block',
      message: `At ${startTime}, Intentional blocks the apps you choose until the habit's time is up. You can change them later in Settings.`,
      confirmLabel: 'Pick apps',
      cancelLabel: 'Not now',
    });
    if (!ok) return;
    if (appBlocking.getAuthorizationStatus() !== 'approved') {
      const status = await appBlocking.requestAuthorization();
      if (status !== 'approved') return;
    }
    if (await appBlocking.presentPicker()) void syncHabits();
  };

  const toggleActionActive = async (a: DailyAction) => {
    const next = a.is_active ? 0 : 1;
    await api.updateAction(a.id, { is_active: next });
    // Pausing cancels the alerts and strict windows; resuming brings them back.
    void syncHabits();
    void load();
  };

  // ── US-059: objective form helpers ───────────────────────────────────────
  const resetObjectiveForm = () => {
    setShowObjectiveForm(false);
    setObjectiveTitle('');
    setObjectiveDoneWhen('');
    setObjectiveDeadline('');
    setObjectiveHasMetric(false);
    setObjectiveMetricCurrent('');
    setObjectiveMetricTarget('');
    setObjectiveMetricUnit('');
  };

  const openNewObjective = () => {
    resetObjectiveForm();
    setObjectiveNotice('');
    setObjectiveError('');
    setShowObjectiveForm(true);
  };
  const openNewObjectiveRef = useRef(openNewObjective);
  openNewObjectiveRef.current = openNewObjective;

  const toggleMaintenance = (on: boolean) => {
    if (!goal) return;
    api.setPillarMaintenance(goal.id, on);
    setIsMaintenance(on);
    hapticLight();
  };

  const saveObjective = async () => {
    if (!goal || !objectiveTitle.trim()) return;
    if (!api.isValidDayKey(objectiveDeadline)) {
      setObjectiveError('Pick a deadline.');
      return;
    }

    const status: ObjectiveStatus = activeObjective ? 'planned' : 'active';
    const metric_current = objectiveHasMetric && objectiveMetricCurrent ? parseFloat(objectiveMetricCurrent) : null;
    const metric_target = objectiveHasMetric && objectiveMetricTarget ? parseFloat(objectiveMetricTarget) : null;
    const metric_unit = objectiveHasMetric && objectiveMetricUnit.trim() ? objectiveMetricUnit.trim() : null;

    const input = {
      pillar_id: goal.id,
      title: objectiveTitle.trim().slice(0, 60),
      done_when: objectiveDoneWhen.trim().slice(0, 140),
      deadline: objectiveDeadline,
      status,
      metric_current: metric_target !== null ? (metric_current ?? 0) : null,
      metric_target,
      metric_unit: metric_target !== null ? metric_unit : null,
      sort_order: plannedObjectives.length,
    };
    try {
      await api.addObjective(input);
      setObjectiveNotice(status === 'planned' ? `Saved "${input.title}" as Next up.` : '');
      resetObjectiveForm();
      void load();
    } catch (err) {
      if (err instanceof api.ActiveObjectiveExistsError) {
        // Another goal became active meanwhile: really save this one as planned, and say so.
        try {
          await api.addObjective({ ...input, status: 'planned' });
          setObjectiveNotice(`This pillar already has an active goal, so "${input.title}" was saved as Next up.`);
          resetObjectiveForm();
          void load();
        } catch (e2) {
          setObjectiveError(e2 instanceof Error ? `Not saved: ${e2.message}` : 'Not saved.');
        }
      } else {
        setObjectiveError(err instanceof Error ? `Not saved: ${err.message}` : 'Not saved.');
      }
    }
  };

  // ── US-013: inline action reorder ────────────────────────────────────────
  const moveAction = async (idx: number, delta: -1 | 1) => {
    if (!goal) return;
    const active = actions.filter((a) => a.is_active);
    const j = idx + delta;
    if (j < 0 || j >= active.length) return;
    const next = [...active];
    [next[idx], next[j]] = [next[j], next[idx]];
    await api.reorderActions(goal.id, next.map((a) => a.id));
    void load();
    hapticLight();
  };

  if (!id || !goal) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Surface.canvas, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={[Type.heading, { textAlign: 'center', fontSize: 20 }]}>{!id ? 'Missing pillar.' : 'Pillar not found or archived.'}</Text>
        <View style={{ marginTop: 20, alignSelf: 'stretch' }}>
          <CTA label="Go back" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const tone = getGoalColor(goal);
  const activeActions = actions.filter((a) => a.is_active);
  const lifetimeHours = lifetimeSec / 3600;
  /** Flick reads the pillar's health: blazing on a real streak, flickering when it's been left alone. */
  const flick: { mood: MascotMood; intensity: number } =
    currentStreak >= 3
      ? { mood: 'proud', intensity: Math.min(1, 0.75 + currentStreak * 0.03) }
      : currentStreak > 0
        ? { mood: 'happy', intensity: 0.6 }
        : lifetimeSec > 0
          ? { mood: 'worried', intensity: 0.22 }
          : { mood: 'calm', intensity: 0.45 };
  const flickLine =
    currentStreak >= 3
      ? `${currentStreak} days running. ${goal.name} is blazing.`
      : currentStreak > 0
        ? `${goal.name} got your time recently. Keep it going.`
        : lifetimeSec > 0
          ? `${goal.name}'s streak went quiet. One session brings it back.`
          : `Give ${goal.name} its first hour.`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Surface.canvas }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 44 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          showsVerticalScrollIndicator={false}
        >
          {/* Top bar */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <RoundButton label="Back" onPress={() => (editingGoalFields ? setEditingGoalFields(false) : router.back())}>
              <ChevronLeft size={22} color={Surface.ink} strokeWidth={2.2} />
            </RoundButton>
            <View style={{ flex: 1 }}>
              {editingGoalFields ? <Text style={[Type.heading, { fontSize: 20, marginLeft: 6 }]}>Edit pillar</Text> : null}
            </View>
            {!editingGoalFields && (
              <>
                <RoundButton label="Archive pillar" onPress={confirmArchive}>
                  <Archive size={18} color={Surface.ink} strokeWidth={2} />
                </RoundButton>
                <RoundButton label="Edit pillar" onPress={() => setEditingGoalFields(true)}>
                  <Pencil size={18} color={Surface.ink} strokeWidth={2} />
                </RoundButton>
              </>
            )}
          </View>

          {editingGoalFields ? (
            <Animated.View entering={FadeInDown.springify().damping(20)} style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <PillarIcon icon={editIcon} name={editName} color={editColor} size={58} />
                <TextInput
                  placeholder="Pillar name"
                  placeholderTextColor={Surface.faint}
                  value={editName}
                  onChangeText={(t) => setEditName(t.slice(0, 30))}
                  maxLength={30}
                  style={[sandInputStyle, { flex: 1, minWidth: 0, width: 0, height: 58 }]}
                />
              </View>

              <FieldLabel>Icon</FieldLabel>
              <View style={{ marginBottom: 24 }}>
                <IconPicker icon={editIcon} name={editName} color={editColor} onChange={setEditIcon} />
              </View>

              <FieldLabel>Colour</FieldLabel>
              <View style={{ marginBottom: 24 }}>
                <ColorPicker value={editColor} onChange={setEditColor} />
              </View>

              <FieldLabel>Why it matters</FieldLabel>
              <TextInput
                placeholder="One sentence you'll read on hard days."
                placeholderTextColor={Surface.faint}
                value={editWhy}
                onChangeText={(t) => setEditWhy(t.slice(0, 140))}
                multiline
                maxLength={140}
                textAlignVertical="top"
                style={[sandInputStyle, { minHeight: 92, paddingTop: 16, paddingBottom: 16, fontFamily: FontFamily.bodySemiBold, fontSize: 17, lineHeight: 23 }]}
              />
              <Text style={[Type.meta, { textAlign: 'right', marginTop: 6, color: Surface.faint }]}>{editWhy.length} / 140</Text>

              <View style={{ marginTop: 18 }}>
                <CTA label="Save" onPress={() => void saveGoalEdits()} disabled={!editName.trim()} />
              </View>
              <PressableScale
                onPress={() => {
                  setEditingGoalFields(false);
                  void load();
                }}
                style={{ height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 6 }}
              >
                <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: Surface.muted }}>Cancel</Text>
              </PressableScale>
            </Animated.View>
          ) : (
            <>
              {/* Identity — the pillar's own colour */}
              <Animated.View
                entering={enter(0)}
                style={{ backgroundColor: tone, borderRadius: 24, padding: 20, paddingRight: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: Surface.surface, alignItems: 'center', justifyContent: 'center' }}>
                    <PillarIcon icon={goal.icon} name={goal.name} color={tone} size={52} tinted={false} />
                  </View>
                  <Text numberOfLines={2} style={{ fontFamily: FontFamily.bodyBold, fontSize: 34, lineHeight: 40, letterSpacing: -0.5, color: Surface.surface, marginTop: 14 }}>
                    {goal.name}
                  </Text>
                  <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: hexToRgba(Surface.surface, 0.85), marginTop: 2 }}>
                    {activeActions.length} active habit{activeActions.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={{ width: 104, height: 120, borderRadius: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: hexToRgba(Surface.surface, 0.18) }}>
                  <Mascot mood={flick.mood} size={92} intensity={flick.intensity} />
                </View>
              </Animated.View>
              <Animated.View entering={enter(1)}>
                <Text style={[Type.body, { fontSize: 15, marginBottom: 18, marginLeft: 4 }]}>{flickLine}</Text>
              </Animated.View>

              {/* Stats */}
              <Animated.View entering={enter(2)} style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                <StatTile Icon={Clock} label="Hours given" iconColor={tone} value={lifetimeHours} format={(n) => (lifetimeSec === 0 ? '0' : n < 0.1 ? '<0.1' : n >= 100 ? `${Math.round(n)}` : n.toFixed(1))} unit="h" />
                <StatTile Icon={Flame} label="Streak" iconColor={Accent.orange} value={currentStreak} format={(n) => `${Math.round(n)}`} unit="d" />
                <StatTile Icon={Trophy} label="Best streak" iconColor={Accent.blue} value={bestStreak} format={(n) => `${Math.round(n)}`} unit="d" />
              </Animated.View>

              {/* Why */}
              <Animated.View entering={enter(3)} style={{ marginBottom: 28 }}>
                {goal.why_statement?.trim() ? (
                  <View style={{ backgroundColor: Accent.blueSoft, borderRadius: Radius.lg, padding: 18 }}>
                    <Quote size={20} color={Accent.blue} strokeWidth={2.2} />
                    <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 18, lineHeight: 25, color: Surface.ink, marginTop: 8 }}>{goal.why_statement.trim()}</Text>
                    <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: Accent.blue, marginTop: 10 }}>Why {goal.name} matters</Text>
                  </View>
                ) : (
                  <PressableScale
                    onPress={() => setEditingGoalFields(true)}
                    accessibilityLabel="Add the reason this pillar matters"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Accent.blueSoft, borderRadius: Radius.lg, padding: 16 }}
                  >
                    <Quote size={20} color={Accent.blue} strokeWidth={2.2} />
                    <Text style={{ flex: 1, fontFamily: FontFamily.bodySemiBold, fontSize: 16, color: Accent.blue }}>Add the reason this pillar matters</Text>
                    <Plus size={18} color={Accent.blue} strokeWidth={2.4} />
                  </PressableScale>
                )}
              </Animated.View>
            </>
          )}

          {/* US-059 / US-060: Goals (Objectives) · US-074: maintenance */}
          {!editingGoalFields && (
            <Animated.View entering={enter(4)} style={{ marginBottom: 24 }}>
              <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 22, lineHeight: 28, color: Surface.ink, marginBottom: 12 }}>Goal</Text>
              {objectiveNotice ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Accent.greenSoft, borderRadius: Radius.md, padding: 12, marginBottom: 10 }}>
                  <CircleCheck size={16} color={Accent.green} strokeWidth={2.2} />
                  <Text style={[Type.meta, { flex: 1, color: Surface.ink, fontSize: 14 }]}>{objectiveNotice}</Text>
                </View>
              ) : null}
              {!showObjectiveForm ? (
                <>
                  {!activeObjective ? (
                    isMaintenance ? (
                      <View style={{ backgroundColor: Surface.surfaceRaised, borderRadius: Radius.lg, padding: 16 }}>
                        <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: Surface.ink }}>{goal.name} runs on habits</Text>
                        <Text style={[Type.body, { fontSize: 14, marginTop: 2 }]}>No goal needed, no nudges. Your habits keep it going.</Text>
                        <PressableScale onPress={openNewObjective} accessibilityLabel="Set a goal anyway" style={{ marginTop: 8, alignSelf: 'flex-start', paddingVertical: 6 }}>
                          <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: Accent.blue }}>Set a goal anyway</Text>
                        </PressableScale>
                      </View>
                    ) : (
                      <PressableScale
                        onPress={openNewObjective}
                        accessibilityLabel="Set a goal"
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Accent.blueSoft, borderRadius: Radius.lg, padding: 16 }}
                      >
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Accent.blue, alignItems: 'center', justifyContent: 'center' }}>
                          <Plus size={16} color={Surface.surface} strokeWidth={2.4} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: Accent.blue }}>Set a goal</Text>
                          <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: Accent.blue }}>What would winning look like?</Text>
                        </View>
                      </PressableScale>
                    )
                  ) : (
                    <View>
                      <ObjectiveCard objective={activeObjective} tasks={activeTasks} minutes={activeMinutes} tone={tone} onPress={() => router.push(`/objective/${activeObjective.id}`)} />
                      <PressableScale
                        onPress={openNewObjective}
                        accessibilityLabel="Plan next goal"
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 4, alignSelf: 'flex-start' }}
                      >
                        <Plus size={18} color={Accent.blue} strokeWidth={2.4} />
                        <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: Accent.blue }}>Plan next goal</Text>
                      </PressableScale>
                    </View>
                  )}
                </>
              ) : null}

              {plannedObjectives.length > 0 && !showObjectiveForm ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: Surface.muted, marginBottom: 8 }}>Next up</Text>
                  {plannedObjectives.map((obj) => (
                    <PressableScale
                      key={obj.id}
                      onPress={() => router.push(`/objective/${obj.id}`)}
                      accessibilityLabel={`Open ${obj.title}`}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Surface.surfaceRaised, borderRadius: Radius.md, padding: 12, marginBottom: 6 }}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: Surface.ink }}>{obj.title}</Text>
                        <Text style={Type.meta}>Due {formatDeadline(obj.deadline)}</Text>
                      </View>
                      <ChevronRight size={18} color={Surface.faint} strokeWidth={2.2} />
                    </PressableScale>
                  ))}
                </View>
              ) : null}

              {!activeObjective && !showObjectiveForm ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, minHeight: 52, paddingHorizontal: 14, borderRadius: Radius.md, backgroundColor: Surface.surface, ...Elevation.card }}>
                  <Text style={{ flex: 1, fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: Surface.ink }}>This pillar runs on habits (no goal needed)</Text>
                  <Switch
                    value={isMaintenance}
                    onValueChange={toggleMaintenance}
                    accessibilityLabel="This pillar runs on habits"
                    trackColor={{ false: Surface.ruleStrong, true: Accent.blue }}
                    thumbColor={Surface.surface}
                    {...({ activeThumbColor: Surface.surface } as object)}
                    ios_backgroundColor={Surface.ruleStrong}
                  />
                </View>
              ) : null}

              {showObjectiveForm && (
                <Animated.View entering={FadeInDown.springify().damping(20)} style={{ marginTop: 6, backgroundColor: Surface.surface, borderRadius: Radius.lg, padding: 16, ...Elevation.card }}>
                  <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 17, color: Surface.ink, marginBottom: 10 }}>{activeObjective ? 'Plan next goal' : 'New goal'}</Text>
                  {activeObjective ? <Text style={[Type.meta, { marginTop: -6, marginBottom: 10 }]}>Saved as Next up while "{activeObjective.title}" is active.</Text> : null}
                  
                  <TextInput
                    placeholder="What will you achieve?"
                    accessibilityLabel="What will you achieve?"
                    placeholderTextColor={Surface.faint}
                    value={objectiveTitle}
                    onChangeText={(t) => setObjectiveTitle(t.slice(0, 60))}
                    maxLength={60}
                    autoFocus
                    style={[sandInputStyle, { height: 58, marginBottom: 12 }]}
                  />

                  <TextInput
                    placeholder="How will you know it's done? (optional)"
                    accessibilityLabel="How will you know it's done?"
                    placeholderTextColor={Surface.faint}
                    value={objectiveDoneWhen}
                    onChangeText={(t) => setObjectiveDoneWhen(t.slice(0, 140))}
                    maxLength={140}
                    multiline
                    textAlignVertical="top"
                    style={[sandInputStyle, { minHeight: 80, paddingTop: 16, paddingBottom: 16, marginBottom: 12 }]}
                  />

                  <FieldLabel>Deadline</FieldLabel>
                  <View style={{ marginBottom: 18 }}>
                    <DeadlinePicker value={objectiveDeadline} onChange={(k) => { setObjectiveDeadline(k); setObjectiveError(''); }} color={tone} />
                  </View>

                  <View style={{ marginBottom: 18 }}>
                    <PressableScale
                      onPress={() => setObjectiveHasMetric(!objectiveHasMetric)}
                      accessibilityLabel="Track a number"
                      accessibilityState={{ checked: objectiveHasMetric }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                    >
                      <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: objectiveHasMetric ? tone : Surface.ruleStrong, backgroundColor: objectiveHasMetric ? tone : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                        {objectiveHasMetric && <Check size={14} color={Surface.surface} strokeWidth={3} />}
                      </View>
                      <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: Surface.ink }}>Track a number</Text>
                    </PressableScale>
                  </View>

                  {objectiveHasMetric && (
                    <Animated.View entering={FadeInDown.duration(200)} style={{ marginBottom: 18 }}>
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                        <TextInput placeholder="Now" placeholderTextColor={Surface.faint} accessibilityLabel="Metric now" value={objectiveMetricCurrent} onChangeText={setObjectiveMetricCurrent} keyboardType="decimal-pad" style={[sandInputStyle, { flex: 1, minWidth: 0, height: 50, fontSize: 17 }]} />
                        <TextInput placeholder="Target" placeholderTextColor={Surface.faint} accessibilityLabel="Metric target" value={objectiveMetricTarget} onChangeText={setObjectiveMetricTarget} keyboardType="decimal-pad" style={[sandInputStyle, { flex: 1, minWidth: 0, height: 50, fontSize: 17 }]} />
                      </View>
                      <TextInput placeholder="Unit (kg, km, €, etc.)" placeholderTextColor={Surface.faint} accessibilityLabel="Metric unit" value={objectiveMetricUnit} onChangeText={(t) => setObjectiveMetricUnit(t.slice(0, 12))} style={[sandInputStyle, { height: 50, fontSize: 17 }]} />
                    </Animated.View>
                  )}

                  {objectiveError ? <Text style={[Type.meta, { color: Accent.amber, fontSize: 14, marginBottom: 10 }]}>{objectiveError}</Text> : null}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton title="Cancel" appearance="ghost" color={Surface.muted} size="small" onPress={resetObjectiveForm} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton
                        title={activeObjective ? 'Add to queue' : 'Set goal'}
                        size="small"
                        disabled={!objectiveTitle.trim() || !objectiveDeadline}
                        onPress={() => void saveObjective()}
                      />
                    </View>
                  </View>
                </Animated.View>
              )}
            </Animated.View>
          )}

          {/* US-068: Habits (was "Actions") */}
          {!editingGoalFields && (
            <Animated.View entering={enter(5)} style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ flex: 1, fontFamily: FontFamily.bodyBold, fontSize: 22, lineHeight: 28, color: Surface.ink }}>Habits</Text>
                {!showActionForm && (
                  <PressableScale
                    onPress={openNewAction}
                    accessibilityLabel="Add habit"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: Surface.ink }}
                  >
                    <Plus size={15} color={Surface.surface} strokeWidth={2.6} />
                    <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: Surface.surface }}>Add</Text>
                  </PressableScale>
                )}
              </View>

              {actions.length === 0 && !showActionForm ? (
                <Text style={[Type.body, { fontSize: 15 }]}>No habits yet. What does {goal.name} get from you each day?</Text>
              ) : null}

              {actions.map((a) => {
                const activeIdx = activeActions.findIndex((x) => x.id === a.id);
                const ActionGlyph = a.type === 'session' ? Timer : CircleCheck;
                return (
                  <Animated.View
                    key={a.id}
                    layout={LinearTransition.springify().damping(20)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      backgroundColor: Surface.surfaceRaised,
                      borderRadius: Radius.md,
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      marginBottom: 8,
                      opacity: a.is_active ? 1 : 0.55,
                    }}
                  >
                    {a.is_active ? (
                      <View style={{ gap: 2 }}>
                        <IconTap onPress={() => void moveAction(activeIdx, -1)} disabled={activeIdx === 0} label={`Move ${a.name} up`}>
                          <ChevronUp size={16} color={Surface.ink} strokeWidth={2.2} />
                        </IconTap>
                        <IconTap onPress={() => void moveAction(activeIdx, 1)} disabled={activeIdx === activeActions.length - 1} label={`Move ${a.name} down`}>
                          <ChevronDown size={16} color={Surface.ink} strokeWidth={2.2} />
                        </IconTap>
                      </View>
                    ) : null}
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: a.is_active ? tone : Surface.ruleStrong, alignItems: 'center', justifyContent: 'center' }}>
                      <ActionGlyph size={16} color={Surface.surface} strokeWidth={2.2} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: Surface.ink }}>{a.name}</Text>
                      <Text style={[Type.meta, { marginTop: 2 }]}>
                        {!a.is_active ? 'Paused · ' : ''}
                        {habitScheduleText(a)}
                      </Text>
                    </View>
                    <IconTap onPress={() => openEditAction(a)} label={`Edit habit ${a.name}`} boxed>
                      <Pencil size={15} color={Surface.ink} strokeWidth={2} />
                    </IconTap>
                    <IconTap onPress={() => void toggleActionActive(a)} label={a.is_active ? `Pause habit ${a.name}` : `Resume habit ${a.name}`} boxed>
                      {a.is_active ? <Pause size={15} color={Surface.ink} strokeWidth={2} /> : <Play size={15} color={Accent.green} strokeWidth={2.2} />}
                    </IconTap>
                  </Animated.View>
                );
              })}

              {/* US-021: inline action form · US-068: habits always timed, goal picker */}
              {showActionForm && (
                <Animated.View entering={FadeInDown.springify().damping(20)} style={{ marginTop: 6, backgroundColor: Surface.surface, borderRadius: Radius.lg, padding: 16, ...Elevation.card }}>
                  <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 17, color: Surface.ink, marginBottom: 10 }}>{editingActionId ? 'Edit habit' : 'New habit'}</Text>
                  <TextInput
                    placeholder="Run, read, call home, etc."
                    accessibilityLabel="Habit name"
                    placeholderTextColor={Surface.faint}
                    value={actionName}
                    onChangeText={setActionName}
                    autoFocus={!editingActionId}
                    style={[sandInputStyle, { height: 58, marginBottom: 18 }]}
                  />

                  <FieldLabel>Duration</FieldLabel>
                  {editingWasCheck ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Accent.blueSoft, borderRadius: Radius.md, padding: 12, marginBottom: 10 }}>
                      <Timer size={16} color={Accent.blue} strokeWidth={2.2} />
                      <Text style={{ flex: 1, fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: Surface.ink }}>Give it 15 min so it counts. Every habit is time you give.</Text>
                    </View>
                  ) : null}
                  <DurationPicker minutes={actionMinutes} color={tone} onChange={setActionMinutes} />

                  {/* US-069: Weekday picker */}
                  <View style={{ marginTop: 18 }}>
                    <FieldLabel>Days</FieldLabel>
                    <WeekdayPicker mask={actionDaysMask} color={tone} onChange={setActionDaysMask} />
                  </View>
                  {/* US-068: Part of goal picker */}
                  {(activeObjective || plannedObjectives.length > 0) && (
                    <View style={{ marginTop: 18 }}>
                      <FieldLabel>Part of goal (optional)</FieldLabel>
                      <View style={{ gap: 6 }}>
                        <PressableScale
                          onPress={() => setActionObjectiveId(null)}
                          accessibilityLabel="Not linked to a goal"
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 10,
                            minHeight: 48,
                            paddingHorizontal: 14,
                            borderRadius: Radius.md,
                            backgroundColor: !actionObjectiveId ? tone : Surface.surfaceRaised,
                            borderWidth: 2,
                            borderColor: !actionObjectiveId ? tone : 'transparent',
                          }}
                        >
                          <Text style={{ flex: 1, fontFamily: FontFamily.bodyBold, fontSize: 15, color: !actionObjectiveId ? Surface.surface : Surface.ink }}>
                            Not linked to a goal
                          </Text>
                          {!actionObjectiveId && <Check size={18} color={Surface.surface} strokeWidth={2.4} />}
                        </PressableScale>
                        {activeObjective && (
                          <PressableScale
                            onPress={() => setActionObjectiveId(activeObjective.id)}
                            accessibilityLabel={`Part of ${activeObjective.title}`}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 10,
                              minHeight: 48,
                              paddingHorizontal: 14,
                              borderRadius: Radius.md,
                              backgroundColor: actionObjectiveId === activeObjective.id ? tone : Surface.surfaceRaised,
                              borderWidth: 2,
                              borderColor: actionObjectiveId === activeObjective.id ? tone : 'transparent',
                            }}
                          >
                            <Text style={{ flex: 1, fontFamily: FontFamily.bodyBold, fontSize: 15, color: actionObjectiveId === activeObjective.id ? Surface.surface : Surface.ink }}>
                              {activeObjective.title}
                            </Text>
                            {actionObjectiveId === activeObjective.id && <Check size={18} color={Surface.surface} strokeWidth={2.4} />}
                          </PressableScale>
                        )}
                        {plannedObjectives.map((obj) => (
                          <PressableScale
                            key={obj.id}
                            onPress={() => setActionObjectiveId(obj.id)}
                            accessibilityLabel={`Part of ${obj.title}`}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 10,
                              minHeight: 48,
                              paddingHorizontal: 14,
                              borderRadius: Radius.md,
                              backgroundColor: actionObjectiveId === obj.id ? tone : Surface.surfaceRaised,
                              borderWidth: 2,
                              borderColor: actionObjectiveId === obj.id ? tone : 'transparent',
                            }}
                          >
                            <Text style={{ flex: 1, fontFamily: FontFamily.bodyBold, fontSize: 15, color: actionObjectiveId === obj.id ? Surface.surface : Surface.ink }}>
                              {obj.title}
                            </Text>
                            {actionObjectiveId === obj.id && <Check size={18} color={Surface.surface} strokeWidth={2.4} />}
                          </PressableScale>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* US-069: Start time (was "Daily reminder") */}
                  <View style={{ marginTop: 18 }}>
                    <FieldLabel>Start time</FieldLabel>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                      <PressableScale
                        onPress={() => {
                          hapticLight();
                          setActionReminderEnabled(false);
                        }}
                        accessibilityLabel="Anytime"
                        style={{
                          flex: 1,
                          height: 48,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: Radius.md,
                          backgroundColor: !actionReminderEnabled ? tone : Surface.surfaceRaised,
                          borderWidth: 2,
                          borderColor: !actionReminderEnabled ? tone : 'transparent',
                        }}
                      >
                        <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: !actionReminderEnabled ? Surface.surface : Surface.ink }}>
                          Anytime
                        </Text>
                      </PressableScale>
                      <View style={{ flex: 1, gap: 6 }}>
                        <PressableScale
                          onPress={() => {
                            hapticLight();
                            setActionReminderEnabled(true);
                          }}
                          accessibilityLabel="Set a start time"
                          style={{
                            height: 48,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: Radius.md,
                            backgroundColor: actionReminderEnabled ? tone : Surface.surfaceRaised,
                            borderWidth: 2,
                            borderColor: actionReminderEnabled ? tone : 'transparent',
                          }}
                        >
                          <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: actionReminderEnabled ? Surface.surface : Surface.ink }}>
                            {actionReminderEnabled && parseReminderTime(actionReminderTime) ? actionReminderTime : 'Set time'}
                          </Text>
                        </PressableScale>
                      </View>
                    </View>
                    {actionReminderEnabled && (
                      <Animated.View entering={FadeInDown.duration(200)} style={{ marginTop: 10 }}>
                        <TextInput
                          value={actionReminderTime}
                          onChangeText={setActionReminderTime}
                          accessibilityLabel="Start time"
                          placeholder="08:00"
                          placeholderTextColor={Surface.faint}
                          keyboardType="numbers-and-punctuation"
                          maxLength={5}
                          style={{
                            width: '100%',
                            height: 48,
                            textAlign: 'center',
                            fontFamily: FontFamily.bodyBold,
                            fontSize: 18,
                            color: Surface.ink,
                            borderRadius: Radius.md,
                            backgroundColor: Surface.surfaceRaised,
                            borderWidth: 2,
                            borderColor: parseReminderTime(actionReminderTime) ? Accent.blue : Accent.amber,
                          }}
                        />
                        <Text style={[Type.meta, { marginTop: 8, textAlign: 'center', color: Surface.muted }]}>
                          {parseReminderTime(actionReminderTime) ? `Notification at ${actionReminderTime} on scheduled days` : 'Enter time in HH:MM format'}
                        </Text>
                      </Animated.View>
                    )}
                  </View>

                  {/* US-077: strict mode, on by default */}
                  {blockingAvailable && (
                    <View style={{ marginTop: 18, paddingHorizontal: 14, paddingVertical: 12, borderRadius: Radius.md, backgroundColor: Surface.surfaceRaised }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 32 }}>
                        <Text style={{ flex: 1, fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: Surface.ink }}>Block apps automatically</Text>
                        <Switch
                          value={actionStrict}
                          onValueChange={(v) => {
                            hapticLight();
                            setActionStrict(v);
                          }}
                          accessibilityLabel="Block apps automatically"
                          trackColor={{ false: Surface.ruleStrong, true: Accent.blue }}
                          thumbColor={Surface.surface}
                          ios_backgroundColor={Surface.ruleStrong}
                        />
                      </View>
                      <Text style={[Type.meta, { marginTop: 6, color: Surface.muted }]}>
                        {!actionStrict
                          ? 'You get a notification only.'
                          : actionReminderEnabled && parseReminderTime(actionReminderTime)
                            ? `Your chosen apps are blocked from ${actionReminderTime} for ${clampHabitMinutes(actionMinutes)} min.`
                            : 'Set a start time to block apps when it comes.'}
                      </Text>
                    </View>
                  )}


                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton title="Cancel" appearance="ghost" color={Surface.muted} size="small" onPress={resetActionForm} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton title={editingActionId ? 'Save' : 'Add habit'} size="small" disabled={!actionName.trim()} onPress={() => void saveAction()} />
                    </View>
                  </View>
                </Animated.View>
              )}
            </Animated.View>
          )}

          {/* Links */}
          {!editingGoalFields && !showActionForm && (
            <Animated.View entering={enter(6)} style={{ gap: 10 }}>
              <LinkRow Icon={History} label="Session history" onPress={() => router.push(`/session-history?goalId=${encodeURIComponent(goal.id)}`)} />
              <LinkRow Icon={ImageIcon} label="Make a lock-screen wallpaper" color={tone} onPress={() => setShowWallpaper(true)} />
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Wallpaper sheet (US-038) */}
      <GoalWallpaperSheet goal={goal} tone={tone} visible={showWallpaper} onClose={() => setShowWallpaper(false)} />
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

function StatTile({
  Icon,
  label,
  value,
  format,
  unit,
  iconColor,
}: {
  Icon: LucideIcon;
  label: string;
  value: number;
  format: (n: number) => string;
  unit: string;
  iconColor: string;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: Surface.surfaceRaised, borderRadius: Radius.md, paddingVertical: 14, paddingHorizontal: 12 }}>
      <Icon size={18} color={iconColor} strokeWidth={2.2} />
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 8 }}>
        <AnimatedNumber value={value} format={format} style={{ fontFamily: FontFamily.bodyBold, fontSize: 30, lineHeight: 34, letterSpacing: -0.5, color: Surface.ink, fontVariant: ['tabular-nums'] }} />
        <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: Surface.muted, marginLeft: 1 }}>{unit}</Text>
      </View>
      <Text numberOfLines={1} style={[Type.meta, { marginTop: 2 }]}>{label}</Text>
    </View>
  );
}

function LinkRow({ Icon, label, onPress, color = Surface.ink }: { Icon: LucideIcon; label: string; onPress: () => void; color?: string }) {
  return (
    <PressableScale
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 58, paddingHorizontal: 16, borderRadius: Radius.md, backgroundColor: Surface.surface, ...Elevation.card }}
    >
      <Icon size={20} color={color} strokeWidth={2} />
      <Text style={{ flex: 1, fontFamily: FontFamily.bodyBold, fontSize: 16, color: Surface.ink }}>{label}</Text>
      <ChevronRight size={18} color={Surface.faint} strokeWidth={2.2} />
    </PressableScale>
  );
}

/** US-060: the pillar's active goal at a glance — title, done-when, progress, days left, pace, hours given. */
function ObjectiveCard({ objective, tasks, minutes, tone, onPress }: { objective: Objective; tasks: Task[]; minutes: number; tone: string; onPress: () => void }) {
  const now = new Date();
  const progress = goalProgress.progressOf(objective, tasks);
  const days = goalProgress.daysLeft(objective, now);
  const pace = goalProgress.paceOf(objective, tasks, now);
  const paceWord = pace === 'ahead' ? 'Ahead' : pace === 'on_track' ? 'On track' : pace === 'behind' ? 'Behind' : null;
  const paceColor = pace === 'ahead' ? Accent.green : pace === 'behind' ? Accent.amber : Surface.ink;
  const daysText = days < 0 ? 'Deadline passed · set a new date' : days === 0 ? 'Due today' : `${days} day${days === 1 ? '' : 's'} left`;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`Open goal ${objective.title}`}
      style={{ backgroundColor: Surface.surface, borderRadius: Radius.lg, padding: 16, ...Elevation.card }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <Target size={18} color={tone} strokeWidth={2.2} style={{ marginTop: 3 }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 18, lineHeight: 23, color: Surface.ink }}>{objective.title}</Text>
          {objective.done_when.trim() ? (
            <Text numberOfLines={2} style={[Type.body, { fontSize: 14, lineHeight: 19, marginTop: 2 }]}>Done when: {objective.done_when}</Text>
          ) : null}
        </View>
        <ChevronRight size={18} color={Surface.faint} strokeWidth={2.2} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
        <View style={{ flex: 1 }}>
          <ProgressBar progress={progress ?? 0} color={tone} trackColor={Surface.rule} height={6} />
        </View>
        <Text style={[Type.number, { color: Surface.ink }]}>{progress !== null ? `${Math.round(progress * 100)}%` : '—'}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 12, rowGap: 4, marginTop: 8 }}>
        <Text style={[Type.meta, { color: days < 0 ? Accent.amber : Surface.ink }]}>{daysText}</Text>
        {paceWord ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <TrendingUp size={13} color={paceColor} strokeWidth={2.2} />
            <Text style={[Type.meta, { color: paceColor }]}>{paceWord}</Text>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Clock size={13} color={Surface.muted} strokeWidth={2} />
          <Text style={Type.meta}>{formatHours(minutes)} given</Text>
        </View>
      </View>
      <Text style={[Type.meta, { color: Surface.faint, marginTop: 4 }]}>Due {formatDeadline(objective.deadline)}</Text>
    </PressableScale>
  );
}
