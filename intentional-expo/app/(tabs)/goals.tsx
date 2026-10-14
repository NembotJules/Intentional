import { useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react';
import { useLocalSearchParams, useRouter, useNavigation, useFocusEffect } from 'expo-router';
import { View, Text, ScrollView, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform, Keyboard, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import {
  Archive,
  Bell,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  History,
  Pencil,
  Plus,
  Timer,
  Trash,
  X,
} from 'lucide-react-native';
import { scheduleActionReminder, cancelActionReminder, parseReminderTime } from '@/services/notifications';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { Swipeable, TouchableOpacity } from 'react-native-gesture-handler';
import { PrimaryButton } from '@/components/PrimaryButton';
import { AnimatedNumber, PressableScale, enter } from '@/components/ui/motion';
import { PillarIcon } from '@/components/ui/PillarIcon';
import { ColorPicker, DurationPicker, FieldLabel, IconPicker, IconTap, Segmented } from '@/components/ui/PillarForm';
import { Colors, Elevation, FontFamily, Radius, Surface, Type, hexToRgba } from '@/constants/design';
import { useGoals } from '@/db/hooks';
import * as api from '@/db/api';
import type { MetaGoal, DailyAction, ActionType } from '@/types';
import { getGoalColor } from '@/utils/goalColors';

export default function GoalsScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ create?: string | string[]; editGoal?: string | string[] }>();
  const { goals, refresh } = useGoals();
  const [editingGoal, setEditingGoal] = useState<MetaGoal | null>(null);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [showActionComposer, setShowActionComposer] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(Colors.goalPhysique);
  const [icon, setIcon] = useState('target');
  const [why, setWhy] = useState('');
  const [actions, setActions] = useState<DailyAction[]>([]);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [actionName, setActionName] = useState('');
  const [actionType, setActionType] = useState<ActionType>('session');
  const [actionMinutes, setActionMinutes] = useState(60);
  const [actionFeedback, setActionFeedback] = useState('');
  /** US-020: reminder time "HH:MM" or empty string */
  const [actionReminderEnabled, setActionReminderEnabled] = useState(false);
  const [actionReminderTime, setActionReminderTime] = useState('08:00');
  /** US-010: Expo Go–safe reorder (no react-native-draggable-flatlist / worklets mismatch) */
  const [reorderMode, setReorderMode] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const goalSheetScrollRef = useRef<ScrollView>(null);

  const resetGoalForm = () => {
    setEditingGoal(null);
    setShowGoalForm(false);
    setShowActionComposer(false);
    setName('');
    setColor(Colors.goalPhysique);
    setIcon('target');
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
    setActionFeedback('');
    setActionReminderEnabled(false);
    setActionReminderTime('08:00');
  };

  /** Archived goals' actions leave Today, so their reminders must stop too. */
  const cancelGoalReminders = async (goalId: string) => {
    const goalActions = await api.getActionsByGoal(goalId, true);
    goalActions.forEach((a) => void cancelActionReminder(a.id));
  };

  const loadActions = async (goalId: string) => {
    const rows = await api.getActionsByGoal(goalId, true);
    setActions(rows);
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
    setIcon('target');
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
        target_minutes: actionType === 'session' ? Math.max(1, actionMinutes) : 60,
        reminder_time: resolvedReminderTime,
      });
      const updatedAction: import('@/types').DailyAction = {
        id: editingActionId,
        goal_id: currentGoal.id,
        name: trimmed,
        type: actionType,
        target_minutes: actionType === 'session' ? Math.max(1, actionMinutes) : 60,
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
        target_minutes: actionType === 'session' ? Math.max(1, actionMinutes) : 60,
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
    void cancelActionReminder(id);
    await api.deleteAction(id);
    await loadActions(editingGoal.id);
    if (editingActionId === id) resetActionForm();
    await refresh();
  };

  const confirmArchiveGoal = useCallback(
    (g: MetaGoal) => {
      const editingId = editingGoal?.id;
      Alert.alert(
        'Keep the history.',
        `Archiving ${g.name} removes it from active planning. Past sessions and insights stay in your ledger.`,
        [
          { text: 'Keep active', style: 'cancel' },
          {
            text: `Archive ${g.name}`,
            style: 'destructive',
            onPress: async () => {
              await cancelGoalReminders(g.id);
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
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  /** The floating tab bar would cover the sheet's save button — hide it while editing. */
  useEffect(() => {
    navigation.setOptions({ tabBarStyle: showGoalForm ? { display: 'none' } : undefined });
  }, [navigation, showGoalForm]);

  /** Tabs stay mounted — reload pillars (archives, new actions, focus time) on every visit. */
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

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

  const goalSheetBottomPad = Math.max(insets.bottom, 16) + 8;
  const nudgeSheetForKeyboard = useCallback(() => {
    setTimeout(() => {
      goalSheetScrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const goalList = (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 16, paddingBottom: 140 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Animated.View entering={enter(0)} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={Type.eyebrow}>{reorderMode ? 'Reorder' : 'Your pillars'}</Text>
          <Text style={[Type.title, { marginTop: 6 }]}>{reorderMode ? 'Set the order.' : 'What your days answer to.'}</Text>
        </View>
        {reorderMode ? (
          <PressableScale
            onPress={() => setReorderMode(false)}
            style={{ height: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: Surface.ink, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={[Type.heading, { color: Surface.surface, fontSize: 15 }]}>Done</Text>
          </PressableScale>
        ) : (
          <PressableScale
            onPress={openCreate}
            accessibilityLabel="Add pillar"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Surface.surface, alignItems: 'center', justifyContent: 'center', ...Elevation.card }}
          >
            <Plus size={20} color={Surface.ink} strokeWidth={2} />
          </PressableScale>
        )}
      </Animated.View>

      {goals.length === 0 ? (
        <Animated.View entering={enter(1)} style={{ backgroundColor: Surface.surface, borderRadius: Radius.lg, padding: 24, marginTop: 24, ...Elevation.card }}>
          <Text style={Type.title}>Your first pillar.</Text>
          <Text style={[Type.body, { marginTop: 8, marginBottom: 20 }]}>
            Start with one. Add the rest after Today has something real to serve.
          </Text>
          <PrimaryButton title="Add a pillar" onPress={openCreate} showArrow={false} />
        </Animated.View>
      ) : (
        <>
          {goals.map((g, index) => {
            const card = <GoalCard goal={g} />;
            return (
              <Animated.View key={g.id} entering={enter(index + 1)} layout={LinearTransition.springify().damping(20)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                {reorderMode && (
                  <View style={{ gap: 6 }}>
                    <ReorderButton direction="up" disabled={index === 0} onPress={() => void moveGoal(index, -1)} />
                    <ReorderButton direction="down" disabled={index === goals.length - 1} onPress={() => void moveGoal(index, 1)} />
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  {reorderMode || Platform.OS === 'web' ? (
                    <PressableScale
                      onPress={reorderMode ? undefined : () => goGoalDetail(g)}
                      onLongPress={reorderMode ? undefined : enterReorderMode}
                      delayLongPress={350}
                    >
                      {card}
                    </PressableScale>
                  ) : (
                    <Swipeable
                      friction={2}
                      overshootRight={false}
                      renderRightActions={() => (
                        <View style={{ justifyContent: 'center', paddingLeft: 10 }}>
                          <TouchableOpacity
                            onPress={() => confirmArchiveGoal(g)}
                            activeOpacity={0.85}
                            style={{ width: 76, height: '100%', minHeight: 96, borderRadius: Radius.lg, backgroundColor: Surface.surfaceRaised, alignItems: 'center', justifyContent: 'center', gap: 6 }}
                          >
                            <Archive size={20} color={Colors.accentDanger} strokeWidth={1.75} />
                            <Text style={[Type.meta, { color: Colors.accentDanger, fontSize: 12 }]}>Archive</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    >
                      <PressableScale onPress={() => goGoalDetail(g)} onLongPress={enterReorderMode} delayLongPress={350}>
                        {card}
                      </PressableScale>
                    </Swipeable>
                  )}
                </View>
              </Animated.View>
            );
          })}

          {!reorderMode && (
            <Animated.View entering={enter(goals.length + 1)}>
              <PressableScale
                onPress={openCreate}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  height: 64,
                  borderRadius: Radius.lg,
                  borderWidth: 1.5,
                  borderStyle: 'dashed',
                  borderColor: Surface.ruleStrong,
                }}
              >
                <Plus size={18} color={Surface.muted} strokeWidth={2} />
                <Text style={[Type.heading, { color: Surface.muted, fontSize: 16 }]}>Add a pillar</Text>
              </PressableScale>

              <PressableScale
                onPress={() => router.push('/session-history')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24, paddingVertical: 14, paddingHorizontal: 16, borderRadius: Radius.lg, backgroundColor: Surface.surface, ...Elevation.card }}
              >
                <History size={18} color={Surface.muted} strokeWidth={1.8} />
                <Text style={[Type.heading, { flex: 1, fontSize: 16 }]}>Session history</Text>
                <ChevronRight size={18} color={Surface.faint} strokeWidth={2} />
              </PressableScale>

              <Text style={[Type.meta, { textAlign: 'center', color: Surface.faint, marginTop: 20 }]}>
                {Platform.OS === 'web' ? 'Long-press a pillar to reorder.' : 'Long-press to reorder · swipe to archive.'}
              </Text>
            </Animated.View>
          )}
        </>
      )}
    </ScrollView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: Surface.canvas }}>
      {goalList}

      {showGoalForm && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}>
          <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(180)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(23,20,17,0.38)' }}>
            <Pressable style={{ flex: 1 }} onPress={resetGoalForm} accessibilityLabel="Close" />
          </Animated.View>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
            style={{ flex: 1, justifyContent: 'flex-end' }}
            pointerEvents="box-none"
          >
            <Animated.View
              entering={SlideInDown.springify().damping(22).stiffness(200)}
              exiting={SlideOutDown.duration(220)}
              style={{
                maxHeight: keyboardOpen ? '96%' : '90%',
                backgroundColor: Surface.canvas,
                borderTopLeftRadius: Radius.xl,
                borderTopRightRadius: Radius.xl,
                ...Elevation.floating,
              }}
            >
              <View style={{ paddingTop: 10, paddingBottom: 6, alignItems: 'center' }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: Surface.ruleStrong }} />
              </View>

              <View style={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[Type.title, { flex: 1, fontSize: 30, lineHeight: 34 }]}>{editingGoal ? 'Edit pillar' : 'New pillar'}</Text>
                <PressableScale
                  onPress={resetGoalForm}
                  accessibilityLabel="Close"
                  style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: Surface.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} color={Surface.muted} strokeWidth={2.2} />
                </PressableScale>
              </View>

              <ScrollView
                ref={goalSheetScrollRef}
                showsVerticalScrollIndicator={false}
                style={{ paddingHorizontal: 20 }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
                contentContainerStyle={{ paddingBottom: keyboardOpen ? goalSheetBottomPad + 60 : 20 }}
              >
                {/* Identity */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 22 }}>
                  <PillarIcon icon={icon} name={name} color={color} size={56} />
                  <TextInput
                    placeholder="Pillar name"
                    placeholderTextColor={Surface.faint}
                    value={name}
                    onChangeText={setName}
                    maxLength={30}
                    style={{
                      flex: 1,
                      fontFamily: FontFamily.display,
                      fontSize: 30,
                      color: Surface.ink,
                      paddingVertical: 6,
                      borderBottomWidth: 1,
                      borderBottomColor: Surface.rule,
                    }}
                  />
                </View>

                <FieldLabel>Icon</FieldLabel>
                <View style={{ marginBottom: 22 }}>
                  <IconPicker icon={icon} name={name} color={color} onChange={setIcon} />
                </View>

                <FieldLabel>Color</FieldLabel>
                <View style={{ marginBottom: 22 }}>
                  <ColorPicker value={color} onChange={setColor} />
                </View>

                <FieldLabel>Why it matters</FieldLabel>
                <TextInput
                  placeholder="One sentence you'll read on hard days."
                  placeholderTextColor={Surface.faint}
                  value={why}
                  onChangeText={(t) => setWhy(t.slice(0, 140))}
                  onFocus={nudgeSheetForKeyboard}
                  multiline
                  maxLength={140}
                  textAlignVertical="top"
                  style={{
                    minHeight: 84,
                    backgroundColor: Surface.surface,
                    borderRadius: Radius.md,
                    padding: 14,
                    fontFamily: FontFamily.body,
                    fontSize: 16,
                    lineHeight: 22,
                    color: Surface.ink,
                  }}
                />
                <Text style={[Type.meta, { textAlign: 'right', marginTop: 6, color: Surface.faint }]}>{why.length} / 140</Text>

                {/* Actions */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 10 }}>
                  <Text style={[Type.heading, { flex: 1 }]}>Daily actions</Text>
                  <Text style={Type.number}>{actions.length}</Text>
                </View>

                {actions.length === 0 && !showActionComposer ? (
                  <Text style={[Type.body, { fontSize: 15, marginBottom: 10 }]}>Add the first thing this pillar receives every day.</Text>
                ) : null}

                {actions.map((a) => {
                  const activeActions = actions.filter((x) => x.is_active);
                  const activeIdx = activeActions.findIndex((x) => x.id === a.id);
                  return (
                    <Animated.View
                      key={a.id}
                      entering={FadeIn.duration(200)}
                      layout={LinearTransition.springify().damping(20)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        backgroundColor: Surface.surface,
                        borderRadius: Radius.md,
                        paddingVertical: 12,
                        paddingHorizontal: 12,
                        marginBottom: 8,
                        opacity: a.is_active ? 1 : 0.6,
                      }}
                    >
                      {a.is_active ? (
                        <View style={{ gap: 2 }}>
                          <IconTap onPress={() => void moveAction(activeIdx, -1)} disabled={activeIdx === 0} label="Move up">
                            <ChevronUp size={16} color={Surface.muted} strokeWidth={2} />
                          </IconTap>
                          <IconTap onPress={() => void moveAction(activeIdx, 1)} disabled={activeIdx === activeActions.length - 1} label="Move down">
                            <ChevronDown size={16} color={Surface.muted} strokeWidth={2} />
                          </IconTap>
                        </View>
                      ) : null}
                      <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: a.is_active ? color : Surface.ruleStrong }} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={[Type.heading, { fontSize: 16 }]}>{a.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                          <Text style={Type.number}>
                            {!a.is_active ? 'Paused · ' : ''}
                            {a.type === 'session' ? `${a.target_minutes} min session` : 'Habit'}
                          </Text>
                          {a.reminder_time ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                              <Bell size={12} color={Surface.muted} strokeWidth={2} />
                              <Text style={Type.number}>{a.reminder_time}</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      {a.is_active ? (
                        <>
                          <IconTap onPress={() => startEditAction(a)} label="Edit action" boxed>
                            <Pencil size={15} color={Surface.muted} strokeWidth={1.9} />
                          </IconTap>
                          <IconTap onPress={() => void removeAction(a.id)} label="Delete action" boxed>
                            <Trash size={15} color={Colors.accentDanger} strokeWidth={1.9} />
                          </IconTap>
                        </>
                      ) : (
                        <PressableScale
                          onPress={async () => {
                            if (!editingGoal) return;
                            await api.updateAction(a.id, { is_active: 1 });
                            await loadActions(editingGoal.id);
                            await refresh();
                          }}
                          style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Surface.surfaceRaised }}
                        >
                          <Text style={[Type.meta, { color: Surface.ink }]}>Restore</Text>
                        </PressableScale>
                      )}
                    </Animated.View>
                  );
                })}

                {!showActionComposer && (
                  <PressableScale
                    onPress={startCreateAction}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      height: 50,
                      borderRadius: Radius.md,
                      borderWidth: 1.5,
                      borderStyle: 'dashed',
                      borderColor: hexToRgba(color, 0.45),
                      marginTop: 4,
                    }}
                  >
                    <Plus size={17} color={color} strokeWidth={2.2} />
                    <Text style={[Type.heading, { color, fontSize: 15 }]}>Add an action</Text>
                  </PressableScale>
                )}

                {showActionComposer && (
                  <Animated.View
                    entering={FadeInDown.springify().damping(20)}
                    style={{ marginTop: 6, backgroundColor: Surface.surface, borderRadius: Radius.lg, padding: 16, ...Elevation.card }}
                  >
                    <Text style={[Type.eyebrow, { marginBottom: 6 }]}>{editingActionId ? 'Edit action' : 'New action'}</Text>
                    <TextInput
                      placeholder="e.g. Morning training"
                      placeholderTextColor={Surface.faint}
                      value={actionName}
                      onChangeText={setActionName}
                      onFocus={nudgeSheetForKeyboard}
                      autoFocus={!editingActionId}
                      style={{
                        fontFamily: FontFamily.bodySemiBold,
                        fontSize: 19,
                        color: Surface.ink,
                        paddingVertical: 8,
                        borderBottomWidth: 1,
                        borderBottomColor: Surface.rule,
                        marginBottom: 14,
                      }}
                    />

                    <Segmented
                      value={actionType}
                      color={color}
                      options={[
                        { value: 'session', label: 'Timed session', Icon: Timer },
                        { value: 'habit', label: 'Habit', Icon: CircleCheck },
                      ]}
                      onChange={(v) => {
                        setActionType(v as ActionType);
                                          }}
                    />

                    {actionType === 'session' && (
                      <View style={{ marginTop: 14 }}>
                        <Text style={[Type.meta, { marginBottom: 8 }]}>Daily target</Text>
                        <DurationPicker minutes={actionMinutes} color={color} onChange={setActionMinutes} onInputFocus={nudgeSheetForKeyboard} />
                      </View>
                    )}

                    {/* US-020: Daily reminder */}
                    <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Bell size={16} color={Surface.muted} strokeWidth={1.9} />
                      <Text style={[Type.heading, { flex: 1, fontSize: 15 }]}>Daily reminder</Text>
                      <Switch
                        value={actionReminderEnabled}
                        onValueChange={setActionReminderEnabled}
                        trackColor={{ false: Surface.ruleStrong, true: color }}
                        thumbColor={Surface.surface}
                        ios_backgroundColor={Surface.ruleStrong}
                      />
                    </View>
                    {actionReminderEnabled && (
                      <Animated.View entering={FadeInDown.duration(200)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginLeft: 26 }}>
                        <Text style={Type.meta}>Every day at</Text>
                        <TextInput
                          value={actionReminderTime}
                          onChangeText={setActionReminderTime}
                          onFocus={nudgeSheetForKeyboard}
                          placeholder="08:00"
                          placeholderTextColor={Surface.faint}
                          keyboardType="numbers-and-punctuation"
                          maxLength={5}
                          style={{
                            width: 70,
                            textAlign: 'center',
                            fontFamily: FontFamily.bodySemiBold,
                            fontSize: 16,
                            color: Surface.ink,
                            paddingVertical: 6,
                            borderRadius: Radius.sm,
                            backgroundColor: Surface.canvas,
                            borderWidth: 1.5,
                            borderColor: parseReminderTime(actionReminderTime) ? 'transparent' : Colors.accentDanger,
                          }}
                        />
                      </Animated.View>
                    )}

                    {actionFeedback ? (
                      <Animated.View entering={FadeIn} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 }}>
                        <CircleCheck size={15} color={Colors.accentSuccess} strokeWidth={2} />
                        <Text style={Type.meta}>{actionFeedback}</Text>
                      </Animated.View>
                    ) : null}

                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                      <View style={{ flex: 1 }}>
                        <PrimaryButton title="Cancel" appearance="ghost" color={Surface.muted} size="small" onPress={resetActionForm} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <PrimaryButton
                          title={editingActionId ? 'Save action' : 'Add action'}
                          size="small"
                          onPress={() => void saveAction()}
                          disabled={!actionName.trim()}
                        />
                      </View>
                    </View>
                  </Animated.View>
                )}

                {editingGoal && (
                  <PressableScale
                    onPress={() => confirmArchiveGoal(editingGoal)}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24, paddingVertical: 10 }}
                  >
                    <Archive size={15} color={Colors.accentDanger} strokeWidth={1.9} />
                    <Text style={[Type.meta, { color: Colors.accentDanger, fontSize: 14 }]}>Archive pillar</Text>
                  </PressableScale>
                )}
              </ScrollView>

              <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: goalSheetBottomPad }}>
                <PrimaryButton
                  title={editingGoal ? 'Save changes' : 'Create pillar'}
                  onPress={() => void doneWithGoalSetup()}
                  disabled={!name.trim()}
                />
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      )}
    </View>
  );
}

function ReorderButton({ direction, disabled, onPress }: { direction: 'up' | 'down'; disabled: boolean; onPress: () => void }) {
  const Glyph = direction === 'up' ? ChevronUp : ChevronDown;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={direction === 'up' ? 'Move up' : 'Move down'}
      scaleTo={0.88}
      style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: Surface.surface, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : 1, ...Elevation.card }}
    >
      <Glyph size={18} color={Surface.ink} strokeWidth={2} />
    </PressableScale>
  );
}

function GoalCard({ goal }: { goal: MetaGoal }) {
  const [weekMinutes, setWeekMinutes] = useState(0);
  const [actions, setActions] = useState<DailyAction[]>([]);
  const tone = getGoalColor(goal);

  useEffect(() => {
    api.getWeeklySecondsByGoal(goal.id).then((s) => setWeekMinutes(Math.round(s / 60)));
    api.getActionsByGoal(goal.id).then(setActions);
    // `goal` is a fresh object on every list refresh, so stats re-query after edits/sessions.
  }, [goal]);

  const formatWeek = (m: number) => {
    const total = Math.round(m);
    const h = Math.floor(total / 60);
    return h > 0 ? `${h}h ${total % 60}m` : `${total}m`;
  };

  return (
    <View style={{ backgroundColor: Surface.surface, borderRadius: Radius.lg, padding: 16, ...Elevation.card }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <PillarIcon icon={goal.icon} name={goal.name} color={tone} size={48} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[Type.heading, { fontSize: 19, lineHeight: 24 }]}>
            {goal.name}
          </Text>
          <Text style={[Type.number, { marginTop: 2 }]}>
            {actions.length} {actions.length === 1 ? 'action' : 'actions'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <AnimatedNumber value={weekMinutes} format={formatWeek} style={{ fontFamily: FontFamily.display, fontSize: 30, lineHeight: 32, color: Surface.ink }} />
          <Text style={[Type.meta, { fontSize: 12, color: Surface.faint }]}>this week</Text>
        </View>
      </View>
      {goal.why_statement?.trim() ? (
        <Text
          numberOfLines={2}
          style={{ fontFamily: FontFamily.displayItalic, fontSize: 17, lineHeight: 22, color: Surface.muted, marginTop: 14, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: hexToRgba(tone, 0.5) }}
        >
          {goal.why_statement.trim()}
        </Text>
      ) : null}
    </View>
  );
}
