/**
 * Goal Detail screen — US-012, US-013, US-021
 *
 * US-012: Inline name / color / why editing (saves immediately on blur / toggle).
 * US-013: Shows both current streak and best streak; actions reorderable inline.
 * US-021: Action edit form embedded directly on this screen.
 */
import { useCallback, useState, useRef, type ReactNode } from 'react';
import { View, Text, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform, ActionSheetIOS, Switch } from 'react-native';
import { Stack, useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import {
  Archive,
  Bell,
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
  Timer,
  Trophy,
  type LucideIcon,
} from 'lucide-react-native';
import { hapticWarning, hapticLight } from '@/utils/haptics';
import * as api from '@/db/api';
import type { DailyAction, MetaGoal, ActionType } from '@/types';
import { Colors, Elevation, FontFamily, Radius, Surface, Type, hexToRgba } from '@/constants/design';
import { getGoalColor } from '@/utils/goalColors';
import { PrimaryButton } from '@/components/PrimaryButton';
import { AnimatedNumber, PressableScale, enter } from '@/components/ui/motion';
import { PillarIcon } from '@/components/ui/PillarIcon';
import { ColorPicker, DurationPicker, FieldLabel, IconPicker, IconTap, Segmented } from '@/components/ui/PillarForm';
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
      actions.forEach((a) => void cancelActionReminder(a.id));
      await api.archiveGoal(goal!.id);
      router.back();
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Keep the history.',
          message: `Archiving ${goal?.name} removes it from active planning. Past sessions and insights stay in your ledger.`,
          options: ['Keep active', `Archive ${goal?.name}`],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 0,
        },
        (idx) => { if (idx === 1) void doArchive(); }
      );
    } else {
      Alert.alert(
        'Keep the history.',
        `Archiving ${goal?.name} removes it from active planning. Past sessions and insights stay in your ledger.`,
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
      };
      if (reminderTime) void scheduleActionReminder(updatedAction, goal.name);
      else void cancelActionReminder(editingActionId);
    } else {
      const newAction = await api.addAction({
        goal_id: goal.id, name: actionName.trim(), type: actionType,
        target_minutes: actionType === 'session' ? Math.max(1, actionMinutes) : 60,
        reminder_time: reminderTime, is_active: 1, sort_order: actions.length,
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
        <Text style={[Type.body, { textAlign: 'center' }]}>{!id ? 'Missing pillar.' : 'Pillar not found or archived.'}</Text>
        <View style={{ marginTop: 16 }}>
          <PrimaryButton title="Go back" appearance="ghost" fullWidth={false} onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const tone = getGoalColor(goal);
  const activeActions = actions.filter((a) => a.is_active);
  const lifetimeHours = lifetimeSec / 3600;

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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <RoundButton label="Back" onPress={() => (editingGoalFields ? setEditingGoalFields(false) : router.back())}>
              <ChevronLeft size={20} color={Surface.ink} strokeWidth={2} />
            </RoundButton>
            <View style={{ flex: 1 }} />
            {!editingGoalFields && (
              <>
                <RoundButton label="Archive pillar" onPress={confirmArchive}>
                  <Archive size={17} color={Surface.muted} strokeWidth={1.9} />
                </RoundButton>
                <RoundButton label="Edit pillar" onPress={() => setEditingGoalFields(true)}>
                  <Pencil size={17} color={Surface.ink} strokeWidth={1.9} />
                </RoundButton>
              </>
            )}
          </View>

          {editingGoalFields ? (
            <Animated.View entering={FadeInDown.springify().damping(20)} style={{ backgroundColor: Surface.surface, borderRadius: Radius.lg, padding: 18, marginBottom: 20, ...Elevation.card }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                <PillarIcon icon={editIcon} name={editName} color={editColor} size={52} />
                <TextInput
                  placeholder="Pillar name"
                  placeholderTextColor={Surface.faint}
                  value={editName}
                  onChangeText={(t) => setEditName(t.slice(0, 30))}
                  maxLength={30}
                  style={{ flex: 1, fontFamily: FontFamily.display, fontSize: 28, color: Surface.ink, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Surface.rule }}
                />
              </View>

              <FieldLabel>Icon</FieldLabel>
              <View style={{ marginBottom: 20 }}>
                <IconPicker icon={editIcon} name={editName} color={editColor} onChange={setEditIcon} />
              </View>

              <FieldLabel>Color</FieldLabel>
              <View style={{ marginBottom: 20 }}>
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
                style={{ minHeight: 80, backgroundColor: Surface.canvas, borderRadius: Radius.md, padding: 14, fontFamily: FontFamily.body, fontSize: 16, lineHeight: 22, color: Surface.ink }}
              />
              <Text style={[Type.meta, { textAlign: 'right', marginTop: 6, color: Surface.faint }]}>{editWhy.length} / 140</Text>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton title="Cancel" appearance="ghost" color={Surface.muted} onPress={() => { setEditingGoalFields(false); void load(); }} />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton title="Save" onPress={saveGoalEdits} disabled={!editName.trim()} />
                </View>
              </View>
            </Animated.View>
          ) : (
            <>
              {/* Identity */}
              <Animated.View entering={enter(0)} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <PillarIcon icon={goal.icon} name={goal.name} color={tone} size={64} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={2} style={[Type.title, { fontSize: 40, lineHeight: 42 }]}>{goal.name}</Text>
                  <Text style={[Type.number, { marginTop: 4 }]}>
                    {activeActions.length} active action{activeActions.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              </Animated.View>

              {/* Why */}
              <Animated.View entering={enter(1)}>
                {goal.why_statement?.trim() ? (
                  <Text style={{ fontFamily: FontFamily.displayItalic, fontSize: 22, lineHeight: 28, color: Surface.ink, paddingLeft: 14, borderLeftWidth: 2, borderLeftColor: tone, marginBottom: 22 }}>
                    {goal.why_statement.trim()}
                  </Text>
                ) : (
                  <PressableScale onPress={() => setEditingGoalFields(true)} style={{ paddingLeft: 14, borderLeftWidth: 2, borderLeftColor: Surface.ruleStrong, marginBottom: 22 }}>
                    <Text style={[Type.body, { color: Surface.faint }]}>Add the reason this pillar matters →</Text>
                  </PressableScale>
                )}
              </Animated.View>

              {/* Stats */}
              <Animated.View entering={enter(2)} style={{ flexDirection: 'row', gap: 10, marginBottom: 28 }}>
                <StatTile Icon={Clock} label="Lifetime" color={Surface.ink} value={lifetimeHours} format={(n) => (lifetimeSec > 0 && n < 0.1 ? '<0.1h' : `${n.toFixed(1)}h`)} />
                <StatTile Icon={Flame} label="Streak" color={currentStreak > 0 ? tone : Surface.ink} value={currentStreak} format={(n) => `${Math.round(n)}d`} />
                <StatTile Icon={Trophy} label="Best" color={Surface.ink} value={bestStreak} format={(n) => `${Math.round(n)}d`} />
              </Animated.View>
            </>
          )}

          {/* Actions */}
          {!editingGoalFields && (
            <Animated.View entering={enter(3)} style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Text style={[Type.heading, { flex: 1 }]}>Daily actions</Text>
                {!showActionForm && (
                  <PressableScale
                    onPress={openNewAction}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: Radius.full, backgroundColor: hexToRgba(tone, 0.12) }}
                  >
                    <Plus size={14} color={tone} strokeWidth={2.4} />
                    <Text style={[Type.meta, { color: tone, fontSize: 14 }]}>Add</Text>
                  </PressableScale>
                )}
              </View>

              {actions.length === 0 && !showActionForm ? <Text style={[Type.body, { fontSize: 15 }]}>No actions yet.</Text> : null}

              {actions.map((a) => {
                const activeIdx = activeActions.findIndex((x) => x.id === a.id);
                return (
                  <Animated.View
                    key={a.id}
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
                      opacity: a.is_active ? 1 : 0.55,
                      ...Elevation.card,
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
                    <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: a.is_active ? tone : Surface.ruleStrong }} />
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
                    <IconTap onPress={() => openEditAction(a)} label="Edit action" boxed>
                      <Pencil size={15} color={Surface.muted} strokeWidth={1.9} />
                    </IconTap>
                    <IconTap onPress={() => void toggleActionActive(a)} label={a.is_active ? 'Pause action' : 'Resume action'} boxed>
                      {a.is_active ? <Pause size={15} color={Surface.muted} strokeWidth={1.9} /> : <Play size={15} color={Colors.accentSuccess} strokeWidth={1.9} />}
                    </IconTap>
                  </Animated.View>
                );
              })}

              {/* US-021: inline action form */}
              {showActionForm && (
                <Animated.View entering={FadeInDown.springify().damping(20)} style={{ marginTop: 6, backgroundColor: Surface.surface, borderRadius: Radius.lg, padding: 16, ...Elevation.card }}>
                  <Text style={[Type.eyebrow, { marginBottom: 6 }]}>{editingActionId ? 'Edit action' : 'New action'}</Text>
                  <TextInput
                    placeholder="e.g. Morning training"
                    placeholderTextColor={Surface.faint}
                    value={actionName}
                    onChangeText={setActionName}
                    autoFocus={!editingActionId}
                    style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 19, color: Surface.ink, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Surface.rule, marginBottom: 14 }}
                  />

                  <Segmented
                    value={actionType}
                    color={tone}
                    options={[
                      { value: 'session', label: 'Timed session', Icon: Timer },
                      { value: 'habit', label: 'Habit', Icon: CircleCheck },
                    ]}
                    onChange={(v) => setActionType(v as ActionType)}
                  />

                  {actionType === 'session' && (
                    <View style={{ marginTop: 14 }}>
                      <Text style={[Type.meta, { marginBottom: 8 }]}>Daily target</Text>
                      <DurationPicker minutes={actionMinutes} color={tone} onChange={setActionMinutes} />
                    </View>
                  )}

                  <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Bell size={16} color={Surface.muted} strokeWidth={1.9} />
                    <Text style={[Type.heading, { flex: 1, fontSize: 15 }]}>Daily reminder</Text>
                    <Switch
                      value={actionReminderEnabled}
                      onValueChange={setActionReminderEnabled}
                      trackColor={{ false: Surface.ruleStrong, true: tone }}
                      thumbColor={Surface.surface}
                      ios_backgroundColor={Surface.ruleStrong}
                    />
                  </View>
                  {actionReminderEnabled && (
                    <Animated.View entering={FadeInDown.duration(200)} style={{ marginTop: 10, marginLeft: 26 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={Type.meta}>Every day at</Text>
                        <TextInput
                          value={actionReminderTime}
                          onChangeText={setActionReminderTime}
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
                      </View>
                      <Text style={[Type.meta, { marginTop: 8, color: Surface.faint }]}>“{formatReminderPreview(goal.name, actionName)}”</Text>
                    </Animated.View>
                  )}

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
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
            <Animated.View entering={enter(4)} style={{ gap: 10 }}>
              <LinkRow Icon={History} label="Session history" onPress={() => router.push(`/session-history?goalId=${encodeURIComponent(goal.id)}`)} />
              <LinkRow Icon={ImageIcon} label="Create goal wallpaper" color={tone} onPress={() => setShowWallpaper(true)} />
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
      style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: Surface.surface, alignItems: 'center', justifyContent: 'center', ...Elevation.card }}
    >
      {children}
    </PressableScale>
  );
}

function StatTile({ Icon, label, value, format, color }: { Icon: LucideIcon; label: string; value: number; format: (n: number) => string; color: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: Surface.surface, borderRadius: Radius.lg, padding: 14, ...Elevation.card }}>
      <Icon size={16} color={Surface.faint} strokeWidth={1.9} />
      <AnimatedNumber value={value} format={format} style={{ fontFamily: FontFamily.display, fontSize: 32, lineHeight: 36, color, marginTop: 8 }} />
      <Text style={[Type.meta, { fontSize: 12 }]}>{label}</Text>
    </View>
  );
}

function LinkRow({ Icon, label, onPress, color = Surface.ink }: { Icon: LucideIcon; label: string; onPress: () => void; color?: string }) {
  return (
    <PressableScale
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: Radius.lg, backgroundColor: Surface.surface, ...Elevation.card }}
    >
      <Icon size={18} color={color === Surface.ink ? Surface.muted : color} strokeWidth={1.8} />
      <Text style={[Type.heading, { flex: 1, fontSize: 16, color }]}>{label}</Text>
      <ChevronRight size={18} color={Surface.faint} strokeWidth={2} />
    </PressableScale>
  );
}
