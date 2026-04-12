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
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as api from '@/db/api';
import type { DailyAction, MetaGoal, ActionType } from '@/types';
import { Colors, Surface, ghostBorder, goalBorderColor } from '@/constants/design';
import { shadows } from '@/styles/shadows';
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

function StatCard({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <View className="flex-1 rounded-xl p-4" style={[shadows.card, { backgroundColor: Surface.container }]}>
      <Text className="text-title2 font-bold" style={{ color: color ?? Colors.textPrimary }}>{value}</Text>
      <Text className="text-caption text-text-tertiary uppercase tracking-wider mt-1">{label}</Text>
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
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  if (!id || !goal) {
    return (
      <SafeAreaView className="flex-1 bg-bg-primary items-center justify-center px-6">
        <Stack.Screen options={{ headerShown: false }} />
        <Text className="text-body text-text-secondary text-center">
          {!id ? 'Missing goal.' : 'Goal not found or archived.'}
        </Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-footnote font-semibold" style={{ color: Colors.accentBlue }}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const tone = getGoalColor(goal.id);
  const tint = getGoalTint(goal.id);
  const activeActions = actions.filter((a) => a.is_active);

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 32 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="flex-row items-center gap-3 mb-5">
            <Pressable onPress={() => { if (editingGoalFields) setEditingGoalFields(false); else router.back(); }} hitSlop={12}>
              <Ionicons name="chevron-back" size={24} color={Colors.textSecondary} />
            </Pressable>
            <View className="flex-1" />
            <Pressable
              onPress={() => setEditingGoalFields((v) => !v)}
              hitSlop={8}
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: editingGoalFields ? tone + '22' : Surface.high }}
            >
              <Ionicons name={editingGoalFields ? 'checkmark' : 'create-outline'} size={15} color={editingGoalFields ? tone : Colors.textSecondary} />
              <Text className="text-footnote font-semibold" style={{ color: editingGoalFields ? tone : Colors.textSecondary }}>
                {editingGoalFields ? 'Done editing' : 'Edit goal'}
              </Text>
            </Pressable>
          </View>

          {/* ── Goal identity (US-012) ──────────────────────────────── */}
          {editingGoalFields ? (
            <View className="rounded-xl p-4 mb-5" style={[shadows.card, { backgroundColor: Surface.container, borderWidth: 1, borderColor: editColor + '44' }]}>
              <Text className="text-caption uppercase tracking-wider text-text-tertiary mb-3">Edit goal</Text>

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
              <Text className="text-caption uppercase tracking-wider text-text-tertiary mb-2">Color</Text>
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
              <Text className="text-caption uppercase tracking-wider text-text-tertiary mb-2">Your why</Text>
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
              <Text className="text-caption text-text-tertiary text-right mt-1">{editWhy.length} / 140</Text>

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
              <View className="flex-row items-center gap-3 mb-5">
                <View className="w-12 h-12 rounded-full items-center justify-center" style={{ backgroundColor: tone + '22' }}>
                  <Text style={{ fontSize: 24 }}>{goal.icon}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-title2 font-bold text-text-primary">{goal.name}</Text>
                  <View className="flex-row items-center gap-1.5 mt-0.5">
                    <View className="w-2 h-2 rounded-full" style={{ backgroundColor: tone }} />
                    <Text className="text-caption text-text-tertiary">{activeActions.length} active action{activeActions.length !== 1 ? 's' : ''}</Text>
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
              <Text className="text-caption uppercase tracking-wider text-text-tertiary mb-2">Why</Text>
              <View className="rounded-xl p-4" style={[shadows.card, { backgroundColor: Surface.container }]}>
                <Text className="text-body leading-6" style={{ color: goal.why_statement?.trim() ? Colors.textPrimary : Colors.textLabel }}>
                  {goal.why_statement?.trim() || 'No why statement yet — tap Edit goal to add one.'}
                </Text>
              </View>
            </View>
          )}

          {/* ── Actions list (US-013 reorder + US-021 edit) ─────────── */}
          {!editingGoalFields && (
            <View className="mb-5">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-caption uppercase tracking-wider text-text-tertiary">Actions</Text>
                <Pressable onPress={openNewAction} hitSlop={8} className="flex-row items-center gap-1">
                  <Ionicons name="add" size={16} color={tone} />
                  <Text className="text-caption font-semibold" style={{ color: tone }}>Add action</Text>
                </Pressable>
              </View>

              {actions.length === 0 ? (
                <Text className="text-footnote text-text-secondary mb-2">No actions yet.</Text>
              ) : null}

              {actions.map((a) => {
                const activeIdx = activeActions.findIndex((x) => x.id === a.id);
                return (
                  <View
                    key={a.id}
                    className="flex-row items-center rounded-xl p-3 mb-2"
                    style={[shadows.card, { backgroundColor: Surface.container, opacity: a.is_active ? 1 : 0.6 }]}
                  >
                    {/* Reorder arrows (active only) */}
                    {a.is_active ? (
                      <View className="gap-0.5 mr-2">
                        <Pressable
                          onPress={() => void moveAction(activeIdx, -1)}
                          disabled={activeIdx === 0}
                          className="w-6 h-6 rounded items-center justify-center"
                          style={{ opacity: activeIdx === 0 ? 0.2 : 1 }}
                        >
                          <Ionicons name="chevron-up" size={14} color={Colors.textSecondary} />
                        </Pressable>
                        <Pressable
                          onPress={() => void moveAction(activeIdx, 1)}
                          disabled={activeIdx === activeActions.length - 1}
                          className="w-6 h-6 rounded items-center justify-center"
                          style={{ opacity: activeIdx === activeActions.length - 1 ? 0.2 : 1 }}
                        >
                          <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} />
                        </Pressable>
                      </View>
                    ) : (
                      <View className="w-1 self-stretch rounded-full mr-3" style={{ backgroundColor: Colors.textMuted }} />
                    )}

                    {/* Color accent bar */}
                    {a.is_active && <View className="w-1 self-stretch rounded-full mr-2" style={{ backgroundColor: tone }} />}

                    <View className="flex-1">
                      <Text className="text-headline font-semibold text-text-primary">{a.name}</Text>
                      <Text className="text-caption text-text-secondary mt-0.5">
                        {a.type === 'session' ? `Session · ${a.target_minutes}m` : 'Habit'}
                        {!a.is_active ? ' · Paused' : ''}
                        {a.reminder_time ? ` · ⏰ ${a.reminder_time}` : ''}
                      </Text>
                    </View>

                    {/* Edit button */}
                    <Pressable
                      onPress={() => openEditAction(a)}
                      className="w-8 h-8 rounded-md items-center justify-center ml-2"
                      style={{ backgroundColor: Surface.high, borderWidth: 0.5, borderColor: ghostBorder }}
                    >
                      <Ionicons name="create-outline" size={15} color={Colors.textSecondary} />
                    </Pressable>

                    {/* Active toggle */}
                    <Pressable
                      onPress={() => void toggleActionActive(a)}
                      className="w-8 h-8 rounded-md items-center justify-center ml-1"
                      style={{ backgroundColor: Surface.high, borderWidth: 0.5, borderColor: ghostBorder }}
                    >
                      <Ionicons
                        name={a.is_active ? 'pause-outline' : 'play-outline'}
                        size={15}
                        color={a.is_active ? Colors.accentDanger : Colors.accentSuccess}
                      />
                    </Pressable>
                  </View>
                );
              })}

              {/* ── US-021: inline action form ──────────────────────── */}
              {showActionForm && (
                <View className="rounded-xl p-4 mt-2" style={[shadows.card, { backgroundColor: Surface.high, borderWidth: 1, borderColor: tone + '33' }]}>
                  <Text className="text-footnote font-bold text-text-primary mb-3">
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
                            backgroundColor: sel ? Surface.container : 'transparent',
                          }}
                        >
                          <Text className="text-caption font-semibold capitalize" style={{ color: sel ? tone : Colors.textSecondary }}>
                            {t}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Duration */}
                  {actionType === 'session' && (
                    <View className="flex-row items-center gap-3 mb-3">
                      <Text className="text-caption text-text-secondary">Target</Text>
                      <TextInput
                        className="text-body font-semibold text-text-primary text-center"
                        style={{ width: 56, borderBottomWidth: 1, borderBottomColor: Colors.textDim, paddingVertical: 4 }}
                        keyboardType="number-pad"
                        value={String(actionMinutes)}
                        onChangeText={(t) => setActionMinutes(Math.max(1, Number(t.replace(/\D/g, '') || '0')))}
                      />
                      <Text className="text-caption text-text-secondary">min</Text>
                    </View>
                  )}

                  {/* Reminder */}
                  <View className="flex-row items-center justify-between mb-4 rounded-lg px-3 py-2.5" style={{ backgroundColor: Surface.container }}>
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="alarm-outline" size={15} color={Colors.textSecondary} />
                      <Text className="text-caption text-text-primary">Daily reminder</Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      {actionReminderEnabled && (
                        <TextInput
                          value={actionReminderTime}
                          onChangeText={setActionReminderTime}
                          placeholder="08:00"
                          placeholderTextColor={Colors.textLabel}
                          keyboardType="numbers-and-punctuation"
                          maxLength={5}
                          className="text-caption font-semibold text-text-primary text-center"
                          style={{ width: 52, borderBottomWidth: 1, borderBottomColor: parseReminderTime(actionReminderTime) ? Colors.textPrimary : Colors.accentDanger }}
                        />
                      )}
                      <Pressable
                        onPress={() => setActionReminderEnabled((v) => !v)}
                        style={{ width: 36, height: 20, borderRadius: 10, backgroundColor: actionReminderEnabled ? Colors.accentSuccess : 'rgba(255,255,255,0.15)', justifyContent: 'center', paddingHorizontal: 2 }}
                      >
                        <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff', transform: [{ translateX: actionReminderEnabled ? 17 : 1 }] }} />
                      </Pressable>
                    </View>
                  </View>

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
              )}
            </View>
          )}

          {/* ── Quick links ─────────────────────────────────────────── */}
          {!editingGoalFields && !showActionForm && (
            <Pressable
              onPress={() => router.push(`/session-history?goalId=${encodeURIComponent(goal.id)}`)}
              className="flex-row items-center justify-between py-3 px-4 rounded-xl mb-3"
              style={[shadows.card, { backgroundColor: Surface.container }]}
            >
              <View className="flex-row items-center gap-2">
                <Ionicons name="time-outline" size={20} color={Colors.textSecondary} />
                <Text className="text-subheadline font-semibold text-text-primary">Session history</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </Pressable>
          )}

          {/* Wallpaper generator (US-038) */}
          {!editingGoalFields && !showActionForm && (
            <Pressable
              onPress={() => setShowWallpaper(true)}
              className="flex-row items-center justify-between py-3 px-4 rounded-xl mt-1"
              style={[shadows.card, { backgroundColor: tint, borderWidth: 0.5, borderColor: tone + '33' }]}
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
