/**
 * US-096 · Unlock with intention (founder's flow, 2026-11-03), told as a scene in Flick's world (US-100):
 *   1. Flick asks "Do you really need this app now?" in a bubble that types itself out.
 *      No → "Good choice" (Flick proud, sparks). Yes → Flick dims a little →
 *   2. Flick, worried, shows your pillars: cards slide out from him with each pillar's minutes today, its goal,
 *      the next step and the habits still waiting. "You're right, keep it blocked", or "I still want to open it" →
 *   3. for how long: 5, 10, 15, 20 or 30 minutes (never more; nothing chosen for you) →
 *   4. type "I choose my phone over Body for 10 minutes." (no pasting) → the apps open, and iOS blocks
 *      them again on its own when the time is up.
 * The full-screen world (components/world/WorldStage) follows the time of day; its ground line glides between
 * steps. Answers are big pill buttons on the ground. From the block screen (?from=shield) step 1 was already
 * answered there, so it starts at 2. A focus session can't be unlocked here (it's ended in Focus).
 * Expo Go / web: a preview, nothing unlocks.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as api from '@/db/api';
import { LiveFlick } from '@/components/flick/LiveFlick';
import { TypedBubble } from '@/components/flick/TypedBubble';
import type { MascotMood } from '@/components/onboarding/Mascot';
import { ProgressBar } from '@/components/ui/motion';
import { Card, PillButton } from '@/components/ui/kit';
import { WorldStage } from '@/components/world/WorldStage';
import { Accent, FontFamily, Motion, Surface, Type } from '@/constants/design';
import * as AppBlocking from '@/services/appBlocking';
import { isRuleBlockId } from '@/services/blockRules';
import { worldLook, worldWarmth } from '@/services/world';
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

const STEPS: UnlockStep[] = ['ask', 'remind', 'duration', 'type'];

/** Where the ground sits (share of the screen) and how big Flick is, per step: the "camera". */
const FRAMING: Record<string, { ground: number; flick: number }> = {
  ask: { ground: 0.6, flick: 150 },
  kept: { ground: 0.6, flick: 160 },
  done: { ground: 0.6, flick: 150 },
  remind: { ground: 0.35, flick: 92 },
  duration: { ground: 0.5, flick: 120 },
  type: { ground: 0.37, flick: 88 },
  state: { ground: 0.6, flick: 150 },
};

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

/** Four dots: where you are in the flow (on a soft chip, readable on any sky). */
function Dots({ step }: { step: UnlockStep }) {
  const at = STEPS.indexOf(step);
  if (at < 0) return null;
  return (
    <View
      style={{ flexDirection: 'row', alignSelf: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: 'rgba(255,252,247,0.82)' }}
      accessibilityLabel={`Step ${at + 1} of ${STEPS.length}`}
    >
      {STEPS.map((s, i) => (
        <View key={s} style={{ height: 6, width: i === at ? 22 : 6, borderRadius: 3, backgroundColor: i <= at ? Surface.ink : Surface.ruleStrong }} />
      ))}
    </View>
  );
}

/** A line of text on the ground, on a soft chip so it reads on grass, sand or night. */
function GroundNote({ children }: { children: string }) {
  return (
    <View style={{ alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: 'rgba(255,252,247,0.9)' }}>
      <Text style={{ ...Type.meta, color: Surface.ink, textAlign: 'center' }}>{children}</Text>
    </View>
  );
}

/** A pillar card, sliding out of Flick one after another. */
function PillarCard({ r, index }: { r: ReminderRow; index: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(180 + index * 110).springify().damping(Motion.springSoft.damping)}>
      <Card
        accessibilityLabel={`${r.name}: ${minutesWords(r.minutesToday)} today`}
        style={{ borderLeftWidth: 6, borderLeftColor: r.color, ...(r.isNow ? { borderWidth: 2, borderColor: Surface.ink, borderLeftWidth: 6, borderLeftColor: r.color } : null) }}
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
      </Card>
    </Animated.View>
  );
}

export default function UnlockScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [state, setState] = useState<UnlockScreenState>(readState);
  const [step, setStep] = useState<UnlockStep>(from === 'shield' ? 'remind' : 'ask');
  const [reminder, setReminder] = useState<{ rows: ReminderRow[]; blocked: ReminderInput['blocked'] } | null>(null);
  const [minutes, setMinutes] = useState<UnlockMinutes | null>(null);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 390, h: 844 });
  // Flick's reaction to an answer: dims on "yes", hops proudly with sparks on "keep it blocked".
  const [reaction, setReaction] = useState<{ mood: MascotMood; intensity: number } | null>(null);
  const [proudKey, setProudKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setState(readState());
    }, [])
  );
  const blockedHabitId = state.kind === 'blocked' ? state.habitId : null;
  useEffect(() => {
    void loadReminder(blockedHabitId).then(setReminder);
  }, [blockedHabitId]);

  const look = useMemo(() => {
    const now = new Date();
    const given = Object.values(api.getMinutesByPillarForDay(localDayKey())).reduce((n, m) => n + m, 0);
    return worldLook({ hour: now.getHours(), minute: now.getMinutes(), warmth: worldWarmth(given, 0) });
  }, []);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/today'));
  const go = (answer: 'yes' | 'no') => {
    hapticLight();
    setError(null);
    if (answer === 'no') {
      hapticSuccess();
      setReaction(null);
      setProudKey((k) => k + 1);
      setStep((s) => nextStep(s, 'no'));
      return;
    }
    if (step === 'ask') {
      // A little sad: he dims for a beat, then shows what's at stake.
      setReaction({ mood: 'sad', intensity: 0.28 });
      setTimeout(() => {
        setReaction(null);
        setStep((s) => nextStep(s, 'yes'));
      }, 650);
      return;
    }
    setStep((s) => nextStep(s, 'yes'));
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
  const sceneKey: string =
    state.kind === 'focus' || state.kind === 'not-blocked' || (state.kind === 'unlocked' && step !== 'done' && step !== 'kept') ? 'state' : step;
  const frame = FRAMING[sceneKey] ?? FRAMING.ask!;
  const groundY = Math.round(size.h * frame.ground);

  const baseMood: MascotMood =
    sceneKey === 'state'
      ? state.kind === 'unlocked'
        ? 'calm'
        : 'happy'
      : step === 'kept'
        ? 'proud'
        : step === 'remind'
          ? 'worried'
          : step === 'done'
            ? 'calm'
            : 'think';
  const mood = reaction?.mood ?? baseMood;
  const intensity = reaction?.intensity ?? (step === 'remind' ? 0.45 : step === 'kept' ? 1 : 0.72);

  // What Flick says, per scene.
  const say: { text: string; sub?: string | null } =
    state.kind === 'focus'
      ? { text: 'You’re in a focus session.', sub: 'Your apps open when the session ends. Ending it early counts as ended early.' }
      : state.kind === 'not-blocked'
        ? { text: 'Nothing is blocked right now.', sub: 'No habit or block hour is blocking your apps.' }
        : sceneKey === 'state' && state.kind === 'unlocked'
          ? { text: 'Your apps are open.', sub: `Until ${clockLabel(state.until)}. Then they block again on their own.` }
          : step === 'ask'
            ? {
                text: 'Do you really need this app now?',
                sub: state.kind === 'blocked' && state.until ? `Your apps are blocked until ${clockLabel(state.until)}.` : 'Your apps are blocked so your hours go where you chose.',
              }
            : step === 'remind'
              ? { text: `Before you open it… ${reminder ? reminderHeadline(reminder.rows, reminder.blocked) : ''}`.trim() }
              : step === 'duration'
                ? { text: 'For how long?' }
                : step === 'type'
                  ? { text: 'Say it, word for word.' }
                  : step === 'kept'
                    ? { text: 'Good choice!', sub: reminder?.blocked ? `Your time stays with ${reminder.blocked.name}.` : 'Your hours stay where you chose.' }
                    : {
                        text: 'Unlocked, on purpose.',
                        sub:
                          state.kind === 'unlocked'
                            ? `Your apps are open until ${clockLabel(state.until)}. Then they block again on their own.`
                            : `On our iPhone build, your apps would open now for ${minutes} minutes, then block again on their own.`,
                      };

  // The pill answers at the bottom, per scene.
  const footer = (() => {
    if (state.kind === 'focus') return <PillButton size="lg" label="Go to Focus" onPress={() => router.replace('/(tabs)/focus')} />;
    if (state.kind === 'not-blocked') return <PillButton size="lg" label="Back to Today" onPress={() => router.replace('/(tabs)/today')} />;
    if (sceneKey === 'state' && state.kind === 'unlocked') return <PillButton size="lg" label="Block again now" onPress={relock} />;
    if (!inFlow && step !== 'kept' && step !== 'done') return null;
    switch (step) {
      case 'ask':
        return (
          <>
            <PillButton size="lg" label="No, keep it blocked" onPress={() => go('no')} />
            <PillButton size="lg" variant="inverse" label="Yes, I need it" onPress={() => go('yes')} disabled={!!reaction} />
          </>
        );
      case 'remind':
        return (
          <>
            <PillButton size="lg" label="You’re right, keep it blocked" onPress={() => go('no')} />
            <PillButton size="lg" variant="inverse" label="I still want to open it" onPress={() => go('yes')} />
          </>
        );
      case 'duration':
        return (
          <>
            <PillButton size="lg" label="Keep it blocked" onPress={() => go('no')} />
            <PillButton size="lg" variant="inverse" label={minutes ? `Continue with ${minutes} min` : 'Choose a time first'} disabled={!minutes} onPress={() => go('yes')} />
          </>
        );
      case 'type':
        return (
          <>
            <PillButton size="lg" label="Keep it blocked" onPress={() => go('no')} />
            <PillButton size="lg" variant="inverse" label={`Unlock for ${minutes} min`} disabled={!matched} onPress={unlock} />
          </>
        );
      case 'kept':
        return <PillButton size="lg" label="Back to Today" onPress={() => router.replace('/(tabs)/today')} />;
      case 'done':
        return state.kind === 'unlocked' ? <PillButton size="lg" label="Block again now" onPress={relock} /> : <PillButton size="lg" label="Done" onPress={leave} />;
      default:
        return null;
    }
  })();

  // What sits on the ground above the answers.
  const ground = (() => {
    if (!inFlow) return null;
    if (step === 'remind')
      return (
        <View style={{ gap: 10 }}>
          <GroundNote>This is what you said your hours are for.</GroundNote>
          {(reminder?.rows ?? []).map((r, i) => (
            <PillarCard key={r.id} r={r} index={i} />
          ))}
        </View>
      );
    if (step === 'duration')
      return (
        <View style={{ gap: 14 }}>
          <GroundNote>30 minutes at most. When the time is up, it blocks again on its own.</GroundNote>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
            {UNLOCK_MINUTES.map((m, i) => (
              <Animated.View key={m} entering={FadeInDown.delay(120 + i * 70).springify().damping(Motion.springSoft.damping)}>
                <PillButton
                  label={`${m} min`}
                  variant={minutes === m ? 'primary' : 'inverse'}
                  accessibilityLabel={`Unlock for ${m} minutes`}
                  onPress={() => {
                    hapticLight();
                    setMinutes(m);
                    setTyped('');
                  }}
                  style={{ minWidth: 92 }}
                />
              </Animated.View>
            ))}
          </View>
        </View>
      );
    if (step === 'type' && minutes)
      return (
        <Animated.View entering={FadeIn.duration(Motion.duration)} style={{ gap: 10 }}>
          <Card>
            <Text style={{ ...Type.meta }}>Type this to unlock</Text>
            <Text accessibilityLabel={`Sentence: ${sentence}`} style={{ ...Type.heading, marginTop: 6 }}>
              {sentence}
            </Text>
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
                marginTop: 12,
                minHeight: 72,
                backgroundColor: Surface.canvas,
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
          </Card>
        </Animated.View>
      );
    return null;
  })();

  return (
    <View style={{ flex: 1, backgroundColor: look.skyBottom }} onLayout={(e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <Stack.Screen options={{ headerShown: false }} />
      <WorldStage
        look={look}
        width={size.w}
        height={size.h}
        groundY={groundY}
        flickSize={frame.flick}
        flick={
          <LiveFlick
            mood={mood}
            size={frame.flick}
            intensity={intensity}
            pulseKey={proudKey}
            label={`Flick, ${mood}`}
          />
        }
        bubble={<TypedBubble key={`${sceneKey}:${say.text}`} text={say.text} sub={say.sub} size={sceneKey === 'remind' || sceneKey === 'type' ? 'md' : 'lg'} />}
      />

      {/* top bar: back, step dots, the preview note */}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, gap: 8 }}>
        <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            onPress={leave}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,252,247,0.9)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-back" size={22} color={Surface.ink} />
          </Pressable>
          {inFlow ? <Dots step={step} /> : null}
          <View style={{ width: 40 }} />
        </View>
        {state.kind === 'preview' && step === 'ask' ? (
          <View style={{ alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(255,252,247,0.82)' }}>
            <Text style={{ ...Type.meta, color: Surface.ink, textAlign: 'center', fontSize: 12 }}>
              Preview: on our iPhone build, a blocked app brings you here. Nothing is unlocked in this version.
            </Text>
          </View>
        ) : null}
      </View>

      {/* the ground: what Flick shows, then the answers */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
        style={{ position: 'absolute', left: 0, right: 0, top: groundY + 18, bottom: 0 }}
      >
        <ScrollView
          key={sceneKey}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}>{ground}</View>
        </ScrollView>
        <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 18, paddingTop: 8, gap: 10, width: '100%', maxWidth: 480, alignSelf: 'center' }}>
          {error ? <Text style={{ ...Type.meta, color: Accent.amber, textAlign: 'center' }}>{error}</Text> : null}
          {footer}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
