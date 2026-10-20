/**
 * Goal Detail screen — US-012, US-013, US-021, US-059
 *
 * US-012: Inline name / color / why editing (saves immediately on blur / toggle).
 * US-013: Shows both current streak and best streak; actions reorderable inline.
 * US-021: Action edit form embedded directly on this screen.
 * US-059: Set a goal (objective) for a pillar with deadline and optional metric.
 */
import { useCallback, useState, useRef, type ReactNode } from 'react';
import { View, Text, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform, ActionSheetIOS, Switch, Pressable } from 'react-native';
import { Stack, useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import {
  Archive,
  Bell,
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
  Timer,
  Trophy,
  type LucideIcon,
} from 'lucide-react-native';
import { hapticWarning, hapticLight } from '@/utils/haptics';
import * as api from '@/db/api';
import type { DailyAction, MetaGoal, ActionType, Objective, ObjectiveStatus } from '@/types';
import { Accent, Elevation, FontFamily, Radius, Surface, Type } from '@/constants/design';
import { getGoalColor } from '@/utils/goalColors';
import { PrimaryButton } from '@/components/PrimaryButton';
import { AnimatedNumber, PressableScale, enter } from '@/components/ui/motion';
import { PillarIcon } from '@/components/ui/PillarIcon';
import { ColorPicker, DurationPicker, FieldLabel, IconPicker, IconTap, Segmented, sandInputStyle } from '@/components/ui/PillarForm';
import { CTA } from '@/components/onboarding/parts';
import { Mascot, type MascotMood } from '@/components/onboarding/Mascot';
import { scheduleActionReminder, cancelActionReminder, syncActionReminder, parseReminderTime } from '@/services/notifications';
import { GoalWallpaperSheet } from '@/components/GoalWallpaperSheet';

function formatReminderPreview(goalName: string, actionName: string): string {
  const pillar = goalName.trim() || 'This pillar';
  const action = actionName.trim();
  return action ? `${pillar} is waiting. Start ${action}?` : `${pillar} is waiting. Start your next session?`;
}

export default function GoalDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [goal, setGoal] = useState<MetaGoal | null>(null);
  const [actions, setActions] = useState<DailyAction[]>([]);
  const [lifetimeSec, setLifetimeSec] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);

  // US-059: objectives
  const [activeObjective, setActiveObjective] = useState<Objective | null>(null);
  const [plannedObjectives, setPlannedObjectives] = useState<Objective[]>([]);

  // US-012: inline edit fields
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editWhy, setEditWhy] = useState('');
  const [editingGoalFields, setEditingGoalFields] = useState(false);

  // US-038: wallpaper sheet
  const [showWallpaper, setShowWallpaper] = useState(false);

  // US-021: action composer
  const [showActionForm, setShowActionForm] = useState(false);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [actionName, setActionName] = useState('');
  const [actionType, setActionType] = useState<ActionType>('session');
  const [actionMinutes, setActionMinutes] = useState(60);
  const [actionReminderEnabled, setActionReminderEnabled] = useState(false);
  const [actionReminderTime, setActionReminderTime] = useState('08:00');

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
    const all = await api.getObjectives(g.id);
    const planned = all.filter((o) => o.status === 'planned');
    setPlannedObjectives(planned);

    // seed edit fields
    setEditName(g.name);
    setEditColor(g.color);
    setEditIcon(g.icon);
    setEditWhy(g.why_statement ?? '');
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  // ── Bonus C: archive from Goal Detail ────────────────────────────────────
  const confirmArchive = () => {
    const doArchive = async () => {
      hapticWarning();
      actions.forEach((a) => void cancelActionReminder(a.id));
      await api.archiveGoal(goal!.id);
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
      Alert.alert(
        'Keep the history.',
        `Archiving ${goal?.name} removes it from active planning. Every hour you gave it stays in your history.`,
        [
          { text: 'Keep active', style: 'cancel' },
          { text: `Archive ${goal?.name}`, style: 'destructive', onPress: () => void doArchive() },
        ]
      );
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

  // ── US-021: action form helpers ──────────────────────────────────────────
  const resetActionForm = () => {
    setShowActionForm(false);
    setEditingActionId(null);
    setActionName('');
    setActionType('session');
    setActionMinutes(60);
    setActionReminderEnabled(false);
    setActionReminderTime('08:00');
  };

  const openNewAction = () => {
    resetActionForm();
    setShowActionForm(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
  };

  const openEditAction = (a: DailyAction) => {
    setEditingActionId(a.id);
    setActionName(a.name);
    setActionType(a.type);
    setActionMinutes(a.target_minutes || 60);
    setActionReminderEnabled(!!a.reminder_time);
    setActionReminderTime(a.reminder_time || '08:00');
    setShowActionForm(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
  };

  const saveAction = async () => {
    if (!goal || !actionName.trim()) return;
    const reminderTime =
      actionReminderEnabled && parseReminderTime(actionReminderTime)
        ? actionReminderTime.trim()
        : null;

    if (editingActionId) {
      await api.updateAction(editingActionId, {
        name: actionName.trim(),
        type: actionType,
        target_minutes: actionType === 'session' ? Math.max(1, actionMinutes) : 60,
        reminder_time: reminderTime,
      });
      const updatedAction: DailyAction = {
        id: editingActionId, goal_id: goal.id, name: actionName.trim(),
        type: actionType, target_minutes: actionType === 'session' ? Math.max(1, actionMinutes) : 60,
        reminder_time: reminderTime, is_active: 1, sort_order: 0,
        objective_id: null, days_mask: 127,
      };
      if (reminderTime) void scheduleActionReminder(updatedAction, goal.name);
      else void cancelActionReminder(editingActionId);
    } else {
      const newAction = await api.addAction({
        goal_id: goal.id, name: actionName.trim(), type: actionType,
        target_minutes: actionType === 'session' ? Math.max(1, actionMinutes) : 60,
        reminder_time: reminderTime, is_active: 1, sort_order: actions.length,
        objective_id: null, days_mask: 127,
      });
      if (reminderTime) void scheduleActionReminder(newAction, goal.name);
    }
    resetActionForm();
    void load();
  };

  const toggleActionActive = async (a: DailyAction) => {
    const next = a.is_active ? 0 : 1;
    await api.updateAction(a.id, { is_active: next });
    // Pausing cancels the reminder; resuming must bring it back.
    if (goal) void syncActionReminder({ ...a, is_active: next }, goal.name);
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
    setShowObjectiveForm(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
  };

  const saveObjective = async () => {
    if (!goal || !objectiveTitle.trim() || !objectiveDeadline) return;

    const status: ObjectiveStatus = activeObjective ? 'planned' : 'active';
    const metric_current = objectiveHasMetric && objectiveMetricCurrent ? parseFloat(objectiveMetricCurrent) : null;
    const metric_target = objectiveHasMetric && objectiveMetricTarget ? parseFloat(objectiveMetricTarget) : null;
    const metric_unit = objectiveHasMetric && objectiveMetricUnit.trim() ? objectiveMetricUnit.trim() : null;

    try {
      await api.addObjective({
        pillar_id: goal.id,
        title: objectiveTitle.trim().slice(0, 60),
        done_when: objectiveDoneWhen.trim().slice(0, 140),
        deadline: objectiveDeadline,
        status,
        metric_current,
        metric_target,
        metric_unit,
        sort_order: plannedObjectives.length,
      });
      resetObjectiveForm();
      void load();
    } catch (err) {
      if (err instanceof api.ActiveObjectiveExistsError) {
        Alert.alert('Active goal exists', 'This pillar already has an active goal. The new goal will be saved as "Next up".');
      } else if (err instanceof Error) {
        Alert.alert('Error', err.message);
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
                  <Text numberOfLines={2} style={{ fontFamily: FontFamily.bodyBold, fontSize: 34, lineHeight: 40, letterSpacing: -0.5, color: '#FFFFFF', marginTop: 14 }}>
                    {goal.name}
                  </Text>
                  <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
                    {activeActions.length} active action{activeActions.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={{ width: 104, height: 120, borderRadius: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' }}>
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

          {/* US-059: Goals (Objectives) */}
          {!editingGoalFields && (
            <Animated.View entering={enter(4)} style={{ marginBottom: 24 }}>
              {!showObjectiveForm ? (
                <>
                  {!activeObjective ? (
                    <PressableScale
                      onPress={openNewObjective}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Accent.blueSoft, borderRadius: Radius.lg, padding: 16 }}
                    >
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Accent.blue, alignItems: 'center', justifyContent: 'center' }}>
                        <Plus size={16} color={Surface.surface} strokeWidth={2.4} />
                      </View>
                      <Text style={{ flex: 1, fontFamily: FontFamily.bodyBold, fontSize: 16, color: Accent.blue }}>Set a goal</Text>
                      <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: Accent.blue }}>What will you achieve?</Text>
                    </PressableScale>
                  ) : (
                    <View>
                      <PressableScale
                        onPress={() => router.push(`/objective/${activeObjective.id}`)}
                        style={{ backgroundColor: Surface.surface, borderRadius: Radius.lg, padding: 16, ...Elevation.card, marginBottom: 12 }}
                      >
                        <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 17, color: Surface.ink, marginBottom: 8 }}>{activeObjective.title}</Text>
                        <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: Surface.muted }}>
                          Due {new Date(activeObjective.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                          <ChevronRight size={16} color={Accent.blue} strokeWidth={2.2} />
                          <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: Accent.blue }}>View details</Text>
                        </View>
                      </PressableScale>
                      <PressableScale
                        onPress={openNewObjective}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12 }}
                      >
                        <Plus size={18} color={Accent.blue} strokeWidth={2.4} />
                        <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: Accent.blue }}>Plan next goal</Text>
                      </PressableScale>
                    </View>
                  )}
                </>
              ) : null}

              {plannedObjectives.length > 0 && !showObjectiveForm ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: Surface.muted, marginBottom: 8 }}>Next up</Text>
                  {plannedObjectives.map((obj) => (
                    <View key={obj.id} style={{ backgroundColor: Surface.surfaceRaised, borderRadius: Radius.md, padding: 12, marginBottom: 6 }}>
                      <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: Surface.ink }}>{obj.title}</Text>
                      <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: Surface.muted }}>
                        Due {new Date(obj.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {showObjectiveForm && (
                <Animated.View entering={FadeInDown.springify().damping(20)} style={{ marginTop: 6, backgroundColor: Surface.surface, borderRadius: Radius.lg, padding: 16, ...Elevation.card }}>
                  <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 17, color: Surface.ink, marginBottom: 10 }}>New goal</Text>
                  
                  <TextInput
                    placeholder="What will you achieve?"
                    placeholderTextColor={Surface.faint}
                    value={objectiveTitle}
                    onChangeText={(t) => setObjectiveTitle(t.slice(0, 60))}
                    maxLength={60}
                    autoFocus
                    style={[sandInputStyle, { height: 58, marginBottom: 12 }]}
                  />

                  <TextInput
                    placeholder="How will you know it's done? (optional)"
                    placeholderTextColor={Surface.faint}
                    value={objectiveDoneWhen}
                    onChangeText={(t) => setObjectiveDoneWhen(t.slice(0, 140))}
                    maxLength={140}
                    multiline
                    textAlignVertical="top"
                    style={[sandInputStyle, { minHeight: 80, paddingTop: 16, paddingBottom: 16, marginBottom: 12 }]}
                  />

                  <FieldLabel>Deadline</FieldLabel>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                    {[
                      { label: '30 days', days: 30 },
                      { label: '90 days', days: 90 },
                      { label: '6 months', days: 180 },
                    ].map((preset) => {
                      const date = new Date();
                      date.setDate(date.getDate() + preset.days);
                      const isoDate = date.toISOString().split('T')[0]!;
                      const selected = objectiveDeadline === isoDate;
                      return (
                        <PressableScale
                          key={preset.label}
                          onPress={() => setObjectiveDeadline(isoDate)}
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: Radius.md,
                            backgroundColor: selected ? tone : Surface.surfaceRaised,
                            borderWidth: selected ? 0 : 1,
                            borderColor: Surface.rule,
                          }}
                        >
                          <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: selected ? Surface.surface : Surface.ink }}>
                            {preset.label}
                          </Text>
                        </PressableScale>
                      );
                    })}
                  </View>

                  <View style={{ marginBottom: 18 }}>
                    <Pressable
                      onPress={() => setObjectiveHasMetric(!objectiveHasMetric)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                    >
                      <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: objectiveHasMetric ? tone : Surface.ruleStrong, backgroundColor: objectiveHasMetric ? tone : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                        {objectiveHasMetric && <Check size={14} color={Surface.surface} strokeWidth={3} />}
                      </View>
                      <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: Surface.ink }}>Track a number</Text>
                    </Pressable>
                  </View>

                  {objectiveHasMetric && (
                    <Animated.View entering={FadeInDown.duration(200)} style={{ marginBottom: 18 }}>
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                        <View style={{ flex: 1 }}>
                          <TextInput
                            placeholder="Start"
                            placeholderTextColor={Surface.faint}
                            value={objectiveMetricCurrent}
                            onChangeText={setObjectiveMetricCurrent}
                            keyboardType="numeric"
                            style={[sandInputStyle, { height: 50 }]}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <TextInput
                            placeholder="Target"
                            placeholderTextColor={Surface.faint}
                            value={objectiveMetricTarget}
                            onChangeText={setObjectiveMetricTarget}
                            keyboardType="numeric"
                            style={[sandInputStyle, { height: 50 }]}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <TextInput
                            placeholder="Unit (e.g. kg)"
                            placeholderTextColor={Surface.faint}
                            value={objectiveMetricUnit}
                            onChangeText={setObjectiveMetricUnit}
                            style={[sandInputStyle, { height: 50 }]}
                          />
                        </View>
                      </View>
                    </Animated.View>
                  )}

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

          {/* Actions */}
          {!editingGoalFields && (
            <Animated.View entering={enter(5)} style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ flex: 1, fontFamily: FontFamily.bodyBold, fontSize: 22, lineHeight: 28, color: Surface.ink }}>Daily actions</Text>
                {!showActionForm && (
                  <PressableScale
                    onPress={openNewAction}
                    accessibilityLabel="Add action"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: Surface.ink }}
                  >
                    <Plus size={15} color={Surface.surface} strokeWidth={2.6} />
                    <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: Surface.surface }}>Add</Text>
                  </PressableScale>
                )}
              </View>

              {actions.length === 0 && !showActionForm ? (
                <Text style={[Type.body, { fontSize: 15 }]}>No actions yet. What does {goal.name} get from you each day?</Text>
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
                        <IconTap onPress={() => void moveAction(activeIdx, -1)} disabled={activeIdx === 0} label="Move up">
                          <ChevronUp size={16} color={Surface.ink} strokeWidth={2.2} />
                        </IconTap>
                        <IconTap onPress={() => void moveAction(activeIdx, 1)} disabled={activeIdx === activeActions.length - 1} label="Move down">
                          <ChevronDown size={16} color={Surface.ink} strokeWidth={2.2} />
                        </IconTap>
                      </View>
                    ) : null}
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: a.is_active ? tone : Surface.ruleStrong, alignItems: 'center', justifyContent: 'center' }}>
                      <ActionGlyph size={16} color="#FFFFFF" strokeWidth={2.2} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: Surface.ink }}>{a.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                        <Text style={Type.meta}>
                          {!a.is_active ? 'Paused · ' : ''}
                          {a.type === 'session' ? `${a.target_minutes} min a day` : 'Daily habit'}
                        </Text>
                        {a.reminder_time ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Bell size={12} color={Surface.muted} strokeWidth={2} />
                            <Text style={Type.meta}>{a.reminder_time}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <IconTap onPress={() => openEditAction(a)} label="Edit action" boxed>
                      <Pencil size={15} color={Surface.ink} strokeWidth={2} />
                    </IconTap>
                    <IconTap onPress={() => void toggleActionActive(a)} label={a.is_active ? 'Pause action' : 'Resume action'} boxed>
                      {a.is_active ? <Pause size={15} color={Surface.ink} strokeWidth={2} /> : <Play size={15} color={Accent.green} strokeWidth={2.2} />}
                    </IconTap>
                  </Animated.View>
                );
              })}

              {/* US-021: inline action form */}
              {showActionForm && (
                <Animated.View entering={FadeInDown.springify().damping(20)} style={{ marginTop: 6, backgroundColor: Surface.surface, borderRadius: Radius.lg, padding: 16, ...Elevation.card }}>
                  <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 17, color: Surface.ink, marginBottom: 10 }}>{editingActionId ? 'Edit action' : 'New action'}</Text>
                  <TextInput
                    placeholder="e.g. Morning training"
                    placeholderTextColor={Surface.faint}
                    value={actionName}
                    onChangeText={setActionName}
                    autoFocus={!editingActionId}
                    style={[sandInputStyle, { height: 58, marginBottom: 18 }]}
                  />

                  <FieldLabel>How do you track it?</FieldLabel>
                  <Segmented
                    value={actionType}
                    color={tone}
                    options={[
                      { value: 'session', label: 'Timed session', hint: 'Focus timer, logs minutes', Icon: Timer },
                      { value: 'habit', label: 'Daily habit', hint: 'Just check it off', Icon: CircleCheck },
                    ]}
                    onChange={(v) => setActionType(v as ActionType)}
                  />

                  {actionType === 'session' && (
                    <View style={{ marginTop: 18 }}>
                      <FieldLabel>Daily target</FieldLabel>
                      <DurationPicker minutes={actionMinutes} color={tone} onChange={setActionMinutes} />
                    </View>
                  )}

                  <View style={{ marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 14, borderRadius: Radius.md, backgroundColor: Surface.surfaceRaised }}>
                    <Bell size={18} color={Surface.ink} strokeWidth={2} />
                    <Text style={{ flex: 1, fontFamily: FontFamily.bodyBold, fontSize: 16, color: Surface.ink }}>Daily reminder</Text>
                    <Switch
                      value={actionReminderEnabled}
                      onValueChange={setActionReminderEnabled}
                      trackColor={{ false: Surface.ruleStrong, true: Accent.blue }}
                      thumbColor={Surface.surface}
                      {...({ activeThumbColor: Surface.surface } as object)}
                      ios_backgroundColor={Surface.ruleStrong}
                    />
                  </View>
                  {actionReminderEnabled && (
                    <Animated.View entering={FadeInDown.duration(200)} style={{ marginTop: 10, marginLeft: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={[Type.body, { fontSize: 15 }]}>Every day at</Text>
                        <TextInput
                          value={actionReminderTime}
                          onChangeText={setActionReminderTime}
                          placeholder="08:00"
                          placeholderTextColor={Surface.faint}
                          keyboardType="numbers-and-punctuation"
                          maxLength={5}
                          style={{
                            width: 82,
                            height: 40,
                            textAlign: 'center',
                            fontFamily: FontFamily.bodyBold,
                            fontSize: 16,
                            color: Surface.ink,
                            borderRadius: 20,
                            backgroundColor: Surface.surfaceRaised,
                            borderWidth: 2,
                            borderColor: parseReminderTime(actionReminderTime) ? 'transparent' : Accent.red,
                          }}
                        />
                      </View>
                      <Text style={[Type.meta, { marginTop: 10, color: Accent.blue }]}>“{formatReminderPreview(goal.name, actionName)}”</Text>
                    </Animated.View>
                  )}

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton title="Cancel" appearance="ghost" color={Surface.muted} size="small" onPress={resetActionForm} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton title={editingActionId ? 'Save' : 'Add action'} size="small" disabled={!actionName.trim()} onPress={() => void saveAction()} />
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
