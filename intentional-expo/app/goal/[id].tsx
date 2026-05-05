/**
 * Goal Detail screen — US-012, US-013, US-021
 *
 * US-012: Inline name / color / why editing (saves immediately on blur / toggle).
 * US-013: Shows both current streak and best streak; actions reorderable inline.
 * US-021: Action edit form embedded directly on this screen.
 */
import { useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { hapticWarning, hapticLight } from '@/utils/haptics';
import * as api from '@/db/api';
import type { DailyAction, MetaGoal, ActionType } from '@/types';
import { Colors, FontFamily, Radius, Surface, ghostBorder, goalBorderColor } from '@/constants/design';
import { getGoalColor, getGoalTint } from '@/utils/goalColors';
import { PrimaryButton } from '@/components/PrimaryButton';
import { EditorialTextInput } from '@/components/EditorialTextInput';
import { scheduleActionReminder, cancelActionReminder, parseReminderTime } from '@/services/notifications';
import { GoalWallpaperSheet } from '@/components/GoalWallpaperSheet';

/** US-012: color palette — same swatches as Goals editor */
const GOAL_COLOR_OPTIONS = [
  { color: Colors.goalPhysique, icon: '🏃' },
  { color: Colors.goalFinances, icon: '💰' },
  { color: Colors.goalSkills, icon: '📚' },
  { color: Colors.goalMind, icon: '🧠' },
];

function formatHours(seconds: number): string {
  const h = seconds / 3600;
  if (h < 0.05 && seconds > 0) return '<0.1h';
  return `${h.toFixed(1)}h`;
}

function formatReminderPreview(goalName: string, actionName: string): string {
  const pillar = goalName.trim() || 'This pillar';
  const action = actionName.trim();
  return action ? `${pillar} is waiting. Start ${action}?` : `${pillar} is waiting. Start your next session?`;
}

function StatCard({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <View className="flex-1 p-4" style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.lg }}>
      <Text style={{ color: color ?? Colors.textPrimary, fontFamily: FontFamily.display, fontSize: 34, lineHeight: 36 }}>{value}</Text>
      <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoMedium, fontSize: 10, letterSpacing: 0.8, marginTop: 2, textTransform: 'uppercase' }}>{label}</Text>
    </View>
  );
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

  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const g = await api.getGoalById(id);
    setGoal(g);
    if (!g) { setActions([]); return; }
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
      await api.archiveGoal(goal!.id);
      router.back();
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: `Archive "${goal?.name}"?`,
          message: 'It will disappear from Today and Goals. All history is kept.',
          options: ['Cancel', 'Archive goal'],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 0,
        },
        (idx) => { if (idx === 1) void doArchive(); }
      );
    } else {
      Alert.alert(
        `Archive "${goal?.name}"?`,
        'It will disappear from Today and Goals. All history is kept.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Archive', style: 'destructive', onPress: () => void doArchive() },
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
        target_minutes: actionType === 'session' ? actionMinutes : 60,
        reminder_time: reminderTime,
      });
      const updatedAction: DailyAction = {
        id: editingActionId, goal_id: goal.id, name: actionName.trim(),
        type: actionType, target_minutes: actionType === 'session' ? actionMinutes : 60,
        reminder_time: reminderTime, is_active: 1, sort_order: 0,
      };
      if (reminderTime) void scheduleActionReminder(updatedAction, goal.name);
      else void cancelActionReminder(editingActionId);
    } else {
      const newAction = await api.addAction({
        goal_id: goal.id, name: actionName.trim(), type: actionType,
        target_minutes: actionType === 'session' ? actionMinutes : 60,
        reminder_time: reminderTime, is_active: 1, sort_order: actions.length,
      });
      if (reminderTime) void scheduleActionReminder(newAction, goal.name);
    }
    resetActionForm();
    void load();
  };

  const toggleActionActive = async (a: DailyAction) => {
    await api.updateAction(a.id, { is_active: a.is_active ? 0 : 1 });
    if (a.is_active) void cancelActionReminder(a.id);
    void load();
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
      <SafeAreaView className="flex-1 bg-canvas items-center justify-center px-6">
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 17, textAlign: 'center' }}>
          {!id ? 'Missing goal.' : 'Goal not found or archived.'}
        </Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.monoSemiBold, fontSize: 11, textTransform: 'uppercase' }}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const tone = getGoalColor(goal.id);
  const tint = getGoalTint(goal.id);
  const activeActions = actions.filter((a) => a.is_active);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
      >
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 44 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
          {/* Header */}
          <View className="flex-row items-center gap-2 mb-6">
            <Pressable onPress={() => { if (editingGoalFields) setEditingGoalFields(false); else router.back(); }} hitSlop={12}>
              <Ionicons name="chevron-back" size={24} color={Colors.textSecondary} />
            </Pressable>
            <View className="flex-1" />
            {/* Bonus C: archive button */}
            {!editingGoalFields && (
              <Pressable
                onPress={confirmArchive}
                hitSlop={8}
                className="flex-row items-center gap-1 px-3 py-2"
                style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.full }}
              >
                <Ionicons name="archive-outline" size={14} color={Colors.textSecondary} />
                <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.monoSemiBold, fontSize: 11, textTransform: 'uppercase' }}>Archive</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => setEditingGoalFields((v) => !v)}
              hitSlop={8}
              className="flex-row items-center gap-1.5 px-3 py-2"
              style={{ backgroundColor: editingGoalFields ? tone + '22' : Surface.surface, borderWidth: 1, borderColor: editingGoalFields ? goalBorderColor(tone) : Surface.rule, borderRadius: Radius.full }}
            >
              <Ionicons name={editingGoalFields ? 'checkmark' : 'create-outline'} size={15} color={editingGoalFields ? tone : Colors.textSecondary} />
              <Text style={{ color: editingGoalFields ? tone : Colors.textSecondary, fontFamily: FontFamily.monoSemiBold, fontSize: 11, textTransform: 'uppercase' }}>
                {editingGoalFields ? 'Done' : 'Edit'}
              </Text>
            </Pressable>
          </View>

          {/* ── Goal identity (US-012) ──────────────────────────────── */}
          {editingGoalFields ? (
            <View className="p-4 mb-5" style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: editColor + '44', borderRadius: Radius.lg }}>
              <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' }}>Edit pillar</Text>

              {/* Name + icon row */}
              <View className="flex-row items-center gap-3 mb-4">
                <View className="w-11 h-11 rounded-full items-center justify-center" style={{ backgroundColor: editColor + '22', borderWidth: 0.5, borderColor: goalBorderColor(editColor) }}>
                  <TextInput
                    className="text-[22px] text-center"
                    value={editIcon}
                    onChangeText={(t) => setEditIcon(t.slice(-2) || '⭐')}
                    maxLength={2}
                  />
                </View>
                <EditorialTextInput
                  variant="underline"
                  className="flex-1"
                  placeholder="Goal name"
                  value={editName}
                  onChangeText={(t) => setEditName(t.slice(0, 30))}
                  maxLength={30}
                  style={{ fontSize: 20, fontWeight: '700' }}
                />
              </View>

              {/* Color picker */}
              <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>Color</Text>
              <View className="flex-row gap-3 mb-4">
                {GOAL_COLOR_OPTIONS.map((opt) => {
                  const sel = editColor === opt.color;
                  return (
                    <Pressable
                      key={opt.color}
                      onPress={() => setEditColor(opt.color)}
                      className="w-9 h-9 rounded-full items-center justify-center"
                      style={{
                        backgroundColor: opt.color,
                        borderWidth: sel ? 2 : 0.5,
                        borderColor: sel ? Colors.textPrimary : ghostBorder,
                        transform: [{ scale: sel ? 1.08 : 1 }],
                      }}
                    />
                  );
                })}
              </View>

              {/* Why */}
              <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>Your why</Text>
              <EditorialTextInput
                variant="contained"
                placeholder="Why does this goal matter?"
                value={editWhy}
                onChangeText={(t) => setEditWhy(t.slice(0, 140))}
                multiline
                maxLength={140}
                textAlignVertical="top"
                className="min-h-[80px]"
              />
              <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoMedium, fontSize: 11, textAlign: 'right', marginTop: 4 }}>{editWhy.length} / 140</Text>

              <PrimaryButton
                title="Save changes"
                onPress={saveGoalEdits}
                disabled={!editName.trim()}
                style={{ marginTop: 12 }}
              />
            </View>
          ) : (
            <>
              {/* Goal chip display */}
              <View className="flex-row items-start gap-3 mb-6">
                <View className="w-14 h-14 items-center justify-center" style={{ backgroundColor: tone + '22', borderWidth: 1, borderColor: goalBorderColor(tone), borderRadius: Radius.md }}>
                  <Text style={{ fontSize: 24 }}>{goal.icon}</Text>
                </View>
                <View className="flex-1">
                  <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
                    Pillar
                  </Text>
                  <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.display, fontSize: 44, lineHeight: 46, marginTop: 2 }}>
                    {goal.name}
                  </Text>
                  <View className="flex-row items-center gap-1.5 mt-0.5">
                    <View className="w-2 h-2 rounded-full" style={{ backgroundColor: tone }} />
                    <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 15 }}>{activeActions.length} active action{activeActions.length !== 1 ? 's' : ''}</Text>
                  </View>
                </View>
              </View>
            </>
          )}

          {/* ── Stats row (US-013 adds current streak) ─────────────── */}
          {!editingGoalFields && (
            <View className="flex-row gap-2 mb-5">
              <StatCard value={formatHours(lifetimeSec)} label="Lifetime focus" />
              <StatCard value={`${currentStreak}d`} label="Current streak" color={currentStreak > 0 ? tone : undefined} />
              <StatCard value={`${bestStreak}d`} label="Best streak" />
            </View>
          )}

          {/* ── Why statement display ───────────────────────────────── */}
          {!editingGoalFields && (
            <View className="mb-5">
              <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>Why</Text>
              <View className="p-4" style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.lg }}>
                <Text style={{ color: goal.why_statement?.trim() ? Colors.textPrimary : Colors.textLabel, fontFamily: FontFamily.body, fontSize: 17, lineHeight: 24 }}>
                  {goal.why_statement?.trim() || 'No why statement yet — tap Edit goal to add one.'}
                </Text>
              </View>
            </View>
          )}

          {/* ── Actions list (US-013 reorder + US-021 edit) ─────────── */}
          {!editingGoalFields && (
            <View className="mb-5"><View className="flex-row items-center justify-between mb-2">
                <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>Actions</Text>
                <Pressable onPress={openNewAction} hitSlop={8} className="flex-row items-center gap-1"><Ionicons name="add" size={16} color={tone} /><Text style={{ color: tone, fontFamily: FontFamily.monoSemiBold, fontSize: 11, textTransform: 'uppercase' }}>Add action</Text></Pressable>
              </View>{actions.length === 0 ? (
                <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 15, marginBottom: 8 }}>No actions yet.</Text>
              ) : null}{actions.map((a) => {
                const activeIdx = activeActions.findIndex((x) => x.id === a.id);
                return (
                  <View
                    key={a.id}
                    className="flex-row items-center p-3 mb-2"
                    style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.md, opacity: a.is_active ? 1 : 0.6 }}
                  >{[
                      a.is_active ? (
                        <View key={`${a.id}-reorder`} className="gap-0.5 mr-2">{[
                          <Pressable
                            key={`${a.id}-up`}
                            onPress={() => void moveAction(activeIdx, -1)}
                            disabled={activeIdx === 0}
                            className="w-6 h-6 rounded items-center justify-center"
                            style={{ opacity: activeIdx === 0 ? 0.2 : 1 }}
                          ><Ionicons name="chevron-up" size={14} color={Colors.textSecondary} /></Pressable>,
                          <Pressable
                            key={`${a.id}-down`}
                            onPress={() => void moveAction(activeIdx, 1)}
                            disabled={activeIdx === activeActions.length - 1}
                            className="w-6 h-6 rounded items-center justify-center"
                            style={{ opacity: activeIdx === activeActions.length - 1 ? 0.2 : 1 }}
                          ><Ionicons name="chevron-down" size={14} color={Colors.textSecondary} /></Pressable>,
                        ]}</View>
                      ) : (
                        <View key={`${a.id}-reorder-spacer`} className="w-1 self-stretch rounded-full mr-3" style={{ backgroundColor: Colors.textMuted }} />
                      ),
                      a.is_active ? (
                        <View key={`${a.id}-accent`} className="w-1 self-stretch rounded-full mr-2" style={{ backgroundColor: tone }} />
                      ) : null,
                      <View key={`${a.id}-body`} className="flex-1">{[
                        <Text key={`${a.id}-title`} style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 17, lineHeight: 22 }}>
                          {a.name}
                        </Text>,
                        <Text key={`${a.id}-meta`} style={{ color: Colors.textSecondary, fontFamily: FontFamily.monoMedium, fontSize: 10, letterSpacing: 0.6, marginTop: 2, textTransform: 'uppercase' }}>
                          {a.type === 'session' ? `Session · ${a.target_minutes}m` : 'Habit'}
                          {!a.is_active ? ' · Paused' : ''}
                          {a.reminder_time ? ` · ${a.reminder_time}` : ''}
                        </Text>,
                      ]}</View>,
                      <Pressable
                        key={`${a.id}-edit`}
                        onPress={() => openEditAction(a)}
                        className="w-9 h-9 items-center justify-center ml-2"
                        style={{ backgroundColor: Surface.surfaceRaised, borderWidth: 1, borderColor: ghostBorder, borderRadius: Radius.sm }}
                      ><Ionicons name="create-outline" size={15} color={Colors.textSecondary} /></Pressable>,
                      <Pressable
                        key={`${a.id}-toggle`}
                        onPress={() => void toggleActionActive(a)}
                        className="w-9 h-9 items-center justify-center ml-1"
                        style={{ backgroundColor: Surface.surfaceRaised, borderWidth: 1, borderColor: ghostBorder, borderRadius: Radius.sm }}
                      ><Ionicons name={a.is_active ? 'pause-outline' : 'play-outline'} size={15} color={a.is_active ? Colors.accentDanger : Colors.accentSuccess} /></Pressable>,
                    ]}</View>
                );
              })}{/* US-021: inline action form */}{showActionForm && (
                <View className="p-4 mt-2" style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: tone + '33', borderRadius: Radius.lg }}>
                  <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 17, marginBottom: 12 }}>
                    {editingActionId ? 'Edit action' : 'New action'}
                  </Text>

                  <EditorialTextInput
                    variant="underline"
                    className="mb-3"
                    placeholder="Action name"
                    value={actionName}
                    onChangeText={setActionName}
                    style={{ fontSize: 17, fontWeight: '700' }}
                  />

                  {/* Type toggle */}
                  <View className="flex-row gap-2 mb-3">
                    {(['session', 'habit'] as const).map((t) => {
                      const sel = actionType === t;
                      return (
                        <Pressable
                          key={t}
                          onPress={() => setActionType(t)}
                          className="flex-1 h-9 rounded-md items-center justify-center"
                          style={{
                            borderWidth: 0.5,
                            borderColor: sel ? goalBorderColor(tone) : ghostBorder,
                            backgroundColor: sel ? Surface.surfaceRaised : 'transparent',
                          }}
                        ><Text className="text-caption font-semibold capitalize" style={{ color: sel ? tone : Colors.textSecondary }}>{t}</Text></Pressable>
                      );
                    })}
                  </View>

                  {/* Duration */}
                  {actionType === 'session' && (
                    <View className="flex-row items-center gap-3 mb-3"><Text className="text-caption text-text-secondary">Target</Text><TextInput
                        className="text-body font-semibold text-text-primary text-center"
                        style={{ width: 56, borderBottomWidth: 1, borderBottomColor: Colors.textDim, paddingVertical: 4 }}
                        keyboardType="number-pad"
                        value={String(actionMinutes)}
                        onChangeText={(t) => setActionMinutes(Math.max(1, Number(t.replace(/\D/g, '') || '0')))}
                      /><Text className="text-caption text-text-secondary">min</Text></View>
                  )}

                  <View className="mb-4 p-4" style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.lg }}>
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2">
                        <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tone }} />
                        <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 17 }}>
                          Reminder
                        </Text>
                      </View>
                      <Text style={{ color: actionReminderEnabled ? tone : Colors.textMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, textTransform: 'uppercase' }}>
                        {actionReminderEnabled ? 'On' : 'Off'}
                      </Text>
                    </View>

                    {actionReminderEnabled ? (
                      <View className="mt-4 flex-row items-center justify-between">
                        <TextInput
                          value={actionReminderTime}
                          onChangeText={setActionReminderTime}
                          placeholder="08:00"
                          placeholderTextColor={Colors.textGhost}
                          keyboardType="numbers-and-punctuation"
                          maxLength={5}
                          style={{
                            width: 108,
                            color: parseReminderTime(actionReminderTime) ? Colors.textPrimary : Colors.accentDanger,
                            fontFamily: FontFamily.bodyBold,
                            fontSize: 28,
                            lineHeight: 34,
                            paddingVertical: 0,
                          }}
                        />
                        <Pressable
                          onPress={() => setActionReminderEnabled(false)}
                          className="px-4 py-2"
                          style={{ borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.full }}
                        >
                          <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                            Turn off
                          </Text>
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => setActionReminderEnabled(true)}
                        className="mt-4 items-center py-3"
                        style={{ borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.full }}
                      >
                        <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                          Add reminder time
                        </Text>
                      </Pressable>
                    )}

                    <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 15, lineHeight: 21, marginTop: 12 }}>
                      {actionReminderEnabled
                        ? 'Notification opens a pre-selected focus session for this action.'
                        : 'This action stays available on Today. You can start it manually whenever the day needs it.'}
                    </Text>
                  </View>

                  {actionReminderEnabled ? (
                    <View className="mb-4 p-4" style={{ backgroundColor: Surface.surfaceRaised, borderRadius: Radius.lg }}>
                      <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 10, letterSpacing: 0.8, marginBottom: 8, textTransform: 'uppercase' }}>
                        Preview copy
                      </Text>
                      <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.body, fontSize: 16, lineHeight: 22 }}>
                        {formatReminderPreview(goal.name, actionName)}
                      </Text>
                    </View>
                  ) : null}

                  {/* Buttons */}
                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <PrimaryButton title="Cancel" variant="ghost" color={Colors.accentDanger} size="small" onPress={resetActionForm} />
                    </View>
                    <View className="flex-1">
                      <PrimaryButton
                        title={editingActionId ? 'Save' : 'Add action'}
                        appearance="goalOutline"
                        color={tone}
                        size="small"
                        disabled={!actionName.trim()}
                        onPress={() => void saveAction()}
                      />
                    </View>
                  </View>
                </View>
              )}</View>
          )}

          {/* ── Quick links ─────────────────────────────────────────── */}
          {!editingGoalFields && !showActionForm && (
            <Pressable
              onPress={() => router.push(`/session-history?goalId=${encodeURIComponent(goal.id)}`)}
              className="flex-row items-center justify-between py-3 px-4 mb-3"
              style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.lg }}
            >
              <View className="flex-row items-center gap-2">
                <Ionicons name="time-outline" size={20} color={Colors.textSecondary} />
                <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 16 }}>Session history</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </Pressable>
          )}

          {/* Wallpaper generator (US-038) */}
          {!editingGoalFields && !showActionForm && (
            <Pressable
              onPress={() => setShowWallpaper(true)}
              className="flex-row items-center justify-between py-3 px-4 mt-1"
              style={{ backgroundColor: tint, borderWidth: 1, borderColor: tone + '33', borderRadius: Radius.lg }}
            >
              <View className="flex-row items-center gap-2">
                <Ionicons name="image-outline" size={20} color={tone} />
                <Text className="text-subheadline font-semibold" style={{ color: tone }}>Create goal wallpaper</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={tone + 'aa'} />
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Wallpaper sheet (US-038) */}
      <GoalWallpaperSheet
        goal={goal}
        tone={tone}
        visible={showWallpaper}
        onClose={() => setShowWallpaper(false)}
      />
    </SafeAreaView>
  );
}
