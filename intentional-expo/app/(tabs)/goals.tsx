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
  Flame,
  History,
  ListChecks,
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
import { AnimatedNumber, PressableScale, ProgressBar, enter } from '@/components/ui/motion';
import { PillarIcon } from '@/components/ui/PillarIcon';
import { ColorPicker, DurationPicker, FieldLabel, IconPicker, IconTap, Segmented, sandInputStyle } from '@/components/ui/PillarForm';
import { CTA } from '@/components/onboarding/parts';
import { Mascot } from '@/components/onboarding/Mascot';
import { Accent, Colors, Elevation, FontFamily, Radius, Surface, Type } from '@/constants/design';
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
        `Archiving ${g.name} removes it from active planning. Every hour you gave it stays in your history.`,
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

  /** Hours given across all pillars in the last 7 days, for the header line. */
  const [weekTotalMinutes, setWeekTotalMinutes] = useState(0);
  useEffect(() => {
    let alive = true;
    Promise.all(goals.map((g) => api.getWeeklySecondsByGoal(g.id))).then((secs) => {
      if (alive) setWeekTotalMinutes(Math.round(secs.reduce((a, b) => a + b, 0) / 60));
    });
    return () => {
      alive = false;
    };
  }, [goals]);

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
      <Animated.View entering={enter(0)} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 22 }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={Type.title}>{reorderMode ? 'Set the order' : 'Your pillars'}</Text>
          <Text style={[Type.body, { fontSize: 15, marginTop: 4 }]}>
            {reorderMode
              ? 'Use the arrows to move a pillar.'
              : goals.length === 0
                ? 'Where your hours will go.'
                : weekTotalMinutes > 0
                  ? `${formatMinutes(weekTotalMinutes)} given to your pillars this week.`
                  : 'Every hour you give lands in one of these.'}
          </Text>
        </View>
        {reorderMode ? (
          <PressableScale
            onPress={() => setReorderMode(false)}
            style={{ height: 44, paddingHorizontal: 20, borderRadius: 22, backgroundColor: Surface.ink, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: Surface.surface }}>Done</Text>
          </PressableScale>
        ) : (
          <PressableScale
            onPress={openCreate}
            accessibilityLabel="Add pillar"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Surface.ink, alignItems: 'center', justifyContent: 'center' }}
          >
            <Plus size={22} color={Surface.surface} strokeWidth={2.4} />
          </PressableScale>
        )}
      </Animated.View>

      {goals.length === 0 ? (
        <Animated.View entering={enter(1)} style={{ alignItems: 'center', paddingTop: 36 }}>
          <Mascot mood="wave" size={120} intensity={0.45} />
          <Text style={[Type.title, { textAlign: 'center', marginTop: 18 }]}>Your first pillar</Text>
          <Text style={[Type.body, { textAlign: 'center', marginTop: 8, marginBottom: 28, paddingHorizontal: 12 }]}>
            A pillar is a part of life you want your hours to go to. Start with one.
          </Text>
          <View style={{ alignSelf: 'stretch' }}>
            <CTA label="Add a pillar" onPress={openCreate} />
          </View>
        </Animated.View>
      ) : (
        <>
          {goals.map((g, index) => {
            const card = <GoalCard goal={g} />;
            return (
              <Animated.View key={g.id} entering={enter(index + 1)} layout={LinearTransition.springify().damping(20)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
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
                            style={{ width: 80, height: '100%', minHeight: 96, borderRadius: Radius.lg, backgroundColor: Accent.redSoft, alignItems: 'center', justifyContent: 'center', gap: 6 }}
                          >
                            <Archive size={20} color={Accent.red} strokeWidth={2} />
                            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 13, color: Accent.red }}>Archive</Text>
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
                  gap: 14,
                  minHeight: 64,
                  paddingHorizontal: 16,
                  borderRadius: Radius.lg,
                  backgroundColor: Surface.surfaceRaised,
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Surface.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={20} color={Surface.ink} strokeWidth={2.4} />
                </View>
                <Text style={{ flex: 1, fontFamily: FontFamily.bodyBold, fontSize: 17, color: Surface.ink }}>Add a pillar</Text>
              </PressableScale>

              <PressableScale
                onPress={() => router.push('/session-history')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 24, minHeight: 58, paddingHorizontal: 16, borderRadius: Radius.md, backgroundColor: Surface.surface, ...Elevation.card }}
              >
                <History size={20} color={Surface.ink} strokeWidth={2} />
                <Text style={{ flex: 1, fontFamily: FontFamily.bodyBold, fontSize: 16, color: Surface.ink }}>Session history</Text>
                <ChevronRight size={18} color={Surface.faint} strokeWidth={2.2} />
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
                <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: Surface.ruleStrong }} />
              </View>

              <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[Type.title, { flex: 1 }]}>{editingGoal ? 'Edit pillar' : 'New pillar'}</Text>
                <PressableScale
                  onPress={resetGoalForm}
                  accessibilityLabel="Close"
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Surface.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={18} color={Surface.ink} strokeWidth={2.2} />
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                  <PillarIcon icon={icon} name={name} color={color} size={58} />
                  <TextInput
                    placeholder="Pillar name"
                    placeholderTextColor={Surface.faint}
                    value={name}
                    onChangeText={setName}
                    maxLength={30}
                    style={[sandInputStyle, { flex: 1, minWidth: 0, width: 0, height: 58 }]}
                  />
                </View>

                <FieldLabel>Icon</FieldLabel>
                <View style={{ marginBottom: 24 }}>
                  <IconPicker icon={icon} name={name} color={color} onChange={setIcon} />
                </View>

                <FieldLabel>Colour</FieldLabel>
                <View style={{ marginBottom: 24 }}>
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
                  style={[sandInputStyle, { minHeight: 92, paddingTop: 16, paddingBottom: 16, fontFamily: FontFamily.bodySemiBold, fontSize: 17, lineHeight: 23 }]}
                />
                <Text style={[Type.meta, { textAlign: 'right', marginTop: 6, color: Surface.faint }]}>{why.length} / 140</Text>

                {/* Actions */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 10 }}>
                  <Text style={{ flex: 1, fontFamily: FontFamily.bodyBold, fontSize: 20, color: Surface.ink }}>Daily actions</Text>
                  <Text style={[Type.number, { fontSize: 15 }]}>{actions.length}</Text>
                </View>

                {actions.length === 0 && !showActionComposer ? (
                  <Text style={[Type.body, { fontSize: 15, marginBottom: 12 }]}>What does this pillar get from you every day?</Text>
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
                        backgroundColor: Surface.surfaceRaised,
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
                            <ChevronUp size={16} color={Surface.ink} strokeWidth={2.2} />
                          </IconTap>
                          <IconTap onPress={() => void moveAction(activeIdx, 1)} disabled={activeIdx === activeActions.length - 1} label="Move down">
                            <ChevronDown size={16} color={Surface.ink} strokeWidth={2.2} />
                          </IconTap>
                        </View>
                      ) : null}
                      <ActionTypeDot type={a.type} color={a.is_active ? color : Surface.ruleStrong} />
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
                      {a.is_active ? (
                        <>
                          <IconTap onPress={() => startEditAction(a)} label="Edit action" boxed>
                            <Pencil size={15} color={Surface.ink} strokeWidth={2} />
                          </IconTap>
                          <IconTap onPress={() => void removeAction(a.id)} label="Delete action" boxed>
                            <Trash size={15} color={Accent.red} strokeWidth={2} />
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
                          style={{ paddingHorizontal: 14, height: 34, justifyContent: 'center', borderRadius: Radius.full, backgroundColor: Surface.surface }}
                        >
                          <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: Surface.ink }}>Restore</Text>
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
                      height: 52,
                      borderRadius: 26,
                      backgroundColor: Surface.surfaceRaised,
                      marginTop: 4,
                    }}
                  >
                    <Plus size={18} color={Surface.ink} strokeWidth={2.4} />
                    <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: Surface.ink }}>Add an action</Text>
                  </PressableScale>
                )}

                {showActionComposer && (
                  <Animated.View
                    entering={FadeInDown.springify().damping(20)}
                    style={{ marginTop: 6, backgroundColor: Surface.surface, borderRadius: Radius.lg, padding: 16, ...Elevation.card }}
                  >
                    <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 17, color: Surface.ink, marginBottom: 10 }}>{editingActionId ? 'Edit action' : 'New action'}</Text>
                    <TextInput
                      placeholder="e.g. Morning training"
                      placeholderTextColor={Surface.faint}
                      value={actionName}
                      onChangeText={setActionName}
                      onFocus={nudgeSheetForKeyboard}
                      autoFocus={!editingActionId}
                      style={[sandInputStyle, { height: 58, marginBottom: 18 }]}
                    />

                    <FieldLabel>How do you track it?</FieldLabel>
                    <Segmented
                      value={actionType}
                      color={color}
                      options={[
                        { value: 'session', label: 'Timed session', hint: 'Focus timer, logs minutes', Icon: Timer },
                        { value: 'habit', label: 'Daily habit', hint: 'Just check it off', Icon: CircleCheck },
                      ]}
                      onChange={(v) => {
                        setActionType(v as ActionType);
                      }}
                    />

                    {actionType === 'session' && (
                      <View style={{ marginTop: 18 }}>
                        <FieldLabel>Daily target</FieldLabel>
                        <DurationPicker minutes={actionMinutes} color={color} onChange={setActionMinutes} onInputFocus={nudgeSheetForKeyboard} />
                      </View>
                    )}

                    {/* US-020: Daily reminder */}
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
                      <Animated.View entering={FadeInDown.duration(200)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, marginLeft: 4 }}>
                        <Text style={[Type.body, { fontSize: 15 }]}>Every day at</Text>
                        <TextInput
                          value={actionReminderTime}
                          onChangeText={setActionReminderTime}
                          onFocus={nudgeSheetForKeyboard}
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
                      </Animated.View>
                    )}

                    {actionFeedback ? (
                      <Animated.View entering={FadeIn} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 }}>
                        <CircleCheck size={16} color={Accent.green} strokeWidth={2.2} />
                        <Text style={[Type.meta, { color: Surface.ink }]}>{actionFeedback}</Text>
                      </Animated.View>
                    ) : null}

                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
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
                    <Archive size={16} color={Accent.red} strokeWidth={2} />
                    <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: Accent.red }}>Archive pillar</Text>
                  </PressableScale>
                )}
              </ScrollView>

              <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: goalSheetBottomPad }}>
                <CTA
                  label={editingGoal ? 'Save changes' : 'Create pillar'}
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

function formatMinutes(m: number): string {
  const total = Math.max(0, Math.round(m));
  const h = Math.floor(total / 60);
  const mm = total % 60;
  if (h === 0) return `${mm}m`;
  return mm === 0 ? `${h}h` : `${h}h ${mm}m`;
}

/** Small round marker telling a timed session from a habit at a glance. */
function ActionTypeDot({ type, color }: { type: ActionType; color: string }) {
  const Glyph = type === 'session' ? Timer : CircleCheck;
  return (
    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Glyph size={16} color="#FFFFFF" strokeWidth={2.2} />
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
      style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Surface.ink, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.18 : 1 }}
    >
      <Glyph size={20} color={Surface.surface} strokeWidth={2.4} />
    </PressableScale>
  );
}

function GoalCard({ goal }: { goal: MetaGoal }) {
  const [weekMinutes, setWeekMinutes] = useState(0);
  const [actions, setActions] = useState<DailyAction[]>([]);
  const [streak, setStreak] = useState(0);
  const tone = getGoalColor(goal);

  useEffect(() => {
    api.getWeeklySecondsByGoal(goal.id).then((s) => setWeekMinutes(Math.round(s / 60)));
    api.getActionsByGoal(goal.id).then((rows) => {
      setActions(rows);
      let best = 0;
      for (const a of rows) best = Math.max(best, api.getActionStreakMetrics(a.id, a.type).current);
      setStreak(best);
    });
    // `goal` is a fresh object on every list refresh, so stats re-query after edits/sessions.
  }, [goal]);

  /** Weekly target = the daily minutes of its timed sessions, seven days running. */
  const weeklyTarget = actions.reduce((sum, a) => sum + (a.type === 'session' ? a.target_minutes || 0 : 0), 0) * 7;
  const progress = weeklyTarget > 0 ? weekMinutes / weeklyTarget : 0;

  return (
    <View style={{ backgroundColor: Surface.surfaceRaised, borderRadius: Radius.lg, padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <PillarIcon icon={goal.icon} name={goal.name} color={tone} size={46} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontFamily: FontFamily.bodyBold, fontSize: 19, lineHeight: 24, color: Surface.ink }}>
            {goal.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 2 }}>
            <AnimatedNumber value={weekMinutes} format={formatMinutes} style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: Surface.ink }} />
            <Text style={{ fontFamily: FontFamily.body, fontSize: 15, color: Surface.muted }}> given this week</Text>
          </View>
        </View>
        <ChevronRight size={20} color={Surface.faint} strokeWidth={2.2} />
      </View>

      {weeklyTarget > 0 ? (
        <View style={{ marginTop: 14 }}>
          <ProgressBar progress={progress} color={tone} trackColor={Surface.rule} height={5} />
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: weeklyTarget > 0 ? 10 : 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <ListChecks size={14} color={Surface.muted} strokeWidth={2} />
          <Text style={Type.meta}>
            {actions.length} {actions.length === 1 ? 'action' : 'actions'}
          </Text>
        </View>
        {streak > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Flame size={14} color={Accent.orange} strokeWidth={2.2} />
            <Text style={[Type.meta, { color: Surface.ink }]}>{streak}-day streak</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        {weeklyTarget > 0 ? (
          <Text numberOfLines={1} style={[Type.meta, { color: progress >= 1 ? Accent.green : Surface.muted }]}>
            {progress >= 1 ? 'Week target met' : `${Math.round(progress * 100)}% of week`}
          </Text>
        ) : null}
      </View>

      {goal.why_statement?.trim() ? (
        <Text
          numberOfLines={2}
          style={{ fontFamily: FontFamily.body, fontSize: 14, lineHeight: 19, color: Surface.muted, marginTop: 12, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: Accent.blue }}
        >
          {goal.why_statement.trim()}
        </Text>
      ) : null}
    </View>
  );
}
