import { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, ScrollView, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Swipeable, TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Colors } from '@/constants/design';
import { useGoals } from '@/db/hooks';
import * as api from '@/db/api';
import type { MetaGoal, DailyAction, ActionType } from '@/types';
import { shadows } from '@/styles/shadows';
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
  const params = useLocalSearchParams<{ create?: string | string[] }>();
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
  const [actionFeedback, setActionFeedback] = useState('');
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
    setActionFeedback('');
  };

  const loadActions = async (goalId: string) => {
    const rows = await api.getActionsByGoal(goalId);
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
    setColor(getGoalColor(g.id));
    setIcon(g.icon);
    setWhy(g.why_statement || '');
    loadActions(g.id);
    setShowActionComposer(false);
    resetActionForm();
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

    if (editingActionId) {
      await api.updateAction(editingActionId, {
        name: trimmed,
        type: actionType,
        target_minutes: actionType === 'session' ? actionMinutes : 60,
      });
    } else {
      await api.addAction({
        goal_id: currentGoal.id,
        name: trimmed,
        type: actionType,
        target_minutes: actionType === 'session' ? actionMinutes : 60,
        reminder_time: null,
        is_active: 1,
        sort_order: actions.length,
      });
    }
    await loadActions(currentGoal.id);
    setEditingActionId(null);
    setActionName('');
    setActionType('session');
    setActionMinutes(60);
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
    setShowActionComposer(true);
  };

  const startCreateAction = () => {
    setEditingActionId(null);
    setActionName('');
    setActionType('session');
    setActionMinutes(60);
    setShowActionComposer(true);
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
      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [goals, refresh]
  );

  const enterReorderMode = useCallback(() => {
    setReorderMode(true);
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: reorderMode ? 'Reorder goals' : 'My Goals',
      headerRight: () =>
        reorderMode ? (
          <Pressable onPress={() => setReorderMode(false)} hitSlop={10} className="mr-2 py-1 px-2">
            <Text className="text-subheadline font-semibold text-accent-blue">Done</Text>
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

  const listHeader =
    goals.length > 0 ? (
      <View className="mb-3">
        <Text className="text-footnote uppercase tracking-wider text-text-tertiary">Goal Manager</Text>
        {reorderMode ? (
          <Text className="text-caption text-accent-blue mt-1 opacity-90">
            Reorder mode — use arrows, then tap Done
          </Text>
        ) : (
          <Text className="text-caption text-text-tertiary mt-1 opacity-80">
            Long press a goal to reorder · Swipe left to archive (native)
          </Text>
        )}
      </View>
    ) : null;

  const listFooter = (
    <>
      <AddGoalCard onPress={openCreate} />
      {goals.length === 0 ? (
        <Text className="text-subheadline text-text-secondary text-center px-6 pt-4">
          Add your first goal, then attach daily actions to make it real.
        </Text>
      ) : null}
    </>
  );

  const goalList = (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 44 }}
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
                className="w-9 h-9 rounded-md bg-bg-secondary border border-separator items-center justify-center"
                style={{ opacity: index === 0 ? 0.35 : 1 }}
              >
                <Ionicons name="chevron-up" size={18} color={Colors.textPrimary} />
              </Pressable>
              <Pressable
                onPress={() => void moveGoal(index, 1)}
                disabled={index === goals.length - 1}
                className="w-9 h-9 rounded-md bg-bg-secondary border border-separator items-center justify-center"
                style={{ opacity: index === goals.length - 1 ? 0.35 : 1 }}
              >
                <Ionicons name="chevron-down" size={18} color={Colors.textPrimary} />
              </Pressable>
            </View>
          ) : null}

          <View className="flex-1 min-w-0">
            {Platform.OS === 'web' ? (
              <Pressable
                onPress={reorderMode ? undefined : () => openEdit(g)}
                onLongPress={reorderMode ? undefined : enterReorderMode}
                delayLongPress={320}
              >
                <GoalCard goal={g} />
              </Pressable>
            ) : reorderMode ? (
              <TouchableOpacity activeOpacity={0.92} onPress={() => openEdit(g)} delayLongPress={320}>
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
                      className="h-[96px] w-[88px] rounded-lg items-center justify-center bg-accent-danger"
                    >
                      <Text className="text-[10px] uppercase font-bold text-white tracking-wide">Archive</Text>
                    </Pressable>
                  </View>
                )}
              >
                <TouchableOpacity
                  activeOpacity={0.92}
                  onPress={() => openEdit(g)}
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
              className="w-14 rounded-lg bg-bg-secondary border border-separator items-center justify-center self-stretch"
              style={shadows.card}
            >
              <Text className="text-[8px] uppercase text-accent-danger font-bold text-center px-1">Archive</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      {listFooter}
    </ScrollView>
  );

  return (
    <View className="flex-1 bg-bg-primary">
      {goalList}

      {showGoalForm && (
        <View className="absolute inset-0 bg-black/35 z-50">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 justify-end"
          >
            <View
              className="bg-bg-primary rounded-t-xl"
              style={[shadows.modal, { maxHeight: '90%' }]}
            >
              <View className="pt-2 pb-3 items-center">
                <View className="w-9 h-1 rounded-full bg-separator" />
              </View>

              <View className="px-4 flex-row justify-between items-center pb-4">
                <Text className="text-title2 font-semibold text-text-primary">
                  {editingGoal ? 'Edit Goal' : 'New Goal'}
                </Text>
                <Pressable
                  onPress={resetGoalForm}
                  className="w-8 h-8 rounded-full bg-bg-tertiary items-center justify-center"
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
                  <Text className="text-footnote text-text-tertiary uppercase tracking-wider mb-2">
                    Goal Identity
                  </Text>
                  <View className="flex-row items-center gap-3">
                    <View
                      className="w-11 h-11 rounded-full items-center justify-center border-2"
                      style={{ backgroundColor: color + '22', borderColor: color }}
                    >
                      <TextInput
                        className="text-[22px] text-center"
                        value={icon}
                        onChangeText={(t) => setIcon(t.slice(-2) || '⭐')}
                        maxLength={2}
                      />
                    </View>
                    <TextInput
                      className="flex-1 bg-bg-secondary rounded-lg h-[50px] px-4 text-title3 text-text-primary"
                      placeholder="Goal name"
                      placeholderTextColor={Colors.textTertiary}
                      value={name}
                      onChangeText={setName}
                      maxLength={30}
                    />
                  </View>
                </View>

                <View className="mb-6">
                  <Text className="text-footnote text-text-tertiary uppercase tracking-wider mb-2">
                    Color Theme
                  </Text>
                  <View className="flex-row gap-3">
                    {GOAL_PRESETS.map((p) => (
                      <Pressable
                        key={p.color}
                        onPress={() => setColor(p.color)}
                        className="w-9 h-9 rounded-full items-center justify-center border-2"
                        style={{
                          backgroundColor: p.color,
                          borderColor: color === p.color ? Colors.backgroundPrimary : 'transparent',
                          shadowColor: color === p.color ? '#000000' : 'transparent',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: color === p.color ? 0.08 : 0,
                          shadowRadius: 3,
                          elevation: color === p.color ? 2 : 0,
                        }}
                      />
                    ))}
                  </View>
                </View>

                <View className="mb-6">
                  <Text className="text-footnote text-text-tertiary uppercase tracking-wider mb-2">
                    Your Why
                  </Text>
                  <TextInput
                    className="bg-bg-secondary rounded-lg p-4 text-body text-text-primary min-h-[100px]"
                    placeholder="Why does this goal matter to you?"
                    placeholderTextColor={Colors.textTertiary}
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
                    <Text className="text-footnote text-text-tertiary uppercase tracking-wider">Daily Actions</Text>
                    <View className="flex-row items-center gap-2">
                      <View className="px-2 py-0.5 rounded-full bg-bg-tertiary">
                        <Text className="text-caption text-text-secondary">{actions.length} total</Text>
                      </View>
                      <Pressable
                        onPress={doneWithGoalSetup}
                        className="px-3 py-1 rounded-full border border-separator bg-bg-primary"
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

                  {actions.map((a) => (
                    <View
                      key={a.id}
                      className="flex-row items-center bg-bg-secondary rounded-lg p-3 mb-2"
                      style={shadows.card}
                    >
                      <View className="w-1 self-stretch rounded-full mr-3" style={{ backgroundColor: Colors.textPrimary }} />
                      <View className="flex-1">
                        <Text className="text-headline font-semibold text-text-primary">{a.name}</Text>
                        <Text className="text-footnote text-text-secondary">
                          {a.type === 'session' ? `${a.target_minutes}m target` : 'Habit'}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => startEditAction(a)}
                        className="bg-bg-primary w-9 h-9 rounded-md items-center justify-center mr-2"
                        style={shadows.card}
                      >
                        <Ionicons name="create-outline" size={16} color={Colors.textSecondary} />
                      </Pressable>
                      <Pressable
                        onPress={() => removeAction(a.id)}
                        className="bg-bg-primary w-9 h-9 rounded-md items-center justify-center"
                        style={shadows.card}
                      >
                        <Ionicons name="trash-outline" size={16} color={Colors.accentDanger} />
                      </Pressable>
                    </View>
                  ))}

                  <Pressable
                    onPress={startCreateAction}
                    className="h-14 rounded-lg border-2 border-dashed border-separator items-center justify-center flex-row gap-2 mt-2 mb-3"
                  >
                    <Ionicons name="add" size={20} color={Colors.accentBlue} />
                    <Text className="text-headline text-accent-blue font-semibold">Add New Action</Text>
                  </Pressable>

                  {showActionComposer && (
                    <View className="mt-1 mb-2 bg-bg-secondary rounded-lg p-4 border border-separator">
                      <Text className="text-headline font-semibold text-text-primary mb-3">
                        {editingActionId ? 'Edit Action' : 'New Action'}
                      </Text>
                      <TextInput
                        className="bg-bg-primary rounded-md h-11 px-3 text-body text-text-primary mb-3 border border-separator"
                        placeholder="Action name"
                        placeholderTextColor={Colors.textTertiary}
                        value={actionName}
                        onChangeText={setActionName}
                      />
                      <View className="flex-row gap-2 mb-3">
                        <Pressable
                          onPress={() => setActionType('session')}
                          className={`flex-1 h-10 rounded-md items-center justify-center border ${actionType === 'session' ? 'bg-accent-blue border-accent-blue' : 'bg-bg-primary border-separator'}`}
                        >
                          <Text className={`text-subheadline font-semibold ${actionType === 'session' ? 'text-text-inverse' : 'text-text-secondary'}`}>
                            Session
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setActionType('habit')}
                          className={`flex-1 h-10 rounded-md items-center justify-center border ${actionType === 'habit' ? 'bg-accent-blue border-accent-blue' : 'bg-bg-primary border-separator'}`}
                        >
                          <Text className={`text-subheadline font-semibold ${actionType === 'habit' ? 'text-text-inverse' : 'text-text-secondary'}`}>
                            Habit
                          </Text>
                        </Pressable>
                      </View>
                      {actionType === 'session' && (
                        <View className="flex-row items-center gap-3 mb-4">
                          <Text className="text-subheadline text-text-secondary">Target:</Text>
                          <TextInput
                            className="bg-bg-primary rounded-md h-10 px-3 text-body border border-separator w-20 text-center text-text-primary font-semibold"
                            keyboardType="number-pad"
                            value={String(actionMinutes)}
                            onChangeText={(t) => setActionMinutes(Math.max(1, Number(t.replace(/\D/g, '') || '0')))}
                          />
                          <Text className="text-subheadline text-text-secondary">minutes</Text>
                        </View>
                      )}
                      {actionFeedback ? (
                        <View className="mb-3 px-3 py-2 rounded-md border border-separator bg-bg-primary flex-row items-center">
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
                          <Pressable
                            onPress={saveAction}
                            disabled={!actionName.trim()}
                            className="h-9 rounded-full items-center justify-center px-4"
                            style={({ pressed }) => ({
                              backgroundColor: !actionName.trim() ? '#1A1A1A' : '#2A2A2A',
                              borderWidth: 0.5,
                              borderColor: !actionName.trim() ? '#222222' : Colors.accentBlue,
                              opacity: pressed ? 0.9 : 1,
                            })}
                          >
                            <Text
                              className="text-[15px] font-semibold"
                              style={{ color: !actionName.trim() ? '#555555' : '#E8E4DC' }}
                            >
                              {editingActionId ? 'Save Action' : 'Add Action'}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              </ScrollView>

              <View className="px-4 pb-6 pt-3 border-t border-separator bg-bg-primary">
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
      className="h-[96px] rounded-lg bg-bg-secondary border border-separator px-3 flex-row items-center mb-2 overflow-hidden"
      style={shadows.card}
    >
      <View className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: tone }} />
      <View className="w-9 h-9 rounded-md items-center justify-center" style={{ backgroundColor: '#0D0D0D', borderWidth: 0.5, borderColor: '#222222' }}>
        <Text className="text-[16px]">{goal.icon}</Text>
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-[18px] font-bold text-text-primary">{goal.name}</Text>
        <Text className="text-[8px] uppercase tracking-[1.3px] text-text-secondary">
          {actions.length} daily {actions.length === 1 ? 'action' : 'actions'}
        </Text>
      </View>
      <View className="items-end pr-1">
        <Text className="text-[12px] font-bold" style={{ color: tone }}>
          {hours.toFixed(1)}h
        </Text>
        <Text className="text-[7px] uppercase tracking-[1.4px] text-text-tertiary">This Week</Text>
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
      className="h-[96px] rounded-lg border border-dashed border-separator bg-bg-secondary items-center justify-center flex-row gap-2 mb-2"
    >
      <Ionicons name="add" size={20} color={Colors.accentBlue} />
      <Text className="text-[8px] uppercase tracking-[2px] text-accent-blue">Add Goal</Text>
    </Pressable>
  );
}
