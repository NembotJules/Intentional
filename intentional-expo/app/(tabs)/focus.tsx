import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
  InputAccessoryView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack, Tabs, useNavigation, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Accent, Surface, FontFamily } from '@/constants/design';
import { CTA, Rings, T } from '@/components/onboarding/parts';
import { Mascot } from '@/components/onboarding/Mascot';
import { Chip, FocusPill, FocusRing, StatTile, StepButton } from '@/components/focus/parts';
import { useGoals } from '@/db/hooks';
import * as api from '@/db/api';
import type { MetaGoal, DailyAction, FocusSession } from '@/types';
import { getGoalColor, getGoalTint } from '@/utils/goalColors';
import { hapticLight, hapticMedium, hapticSuccess, hapticWarning } from '@/utils/haptics';
import * as AppBlocking from '@/services/appBlocking';
import {
  clampSessionMinutes,
  createFocusSessionDraft,
  formatCountdown,
  getShieldCopy,
  initialFocusSessionModel,
  shouldApplyShieldsOnTransition,
  shouldRemoveShieldsOnTransition,
  transitionFocusSession,
  type FocusSessionModel,
  type SessionPhase,
  type ShieldState,
} from '@/services/focusSessionDomain';

const DURATION_PRESETS = [25, 45, 60, 90, 120] as const;
const SESSION_NOTE_INPUT_ACCESSORY_ID = 'sessionNoteInputAccessory';

function blockingPrefsSummary(): string {
  const ids = api.getBlockedCategoryIds();
  const labels = ids
    .map((id) => api.BLOCKABLE_APP_CATEGORIES.find((c) => c.id === id)?.label ?? id)
    .slice(0, 4);
  const tail = ids.length > 4 ? ` +${ids.length - 4}` : '';
  return `${ids.length} categor${ids.length === 1 ? 'y' : 'ies'} (${labels.join(', ')}${tail})`;
}

function tabBarOverlapPadding(insetsBottom: number) {
  const tabBarHeight = 54;
  const tabBarBottomMargin = Math.max(insetsBottom, 10);
  const gapAboveBar = 8;
  return tabBarHeight + tabBarBottomMargin + gapAboveBar;
}

function defaultTabBarStyle(insetsBottom: number) {
  return {
    position: 'absolute' as const,
    height: 54,
    paddingTop: 4,
    paddingBottom: 4,
    paddingHorizontal: 8,
    marginHorizontal: 16,
    marginBottom: Math.max(insetsBottom, 10),
    borderWidth: 1,
    borderColor: Surface.rule,
    backgroundColor: 'transparent',
    borderRadius: 9999,
    overflow: 'hidden' as const,
  };
}

export default function FocusScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const params = useLocalSearchParams<{ goalId?: string; actionId?: string }>();
  const { goals, refresh: refreshGoals } = useGoals();
  const [actionsByGoal, setActionsByGoal] = useState<Record<string, DailyAction[]>>({});
  const [sessionModel, setSessionModel] = useState<FocusSessionModel>(initialFocusSessionModel);
  const [goal, setGoal] = useState<MetaGoal | null>(null);
  const [action, setAction] = useState<DailyAction | null>(null);
  const [durationMins, setDurationMins] = useState(25);
  const [useCustomDuration, setUseCustomDuration] = useState(false);
  const [customMinsStr, setCustomMinsStr] = useState('25');
  const [completedSession, setCompletedSession] = useState<FocusSession | null>(null);
  const [sessionNoteDraft, setSessionNoteDraft] = useState('');
  const [actionStreak, setActionStreak] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionModelRef = useRef<FocusSessionModel>(initialFocusSessionModel);
  /**
   * Wall-clock timing: JS timers are suspended while the phone is locked or the
   * app is backgrounded, so elapsed time is derived from Date.now() rather than
   * by counting interval ticks. The interval only re-renders the countdown.
   */
  const segmentStartRef = useRef<number | null>(null);
  const accumulatedSecondsRef = useRef(0);
  const completionHandledRef = useRef(false);
  const sessionNoteInputRef = useRef<TextInput>(null);
  
  const actionIdParam = useMemo(
    () => (Array.isArray(params.actionId) ? params.actionId[0] : params.actionId),
    [params.actionId]
  );

  const applyDurationFromAction = useCallback((a: DailyAction) => {
    const t = Math.max(1, a.target_minutes || 25);
    const presetHit = (DURATION_PRESETS as readonly number[]).includes(t);
    setDurationMins(t);
    setUseCustomDuration(!presetHit);
    setCustomMinsStr(String(t));
  }, []);

  useEffect(() => {
    sessionModelRef.current = sessionModel;
  }, [sessionModel]);

  useEffect(() => {
    // Preparing is full-screen too: its Start button sits where the tab bar floats.
    if (sessionModel.phase === 'preparing' || sessionModel.phase === 'focusing' || sessionModel.phase === 'paused') {
      navigation.setOptions({
        tabBarStyle: { display: 'none' },
      });
    } else {
      navigation.setOptions({
        tabBarStyle: defaultTabBarStyle(insets.bottom),
      });
    }
  }, [sessionModel.phase, insets.bottom, navigation]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const next: Record<string, DailyAction[]> = {};
      for (const g of goals) {
        next[g.id] = await api.getActionsByGoal(g.id);
      }
      if (mounted) setActionsByGoal(next);
    })();
    return () => {
      mounted = false;
    };
  }, [goals]);

  useEffect(() => {
    if (!actionIdParam || !goals.length) return;
    const phase = sessionModelRef.current.phase;
    if (phase === 'focusing' || phase === 'paused') return;
    const resolvedActionId = decodeURIComponent(actionIdParam);
    void api.getAllActions().then((actions) => {
      const a = actions.find((x) => x.id === resolvedActionId);
      // Reminder notifications only carry actionId — resolve the goal from the action.
      const g = a ? goals.find((x) => x.id === a.goal_id) : undefined;
      // Clear params so tapping START on the same action again re-triggers this effect.
      router.setParams({ goalId: undefined, actionId: undefined });
      if (!a || !g) return;
      setGoal(g);
      setAction(a);
      applyDurationFromAction(a);
      const mins = Math.max(1, a.target_minutes || 25);
      setSessionModel(
        transitionFocusSession(initialFocusSessionModel, {
          type: 'select_session',
          totalSeconds: mins * 60,
          goalId: g.id,
          actionId: a.id,
          goalName: g.name,
          actionName: a.name,
        })
      );
    });
  }, [actionIdParam, goals, applyDurationFromAction, router]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if ((sessionModel.phase === 'completed' || sessionModel.phase === 'aborted') && action && completedSession) {
      void api.getFocusStreakForAction(action.id).then(setActionStreak);
    }
  }, [sessionModel.phase, action?.id, completedSession?.id]);

  const handleShieldTransition = useCallback(
    async (fromPhase: SessionPhase, toPhase: SessionPhase) => {
      if (shouldRemoveShieldsOnTransition(fromPhase, toPhase)) {
        await AppBlocking.removeShields();
        setSessionModel((prev) =>
          transitionFocusSession(prev, { type: 'shield_result', shield: 'removed' })
        );
      } else if (shouldApplyShieldsOnTransition(fromPhase, toPhase)) {
        const result = await AppBlocking.applyShields();
        let shieldState: ShieldState;
        switch (result) {
          case 'applied':
            shieldState = 'applied';
            break;
          case 'denied':
            shieldState = 'denied';
            break;
          case 'no_selection':
            shieldState = 'no_selection';
            break;
          case 'unsupported':
            shieldState = 'unsupported';
            break;
        }
        setSessionModel((prev) =>
          transitionFocusSession(prev, { type: 'shield_result', shield: shieldState })
        );
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      // Tabs stay mounted: pick up goals/actions added elsewhere since last visit.
      void refreshGoals();
      return () => {
        const current = sessionModelRef.current;
        if (current.phase === 'focusing') {
          clearTick();
          const elapsed = Math.min(current.totalSeconds, elapsedNow());
          segmentStartRef.current = null;
          if (elapsed > 0 && current.context.goalId && current.context.actionId) {
            void api.saveFocusSession(
              createFocusSessionDraft({
                actionId: current.context.actionId,
                goalId: current.context.goalId,
                elapsedSeconds: elapsed,
                completedFullTimer: false,
              })
            );
          }
          void AppBlocking.removeShields();
          setSessionModel(transitionFocusSession(current, { type: 'reset' }));
          setGoal(null);
          setAction(null);
          setCompletedSession(null);
          setSessionNoteDraft('');
          setActionStreak(0);
        }
      };
    }, [refreshGoals])
  );

  const allActions = useMemo(
    () => Object.values(actionsByGoal).flat().filter((a) => a.type === 'session'),
    [actionsByGoal]
  );

  const clearTick = () => {
    if (!intervalRef.current) return;
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  };

  function elapsedNow(): number {
    const running = segmentStartRef.current != null ? (Date.now() - segmentStartRef.current) / 1000 : 0;
    return Math.floor(accumulatedSecondsRef.current + running);
  }

  /** Re-render the countdown from wall-clock time; pure updater, no side effects. */
  const startTicking = () => {
    clearTick();
    intervalRef.current = setInterval(() => {
      setSessionModel((prev) => {
        if (prev.phase !== 'focusing') return prev;
        const delta = Math.min(prev.totalSeconds, elapsedNow()) - prev.elapsedSeconds;
        return delta > 0 ? transitionFocusSession(prev, { type: 'tick', seconds: delta }) : prev;
      });
    }, 500);
  };

  const resolvedDurationMinutes = useCallback(() => {
    if (useCustomDuration) return clampSessionMinutes(Number(customMinsStr));
    return durationMins;
  }, [useCustomDuration, customMinsStr, durationMins]);

  const recordSession = async (totalElapsed: number, completedFullTimer: boolean) => {
    if (!goal || !action) return;
    const session = await api.saveFocusSession(
      createFocusSessionDraft({
        actionId: action.id,
        goalId: goal.id,
        elapsedSeconds: totalElapsed,
        completedFullTimer,
      })
    );
    setCompletedSession(session);
    setSessionNoteDraft('');
    await AppBlocking.removeShields();
    if (completedFullTimer) hapticSuccess();
    else hapticWarning();
  };

  // Timer reached zero (the tick moved the model to 'completed'): persist once.
  useEffect(() => {
    if (sessionModel.phase !== 'completed' || completionHandledRef.current) return;
    completionHandledRef.current = true;
    clearTick();
    segmentStartRef.current = null;
    void recordSession(sessionModel.totalSeconds, true);
  }, [sessionModel.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const startFocus = async () => {
    if (!goal || !action) return;
    hapticMedium();
    // Use the duration chosen with the -/+ stepper, not the action's default target.
    const totalSeconds = resolvedDurationMinutes() * 60;
    const prevPhase = sessionModel.phase;
    const nextModel = transitionFocusSession({ ...sessionModel, totalSeconds }, { type: 'start' });
    completionHandledRef.current = false;
    accumulatedSecondsRef.current = 0;
    segmentStartRef.current = Date.now();
    setSessionModel(nextModel);
    startTicking();
    await handleShieldTransition(prevPhase, nextModel.phase);
  };

  const endSessionEarly = async () => {
    if (completionHandledRef.current) return;
    completionHandledRef.current = true;
    clearTick();
    const elapsed = Math.min(sessionModel.totalSeconds, elapsedNow());
    segmentStartRef.current = null;
    const prevPhase = sessionModel.phase;
    const nextModel = transitionFocusSession({ ...sessionModel, elapsedSeconds: elapsed }, { type: 'abort' });
    setSessionModel(nextModel);
    await recordSession(elapsed, false);
    await handleShieldTransition(prevPhase, nextModel.phase);
  };

  const togglePause = async () => {
    if (!goal || !action) return;
    const prevPhase = sessionModel.phase;
    if (sessionModel.phase === 'paused') {
      const nextModel = transitionFocusSession(sessionModel, { type: 'resume' });
      segmentStartRef.current = Date.now();
      setSessionModel(nextModel);
      startTicking();
      await handleShieldTransition(prevPhase, nextModel.phase);
    } else {
      clearTick();
      accumulatedSecondsRef.current = Math.min(sessionModel.totalSeconds, elapsedNow());
      segmentStartRef.current = null;
      const nextModel = transitionFocusSession(
        { ...sessionModel, elapsedSeconds: accumulatedSecondsRef.current },
        { type: 'pause' }
      );
      setSessionModel(nextModel);
      await handleShieldTransition(prevPhase, nextModel.phase);
    }
  };

  const backToToday = () => {
    clearTick();
    setSessionModel(transitionFocusSession(sessionModel, { type: 'reset' }));
    setGoal(null);
    setAction(null);
    setCompletedSession(null);
    setSessionNoteDraft('');
    setActionStreak(0);
    router.replace('/(tabs)/today');
  };

  const persistSessionNoteIfAny = async () => {
    const trimmed = sessionNoteDraft.trim();
    if (completedSession && trimmed.length > 0) {
      await api.updateFocusSessionNote(completedSession.id, trimmed.slice(0, 280));
    }
  };

  const dismissSessionNoteKeyboard = useCallback(() => {
    sessionNoteInputRef.current?.blur();
    requestAnimationFrame(() => {
      Keyboard.dismiss();
    });
  }, []);

  const finishSessionComplete = async () => {
    dismissSessionNoteKeyboard();
    await persistSessionNoteIfAny();
    backToToday();
  };

  const startAnotherSession = async () => {
    dismissSessionNoteKeyboard();
    await persistSessionNoteIfAny();
    clearTick();
    setSessionModel(transitionFocusSession(sessionModel, { type: 'reset' }));
    setGoal(null);
    setAction(null);
    setCompletedSession(null);
    setSessionNoteDraft('');
    setActionStreak(0);
  };

  const chooseAction = (g: MetaGoal, a: DailyAction) => {
    setGoal(g);
    setAction(a);
    applyDurationFromAction(a);
    const mins = Math.max(1, a.target_minutes || 25);
    setSessionModel(
      transitionFocusSession(initialFocusSessionModel, {
        type: 'select_session',
        totalSeconds: mins * 60,
        goalId: g.id,
        actionId: a.id,
        goalName: g.name,
        actionName: a.name,
      })
    );
  };

  const confirmEndEarly = () => {
    const msg = 'Your minutes so far still count.';
    if (Platform.OS === 'web') {
      // Alert.alert is a no-op on react-native-web.
      if (typeof window !== 'undefined' && window.confirm(`End session?\n${msg}`)) void endSessionEarly();
      return;
    }
    Alert.alert('End session?', msg, [
      { text: 'Keep going', style: 'cancel' },
      { text: 'End session', style: 'destructive', onPress: () => void endSessionEarly() },
    ]);
  };

  // ─── Focus room (running / paused): warm charcoal, Flick grows with the session ───
  if ((sessionModel.phase === 'focusing' || sessionModel.phase === 'paused') && goal && action) {
    const isPaused = sessionModel.phase === 'paused';
    const tone = getGoalColor(goal);
    const total = Math.max(1, sessionModel.totalSeconds);
    const progress = Math.min(1, sessionModel.elapsedSeconds / total);
    const remaining = sessionModel.totalSeconds - sessionModel.elapsedSeconds;
    const givenMins = Math.floor(sessionModel.elapsedSeconds / 60);
    const ringSize = Math.min(268, windowWidth - 96);
    const shieldOn = sessionModel.shield === 'applied';

    return (
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: Surface.focusCanvas }}>
        <Stack.Screen options={{ headerShown: false }} />
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.6 }}>
          <Rings />
        </View>
        <View style={{ flex: 1, paddingHorizontal: 22, paddingTop: 20, paddingBottom: 20 }}>
          <View style={{ alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: tone }} />
              <Text style={{ color: Surface.focusMuted, fontFamily: FontFamily.bodySemiBold, fontSize: 15 }}>{goal.name}</Text>
            </View>
            <Text
              style={{ color: Surface.focusText, fontFamily: FontFamily.bodyBold, fontSize: 24, lineHeight: 30, marginTop: 4, textAlign: 'center' }}
              numberOfLines={2}
            >
              {action.name}
            </Text>
          </View>

          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <FocusRing size={ringSize} progress={progress} color={tone} dim={isPaused}>
              <Mascot
                mood={isPaused ? 'think' : 'calm'}
                size={Math.round(ringSize * 0.52)}
                intensity={0.3 + 0.7 * progress}
                bob={!isPaused}
              />
            </FocusRing>
            <Text
              accessibilityLabel={`${formatCountdown(remaining)} remaining`}
              style={{
                color: isPaused ? Surface.focusMuted : Surface.focusText,
                fontFamily: FontFamily.monoSemiBold,
                fontSize: 64,
                lineHeight: 72,
                letterSpacing: -2,
                marginTop: 22,
                includeFontPadding: false,
              }}
            >
              {formatCountdown(remaining)}
            </Text>
            <Text style={{ color: Surface.focusMuted, fontFamily: FontFamily.bodySemiBold, fontSize: 16, lineHeight: 22, marginTop: 4, textAlign: 'center' }}>
              {isPaused
                ? 'Paused. Resume when you’re ready.'
                : givenMins > 0
                  ? `${givenMins}m given to ${goal.name} so far`
                  : `Every minute goes to ${goal.name}`}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 14, opacity: isPaused ? 0 : 1 }}>
            <Ionicons name={shieldOn ? 'lock-closed' : 'lock-open-outline'} size={13} color={Surface.focusFaint} />
            <Text style={{ color: Surface.focusFaint, fontFamily: FontFamily.bodySemiBold, fontSize: 13 }}>
              {shieldOn ? 'Distracting apps blocked' : getShieldCopy(sessionModel.shield)}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            {isPaused ? (
              <FocusPill label="Resume" icon="play" variant="light" accessibilityLabel="Resume focus session" onPress={() => void togglePause()} />
            ) : (
              <FocusPill label="Pause" icon="pause" variant="dark" accessibilityLabel="Pause focus session" onPress={() => void togglePause()} />
            )}
            <FocusPill label="End" icon="stop" variant="danger" accessibilityLabel="End focus session" onPress={confirmEndEarly} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Session complete / ended early: light paper, Flick proud ───
  if (
    (sessionModel.phase === 'completed' || sessionModel.phase === 'aborted') &&
    goal &&
    action &&
    completedSession
  ) {
    const secs = completedSession.duration_seconds;
    const mins = Math.floor(secs / 60);
    const hrs = Math.floor(mins / 60);
    const display = hrs > 0 ? `${hrs}h ${mins % 60}m` : mins > 0 ? `${mins}m` : `${secs}s`;
    const tone = getGoalColor(goal);
    const fullComplete = sessionModel.phase === 'completed';
    const bottomPad = tabBarOverlapPadding(insets.bottom) + 24;
    const startedAt = new Date(completedSession.started_at).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Surface.canvas }} edges={['top', 'left', 'right']}>
        <Stack.Screen options={{ headerShown: false }} />

        <KeyboardAvoidingView
          style={{ flex: 1, zIndex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
        >
          {Platform.OS === 'ios' ? (
            <InputAccessoryView nativeID={SESSION_NOTE_INPUT_ACCESSORY_ID}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: Surface.surface,
                  borderTopWidth: 1,
                  borderTopColor: Surface.rule,
                }}
              >
                <Pressable
                  onPress={dismissSessionNoteKeyboard}
                  hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: 4, paddingHorizontal: 8 })}
                >
                  <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 17 }}>Done</Text>
                </Pressable>
              </View>
            </InputAccessoryView>
          ) : null}

          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: bottomPad }}
          >
            <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center' }}>
              <View style={{ alignItems: 'center' }}>
                <Mascot mood={fullComplete ? 'proud' : 'happy'} size={140} intensity={fullComplete ? 1 : 0.75} />
              </View>
              <Text style={[T.fine, { color: Surface.muted, fontFamily: FontFamily.bodySemiBold, fontSize: 15, marginTop: 10 }]}>
                {fullComplete ? 'Session complete' : 'Session ended early'}
              </Text>
              <Text
                style={{
                  color: Surface.ink,
                  fontFamily: FontFamily.bodyBold,
                  fontSize: 40,
                  lineHeight: 46,
                  letterSpacing: -0.8,
                  textAlign: 'center',
                  marginTop: 4,
                }}
              >
                +{display} to <Text style={{ color: tone }}>{goal.name}</Text>
              </Text>
              <Text style={[T.body, { marginTop: 8, paddingHorizontal: 8 }]}>
                {fullComplete
                  ? `${action.name}. That time went where you meant it to.`
                  : `${action.name}. Partial time still counts.`}
              </Text>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
                <StatTile icon="time-outline" label="Started" value={startedAt} />
                <StatTile
                  icon="flame"
                  label="Streak"
                  color={Accent.orange}
                  value={actionStreak > 0 ? `${actionStreak} day${actionStreak === 1 ? '' : 's'}` : 'Day 1'}
                />
              </View>

              <View style={{ marginTop: 22 }}>
                <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 16, marginBottom: 8 }}>
                  Add a note <Text style={{ color: Surface.faint, fontFamily: FontFamily.bodySemiBold }}>(optional)</Text>
                </Text>
                <TextInput
                  ref={sessionNoteInputRef}
                  style={{
                    minHeight: 96,
                    paddingHorizontal: 16,
                    paddingTop: 14,
                    paddingBottom: 14,
                    backgroundColor: Surface.surfaceRaised,
                    borderRadius: 18,
                    color: Surface.ink,
                    fontFamily: FontFamily.body,
                    fontSize: 17,
                    lineHeight: 24,
                  }}
                  placeholder="What did you work on?"
                  placeholderTextColor={Surface.faint}
                  accessibilityLabel="Session note"
                  multiline
                  blurOnSubmit={false}
                  maxLength={280}
                  value={sessionNoteDraft}
                  onChangeText={setSessionNoteDraft}
                  textAlignVertical="top"
                  returnKeyType="default"
                  inputAccessoryViewID={Platform.OS === 'ios' ? SESSION_NOTE_INPUT_ACCESSORY_ID : undefined}
                />
                <Text style={{ color: Surface.faint, fontFamily: FontFamily.bodySemiBold, fontSize: 12, textAlign: 'right', marginTop: 6 }}>
                  {sessionNoteDraft.length}/280
                </Text>
              </View>

              <View style={{ marginTop: 14 }}>
                <CTA label="Back to Today" onPress={() => void finishSessionComplete()} />
              </View>
              <Pressable
                onPress={() => void startAnotherSession()}
                accessibilityRole="button"
                accessibilityLabel="Start another session"
                style={({ pressed }) => ({ marginTop: 10, paddingVertical: 12, alignItems: 'center', opacity: pressed ? 0.6 : 1 })}
              >
                <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodyBold, fontSize: 16 }}>Start another session</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ─── Preparation: pick how long, then start ───
  if (sessionModel.phase === 'preparing' && goal && action) {
    const tone = getGoalColor(goal);
    const effectiveDuration = useCustomDuration ? clampSessionMinutes(Number(customMinsStr) || 25) : durationMins;
    const presets = DURATION_PRESETS as readonly number[];

    const stepDown = () => {
      hapticMedium();
      if (useCustomDuration) {
        const current = Number(customMinsStr) || 25;
        const next = Math.max(1, current - 5);
        setCustomMinsStr(String(next));
      } else {
        const currentIndex = presets.indexOf(durationMins);
        if (currentIndex > 0) setDurationMins(presets[currentIndex - 1]);
      }
    };
    const stepUp = () => {
      hapticMedium();
      if (useCustomDuration) {
        const current = Number(customMinsStr) || 25;
        const next = Math.min(999, current + 5);
        setCustomMinsStr(String(next));
      } else {
        const currentIndex = presets.indexOf(durationMins);
        if (currentIndex < presets.length - 1) {
          setDurationMins(presets[currentIndex + 1]);
        } else {
          setUseCustomDuration(true);
          setCustomMinsStr(String(durationMins + 15));
        }
      }
    };
    const pickPreset = (m: number) => {
      hapticLight();
      setUseCustomDuration(false);
      setDurationMins(m);
    };
    const hrs = Math.floor(effectiveDuration / 60);
    const durationWords =
      hrs > 0 ? `${hrs}h${effectiveDuration % 60 ? ` ${effectiveDuration % 60}m` : ''}` : `${effectiveDuration} minutes`;

    return (
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: Surface.canvas }}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={() => {
                hapticMedium();
                setSessionModel(transitionFocusSession(sessionModel, { type: 'reset' }));
              }}
              hitSlop={10}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: Surface.surfaceRaised,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name="close" size={22} color={Surface.ink} />
            </Pressable>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 7,
                height: 34,
                paddingHorizontal: 14,
                borderRadius: 17,
                backgroundColor: getGoalTint(goal),
              }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone }} />
              <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 14 }}>{goal.name}</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          <View style={{ flex: 1, justifyContent: 'center' }}>
            <View style={{ alignItems: 'center' }}>
              <Mascot mood="happy" size={112} intensity={0.6} />
            </View>
            <Text style={[T.title, { marginTop: 12 }]} numberOfLines={2}>
              {action.name}
            </Text>
            <Text style={[T.body, { marginTop: 6 }]}>
              How long are you giving to <Text style={{ color: tone, fontFamily: FontFamily.bodySemiBold }}>{goal.name}</Text>?
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 26 }}>
              <StepButton icon="remove" accessibilityLabel="Shorter session" onPress={stepDown} />
              <View style={{ minWidth: 130, alignItems: 'center' }}>
                <Text
                  accessibilityLabel={`${effectiveDuration} minutes`}
                  style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 64, lineHeight: 70, letterSpacing: -1.5 }}
                >
                  {effectiveDuration}
                </Text>
                <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodySemiBold, fontSize: 14 }}>
                  {hrs > 0 ? durationWords : 'minutes'}
                </Text>
              </View>
              <StepButton icon="add" accessibilityLabel="Longer session" onPress={stepUp} />
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 22 }}>
              {presets.map((m) => (
                <Chip
                  key={m}
                  label={m >= 60 ? `${m / 60 === Math.floor(m / 60) ? m / 60 : (m / 60).toFixed(1)}h` : `${m}m`}
                  accessibilityLabel={`${m} minutes`}
                  on={!useCustomDuration && durationMins === m}
                  onPress={() => pickPreset(m)}
                />
              ))}
            </View>
          </View>

          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 14 }}>
              <Ionicons name={AppBlocking.isAvailable() ? 'lock-closed' : 'timer-outline'} size={13} color={Surface.faint} />
              <Text style={{ color: Surface.faint, fontFamily: FontFamily.bodySemiBold, fontSize: 13 }}>
                {AppBlocking.isAvailable() ? 'Distracting apps get blocked while you focus' : 'Timer only on this device'}
              </Text>
            </View>
            <CTA
              label="Start focus"
              onPress={() => {
                hapticSuccess();
                void startFocus();
              }}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Pick what to focus on ───
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: Surface.canvas }}>
      <Stack.Screen options={{ title: 'Focus', headerShown: false }} />
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: tabBarOverlapPadding(insets.bottom) + 24 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <View style={{ flex: 1 }}>
            <Text style={[T.titleLeft, { fontSize: 34, lineHeight: 40, letterSpacing: -0.5 }]}>Focus</Text>
            <Text style={[T.body, { textAlign: 'left', marginTop: 4 }]}>Pick where your next hour goes.</Text>
          </View>
          <Mascot mood="happy" size={72} intensity={0.6} />
        </View>

        {allActions.length === 0 ? (
          <View style={{ backgroundColor: Surface.surfaceRaised, borderRadius: 20, padding: 24, alignItems: 'center' }}>
            <Mascot mood="think" size={96} intensity={0.35} />
            <Text style={[T.lead, { marginTop: 10 }]}>Nothing to focus on yet</Text>
            <Text style={[T.body, { marginTop: 6, marginBottom: 18 }]}>
              Add a timed action to one of your pillars and it shows up here.
            </Text>
            <View style={{ alignSelf: 'stretch' }}>
              <CTA label="Add a pillar" onPress={() => router.push('/(tabs)/goals?create=1')} />
            </View>
          </View>
        ) : null}

        {goals.map((g) => {
          const actions = (actionsByGoal[g.id] ?? []).filter((a) => a.type === 'session');
          if (actions.length === 0) return null;
          const tone = getGoalColor(g);
          return (
            <View key={g.id} style={{ marginBottom: 22 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tone }} />
                <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 17 }}>{g.name}</Text>
              </View>

              <View style={{ gap: 10 }}>
                {actions.map((a) => (
                  <Pressable
                    key={a.id}
                    onPress={() => {
                      hapticLight();
                      chooseAction(g, a);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Focus on ${a.name}, ${a.target_minutes} minutes for ${g.name}`}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 14,
                      minHeight: 72,
                      paddingHorizontal: 18,
                      paddingVertical: 14,
                      borderRadius: 18,
                      backgroundColor: Surface.surfaceRaised,
                      transform: [{ scale: pressed ? 0.985 : 1 }],
                    })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 17, lineHeight: 22 }}>{a.name}</Text>
                      <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodySemiBold, fontSize: 14, marginTop: 2 }}>
                        {a.target_minutes} min for {g.name}
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: Surface.ink,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="play" size={17} color="#FFFFFF" style={{ marginLeft: 2 }} />
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

