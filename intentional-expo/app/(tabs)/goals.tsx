import { useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react';
import { useLocalSearchParams, useRouter, useNavigation, useFocusEffect } from 'expo-router';
import { View, Text, ScrollView, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import {
  Archive,
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
import { cancelActionReminder } from '@/services/notifications';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { Swipeable, TouchableOpacity } from 'react-native-gesture-handler';
import { AnimatedNumber, PressableScale, ProgressBar, enter } from '@/components/ui/motion';
import { PillarIcon } from '@/components/ui/PillarIcon';
import { ColorPicker, FieldLabel, IconPicker, IconTap, habitScheduleText, sandInputStyle } from '@/components/ui/PillarForm';
import { CTA } from '@/components/onboarding/parts';
import { Mascot } from '@/components/onboarding/Mascot';
import { Accent, Colors, Elevation, FontFamily, Radius, Surface, Type, hexToRgba } from '@/constants/design';
import { useGoals } from '@/db/hooks';
import { MAX_PILLARS } from '@/constants/limits';
import * as api from '@/db/api';
import * as goalProgress from '@/services/goalProgress';
import type { MetaGoal, DailyAction, ActionType, Objective, Task } from '@/types';
import { getGoalColor } from '@/utils/goalColors';
import { confirmAsync } from '@/utils/confirm';
import { dismissNudge, getDismissedNudges, isNudgeSnoozed } from '@/utils/goalNudges';

export default function GoalsScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ create?: string | string[]; editGoal?: string | string[] }>();
  const { goals, refresh } = useGoals();
  const [editingGoal, setEditingGoal] = useState<MetaGoal | null>(null);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(Colors.goalPhysique);
  const [icon, setIcon] = useState('target');
  const [why, setWhy] = useState('');
  const [actions, setActions] = useState<DailyAction[]>([]);
  /** US-074: which goal-less pillars may show the "Set a goal" nudge. */
  const [nudgeBlocked, setNudgeBlocked] = useState<Set<string>>(new Set());
  /** US-010: Expo Go–safe reorder (no react-native-draggable-flatlist / worklets mismatch) */
  const [reorderMode, setReorderMode] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const goalSheetScrollRef = useRef<ScrollView>(null);

  const resetGoalForm = () => {
    setEditingGoal(null);
    setShowGoalForm(false);
    setName('');
    setColor(Colors.goalPhysique);
    setIcon('target');
    setWhy('');
    setActions([]);
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
  };
  const openEditRef = useRef(openEdit);
  openEditRef.current = openEdit;

  const goGoalDetail = (g: MetaGoal) => {
    router.push(`/goal/${g.id}`);
  };

  const atPillarLimit = goals.length >= MAX_PILLARS;
  const openCreate = useCallback(() => {
    if (goals.length >= MAX_PILLARS) {
      const msg = `You have ${MAX_PILLARS} pillars. A few pillars, given real hours, beat many that get none. Archive one to make room.`;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Your pillars are full', msg);
      return;
    }
    setShowGoalForm(true);
    setEditingGoal(null);
    setName('');
    setColor(Colors.goalPhysique);
    setIcon('target');
    setWhy('');
    setActions([]);
  }, [goals.length]);

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

  const doneWithGoalSetup = async () => {
    const saved = await ensureGoalSaved();
    if (!saved) return;
    await loadActions(saved.id);
    await refresh();
    resetGoalForm();
  };

  /**
   * US-068/069: ONE habit form — the pillar detail one (duration ≥ 5, weekdays, start time, goal link).
   * Saves the pillar first when it's new, then opens that form.
   */
  const openHabitForm = async (habitId?: string) => {
    const saved = await ensureGoalSaved();
    if (!saved) return;
    await refresh();
    resetGoalForm();
    router.push(habitId ? `/goal/${saved.id}?editHabit=${encodeURIComponent(habitId)}` : `/goal/${saved.id}?addHabit=1`);
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

  const removeAction = async (a: DailyAction) => {
    if (!editingGoal) return;
    const ok = await confirmAsync({
      title: `Delete ${a.name}?`,
      message: 'The habit goes away. Hours you already gave stay in your history.',
      confirmLabel: 'Delete habit',
      destructive: true,
    });
    if (!ok) return;
    void cancelActionReminder(a.id);
    await api.deleteAction(a.id);
    await loadActions(editingGoal.id);
    await refresh();
  };

  const confirmArchiveGoal = useCallback(
    (g: MetaGoal) => {
      const editingId = editingGoal?.id;
      void confirmAsync({
        title: 'Keep the history.',
        message: `Archiving ${g.name} removes it from active planning. Every hour you gave it stays in your history.`,
        confirmLabel: `Archive ${g.name}`,
        cancelLabel: 'Keep active',
        destructive: true,
      }).then(async (ok) => {
        if (!ok) return;
        await cancelGoalReminders(g.id);
        await api.archiveGoal(g.id);
        await refresh();
        if (editingId === g.id) resetGoalForm();
      });
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
  const loadNudges = useCallback(async () => {
    const dismissed = await getDismissedNudges();
    const maintenance = api.getMaintenancePillars();
    const blocked = new Set<string>(maintenance);
    for (const id of Object.keys(dismissed)) if (isNudgeSnoozed(dismissed, id)) blocked.add(id);
    setNudgeBlocked(blocked);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      void loadNudges();
    }, [refresh, loadNudges])
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
            accessibilityLabel="Done reordering"
            style={{ height: 44, paddingHorizontal: 20, borderRadius: 22, backgroundColor: Surface.ink, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: Surface.surface }}>Done</Text>
          </PressableScale>
        ) : (
          <PressableScale
            onPress={openCreate}
            accessibilityLabel="Add pillar"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Surface.ink, alignItems: 'center', justifyContent: 'center', opacity: atPillarLimit ? 0.35 : 1 }}
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
            const card = (
              <GoalCard
                goal={g}
                reorderMode={reorderMode}
                showNudge={!reorderMode && !nudgeBlocked.has(g.id)}
                onOpen={() => goGoalDetail(g)}
                onLongPress={enterReorderMode}
                onSetGoal={() => router.push(`/goal/${g.id}?setGoal=1`)}
                onDismissNudge={async () => {
                  await dismissNudge(g.id);
                  await loadNudges();
                }}
              />
            );
            return (
              <Animated.View key={g.id} entering={enter(index + 1)} layout={LinearTransition.springify().damping(20)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                {reorderMode && (
                  <View style={{ gap: 6 }}>
                    <ReorderButton direction="up" label={`Move ${g.name} up`} disabled={index === 0} onPress={() => void moveGoal(index, -1)} />
                    <ReorderButton direction="down" label={`Move ${g.name} down`} disabled={index === goals.length - 1} onPress={() => void moveGoal(index, 1)} />
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  {reorderMode || Platform.OS === 'web' ? (
                    card
                  ) : (
                    <Swipeable
                      friction={2}
                      overshootRight={false}
                      renderRightActions={() => (
                        <View style={{ justifyContent: 'center', paddingLeft: 10 }}>
                          <TouchableOpacity
                            onPress={() => confirmArchiveGoal(g)}
                            activeOpacity={0.85}
                            accessibilityLabel={`Archive ${g.name}`}
                            style={{ width: 80, height: '100%', minHeight: 96, borderRadius: Radius.lg, backgroundColor: Surface.surfaceRaised, alignItems: 'center', justifyContent: 'center', gap: 6 }}
                          >
                            <Archive size={20} color={Surface.ink} strokeWidth={2} />
                            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 13, color: Surface.ink }}>Archive</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    >
                      {card}
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
                accessibilityLabel="Add a pillar"
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
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 17, color: atPillarLimit ? Surface.muted : Surface.ink }}>
                    {atPillarLimit ? `${MAX_PILLARS} of ${MAX_PILLARS} pillars` : 'Add a pillar'}
                  </Text>
                  <Text style={{ fontFamily: FontFamily.body, fontSize: 13, color: Surface.muted, marginTop: 1 }}>
                    {atPillarLimit ? 'Archive one to make room for another.' : `${goals.length} of ${MAX_PILLARS}. Keep it to the few that matter.`}
                  </Text>
                </View>
              </PressableScale>

              <PressableScale
                onPress={() => router.push('/session-history')}
                accessibilityLabel="Session history"
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
          <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(180)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: hexToRgba(Surface.ink, 0.38) }}>
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

                {/* Habits — listed here; added and edited in the pillar's one habit form */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 10 }}>
                  <Text style={{ flex: 1, fontFamily: FontFamily.bodyBold, fontSize: 20, color: Surface.ink }}>Habits</Text>
                  <Text style={[Type.number, { fontSize: 15 }]}>{actions.length}</Text>
                </View>

                {actions.length === 0 ? (
                  <Text style={[Type.body, { fontSize: 15, marginBottom: 12 }]}>What does this pillar get from you, and when? Run, read, call home, etc.</Text>
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
                          <IconTap onPress={() => void moveAction(activeIdx, -1)} disabled={activeIdx === 0} label={`Move ${a.name} up`}>
                            <ChevronUp size={16} color={Surface.ink} strokeWidth={2.2} />
                          </IconTap>
                          <IconTap onPress={() => void moveAction(activeIdx, 1)} disabled={activeIdx === activeActions.length - 1} label={`Move ${a.name} down`}>
                            <ChevronDown size={16} color={Surface.ink} strokeWidth={2.2} />
                          </IconTap>
                        </View>
                      ) : null}
                      <ActionTypeDot type={a.type} color={a.is_active ? color : Surface.ruleStrong} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: Surface.ink }}>{a.name}</Text>
                        <Text style={[Type.meta, { marginTop: 2 }]}>
                          {!a.is_active ? 'Paused · ' : ''}
                          {habitScheduleText(a)}
                        </Text>
                      </View>
                      {a.is_active ? (
                        <>
                          <IconTap onPress={() => void openHabitForm(a.id)} label={`Edit habit ${a.name}`} boxed>
                            <Pencil size={15} color={Surface.ink} strokeWidth={2} />
                          </IconTap>
                          <IconTap onPress={() => void removeAction(a)} label={`Delete habit ${a.name}`} boxed>
                            <Trash size={15} color={Surface.muted} strokeWidth={2} />
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
                          accessibilityLabel={`Resume habit ${a.name}`}
                          style={{ paddingHorizontal: 14, height: 34, justifyContent: 'center', borderRadius: Radius.full, backgroundColor: Surface.surface }}
                        >
                          <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: Surface.ink }}>Resume</Text>
                        </PressableScale>
                      )}
                    </Animated.View>
                  );
                })}

                <PressableScale
                  onPress={() => void openHabitForm()}
                  disabled={!name.trim()}
                  accessibilityLabel="Add a habit"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: Surface.surfaceRaised,
                    marginTop: 4,
                    opacity: name.trim() ? 1 : 0.4,
                  }}
                >
                  <Plus size={18} color={Surface.ink} strokeWidth={2.4} />
                  <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: Surface.ink }}>Add a habit</Text>
                </PressableScale>
                {!editingGoal ? (
                  <Text style={[Type.meta, { textAlign: 'center', marginTop: 8 }]}>Name the pillar first. Habits are set up on its page: days, start time, duration.</Text>
                ) : null}

                {editingGoal && (
                  <PressableScale
                    onPress={() => confirmArchiveGoal(editingGoal)}
                    accessibilityLabel="Archive pillar"
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24, paddingVertical: 10 }}
                  >
                    <Archive size={16} color={Surface.muted} strokeWidth={2} />
                    <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: Surface.muted }}>Archive pillar</Text>
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

/** Small round marker: a timed habit, or a legacy check habit still waiting for a duration. */
function ActionTypeDot({ type, color }: { type: ActionType; color: string }) {
  const Glyph = type === 'session' ? Timer : CircleCheck;
  return (
    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Glyph size={16} color={Surface.surface} strokeWidth={2.2} />
    </View>
  );
}

function ReorderButton({ direction, disabled, onPress, label }: { direction: 'up' | 'down'; disabled: boolean; onPress: () => void; label: string }) {
  const Glyph = direction === 'up' ? ChevronUp : ChevronDown;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      scaleTo={0.88}
      style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Surface.ink, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.18 : 1 }}
    >
      <Glyph size={20} color={Surface.surface} strokeWidth={2.4} />
    </PressableScale>
  );
}

function GoalCard({
  goal,
  reorderMode,
  showNudge,
  onOpen,
  onLongPress,
  onSetGoal,
  onDismissNudge,
}: {
  goal: MetaGoal;
  reorderMode: boolean;
  showNudge: boolean;
  onOpen: () => void;
  onLongPress: () => void;
  onSetGoal: () => void;
  onDismissNudge: () => void;
}) {
  const [weekMinutes, setWeekMinutes] = useState(0);
  const [actions, setActions] = useState<DailyAction[]>([]);
  const [streak, setStreak] = useState(0);
  const [objective, setObjective] = useState<Objective | null>(null);
  const [objectiveTasks, setObjectiveTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const tone = getGoalColor(goal);

  useEffect(() => {
    api.getWeeklySecondsByGoal(goal.id).then((s) => setWeekMinutes(Math.round(s / 60)));
    api.getActionsByGoal(goal.id).then((rows) => {
      setActions(rows);
      let best = 0;
      for (const a of rows) best = Math.max(best, api.getActionStreakMetrics(a.id, a.type).current);
      setStreak(best);
    });
    // US-060: active goal
    api.getActiveObjective(goal.id).then(async (obj) => {
      setObjective(obj);
      setObjectiveTasks(obj ? await api.getTasks(obj.id) : []);
      setLoaded(true);
    });
    // `goal` is a fresh object on every list refresh, so stats re-query after edits/sessions.
  }, [goal]);

  /** Weekly target = each timed habit's minutes on its scheduled days. */
  const weeklyTarget = actions.reduce((sum, a) => {
    if (a.type !== 'session') return sum;
    const days = [0, 1, 2, 3, 4, 5, 6].filter((i) => ((a.days_mask ?? 127) & (1 << i)) !== 0).length;
    return sum + (a.target_minutes || 0) * days;
  }, 0);
  const progress = weeklyTarget > 0 ? weekMinutes / weeklyTarget : 0;

  // US-060: goal progress and pace ("behind" is amber, never red)
  const now = new Date();
  const objectiveProgress = objective ? goalProgress.progressOf(objective, objectiveTasks) : null;
  const daysLeft = objective ? goalProgress.daysLeft(objective, now) : 0;
  const pace = objective ? goalProgress.paceOf(objective, objectiveTasks, now) : 'unknown';
  const paceColor = pace === 'ahead' ? Accent.green : pace === 'behind' ? Accent.amber : Surface.ink;
  const daysText = daysLeft < 0 ? 'Deadline passed · set a new date' : daysLeft === 0 ? 'Due today' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;

  return (
    <View style={{ backgroundColor: Surface.surfaceRaised, borderRadius: Radius.lg, overflow: 'hidden' }}>
      <PressableScale
        onPress={reorderMode ? undefined : onOpen}
        onLongPress={reorderMode ? undefined : onLongPress}
        delayLongPress={350}
        disabled={reorderMode}
        accessibilityLabel={`Open ${goal.name}`}
        style={{ padding: 16 }}
      >
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

        {objective ? (
          <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Surface.rule }}>
            <Text numberOfLines={1} style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: Surface.ink, marginBottom: 6 }}>
              {objective.title}
            </Text>
            <View style={{ marginBottom: 8 }}>
              <ProgressBar progress={objectiveProgress ?? 0} color={tone} trackColor={Surface.rule} height={3} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 12, rowGap: 2 }}>
              <Text style={[Type.meta, { color: daysLeft < 0 ? Accent.amber : Surface.ink }]}>{daysText}</Text>
              {pace !== 'unknown' && (
                <Text style={[Type.meta, { color: paceColor }]}>
                  {pace === 'ahead' ? '↗ ahead' : pace === 'on_track' ? '→ on track' : '↘ behind'}
                </Text>
              )}
            </View>
          </View>
        ) : null}

        {weeklyTarget > 0 ? (
          <View style={{ marginTop: 14 }}>
            <ProgressBar progress={progress} color={tone} trackColor={Surface.rule} height={5} />
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: weeklyTarget > 0 ? 10 : 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <ListChecks size={14} color={Surface.muted} strokeWidth={2} />
            <Text style={Type.meta}>
              {actions.length} {actions.length === 1 ? 'habit' : 'habits'}
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
      </PressableScale>

      {/* US-074: soft "Set a goal" nudge — a sibling of the card's pressable, never nested in it */}
      {loaded && !objective && showNudge ? (
        <View style={{ marginHorizontal: 16, marginBottom: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: Surface.rule }}>
          <Text style={{ fontFamily: FontFamily.body, fontSize: 14, color: Surface.muted, lineHeight: 20 }}>
            <Text style={{ color: tone, fontFamily: FontFamily.bodyBold }}>{goal.name}</Text> has no goal yet. What would winning look like?
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <PressableScale
              onPress={onSetGoal}
              accessibilityLabel={`Set a goal for ${goal.name}`}
              style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: Surface.surface, justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: Surface.ink }}>Set goal</Text>
            </PressableScale>
            <PressableScale
              onPress={onDismissNudge}
              accessibilityLabel={`Not now, ${goal.name}`}
              style={{ height: 34, paddingHorizontal: 10, justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: Surface.muted }}>Not now</Text>
            </PressableScale>
          </View>
        </View>
      ) : null}
    </View>
  );
}
