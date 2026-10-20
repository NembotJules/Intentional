/**
 * Objective (Goal) Detail screen — US-061, US-062
 *
 * US-061: One place for everything about a goal: progress, tasks, linked habits, sessions.
 * US-062: Complete a goal with celebration and next-goal flow.
 */
import { useCallback, useState, useRef } from 'react';
import { View, Text, ScrollView, TextInput, Alert, Modal } from 'react-native';
import { Stack, useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import {
  ChevronLeft,
  Clock,
  Flame,
  Pencil,
  Target,
  TrendingUp,
  Trophy,
} from 'lucide-react-native';
import { hapticLight, hapticSuccess, hapticHeavy } from '@/utils/haptics';
import * as api from '@/db/api';
import * as goalProgress from '@/services/goalProgress';
import type { Objective, Task, MetaGoal, DailyAction } from '@/types';
import { Accent, Elevation, FontFamily, Radius, Surface, Type } from '@/constants/design';
import { getGoalColor } from '@/utils/goalColors';
import { PrimaryButton } from '@/components/PrimaryButton';
import { AnimatedNumber, PressableScale, ProgressBar, enter } from '@/components/ui/motion';
import { PillarIcon } from '@/components/ui/PillarIcon';
import { FieldLabel, sandInputStyle } from '@/components/ui/PillarForm';
import { Mascot, type MascotMood } from '@/components/onboarding/Mascot';
import { Confetti } from '@/components/onboarding/FlickScenes';

export default function ObjectiveDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [objective, setObjective] = useState<Objective | null>(null);
  const [pillar, setPillar] = useState<MetaGoal | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<DailyAction[]>([]);
  const [weekMinutes, setWeekMinutes] = useState(0);
  const [lifetimeMinutes, setLifetimeMinutes] = useState(0);

  // Edit state
  const [showEditForm, setShowEditForm] = useState(false);
  
  // US-062: Complete state
  const [showCelebration, setShowCelebration] = useState(false);
  const [reflection, setReflection] = useState('');
  const [nextObjective, setNextObjective] = useState<Objective | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDoneWhen, setEditDoneWhen] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editMetricCurrent, setEditMetricCurrent] = useState('');
  const [editMetricTarget, setEditMetricTarget] = useState('');
  const [editMetricUnit, setEditMetricUnit] = useState('');

  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const obj = await api.getObjectives().then((all) => all.find((o) => o.id === id) ?? null);
    setObjective(obj);
    if (!obj) { setTasks([]); setHabits([]); return; }

    const p = await api.getGoalById(obj.pillar_id);
    setPillar(p);
    
    const t = await api.getTasks(obj.id);
    setTasks(t);

    const h = await api.getActionsByGoal(obj.pillar_id).then((acts) =>
      acts.filter((a) => a.objective_id === obj.id)
    );
    setHabits(h);

    setWeekMinutes(await api.getMinutesForObjective(obj.id, {
      start: getWeekStart(),
      end: new Date().toISOString(),
    }));
    setLifetimeMinutes(await api.getMinutesForObjective(obj.id));

    // Seed edit fields
    setEditTitle(obj.title);
    setEditDoneWhen(obj.done_when);
    setEditDeadline(obj.deadline);
    setEditMetricCurrent(obj.metric_current?.toString() ?? '');
    setEditMetricTarget(obj.metric_target?.toString() ?? '');
    setEditMetricUnit(obj.metric_unit ?? '');
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const openEdit = () => {
    setShowEditForm(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
  };

  const saveEdit = async () => {
    if (!objective || !editTitle.trim()) return;
    try {
      await api.updateObjective(objective.id, {
        title: editTitle.trim().slice(0, 60),
        done_when: editDoneWhen.trim().slice(0, 140),
        deadline: editDeadline,
        metric_current: editMetricCurrent ? parseFloat(editMetricCurrent) : null,
        metric_target: editMetricTarget ? parseFloat(editMetricTarget) : null,
        metric_unit: editMetricUnit.trim() || null,
      });
      setShowEditForm(false);
      void load();
    } catch (err) {
      if (err instanceof Error) {
        Alert.alert('Error', err.message);
      }
    }
  };

  // US-062: Complete goal
  const confirmComplete = () => {
    Alert.alert(
      'Mark as achieved?',
      `Celebrate completing ${objective?.title}. Unfinished tasks stay in your history.`,
      [
        { text: 'Not yet', style: 'cancel' },
        { text: 'Mark achieved', onPress: () => void completeGoal() },
      ]
    );
  };

  const completeGoal = async () => {
    if (!objective) return;
    hapticHeavy();
    await api.setObjectiveStatus(objective.id, 'completed', '');
    
    // Check for next planned objective
    const planned = await api.getObjectives(objective.pillar_id).then((all) =>
      all.filter((o) => o.status === 'planned')
    );
    setNextObjective(planned[0] ?? null);
    
    setShowCelebration(true);
    hapticSuccess();
  };

  const finishCelebration = async () => {
    if (!objective) return;
    if (reflection.trim()) {
      await api.updateObjective(objective.id, { close_note: reflection.trim() });
    }
    setShowCelebration(false);
    setReflection('');
    
    if (nextObjective) {
      // Activate next objective
      await api.setObjectiveStatus(nextObjective.id, 'active');
      router.replace(`/objective/${nextObjective.id}`);
    } else {
      // Go back to pillar detail
      router.back();
    }
  };

  if (!id || !objective || !pillar) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Surface.canvas, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={[Type.heading, { textAlign: 'center', fontSize: 20 }]}>{!id ? 'Missing goal.' : 'Goal not found.'}</Text>
        <View style={{ marginTop: 20, alignSelf: 'stretch' }}>
          <PrimaryButton title="Go back" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const tone = getGoalColor(pillar);
  const now = new Date();
  const progress = goalProgress.progressOf(objective, tasks);
  const daysLeft = goalProgress.daysLeft(objective, now);
  const pace = progress !== null ? goalProgress.paceOf(objective, tasks, now) : 'unknown';

  // Flick mood reflects pace
  const flickMood: MascotMood =
    objective.status === 'completed' ? 'proud' :
    pace === 'ahead' ? 'happy' :
    pace === 'behind' ? 'worried' :
    'calm';
  const flickIntensity =
    objective.status === 'completed' ? 1 :
    pace === 'ahead' ? 0.8 :
    pace === 'behind' ? 0.4 :
    0.6;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Surface.canvas }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 44 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <PressableScale
            onPress={() => router.back()}
            accessibilityLabel="Back"
            hitSlop={6}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Surface.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronLeft size={22} color={Surface.ink} strokeWidth={2.2} />
          </PressableScale>
          <View style={{ flex: 1 }} />
          {!showEditForm && (
            <PressableScale
              onPress={openEdit}
              accessibilityLabel="Edit goal"
              hitSlop={6}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Surface.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}
            >
              <Pencil size={18} color={Surface.ink} strokeWidth={2} />
            </PressableScale>
          )}
        </View>

        {!showEditForm ? (
          <>
            {/* Pillar chip */}
            <Animated.View entering={enter(0)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <View style={{ backgroundColor: Surface.surfaceRaised, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <PillarIcon icon={pillar.icon} name={pillar.name} color={tone} size={20} />
                <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: Surface.ink }}>{pillar.name}</Text>
              </View>
            </Animated.View>

            {/* Title and progress */}
            <Animated.View entering={enter(1)} style={{ marginBottom: 20 }}>
              <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 28, lineHeight: 34, color: Surface.ink, marginBottom: 12 }}>
                {objective.title}
              </Text>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <View style={{ flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' }}>
                  <ProgressBar progress={progress ?? 0} color={tone} trackColor={Surface.rule} height={8} />
                </View>
                <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 18, color: Surface.ink }}>
                  {progress !== null ? `${Math.round(progress * 100)}%` : '—'}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Target size={16} color={Surface.muted} strokeWidth={2} />
                  <Text style={[Type.meta, { color: Surface.ink }]}>
                    {Math.abs(daysLeft)} day{Math.abs(daysLeft) !== 1 ? 's' : ''} {daysLeft < 0 ? 'overdue' : 'left'}
                  </Text>
                </View>
                {pace !== 'unknown' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <TrendingUp
                      size={16}
                      color={pace === 'ahead' ? Accent.green : pace === 'behind' ? Accent.orange : Surface.muted}
                      strokeWidth={2}
                    />
                    <Text style={[Type.meta, { color: pace === 'ahead' ? Accent.green : pace === 'behind' ? Accent.orange : Surface.ink }]}>
                      {pace === 'ahead' ? 'Ahead' : pace === 'on_track' ? 'On track' : 'Behind'}
                    </Text>
                  </View>
                )}
              </View>

              {objective.done_when.trim() && (
                <View style={{ marginTop: 12, padding: 12, backgroundColor: Accent.blueSoft, borderRadius: Radius.md }}>
                  <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: Surface.ink }}>
                    {objective.done_when}
                  </Text>
                </View>
              )}
            </Animated.View>

            {/* Hours given + Flick */}
            <Animated.View entering={enter(2)} style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
              <View style={{ flex: 1, backgroundColor: Surface.surface, borderRadius: Radius.lg, padding: 16, ...Elevation.card }}>
                <Clock size={18} color={tone} strokeWidth={2.2} />
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 8 }}>
                  <AnimatedNumber value={lifetimeMinutes / 60} format={(n) => n < 0.1 ? '<0.1' : n >= 100 ? `${Math.round(n)}` : n.toFixed(1)} style={{ fontFamily: FontFamily.bodyBold, fontSize: 30, lineHeight: 34, letterSpacing: -0.5, color: Surface.ink }} />
                  <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: Surface.muted, marginLeft: 1 }}>h</Text>
                </View>
                <Text numberOfLines={1} style={[Type.meta, { marginTop: 2 }]}>Hours given</Text>
              </View>

              <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: Surface.surface, alignItems: 'center', justifyContent: 'center', ...Elevation.card }}>
                <Mascot mood={flickMood} size={72} intensity={flickIntensity} />
              </View>
            </Animated.View>

            {/* Tasks placeholder (US-064) */}
            <Animated.View entering={enter(3)} style={{ marginBottom: 20 }}>
              <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 20, color: Surface.ink, marginBottom: 12 }}>Tasks</Text>
              <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: Surface.muted }}>Tasks UI coming in US-064</Text>
            </Animated.View>

            {/* Linked habits */}
            <Animated.View entering={enter(4)} style={{ marginBottom: 20 }}>
              <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 20, color: Surface.ink, marginBottom: 12 }}>Habits for this goal</Text>
              {habits.length === 0 ? (
                <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: Surface.muted }}>No linked habits yet</Text>
              ) : (
                habits.map((h) => {
                  const streak = api.getActionStreakMetrics(h.id, h.type).current;
                  return (
                    <View key={h.id} style={{ backgroundColor: Surface.surfaceRaised, borderRadius: Radius.md, padding: 12, marginBottom: 8 }}>
                      <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: Surface.ink }}>{h.name}</Text>
                      {streak > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <Flame size={14} color={Accent.orange} strokeWidth={2.2} />
                          <Text style={[Type.meta, { color: Surface.ink }]}>{streak}-day streak</Text>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </Animated.View>

            {/* Recent sessions placeholder */}
            <Animated.View entering={enter(5)} style={{ marginBottom: 20 }}>
              <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 20, color: Surface.ink, marginBottom: 12 }}>Recent sessions</Text>
              <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: Surface.muted }}>Session history coming soon</Text>
            </Animated.View>

            {/* US-062: Complete button */}
            {objective.status === 'active' && (
              <Animated.View entering={enter(6)}>
                <PrimaryButton
                  title="Mark as achieved"
                  appearance="filled"
                  onPress={confirmComplete}
                  showArrow={false}
                />
              </Animated.View>
            )}
          </>
        ) : (
          <Animated.View entering={FadeInDown.springify().damping(20)}>
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 22, color: Surface.ink, marginBottom: 16 }}>Edit goal</Text>

            <FieldLabel>Title</FieldLabel>
            <TextInput
              placeholder="What will you achieve?"
              placeholderTextColor={Surface.faint}
              value={editTitle}
              onChangeText={(t) => setEditTitle(t.slice(0, 60))}
              maxLength={60}
              style={[sandInputStyle, { height: 58, marginBottom: 18 }]}
            />

            <FieldLabel>Done when</FieldLabel>
            <TextInput
              placeholder="How will you know it's done?"
              placeholderTextColor={Surface.faint}
              value={editDoneWhen}
              onChangeText={(t) => setEditDoneWhen(t.slice(0, 140))}
              maxLength={140}
              multiline
              textAlignVertical="top"
              style={[sandInputStyle, { minHeight: 80, paddingTop: 16, paddingBottom: 16, marginBottom: 18 }]}
            />

            <FieldLabel>Deadline</FieldLabel>
            <TextInput
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Surface.faint}
              value={editDeadline}
              onChangeText={setEditDeadline}
              style={[sandInputStyle, { height: 58, marginBottom: 18 }]}
            />

            {objective.metric_target !== null && (
              <>
                <FieldLabel>Update metric</FieldLabel>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      placeholder="Current"
                      placeholderTextColor={Surface.faint}
                      value={editMetricCurrent}
                      onChangeText={setEditMetricCurrent}
                      keyboardType="numeric"
                      style={[sandInputStyle, { height: 50 }]}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      placeholder="Target"
                      placeholderTextColor={Surface.faint}
                      value={editMetricTarget}
                      onChangeText={setEditMetricTarget}
                      keyboardType="numeric"
                      style={[sandInputStyle, { height: 50 }]}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      placeholder="Unit"
                      placeholderTextColor={Surface.faint}
                      value={editMetricUnit}
                      onChangeText={setEditMetricUnit}
                      style={[sandInputStyle, { height: 50 }]}
                    />
                  </View>
                </View>
              </>
            )}

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <PrimaryButton title="Cancel" appearance="ghost" color={Surface.muted} size="small" onPress={() => { setShowEditForm(false); void load(); }} />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton title="Save" size="small" disabled={!editTitle.trim()} onPress={() => void saveEdit()} />
              </View>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* US-062: Celebration modal */}
      <Modal visible={showCelebration} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Confetti width={390} height={844} />
          <Animated.View entering={FadeIn.delay(300)} style={{ alignItems: 'center', width: '100%', maxWidth: 400 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: Accent.green, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Trophy size={40} color={Surface.surface} strokeWidth={2.2} />
            </View>
            <Mascot mood="proud" size={100} intensity={1} />
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 32, lineHeight: 38, color: Surface.surface, textAlign: 'center', marginTop: 20 }}>
              Goal achieved!
            </Text>
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 20, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 8, marginBottom: 24 }}>
              {objective?.title}
            </Text>
            <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 16, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 20 }}>
              {lifetimeMinutes > 0 && `${(lifetimeMinutes / 60).toFixed(1)} hours given to the life you chose.`}
            </Text>

            <View style={{ width: '100%', marginBottom: 20 }}>
              <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: 'rgba(255,255,255,0.85)', marginBottom: 8 }}>
                What made it work? (optional)
              </Text>
              <TextInput
                placeholder="One line..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={reflection}
                onChangeText={setReflection}
                maxLength={140}
                multiline
                textAlignVertical="top"
                style={{
                  minHeight: 80,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  fontFamily: FontFamily.bodySemiBold,
                  fontSize: 16,
                  color: Surface.surface,
                }}
              />
            </View>

            {nextObjective ? (
              <View style={{ width: '100%' }}>
                <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 12 }}>
                  Start next: {nextObjective.title}
                </Text>
                <PrimaryButton title="Continue" onPress={() => void finishCelebration()} showArrow={false} />
              </View>
            ) : (
              <View style={{ width: '100%' }}>
                <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 12 }}>
                  Set your next goal for {pillar?.name}
                </Text>
                <PrimaryButton title="Continue" onPress={() => void finishCelebration()} showArrow={false} />
              </View>
            )}
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day;
  const monday = new Date(now.setDate(diff));
  return monday.toISOString();
}
