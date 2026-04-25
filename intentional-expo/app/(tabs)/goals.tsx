import { useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, ScrollView, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { scheduleActionReminder, cancelActionReminder, parseReminderTime, formatReminderTime } from '@/services/notifications';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { Swipeable, TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { EditorialTextInput } from '@/components/EditorialTextInput';
import { Colors, FontFamily, Radius, Surface, ghostBorder, goalBorderColor } from '@/constants/design';
import { useGoals } from '@/db/hooks';
import * as api from '@/db/api';
import type { MetaGoal, DailyAction, ActionType } from '@/types';
import { getGoalColor } from '@/utils/goalColors';

const GOAL_PRESETS = [
  { color: Colors.goalPhysique, icon: '🏃' },
  { color: Colors.goalFinances, icon: '💰' },
  { color: Colors.goalSkills, icon: '📚' },
  { color: Colors.goalMind, icon: '🧠' },
];

export default function GoalsScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const params = useLocalSearchParams<{ create?: string | string[]; editGoal?: string | string[] }>();
  const { goals, refresh } = useGoals();
  const [editingGoal, setEditingGoal] = useState<MetaGoal | null>(null);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [showActionComposer, setShowActionComposer] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(Colors.goalPhysique);
  const [icon, setIcon] = useState('⭐');
  const [why, setWhy] = useState('');
  const [actions, setActions] = useState<DailyAction[]>([]);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [actionName, setActionName] = useState('');
  const [actionType, setActionType] = useState<ActionType>('session');
  const [actionMinutes, setActionMinutes] = useState(60);
  const [actionMinutesFocused, setActionMinutesFocused] = useState(false);
  const [actionFeedback, setActionFeedback] = useState('');
  /** US-020: reminder time "HH:MM" or empty string */
  const [actionReminderEnabled, setActionReminderEnabled] = useState(false);
  const [actionReminderTime, setActionReminderTime] = useState('08:00');
  /** US-010: Expo Go–safe reorder (no react-native-draggable-flatlist / worklets mismatch) */
  const [reorderMode, setReorderMode] = useState(false);

  const resetGoalForm = () => {
    setEditingGoal(null);
    setShowGoalForm(false);
    setShowActionComposer(false);
    setName('');
    setColor(Colors.goalPhysique);
    setIcon('⭐');
    setWhy('');
    setActions([]);
    resetActionForm();
  };

  const resetActionForm = () => {
    setEditingActionId(null);
    setShowActionComposer(false);
    setActionName('');
    setActionType('session');
    setActionMinutes(60);
    setActionMinutesFocused(false);
    setActionFeedback('');
    setActionReminderEnabled(false);
    setActionReminderTime('08:00');
  };

  const loadActions = async (goalId: string) => {
    const rows = await api.getActionsByGoal(goalId, true);
    setActions(rows);
  };

  const saveGoal = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (editingGoal) {
      await api.updateGoal(editingGoal.id, { name: trimmed, color, icon, why_statement: why.slice(0, 140) });
      await loadActions(editingGoal.id);
    } else {
      /** US-009: new goal may have zero actions — close sheet after save */
      await api.addGoal({
        name: trimmed,
        color,
        icon,
        sort_order: goals.length,
        why_statement: why.slice(0, 140),
        is_archived: 0,
      });
      await refresh();
      resetGoalForm();
      return;
    }
    await refresh();
  };

  const openEdit = (g: MetaGoal) => {
    setShowGoalForm(true);
    setEditingGoal(g);
    setName(g.name);
    setColor(g.color);
    setIcon(g.icon);
    setWhy(g.why_statement || '');
    void loadActions(g.id);
    setShowActionComposer(false);
    resetActionForm();
  };
  const openEditRef = useRef(openEdit);
  openEditRef.current = openEdit;

  const goGoalDetail = (g: MetaGoal) => {
    router.push(`/goal/${g.id}`);
  };

  const openCreate = useCallback(() => {
    setShowGoalForm(true);
    setEditingGoal(null);
    setName('');
    setColor(Colors.goalPhysique);
    setIcon('⭐');
    setWhy('');
    setActions([]);
    setShowActionComposer(false);
    setEditingActionId(null);
    setActionName('');
    setActionType('session');
    setActionMinutes(60);
    setActionFeedback('');
  }, []);

  const ensureGoalSaved = async (): Promise<MetaGoal | null> => {
    const trimmed = name.trim();
    if (!trimmed) return null;

    if (editingGoal) {
      await api.updateGoal(editingGoal.id, { name: trimmed, color, icon, why_statement: why.slice(0, 140) });
      return editingGoal;
    }

    const created = await api.addGoal({
      name: trimmed,
      color,
      icon,
      sort_order: goals.length,
      why_statement: why.slice(0, 140),
      is_archived: 0,
    });
    setEditingGoal(created);
    await refresh();
    return created;
  };

  const saveAction = async () => {
    const trimmed = actionName.trim();
    if (!trimmed) return;
    const currentGoal = await ensureGoalSaved();
    if (!currentGoal) return;
    const wasEditing = !!editingActionId;

    const resolvedReminderTime =
      actionReminderEnabled && parseReminderTime(actionReminderTime)
        ? actionReminderTime.trim()
        : null;

    if (editingActionId) {
      await api.updateAction(editingActionId, {
        name: trimmed,
        type: actionType,
        target_minutes: actionType === 'session' ? actionMinutes : 60,
        reminder_time: resolvedReminderTime,
      });
      const updatedAction: import('@/types').DailyAction = {
        id: editingActionId,
        goal_id: currentGoal.id,
        name: trimmed,
        type: actionType,
        target_minutes: actionType === 'session' ? actionMinutes : 60,
        reminder_time: resolvedReminderTime,
        is_active: 1,
        sort_order: 0,
      };
      if (resolvedReminderTime) {
        void scheduleActionReminder(updatedAction, currentGoal.name);
      } else {
        void cancelActionReminder(editingActionId);
      }
    } else {
      const newAction = await api.addAction({
        goal_id: currentGoal.id,
        name: trimmed,
        type: actionType,
        target_minutes: actionType === 'session' ? actionMinutes : 60,
        reminder_time: resolvedReminderTime,
        is_active: 1,
        sort_order: actions.length,
      });
      if (resolvedReminderTime) {
        void scheduleActionReminder(newAction, currentGoal.name);
      }
    }
    await loadActions(currentGoal.id);
    setEditingActionId(null);
    setActionName('');
    setActionType('session');
    setActionMinutes(60);
    setActionReminderEnabled(false);
    setActionReminderTime('08:00');
    setActionFeedback(wasEditing ? `Updated "${trimmed}".` : `Added "${trimmed}".`);
    setShowActionComposer(true);
    await refresh();
  };

  const doneWithGoalSetup = async () => {
    const saved = await ensureGoalSaved();
    if (!saved) return;
    await loadActions(saved.id);
    await refresh();
    resetGoalForm();
  };

  const startEditAction = (a: DailyAction) => {
    setEditingActionId(a.id);
    setActionName(a.name);
    setActionType(a.type);
    setActionMinutes(a.target_minutes || 60);
    setActionReminderEnabled(!!a.reminder_time);
    setActionReminderTime(a.reminder_time || '08:00');
    setShowActionComposer(true);
  };

  const startCreateAction = () => {
    setEditingActionId(null);
    setActionName('');
    setActionType('session');
    setActionMinutes(60);
    setShowActionComposer(true);
  };

  const moveAction = async (index: number, delta: -1 | 1) => {
    if (!editingGoal) return;
    const active = actions.filter((a) => a.is_active);
    const j = index + delta;
    if (j < 0 || j >= active.length) return;
    const next = [...active];
    [next[index], next[j]] = [next[j], next[index]];
    await api.reorderActions(editingGoal.id, next.map((a) => a.id));
    await loadActions(editingGoal.id);
    hapticLight();
  };

  const removeAction = async (id: string) => {
    if (!editingGoal) return;
    await api.deleteAction(id);
    await loadActions(editingGoal.id);
    if (editingActionId === id) resetActionForm();
    await refresh();
  };

  const archiveGoal = async () => {
    if (!editingGoal) return;
    await api.archiveGoal(editingGoal.id);
    resetGoalForm();
    await refresh();
  };

  const confirmArchiveGoal = useCallback(
    (g: MetaGoal) => {
      const editingId = editingGoal?.id;
      Alert.alert(
        'Archive Goal',
        `Archive "${g.name}"? History is kept; it will hide from Today and Goals.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Archive',
            style: 'destructive',
            onPress: async () => {
              await api.archiveGoal(g.id);
              await refresh();
              if (editingId === g.id) resetGoalForm();
            },
          },
        ]
      );
    },
    [editingGoal?.id, refresh]
  );

  const moveGoal = useCallback(
    async (index: number, delta: -1 | 1) => {
      const j = index + delta;
      if (j < 0 || j >= goals.length) return;
      const next = [...goals];
      [next[index], next[j]] = [next[j], next[index]];
      await api.reorderGoals(next.map((g) => g.id));
      await refresh();
      hapticLight();
    },
    [goals, refresh]
  );

  const enterReorderMode = useCallback(() => {
    setReorderMode(true);
    hapticMedium();
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: reorderMode ? 'Reorder pillars' : 'Goals',
      headerRight: () =>
        reorderMode ? (
          <Pressable onPress={() => setReorderMode(false)} hitSlop={10} className="mr-2 py-1 px-2">
            <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 16 }}>Done</Text>
          </Pressable>
        ) : (
          <Pressable onPress={openCreate} hitSlop={10} className="mr-1 p-1">
            <Ionicons name="add" size={26} color={Colors.textPrimary} />
          </Pressable>
        ),
    });
  }, [navigation, reorderMode, openCreate]);

  /** US-009: deep link from Today FAB / Focus empty state — open create sheet in one step */
  useFocusEffect(
    useCallback(() => {
      const raw = params.create;
      const wantsCreate = raw === '1' || (Array.isArray(raw) && raw[0] === '1');
      if (!wantsCreate) return;
      const t = setTimeout(() => {
        openCreate();
        router.setParams({ create: undefined });
      }, 0);
      return () => clearTimeout(t);
    }, [params.create, openCreate, router])
  );

  /** Goal Detail → Edit goal & actions */
  useFocusEffect(
    useCallback(() => {
      const raw = params.editGoal;
      if (raw == null || raw === '') return;
      const editId = Array.isArray(raw) ? raw[0] : raw;
      const decoded = decodeURIComponent(editId);
      const g = goals.find((x) => x.id === decoded);
      if (!g) return;
      openEditRef.current(g);
      router.setParams({ editGoal: undefined });
    }, [params.editGoal, goals, router])
  );

  const listHeader = (
    <View className="mb-6">
      <View className="flex-row items-start justify-between mb-6">
        <View className="flex-1 pr-4">
          <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase' }}>
            Pillars
          </Text>
          <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.display, fontSize: 44, lineHeight: 46, marginTop: 4 }}>
            What days answer to.
          </Text>
        </View>
        <Pressable
          onPress={openCreate}
          className="px-4 h-10 items-center justify-center"
          style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.ruleStrong, borderRadius: Radius.full }}
        >
          <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
            Add
          </Text>
        </Pressable>
      </View>
      <Pressable
        onPress={() => router.push('/session-history')}
        className="flex-row items-center justify-between py-3 px-4 mb-4"
        style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.lg }}
      >
        <View className="flex-row items-center gap-2">
          <Ionicons name="time-outline" size={20} color={Colors.textSecondary} />
          <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 16 }}>Session history</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
      </Pressable>
      {goals.length > 0 ? (
        <>
          <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase' }}>
            Active pillars
          </Text>
          {reorderMode ? (
            <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 14, marginTop: 4 }}>
              Reorder mode. Use arrows, then tap Done.
            </Text>
          ) : (
            <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 14, marginTop: 4 }}>
              Long press a pillar to reorder. Archive keeps history.
            </Text>
          )}
        </>
      ) : null}
    </View>
  );

  const listFooter = (
    <>
      <AddGoalCard onPress={openCreate} />
      {goals.length === 0 ? (
        <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 17, lineHeight: 24, textAlign: 'center', paddingHorizontal: 24, paddingTop: 16 }}>
          Start with one pillar. Add the rest after Today has something real to serve.
        </Text>
      ) : null}
    </>
  );

  const goalList = (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 132 }}
      showsVerticalScrollIndicator={false}
    >
      {listHeader}
      {goals.map((g, index) => (
        <View key={g.id} className="flex-row items-stretch mb-2 gap-1">
          {reorderMode ? (
            <View className="justify-center gap-1 pr-1">
              <Pressable
                onPress={() => void moveGoal(index, -1)}
                disabled={index === 0}
                className="w-9 h-9 items-center justify-center"
                style={{
                  opacity: index === 0 ? 0.35 : 1,
                  backgroundColor: Surface.surface,
                  borderWidth: 1,
                  borderColor: ghostBorder,
                  borderRadius: Radius.sm,
                }}
              >
                <Ionicons name="chevron-up" size={18} color={Colors.textPrimary} />
              </Pressable>
              <Pressable
                onPress={() => void moveGoal(index, 1)}
                disabled={index === goals.length - 1}
                className="w-9 h-9 items-center justify-center"
                style={{
                  opacity: index === goals.length - 1 ? 0.35 : 1,
                  backgroundColor: Surface.surface,
                  borderWidth: 1,
                  borderColor: ghostBorder,
                  borderRadius: Radius.sm,
                }}
              >
                <Ionicons name="chevron-down" size={18} color={Colors.textPrimary} />
              </Pressable>
            </View>
          ) : null}

          <View className="flex-1 min-w-0">
            {Platform.OS === 'web' ? (
              <Pressable
                onPress={reorderMode ? undefined : () => goGoalDetail(g)}
                onLongPress={reorderMode ? undefined : enterReorderMode}
                delayLongPress={320}
              >
                <GoalCard goal={g} />
              </Pressable>
            ) : reorderMode ? (
              <TouchableOpacity activeOpacity={0.92} onPress={() => goGoalDetail(g)} delayLongPress={320}>
                <GoalCard goal={g} />
              </TouchableOpacity>
            ) : (
              <Swipeable
                friction={2}
                overshootRight={false}
                renderRightActions={() => (
                  <View className="justify-center mb-2 pl-2">
                    <Pressable
                      onPress={() => confirmArchiveGoal(g)}
                      className="h-[112px] w-[88px] items-center justify-center bg-accent-danger"
                      style={{ borderRadius: Radius.md }}
                    >
                      <Text style={{ color: Surface.surface, fontFamily: FontFamily.monoSemiBold, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>
                        Archive
                      </Text>
                    </Pressable>
                  </View>
                )}
              >
                <TouchableOpacity
                  activeOpacity={0.92}
                  onPress={() => goGoalDetail(g)}
                  onLongPress={enterReorderMode}
                  delayLongPress={320}
                >
                  <GoalCard goal={g} />
                </TouchableOpacity>
              </Swipeable>
            )}
          </View>

          {Platform.OS === 'web' ? (
            <Pressable
              onPress={() => confirmArchiveGoal(g)}
              className="w-14 items-center justify-center self-stretch"
              style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.md }}
            >
              <Text style={{ color: Colors.accentDanger, fontFamily: FontFamily.monoSemiBold, fontSize: 9, textAlign: 'center', textTransform: 'uppercase' }}>Archive</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      {listFooter}
    </ScrollView>
  );

  return (
    <View className="flex-1 bg-canvas">
      {goalList}

      {showGoalForm && (
        <View className="absolute inset-0 bg-black/35 z-50">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 justify-end"
          >
            <View
              style={{
                maxHeight: '90%',
                backgroundColor: Surface.canvas,
                borderTopLeftRadius: Radius.xl,
                borderTopRightRadius: Radius.xl,
                borderWidth: 1,
                borderColor: Surface.rule,
              }}
            >
              <View className="pt-2 pb-3 items-center">
                <View className="w-9 h-1 rounded-full" style={{ backgroundColor: Surface.ruleStrong }} />
              </View>

              <View className="px-4 flex-row justify-between items-center pb-4">
                <Text className="text-title2 font-semibold text-text-primary">
                  {editingGoal ? 'Edit Goal' : 'New Goal'}
                </Text>
                <Pressable
                  onPress={resetGoalForm}
                  className="w-8 h-8 rounded-full items-center justify-center"
                  style={{ backgroundColor: Surface.surfaceRaised }}
                >
                  <Ionicons name="close" size={18} color={Colors.textSecondary} />
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                className="px-4"
                contentContainerStyle={{ paddingBottom: 12 }}
              >
                <View className="mb-6">
                  <Text
                    className="text-footnote uppercase mb-2 text-text-label"
                    style={{ letterSpacing: 2.5 }}
                  >
                    Goal Identity
                  </Text>
                  <View className="flex-row items-end gap-3">
                    <View
                      className="w-11 h-11 rounded-full items-center justify-center"
                      style={{
                        backgroundColor: color + '22',
                        borderWidth: 0.5,
                        borderColor: goalBorderColor(color),
                      }}
                    >
                      <TextInput
                        className="text-[22px] text-center text-text-primary"
                        value={icon}
                        onChangeText={(t) => setIcon(t.slice(-2) || '⭐')}
                        maxLength={2}
                      />
                    </View>
                    <View className="flex-1 min-w-0">
                      <EditorialTextInput
                        variant="underline"
                        className="pb-1"
                        placeholder="Goal name"
                        value={name}
                        onChangeText={setName}
                        maxLength={30}
                        style={{ fontSize: 22, fontWeight: '700', letterSpacing: -0.5 }}
                      />
                    </View>
                  </View>
                </View>

                <View className="mb-6">
                  <Text
                    className="text-footnote uppercase mb-2 text-text-label"
                    style={{ letterSpacing: 2.5 }}
                  >
                    Color Theme
                  </Text>
                  <View className="flex-row gap-3">
                    {GOAL_PRESETS.map((p) => {
                      const sel = color === p.color;
                      return (
                        <Pressable
                          key={p.color}
                          onPress={() => setColor(p.color)}
                          className="w-9 h-9 rounded-full items-center justify-center"
                          style={{
                            backgroundColor: p.color,
                            borderWidth: sel ? 2 : 0.5,
                            borderColor: sel ? Colors.textPrimary : ghostBorder,
                            transform: [{ scale: sel ? 1.06 : 1 }],
                          }}
                        />
                      );
                    })}
                  </View>
                </View>

                <View className="mb-6">
                  <Text
                    className="text-footnote uppercase mb-2 text-text-label"
                    style={{ letterSpacing: 2.5 }}
                  >
                    Your Why
                  </Text>
                  <EditorialTextInput
                    variant="contained"
                    className="min-h-[100px]"
                    placeholder="Why does this goal matter to you?"
                    value={why}
                    onChangeText={(t) => setWhy(t.slice(0, 140))}
                    multiline
                    maxLength={140}
                    textAlignVertical="top"
                  />
                  <Text className="text-caption text-text-tertiary text-right mt-1">
                    {why.length} / 140
                  </Text>
                </View>

                <View className="pt-1">
                  <View className="flex-row justify-between items-center mb-4">
                    <Text
                      className="text-footnote uppercase text-text-label"
                      style={{ letterSpacing: 2.5 }}
                    >
                      Daily Actions
                    </Text>
                    <View className="flex-row items-center gap-2">
                      <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: Surface.surfaceRaised }}>
                        <Text className="text-caption text-text-secondary">{actions.length} total</Text>
                      </View>
                      <Pressable
                        onPress={doneWithGoalSetup}
                        className="px-3 py-1 rounded-full"
                        style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule }}
                      >
                        <Text className="text-[11px] font-semibold text-text-primary">Done</Text>
                      </Pressable>
                    </View>
                  </View>

                  {actions.length === 0 ? (
                    <Text className="text-footnote text-text-secondary mb-3">
                      Add at least one action for this goal.
                    </Text>
                  ) : null}

                  {actions.map((a, idx) => {
                    const activeActions = actions.filter((x) => x.is_active);
                    const activeIdx = activeActions.findIndex((x) => x.id === a.id);
                    return (
                      <View
                        key={a.id}
                        className="flex-row items-center rounded-lg p-3 mb-2"
                        style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, opacity: a.is_active ? 1 : 0.7 }}
                      >
                        {a.is_active ? (
                          <View className="justify-center gap-0.5 mr-2">
                            <Pressable
                              onPress={() => void moveAction(activeIdx, -1)}
                              disabled={activeIdx === 0}
                              className="w-6 h-6 rounded items-center justify-center"
                              style={{ opacity: activeIdx === 0 ? 0.25 : 1 }}
                            >
                              <Ionicons name="chevron-up" size={14} color={Colors.textSecondary} />
                            </Pressable>
                            <Pressable
                              onPress={() => void moveAction(activeIdx, 1)}
                              disabled={activeIdx === activeActions.length - 1}
                              className="w-6 h-6 rounded items-center justify-center"
                              style={{ opacity: activeIdx === activeActions.length - 1 ? 0.25 : 1 }}
                            >
                              <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} />
                            </Pressable>
                          </View>
                        ) : (
                          <View className="w-1 self-stretch rounded-full mr-3" style={{ backgroundColor: Colors.textMuted }} />
                        )}
                        {a.is_active ? (
                          <View className="w-1 self-stretch rounded-full mr-2" style={{ backgroundColor: color }} />
                        ) : null}
                        <View className="flex-1">
                          <Text className="text-headline font-semibold text-text-primary">{a.name}</Text>
                          <Text className="text-footnote text-text-secondary">
                            {!a.is_active ? 'Paused (hidden from Today) · ' : ''}
                            {a.type === 'session' ? `${a.target_minutes}m target` : 'Habit'}
                            {a.reminder_time ? ` · ⏰ ${a.reminder_time}` : ''}
                          </Text>
                        </View>
                        {a.is_active ? (
                          <>
                            <Pressable
                              onPress={() => startEditAction(a)}
                              className="w-9 h-9 rounded-md items-center justify-center mr-2"
                              style={{ backgroundColor: Surface.surfaceRaised, borderWidth: 1, borderColor: Surface.rule }}
                            >
                              <Ionicons name="create-outline" size={16} color={Colors.textSecondary} />
                            </Pressable>
                            <Pressable
                              onPress={() => removeAction(a.id)}
                              className="w-9 h-9 rounded-md items-center justify-center"
                              style={{ backgroundColor: Surface.surfaceRaised, borderWidth: 1, borderColor: Surface.rule }}
                            >
                              <Ionicons name="trash-outline" size={16} color={Colors.accentDanger} />
                            </Pressable>
                          </>
                        ) : (
                          <Pressable
                            onPress={async () => {
                              if (!editingGoal) return;
                              await api.updateAction(a.id, { is_active: 1 });
                              await loadActions(editingGoal.id);
                              await refresh();
                            }}
                            className="px-3 py-2 rounded-md"
                            style={{
                              backgroundColor: Surface.surfaceRaised,
                              borderWidth: 1,
                              borderColor: goalBorderColor(Colors.textPrimary),
                            }}
                          >
                            <Text className="text-[10px] font-semibold uppercase" style={{ color: Colors.textPrimary }}>
                              Restore
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })}

                  <Pressable
                    onPress={startCreateAction}
                    className="h-14 rounded-lg items-center justify-center flex-row gap-2 mt-2 mb-3"
                    style={{
                      borderWidth: 0.5,
                      borderStyle: 'dashed',
                      borderColor: ghostBorder,
                      backgroundColor: Surface.surface,
                    }}
                  >
                    <Ionicons name="add" size={20} color={color} />
                    <Text className="text-headline font-semibold" style={{ color }}>
                      Add New Action
                    </Text>
                  </Pressable>

                  {showActionComposer && (
                    <View className="mt-1 mb-2 rounded-lg p-4" style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule }}>
                      <Text className="text-headline font-semibold text-text-primary mb-3">
                        {editingActionId ? 'Edit Action' : 'New Action'}
                      </Text>
                      <EditorialTextInput
                        variant="underline"
                        className="mb-3"
                        placeholder="Action name"
                        value={actionName}
                        onChangeText={setActionName}
                        style={{ fontSize: 18, fontWeight: '700' }}
                      />
                      <View className="flex-row gap-2 mb-3">
                        <Pressable
                          onPress={() => {
                            setActionType('session');
                            setActionMinutesFocused(false);
                          }}
                          className="flex-1 h-10 rounded-md items-center justify-center"
                          style={{
                            borderWidth: 0.5,
                            borderColor: actionType === 'session' ? goalBorderColor(color) : ghostBorder,
                            backgroundColor: actionType === 'session' ? Surface.surfaceRaised : 'transparent',
                          }}
                        >
                          <Text
                            className="text-subheadline font-semibold"
                            style={{ color: actionType === 'session' ? color : Colors.textSecondary }}
                          >
                            Session
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            setActionType('habit');
                            setActionMinutesFocused(false);
                          }}
                          className="flex-1 h-10 rounded-md items-center justify-center"
                          style={{
                            borderWidth: 0.5,
                            borderColor: actionType === 'habit' ? goalBorderColor(color) : ghostBorder,
                            backgroundColor: actionType === 'habit' ? Surface.surfaceRaised : 'transparent',
                          }}
                        >
                          <Text
                            className="text-subheadline font-semibold"
                            style={{ color: actionType === 'habit' ? color : Colors.textSecondary }}
                          >
                            Habit
                          </Text>
                        </Pressable>
                      </View>
                      {actionType === 'session' && (
                        <View className="flex-row items-end gap-3 mb-4">
                          <Text className="text-subheadline text-text-secondary pb-2">Target</Text>
                          <View className="w-20">
                            <TextInput
                              className="text-center text-body font-semibold text-text-primary pb-2"
                              style={{
                                borderBottomWidth: 1,
                                borderBottomColor: actionMinutesFocused ? Colors.textPrimary : Colors.textDim,
                                backgroundColor: 'transparent',
                                paddingVertical: 8,
                              }}
                              keyboardType="number-pad"
                              value={String(actionMinutes)}
                              onChangeText={(t) =>
                                setActionMinutes(Math.max(1, Number(t.replace(/\D/g, '') || '0')))
                              }
                              onFocus={() => setActionMinutesFocused(true)}
                              onBlur={() => setActionMinutesFocused(false)}
                            />
                          </View>
                          <Text className="text-subheadline text-text-secondary pb-2">minutes</Text>
                        </View>
                      )}

                      {/* US-020: Daily reminder */}
                      <View className="mb-4 rounded-lg p-3" style={{ backgroundColor: Surface.surfaceRaised }}>
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center gap-2">
                            <Ionicons name="alarm-outline" size={16} color={Colors.textSecondary} />
                            <Text className="text-subheadline text-text-primary">Daily reminder</Text>
                          </View>
                          <Pressable
                            onPress={() => setActionReminderEnabled((v) => !v)}
                            className="w-10 h-5.5 rounded-full justify-center"
                            style={{
                              backgroundColor: actionReminderEnabled ? Colors.accentSuccess : Surface.ruleStrong,
                              paddingHorizontal: 2,
                              width: 40,
                              height: 22,
                            }}
                          >
                            <View
                              className="w-4.5 h-4.5 rounded-full bg-white"
                              style={{
                                width: 18,
                                height: 18,
                                transform: [{ translateX: actionReminderEnabled ? 19 : 1 }],
                              }}
                            />
                          </Pressable>
                        </View>
                        {actionReminderEnabled && (
                          <View className="flex-row items-center gap-2 mt-3">
                            <Text className="text-caption text-text-tertiary">Fires daily at</Text>
                            <TextInput
                              value={actionReminderTime}
                              onChangeText={(t) => setActionReminderTime(t)}
                              placeholder="08:00"
                              placeholderTextColor={Colors.textLabel}
                              keyboardType="numbers-and-punctuation"
                              maxLength={5}
                              className="text-body font-semibold text-text-primary text-center"
                              style={{
                                width: 64,
                                borderBottomWidth: 1,
                                borderBottomColor: parseReminderTime(actionReminderTime)
                                  ? Colors.textPrimary
                                  : Colors.accentDanger,
                                paddingVertical: 4,
                              }}
                            />
                            <Text className="text-caption text-text-tertiary">(HH:MM)</Text>
                          </View>
                        )}
                      </View>

                      {actionFeedback ? (
                        <View
                          className="mb-3 px-3 py-2 rounded-md flex-row items-center"
                          style={{ backgroundColor: Surface.surfaceRaised }}
                        >
                          <Ionicons name="checkmark-circle" size={15} color={Colors.accentSuccess} />
                          <Text className="text-footnote text-text-secondary ml-2">{actionFeedback}</Text>
                        </View>
                      ) : null}
                      <View className="flex-row gap-2">
                        <View className="flex-1">
                          <PrimaryButton
                            title="Cancel"
                            variant="ghost"
                            color={Colors.accentDanger}
                            size="small"
                            onPress={resetActionForm}
                          />
                        </View>
                        <View className="flex-1">
                          <PrimaryButton
                            title={editingActionId ? 'Save action' : 'Add action'}
                            appearance="goalOutline"
                            color={color}
                            size="small"
                            disabled={!actionName.trim()}
                            onPress={() => void saveAction()}
                          />
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              </ScrollView>

              <View
                className="px-4 pb-6 pt-3"
                style={{ backgroundColor: Surface.canvas, borderTopWidth: 1, borderTopColor: Surface.rule }}
              >
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <PrimaryButton
                      title={editingGoal ? 'Save Changes' : 'Save Goal'}
                      onPress={saveGoal}
                      disabled={!name.trim()}
                    />
                  </View>
                  <View className="flex-1">
                    <PrimaryButton
                      title="Done"
                      onPress={doneWithGoalSetup}
                      disabled={!name.trim()}
                    />
                  </View>
                </View>
                {editingGoal && (
                  <Pressable
                    onPress={() =>
                      Alert.alert('Archive Goal', 'Are you sure? This will hide the goal and its actions.', [
                        { text: 'Cancel' },
                        { text: 'Archive', style: 'destructive', onPress: archiveGoal },
                      ])
                    }
                    className="mt-4 mb-1 items-center py-2"
                  >
                    <Text className="text-subheadline text-accent-danger font-semibold">Archive Goal</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
    </View>
  );
}

function GoalCard({ goal }: { goal: MetaGoal }) {
  const [hours, setHours] = useState(0);
  const [actions, setActions] = useState<DailyAction[]>([]);
  const tone = getGoalColor(goal.id);

  useEffect(() => {
    api.getWeeklySecondsByGoal(goal.id).then((s) => setHours(s / 3600));
    api.getActionsByGoal(goal.id).then(setActions);
  }, [goal.id]);

  return (
    <View
      className="min-h-[112px] px-4 py-4 flex-row items-center mb-3 overflow-hidden"
      style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.lg }}
    >
      <View className="absolute left-0 top-0 bottom-0 w-[5px]" style={{ backgroundColor: tone }} />
      <View
        className="w-12 h-12 items-center justify-center"
        style={{ backgroundColor: tone + '1F', borderWidth: 1, borderColor: goalBorderColor(tone), borderRadius: Radius.md }}
      >
        <Text style={{ fontSize: 22 }}>{goal.icon}</Text>
      </View>
      <View className="flex-1 ml-3">
        <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 19, lineHeight: 24 }}>
          {goal.name}
        </Text>
        {goal.why_statement?.trim() ? (
          <Text numberOfLines={2} style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 15, lineHeight: 20, marginTop: 3 }}>
            {goal.why_statement.trim()}
          </Text>
        ) : null}
        <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoMedium, fontSize: 10, letterSpacing: 0.8, marginTop: 6, textTransform: 'uppercase' }}>
          {actions.length} active {actions.length === 1 ? 'action' : 'actions'}
        </Text>
      </View>
      <View className="items-end pr-1">
        <Text style={{ color: tone, fontFamily: FontFamily.monoSemiBold, fontSize: 13 }}>
          {hours.toFixed(1)}h
        </Text>
        <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoMedium, fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase' }}>
          wk
        </Text>
      </View>
      <View className="ml-2">
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
      </View>
    </View>
  );
}

function AddGoalCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="h-[96px] items-center justify-center flex-row gap-2 mb-2"
      style={{
        backgroundColor: Surface.surface,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: Surface.ruleStrong,
        borderRadius: Radius.lg,
      }}
    >
      <Ionicons name="add" size={20} color={Colors.textPrimary} />
      <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase' }}>
        Add pillar
      </Text>
    </Pressable>
  );
}
