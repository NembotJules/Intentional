/**
 * US-096 · Unlock with intention (founder's flow, 2026-11-03), one animated step at a time:
 *   1. "Do you really need this app now?"  No → "Good choice", kept blocked. Yes →
 *   2. your pillars: what's running now, each pillar's minutes today, its goal, the next step and the habits
 *      still waiting today. "You're right, keep it blocked", or "I still want to open it" →
 *   3. for how long: 5, 10, 15, 20 or 30 minutes (never more; nothing chosen for you) →
 *   4. type "I choose my phone over Body for 10 minutes." (no pasting) → the apps open, and iOS blocks
 *      them again on its own when the time is up.
 * From the block screen (?from=shield) step 1 was already answered there, so it starts at 2.
 * A focus session can't be unlocked here (it's ended in Focus). Expo Go / web: a preview, nothing unlocks.
 */
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, ZoomIn, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as api from '@/db/api';
import { CTA } from '@/components/onboarding/parts';
import { Mascot, type MascotMood } from '@/components/onboarding/Mascot';
import { Chip } from '@/components/focus/parts';
import { PressableScale, ProgressBar, enter } from '@/components/ui/motion';
import { Accent, FontFamily, Motion, Surface, Type } from '@/constants/design';
import * as AppBlocking from '@/services/appBlocking';
import { isRuleBlockId } from '@/services/blockRules';
import {
  UNLOCK_MINUTES,
  buildReminder,
  clockLabel,
  minutesWords,
  nextStep,
  reminderHeadline,
  sentenceMatches,
  sentenceOffTrack,
  sentenceProgress,
  unlockErrorText,
  unlockScreenState,
  unlockSentence,
  type ReminderInput,
  type ReminderRow,
  type UnlockMinutes,
  type UnlockScreenState,
  type UnlockStep,
} from '@/services/unlock';
import { getGoalColor } from '@/utils/goalColors';
import { isDueToday, localDayKey } from '@/utils/dates';
import { hapticLight, hapticSuccess } from '@/utils/haptics';

const card = { backgroundColor: Surface.surfaceRaised, borderRadius: 18, padding: 16 } as const;
const STEPS: UnlockStep[] = ['ask', 'remind', 'duration', 'type'];

function readState(): UnlockScreenState {
  return unlockScreenState({
    native: AppBlocking.canUnlock(),
    focusShieldsOn: AppBlocking.focusShieldsOn(),
    unlockUntil: AppBlocking.getUnlockUntil(),
    activeBlock: AppBlocking.getActiveHabitBlock(),
    now: Date.now(),
  });
}

/** Everything step 2 shows: pillars, their goals and next steps, today's minutes and the habits left. */
async function loadReminder(blockedHabitId: string | null): Promise<{ rows: ReminderRow[]; blocked: ReminderInput['blocked'] }> {
  const pillars = api.getAllPillarsSync().filter((p) => !p.is_archived);
  const habits = api.getAllActionsWithGoal().filter((h) => h.is_active);
  const done = api.getHabitsDoneToday();
  const skipped = api.getSkippedHabits();
  const goals: Record<string, string | null> = {};
  const nextTasks: Record<string, string | null> = {};
  for (const p of pillars) {
    const g = await api.getActiveObjective(p.id).catch(() => null);
    goals[p.id] = g?.title ?? null;
    nextTasks[p.id] = g ? ((await api.getNextTask(g.id).catch(() => null))?.title ?? null) : null;
  }
  const habitsLeft: Record<string, string[]> = {};
  for (const h of habits) {
    if (!isDueToday(h.days_mask ?? 127) || done.has(h.id) || skipped.has(h.id)) continue;
    (habitsLeft[h.goal_id] ??= []).push(h.reminder_time ? `${h.name} (${h.reminder_time})` : h.name);
  }
  const bh = blockedHabitId && !isRuleBlockId(blockedHabitId) ? habits.find((h) => h.id === blockedHabitId) : null;
  const blocked = bh ? { name: bh.name, pillarId: bh.goal_id } : null;
  const input: ReminderInput = {
    pillars: pillars.map((p) => ({ id: p.id, name: p.name, color: getGoalColor(p) })),
    minutesToday: api.getMinutesByPillarForDay(localDayKey()),
    goals,
    nextTasks,
    habitsLeft,
    blocked,
  };
  return { rows: buildReminder(input), blocked };
}

/** Flick, who reacts to every step with a little bounce. */
function Flick({ mood, step }: { mood: MascotMood; step: string }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withSequence(withTiming(0.86, { duration: 120 }), withSpring(1, Motion.spring));
  }, [step, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[{ alignItems: 'center', marginTop: 4, marginBottom: 10 }, style]}>
      <Mascot mood={mood} size={104} intensity={mood === 'worried' ? 0.45 : 0.75} />
    </Animated.View>
  );
}

/** Four dots: where you are in the flow. */
function Dots({ step }: { step: UnlockStep }) {
  const at = STEPS.indexOf(step);
  if (at < 0) return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 6 }} accessibilityLabel={`Step ${at + 1} of ${STEPS.length}`}>
      {STEPS.map((s, i) => (
        <View key={s} style={{ height: 6, width: i === at ? 22 : 6, borderRadius: 3, backgroundColor: i <= at ? Surface.ink : Surface.ruleStrong }} />
      ))}
    </View>
  );
}

function Secondary({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={{ marginTop: 10, height: 54, borderRadius: 27, borderWidth: 2, borderColor: Surface.ink, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : 1 }}
    >
      <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 17 }}>{label}</Text>
    </PressableScale>
  );
}

function PillarCard({ r, index }: { r: ReminderRow; index: number }) {
  return (
    <Animated.View
      entering={enter(index + 1)}
      accessibilityLabel={`${r.name}: ${minutesWords(r.minutesToday)} today`}
      style={{ ...card, borderLeftWidth: 5, borderLeftColor: r.color, ...(r.isNow ? { borderWidth: 2, borderColor: Surface.ink, borderLeftWidth: 5, borderLeftColor: r.color } : null) }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ ...Type.heading }}>{r.name}</Text>
        <Text style={{ color: r.minutesToday ? Surface.ink : Accent.amber, fontFamily: FontFamily.bodyBold, fontSize: 15 }}>{minutesWords(r.minutesToday)} today</Text>
      </View>
      {r.isNow ? <Text style={{ ...Type.meta, color: Surface.ink, marginTop: 2 }}>This is the time you set for it.</Text> : null}
      {r.goal ? (
        <Text style={{ ...Type.body, marginTop: 6 }}>
          <Text style={{ fontFamily: FontFamily.bodyBold }}>Goal: </Text>
          {r.goal}
        </Text>
      ) : null}
      {r.next ? (
        <Text style={{ ...Type.body, marginTop: 2 }}>
          <Text style={{ fontFamily: FontFamily.bodyBold }}>Next step: </Text>
          {r.next}
        </Text>
      ) : null}
      {r.habitsLeft.length ? (
        <Text style={{ ...Type.body, marginTop: 2 }}>
          <Text style={{ fontFamily: FontFamily.bodyBold }}>Still waiting today: </Text>
          {r.habitsLeft.join(', ')}
        </Text>
      ) : null}
    </Animated.View>
  );
}

export default function UnlockScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [state, setState] = useState<UnlockScreenState>(readState);
  const [step, setStep] = useState<UnlockStep>(from === 'shield' ? 'remind' : 'ask');
  const [reminder, setReminder] = useState<{ rows: ReminderRow[]; blocked: ReminderInput['blocked'] } | null>(null);
  const [minutes, setMinutes] = useState<UnlockMinutes | null>(null);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setState(readState());
    }, [])
  );
  const blockedHabitId = state.kind === 'blocked' ? state.habitId : null;
  useEffect(() => {
    void loadReminder(blockedHabitId).then(setReminder);
  }, [blockedHabitId]);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/today'));
  const go = (answer: 'yes' | 'no') => {
    hapticLight();
    if (answer === 'no') hapticSuccess();
    setError(null);
    setStep((s) => nextStep(s, answer));
  };

  const pillarName = reminder?.blocked ? (reminder.rows.find((r) => r.id === reminder.blocked!.pillarId)?.name ?? null) : (reminder?.rows[0]?.name ?? null);
  const sentence = unlockSentence(reminder?.blocked ? pillarName : state.kind === 'preview' ? pillarName : null, minutes ?? 0);
  const matched = sentenceMatches(typed, sentence);
  const offTrack = sentenceOffTrack(typed, sentence);

  const unlock = () => {
    if (!matched || !minutes) return;
    setError(null);
    if (state.kind === 'preview') {
      hapticSuccess();
      setStep('done');
      return;
    }
    const r = AppBlocking.unlockFor(minutes);
    if (!r.ok || !r.until) {
      setError(unlockErrorText(r.error));
      setState(readState());
      return;
    }
    hapticSuccess();
    setTyped('');
    setState({ kind: 'unlocked', until: r.until });
    setStep('done');
  };

  const relock = () => {
    AppBlocking.relockNow();
    setState(readState());
    setStep('kept');
  };

  const inFlow = state.kind === 'blocked' || state.kind === 'preview';
  const mood: MascotMood =
    step === 'kept' ? 'proud' : step === 'remind' ? 'worried' : step === 'duration' || step === 'type' ? 'think' : step === 'done' ? 'calm' : 'think';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Surface.canvas }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}>
            <Pressable
              onPress={leave}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Surface.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="chevron-back" size={22} color={Surface.ink} />
            </Pressable>

            {state.kind === 'focus' ? (
              <Animated.View entering={FadeIn.duration(Motion.duration)}>
                <Flick mood="happy" step="focus" />
                <Text accessibilityRole="header" style={{ ...Type.title, textAlign: 'center' }}>You’re in a focus session</Text>
                <Text style={{ ...Type.body, textAlign: 'center', marginTop: 8 }}>Your apps open when the session ends. Ending it early counts as ended early.</Text>
                <View style={{ marginTop: 22 }}>
                  <CTA label="Go to Focus" onPress={() => router.replace('/(tabs)/focus')} />
                </View>
              </Animated.View>
            ) : state.kind === 'not-blocked' ? (
              <Animated.View entering={FadeIn.duration(Motion.duration)}>
                <Flick mood="happy" step="free" />
                <Text accessibilityRole="header" style={{ ...Type.title, textAlign: 'center' }}>Nothing is blocked</Text>
                <Text style={{ ...Type.body, textAlign: 'center', marginTop: 8 }}>No habit or block hour is blocking your apps right now.</Text>
                <View style={{ marginTop: 22 }}>
                  <CTA label="Back to Today" onPress={() => router.replace('/(tabs)/today')} />
                </View>
              </Animated.View>
            ) : state.kind === 'unlocked' && step !== 'done' && step !== 'kept' ? (
              <Animated.View entering={FadeIn.duration(Motion.duration)}>
                <Flick mood="calm" step="open" />
                <Text accessibilityRole="header" style={{ ...Type.title, textAlign: 'center' }}>Your apps are open</Text>
                <Text accessibilityLabel={`Open until ${clockLabel(state.until)}`} style={{ ...Type.body, textAlign: 'center', marginTop: 8 }}>
                  Until {clockLabel(state.until)}. Then they block again on their own.
                </Text>
                <View style={{ marginTop: 22 }}>
                  <CTA label="Block again now" onPress={relock} />
                </View>
              </Animated.View>
            ) : (
              <>
                <Flick mood={mood} step={step} />
                <Dots step={step} />
                {state.kind === 'preview' && step === 'ask' ? (
                  <Animated.Text entering={FadeIn.delay(200)} style={{ ...Type.meta, textAlign: 'center', marginBottom: 6 }}>
                    Preview: on our iPhone build, a blocked app brings you here. Nothing is unlocked in this version.
                  </Animated.Text>
                ) : null}

                {/* 1 · the question */}
                {step === 'ask' && inFlow ? (
                  <Animated.View key="ask" entering={FadeInDown.springify().damping(Motion.springSoft.damping)} exiting={FadeOut.duration(Motion.durationFast)}>
                    <Text accessibilityRole="header" style={{ ...Type.title, textAlign: 'center' }}>
                      Do you really need this app now?
                    </Text>
                    <Text style={{ ...Type.body, textAlign: 'center', marginTop: 8 }}>
                      {state.kind === 'blocked' && state.until ? `Your apps are blocked until ${clockLabel(state.until)}.` : 'Your apps are blocked so your hours go where you chose.'}
                    </Text>
                    <View style={{ marginTop: 26 }}>
                      <CTA label="No, keep it blocked" onPress={() => go('no')} />
                    </View>
                    <Secondary label="Yes, I need it" onPress={() => go('yes')} />
                  </Animated.View>
                ) : null}

                {/* 2 · your pillars */}
                {step === 'remind' && inFlow ? (
                  <Animated.View key="remind" entering={FadeInDown.springify().damping(Motion.springSoft.damping)} exiting={FadeOut.duration(Motion.durationFast)}>
                    <Text accessibilityRole="header" style={{ ...Type.title, textAlign: 'center' }}>
                      Before you open it
                    </Text>
                    <Animated.Text entering={FadeIn.delay(150)} style={{ ...Type.heading, textAlign: 'center', marginTop: 8 }}>
                      {reminder ? reminderHeadline(reminder.rows, reminder.blocked) : ' '}
                    </Animated.Text>
                    <Text style={{ ...Type.body, textAlign: 'center', marginTop: 4 }}>This is what you said your hours are for.</Text>
                    <View style={{ gap: 10, marginTop: 16 }}>
                      {(reminder?.rows ?? []).map((r, i) => (
                        <PillarCard key={r.id} r={r} index={i} />
                      ))}
                    </View>
                    <Animated.View entering={enter((reminder?.rows.length ?? 0) + 2)} style={{ marginTop: 22 }}>
                      <CTA label="You’re right, keep it blocked" onPress={() => go('no')} />
                      <Secondary label="I still want to open it" onPress={() => go('yes')} />
                    </Animated.View>
                  </Animated.View>
                ) : null}

                {/* 3 · how long */}
                {step === 'duration' && inFlow ? (
                  <Animated.View key="duration" entering={FadeInDown.springify().damping(Motion.springSoft.damping)} exiting={FadeOut.duration(Motion.durationFast)}>
                    <Text accessibilityRole="header" style={{ ...Type.title, textAlign: 'center' }}>
                      For how long?
                    </Text>
                    <Text style={{ ...Type.body, textAlign: 'center', marginTop: 8 }}>30 minutes at most. When the time is up, it blocks again on its own.</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 20 }}>
                      {UNLOCK_MINUTES.map((m, i) => (
                        <Animated.View key={m} entering={enter(i)}>
                          <Chip
                            label={`${m} min`}
                            on={minutes === m}
                            onPress={() => {
                              hapticLight();
                              setMinutes(m);
                              setTyped('');
                            }}
                            accessibilityLabel={`Unlock for ${m} minutes`}
                          />
                        </Animated.View>
                      ))}
                    </View>
                    <View style={{ marginTop: 26 }}>
                      <CTA label="Keep it blocked" onPress={() => go('no')} />
                    </View>
                    <Secondary label={minutes ? `Continue with ${minutes} min` : 'Choose a time first'} disabled={!minutes} onPress={() => go('yes')} />
                  </Animated.View>
                ) : null}

                {/* 4 · say it */}
                {step === 'type' && inFlow && minutes ? (
                  <Animated.View key="type" entering={FadeInDown.springify().damping(Motion.springSoft.damping)} exiting={FadeOut.duration(Motion.durationFast)}>
                    <Text accessibilityRole="header" style={{ ...Type.title, textAlign: 'center' }}>
                      Say it
                    </Text>
                    <View style={{ ...card, marginTop: 16 }}>
                      <Text style={{ ...Type.meta }}>Type this to unlock</Text>
                      <Text accessibilityLabel={`Sentence: ${sentence}`} style={{ ...Type.heading, marginTop: 6 }}>
                        {sentence}
                      </Text>
                    </View>
                    <TextInput
                      value={typed}
                      onChangeText={(v) => {
                        setTyped(v);
                        if (error) setError(null);
                      }}
                      placeholder="Type the sentence…"
                      placeholderTextColor={Surface.faint}
                      accessibilityLabel="Type the sentence"
                      autoCorrect={false}
                      spellCheck={false}
                      autoComplete="off"
                      contextMenuHidden
                      multiline
                      style={{
                        marginTop: 10,
                        minHeight: 76,
                        backgroundColor: Surface.surface,
                        borderWidth: 2,
                        borderColor: matched ? Accent.green : offTrack ? Accent.amber : Surface.ruleStrong,
                        borderRadius: 16,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        color: Surface.ink,
                        fontFamily: FontFamily.bodySemiBold,
                        fontSize: 17,
                        textAlignVertical: 'top',
                      }}
                    />
                    <View style={{ marginTop: 8 }}>
                      <ProgressBar progress={sentenceProgress(typed, sentence)} color={offTrack ? Accent.amber : Surface.ink} trackColor={Surface.hill} height={4} />
                    </View>
                    <Text style={{ ...Type.meta, marginTop: 6, color: offTrack ? Accent.amber : Surface.muted }}>
                      {matched ? 'That’s it.' : offTrack ? 'Not quite: check the words.' : 'Word for word. No pasting.'}
                    </Text>
                    <View style={{ marginTop: 22 }}>
                      <CTA label="Keep it blocked" onPress={() => go('no')} />
                    </View>
                    <Secondary label={`Unlock for ${minutes} min`} disabled={!matched} onPress={unlock} />
                  </Animated.View>
                ) : null}

                {/* kept blocked */}
                {step === 'kept' ? (
                  <Animated.View key="kept" entering={ZoomIn.springify().damping(Motion.spring.damping)}>
                    <Text accessibilityRole="header" style={{ ...Type.title, textAlign: 'center' }}>
                      Good choice
                    </Text>
                    <Text style={{ ...Type.body, textAlign: 'center', marginTop: 8 }}>
                      {reminder?.blocked ? `Your time stays with ${reminder.blocked.name}.` : 'Your hours stay where you chose.'}
                    </Text>
                    <View style={{ marginTop: 22 }}>
                      <CTA label="Back to Today" onPress={() => router.replace('/(tabs)/today')} />
                    </View>
                  </Animated.View>
                ) : null}

                {/* unlocked */}
                {step === 'done' ? (
                  <Animated.View key="done" entering={FadeInDown.springify().damping(Motion.springSoft.damping)}>
                    <Text accessibilityRole="header" style={{ ...Type.title, textAlign: 'center' }}>
                      Unlocked, on purpose
                    </Text>
                    <Text style={{ ...Type.body, textAlign: 'center', marginTop: 8 }}>
                      {state.kind === 'unlocked'
                        ? `Your apps are open until ${clockLabel(state.until)}. Then they block again on their own.`
                        : `On our iPhone build, your apps would open now for ${minutes} minutes, then block again on their own.`}
                    </Text>
                    <View style={{ marginTop: 22 }}>
                      {state.kind === 'unlocked' ? <CTA label="Block again now" onPress={relock} /> : <CTA label="Done" onPress={leave} />}
                    </View>
                  </Animated.View>
                ) : null}
              </>
            )}

            {error ? <Text style={{ ...Type.meta, color: Accent.amber, textAlign: 'center', marginTop: 14 }}>{error}</Text> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
