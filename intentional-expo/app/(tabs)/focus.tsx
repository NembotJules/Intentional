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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { PrimaryButton } from '@/components/PrimaryButton';
import { GoalChip } from '@/components/GoalChip';
import { Colors, Surface } from '@/constants/design';
import { useGoals } from '@/db/hooks';
import * as api from '@/db/api';
import type { MetaGoal, DailyAction, FocusSession } from '@/types';
import { getGoalColor, getGoalTint } from '@/utils/goalColors';
import { hapticMedium, hapticSuccess, hapticWarning } from '@/utils/haptics';
import * as AppBlocking from '@/services/appBlocking';
import {
  clampSessionMinutes,
  createFocusSessionDraft,
  formatCountdown,
  type FocusPhase,
} from '@/services/focusSessionDomain';
import { FontFamily, Radius } from '@/constants/design';

type FocusState = Exclude<FocusPhase, 'paused'>;

/** US-023: MVP presets (25 / 45 / 60 / 90 / 120) + action default + Custom */
const DURATION_PRESETS = [25, 45, 60, 90, 120] as const;

const SESSION_NOTE_INPUT_ACCESSORY_ID = 'sessionNoteInputAccessory';

/** US-041: show saved category prefs (not enforced in Expo). */
function blockingPrefsSummary(): string {
  const ids = api.getBlockedCategoryIds();
  const labels = ids
    .map((id) => api.BLOCKABLE_APP_CATEGORIES.find((c) => c.id === id)?.label ?? id)
    .slice(0, 4);
  const tail = ids.length > 4 ? ` +${ids.length - 4}` : '';
  return `${ids.length} categor${ids.length === 1 ? 'y' : 'ies'} (${labels.join(', ')}${tail})`;
}

/** Must match `(tabs)/_layout.tsx` tabBarStyle height so PAUSE/END aren’t covered by the floating tab bar */
function tabBarOverlapPadding(insetsBottom: number) {
  const tabBarCore = 56;
  const tabBarExtra = 8;
  const gapAboveBar = 10;
  return tabBarCore + Math.max(insetsBottom, 6) + tabBarExtra + gapAboveBar;
}

function FocusTimerRing({
  remaining,
  total,
  color,
}: {
  remaining: number;
  total: number;
  color: string;
}) {
  const size = 260;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  /** US-027: ring fills as session progresses (elapsed), not remaining */
  const elapsed = Math.max(0, total - remaining);
  const fillRatio = total > 0 ? Math.max(0, Math.min(1, elapsed / total)) : 0;
  const offset = circumference * (1 - fillRatio);

  return (
    <View className="items-center justify-center" style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference}, ${circumference}`}
          strokeDashoffset={offset}
        />
      </Svg>
      <View className="absolute items-center">
        <Text style={{ color: Surface.focusText, fontFamily: FontFamily.display, fontSize: 112, lineHeight: 112 }}>
          {formatCountdown(remaining)}
        </Text>
        <Text style={{ color: Surface.focusMuted, fontFamily: FontFamily.monoMedium, fontSize: 11, letterSpacing: 1, marginTop: 8, textTransform: 'uppercase' }}>
          remaining
        </Text>
      </View>
    </View>
  );
}

export default function FocusScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ goalId?: string; actionId?: string }>();
  const { goals } = useGoals();
  const [actionsByGoal, setActionsByGoal] = useState<Record<string, DailyAction[]>>({});
  const [state, setState] = useState<FocusState>('idle');
  const [goal, setGoal] = useState<MetaGoal | null>(null);
  const [action, setAction] = useState<DailyAction | null>(null);
  const [durationMins, setDurationMins] = useState(25);
  const [useCustomDuration, setUseCustomDuration] = useState(false);
  const [customMinsStr, setCustomMinsStr] = useState('25');
  const [remaining, setRemaining] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [completedSession, setCompletedSession] = useState<FocusSession | null>(null);
  const [sessionNoteDraft, setSessionNoteDraft] = useState('');
  const [actionStreak, setActionStreak] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  /** Fixed for the active session — pause/resume + ring must not use prepare-screen duration if it changes */
  const sessionTotalSecondsRef = useRef(0);
  /** Bonus B: ref-tracked state so useFocusEffect cleanup isn't stale */
  const focusStateRef = useRef<FocusState>('idle');
  const sessionNoteInputRef = useRef<TextInput>(null);
  const goalIdParam = useMemo(
    () => (Array.isArray(params.goalId) ? params.goalId[0] : params.goalId),
    [params.goalId]
  );
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
    elapsedRef.current = elapsed;
  }, [elapsed]);

  // Keep focusStateRef in sync so useFocusEffect cleanup can read it without a stale closure
  useEffect(() => {
    focusStateRef.current = state;
  }, [state]);

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
    if (goalIdParam && actionIdParam && goals.length) {
      const resolvedGoalId = decodeURIComponent(goalIdParam);
      const resolvedActionId = decodeURIComponent(actionIdParam);
      const g = goals.find((x) => x.id === resolvedGoalId);
      if (!g) return;
      api.getActionsByGoal(g.id).then((actions) => {
        const a = actions.find((x) => x.id === resolvedActionId);
        if (!a) return;
        setGoal(g);
        setAction(a);
        applyDurationFromAction(a);
        setState('preparing');
      });
    }
  }, [goalIdParam, actionIdParam, goals, applyDurationFromAction]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if ((state === 'completed' || state === 'aborted') && action && completedSession) {
      void api.getFocusStreakForAction(action.id).then(setActionStreak);
    }
  }, [state, action?.id, completedSession?.id]);

  /**
   * Bonus B — Session abandon guard.
   * When the Focus tab loses focus (user taps another tab) while a session is
   * actively running, automatically save the elapsed time as a partial session
   * so no work is lost. The timer stops and the user returns to the idle picker.
   */
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (focusStateRef.current === 'focusing') {
          clearTick();
          const elapsed = elapsedRef.current;
          if (elapsed > 0 && goal && action) {
            void api.saveFocusSession(createFocusSessionDraft({
              actionId: action.id,
              goalId: goal.id,
              elapsedSeconds: elapsed,
              completedFullTimer: false,
            }));
          }
          // Lift shields — session was abandoned by navigating away
          void AppBlocking.removeShields();
          // Reset to idle — user will see the picker when they return
          setState('idle');
          setGoal(null);
          setAction(null);
          setCompletedSession(null);
          setSessionNoteDraft('');
          setActionStreak(0);
          setElapsed(0);
          setRemaining(0);
          setIsPaused(false);
        }
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [goal, action])
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

  const resolvedDurationMinutes = useCallback(() => {
    if (useCustomDuration) return clampSessionMinutes(Number(customMinsStr));
    return durationMins;
  }, [useCustomDuration, customMinsStr, durationMins]);

  const endSessionWithElapsed = async (totalElapsed: number, completedFullTimer: boolean) => {
    if (!goal || !action) return;
    const session = await api.saveFocusSession(createFocusSessionDraft({
      actionId: action.id,
      goalId: goal.id,
      elapsedSeconds: totalElapsed,
      completedFullTimer,
    }));
    setCompletedSession(session);
    setSessionNoteDraft('');
    // Lift OS shields regardless of how the session ended
    void AppBlocking.removeShields();
    if (completedFullTimer) hapticSuccess(); else hapticWarning();
    setState(completedFullTimer ? 'completed' : 'aborted');
  };

  const startFocus = () => {
    if (!goal || !action) return;
    hapticMedium();
    // Apply OS-level shields; no-op on web / Expo Go / Android
    void AppBlocking.applyShields();
    const mins = resolvedDurationMinutes();
    const total = mins * 60;
    sessionTotalSecondsRef.current = total;
    setRemaining(total);
    setElapsed(0);
    setIsPaused(false);
    setState('focusing');
    clearTick();
    intervalRef.current = setInterval(() => {
      setElapsed((e) => {
        const next = e + 1;
        setRemaining(Math.max(0, total - next));
        if (next >= total) {
          clearTick();
          void endSessionWithElapsed(next, true);
        }
        return next;
      });
    }, 1000);
  };

  const endSessionEarly = async () => {
    clearTick();
    await endSessionWithElapsed(elapsedRef.current, false);
  };

  const togglePause = () => {
    if (!goal || !action) return;
    const total = sessionTotalSecondsRef.current;
    if (total <= 0) return;
    if (isPaused) {
      setIsPaused(false);
      clearTick();
      intervalRef.current = setInterval(() => {
        setElapsed((e) => {
          const next = e + 1;
          setRemaining(Math.max(0, total - next));
          if (next >= total) {
            clearTick();
            void endSessionWithElapsed(next, true);
          }
          return next;
        });
      }, 1000);
      return;
    }
    clearTick();
    setIsPaused(true);
  };

  const backToToday = () => {
    clearTick();
    setState('idle');
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
    // Multiline TextInput often ignores Keyboard.dismiss() until blurred
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
    setState('idle');
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
    setState('preparing');
  };

  if (state === 'focusing' && goal && action) {
    const totalSeconds = sessionTotalSecondsRef.current;
    const tone = getGoalColor(goal.id);
    return (
      <SafeAreaView
        edges={['top', 'left', 'right']}
        className="flex-1 bg-focus-canvas px-5"
        style={{ paddingBottom: tabBarOverlapPadding(insets.bottom) }}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <View className="pt-2 items-center">
          <View className="px-4 py-2 flex-row items-center gap-2" style={{ borderWidth: 1, borderColor: Surface.focusRule, backgroundColor: Surface.focusSurface, borderRadius: Radius.full }}>
            <Ionicons name="lock-closed" size={12} color={Surface.focusMuted} />
            <Text style={{ color: Surface.focusMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
              Focus room
            </Text>
          </View>
        </View>
        <View className="flex-1 items-center justify-between py-8" style={{ zIndex: 1 }}>
          <View className="items-center mt-3 px-2">
            <Text style={{ color: Surface.focusMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1, textAlign: 'center', textTransform: 'uppercase' }}>
              {goal.name}
            </Text>
            <GoalChip name={goal.name} color={tone} icon={goal.icon} useTint />
            <Text style={{ color: Surface.focusText, fontFamily: FontFamily.display, fontSize: 34, lineHeight: 36, textAlign: 'center', marginTop: 14 }}>
              {action.name}
            </Text>
          </View>

          <FocusTimerRing remaining={remaining} total={totalSeconds} color={tone} />

          <View className="w-full mb-1">
            <View className="items-center mb-6">
              <View className="px-3 py-1.5" style={{ backgroundColor: Surface.focusSurface, borderWidth: 1, borderColor: Surface.focusRule, borderRadius: Radius.full }}>
                <Text style={{ color: Surface.focusMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
                  {isPaused ? 'Shield lifted' : 'Timer only'}
                </Text>
              </View>
              <Text style={{ color: Surface.focusFaint, fontFamily: FontFamily.body, fontSize: 14, lineHeight: 19, marginTop: 8, textAlign: 'center', paddingHorizontal: 16 }}>
                Category shields are not available in this build. Your focus time still counts honestly. Settings: {blockingPrefsSummary()}.
              </Text>
            </View>
            <View className="flex-row gap-4 flex-shrink-0">
              <View className="flex-1">
                <PrimaryButton
                  title={isPaused ? 'RESUME' : 'PAUSE'}
                  variant="ghost"
                  color={Surface.focusText}
                  onPress={togglePause}
                />
              </View>
              <View className="flex-1">
                <PrimaryButton
                  title="END"
                  variant="ghost"
                  color={Colors.accentDanger}
                  onPress={() =>
                    Alert.alert('End session?', 'Your time will still be logged.', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'End session', onPress: () => void endSessionEarly() },
                    ])
                  }
                />
              </View>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if ((state === 'completed' || state === 'aborted') && goal && action && completedSession) {
    const secs = completedSession.duration_seconds;
    const mins = Math.floor(secs / 60);
    const hrs = Math.floor(mins / 60);
    const display = hrs > 0 ? `${hrs}h ${mins % 60}m` : mins > 0 ? `${mins}m` : `${secs}s`;
    const tone = getGoalColor(goal.id);
    const tint = getGoalTint(goal.id);
    const fullComplete = state === 'completed';

    const bottomPad = tabBarOverlapPadding(insets.bottom) + 24;

    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'left', 'right']}>
        <Stack.Screen options={{ headerShown: false }} />

        <KeyboardAvoidingView
          className="flex-1"
          style={{ zIndex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {Platform.OS === 'ios' ? (
            <InputAccessoryView nativeID={SESSION_NOTE_INPUT_ACCESSORY_ID}>
              <View className="flex-row justify-end items-center px-3 py-2.5 bg-surface border-t border-rule">
                <Pressable
                  onPress={dismissSessionNoteKeyboard}
                  hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: 4, paddingHorizontal: 8 })}
                >
                  <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 17 }}>Done</Text>
                </Pressable>
              </View>
            </InputAccessoryView>
          ) : null}

          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="always"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingTop: 16,
              paddingBottom: bottomPad,
              alignItems: 'center',
            }}
          >
            <View className="w-24 h-24 items-center justify-center mb-6" style={{ backgroundColor: tint, borderRadius: Radius.xl }}>
              <Ionicons name={fullComplete ? 'checkmark' : 'time-outline'} size={40} color={tone} />
            </View>
            <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.display, fontSize: 44, lineHeight: 46, textAlign: 'center', marginBottom: 8 }}>
              {fullComplete ? 'Session complete.' : 'Partial time counts.'}
            </Text>
            <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 17, lineHeight: 24, textAlign: 'center', marginBottom: 8, paddingHorizontal: 8 }}>
              {fullComplete ? (
                <>
                  Time credited to <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold }}>{action.name}</Text>.
                </>
              ) : (
                <>
                  You ended early. <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold }}>{display}</Text> still logged.
                </>
              )}
            </Text>

            <View
              className="px-10 py-6 mb-4 items-center w-full max-w-[320px]"
              style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.lg }}
            >
              <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.display, fontSize: 64, lineHeight: 64 }}>{display}</Text>
              <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1, marginTop: 6, textTransform: 'uppercase' }}>
                Time logged
              </Text>
            </View>

            <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 15, lineHeight: 21, marginBottom: 24, textAlign: 'center', paddingHorizontal: 8 }}>
              <Text style={{ color: tone, fontFamily: FontFamily.bodySemiBold }}>
                {actionStreak}
              </Text>
              {' - '}
              day streak for this action
            </Text>

            <View className="mb-6 w-full max-w-[320px]">
              <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>Session note (optional)</Text>
              <TextInput
                ref={sessionNoteInputRef}
                className="px-4 py-3 min-h-[88px]"
                style={{
                  backgroundColor: Surface.surface,
                  borderWidth: 1,
                  borderColor: Surface.rule,
                  borderRadius: Radius.md,
                  color: Colors.textPrimary,
                  fontFamily: FontFamily.body,
                  fontSize: 17,
                  lineHeight: 24,
                }}
                placeholder="What did you work on?"
                placeholderTextColor={Colors.textGhost}
                multiline
                blurOnSubmit={false}
                maxLength={280}
                value={sessionNoteDraft}
                onChangeText={setSessionNoteDraft}
                textAlignVertical="top"
                returnKeyType="default"
                inputAccessoryViewID={Platform.OS === 'ios' ? SESSION_NOTE_INPUT_ACCESSORY_ID : undefined}
              />
              <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoMedium, fontSize: 11, textAlign: 'right', marginTop: 4 }}>{sessionNoteDraft.length}/280</Text>
            </View>

            <View className="mb-6">
              <GoalChip name={goal.name} color={tone} icon={goal.icon} useTint />
            </View>

            <View className="w-full max-w-[320px]">
              <PrimaryButton title="Back to Today" onPress={() => void finishSessionComplete()} />
            </View>
            <Pressable onPress={() => void startAnotherSession()} className="mt-3 py-2 mb-2">
              <Text className="text-footnote text-text-tertiary text-center font-semibold">Done</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (state === 'preparing' && goal && action) {
    const tone = getGoalColor(goal.id);
    return (
      <ScrollView
        className="flex-1 bg-focus-canvas"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 36, flexGrow: 1, justifyContent: 'center' }}
      >
        <Stack.Screen options={{ title: 'Prepare Session', headerShown: true }} />
        <View className="items-center mb-8">
          <GoalChip name={goal.name} color={tone} icon={goal.icon} useTint />
          <Text style={{ color: Surface.focusText, fontFamily: FontFamily.display, fontSize: 44, lineHeight: 46, textAlign: 'center', marginTop: 16 }}>
            {action.name}
          </Text>
          <Text style={{ color: Surface.focusMuted, fontFamily: FontFamily.body, fontSize: 17, lineHeight: 24, marginTop: 4 }}>
            Choose your focus duration.
          </Text>
          <Text style={{ color: Surface.focusFaint, fontFamily: FontFamily.body, fontSize: 14, lineHeight: 19, textAlign: 'center', marginTop: 12, paddingHorizontal: 8 }}>
            Next session will reference category prefs: {blockingPrefsSummary()}.
          </Text>
        </View>

        <View className="flex-row flex-wrap justify-center gap-3 mb-4">
          {DURATION_PRESETS.map((m) => {
            const selected = !useCustomDuration && durationMins === m;
            return (
              <Pressable
                key={m}
                onPress={() => {
                  setUseCustomDuration(false);
                  setDurationMins(m);
                }}
                className="w-20 h-20 rounded-lg items-center justify-center"
                style={{
                  borderWidth: 1,
                  borderColor: selected ? tone : Surface.focusRule,
                  backgroundColor: selected ? tone : Surface.focusSurface,
                  borderRadius: Radius.md,
                }}
              >
                <Text
                  style={{ color: selected ? Surface.focusText : Surface.focusText, fontFamily: FontFamily.display, fontSize: 34, lineHeight: 36 }}
                >
                  {m}
                </Text>
                <Text
                  style={{ color: selected ? Surface.focusText : Surface.focusMuted, fontFamily: FontFamily.monoMedium, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', opacity: selected ? 0.85 : 1 }}
                >
                  min
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setUseCustomDuration(true)}
            className="w-20 h-20 rounded-lg items-center justify-center"
            style={{
              borderWidth: 1,
              borderColor: useCustomDuration ? tone : Surface.focusRule,
              backgroundColor: useCustomDuration ? tone : Surface.focusSurface,
              borderRadius: Radius.md,
            }}
          >
            <Text
              style={{ color: Surface.focusText, fontFamily: FontFamily.monoSemiBold, fontSize: 11 }}
            >
              Custom
            </Text>
            <Text
              style={{ color: useCustomDuration ? Surface.focusText : Surface.focusMuted, fontFamily: FontFamily.monoMedium, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', opacity: useCustomDuration ? 0.85 : 1 }}
            >
              min
            </Text>
          </Pressable>
        </View>

        {useCustomDuration ? (
          <View className="mb-8 px-2">
            <Text className="text-footnote text-text-tertiary mb-2">Minutes (1–999)</Text>
            <TextInput
              className="rounded-lg px-4 py-3 text-title2"
              style={{
                backgroundColor: Surface.focusSurface,
                borderWidth: 1,
                borderColor: Surface.focusRule,
                color: Surface.focusText,
                fontFamily: FontFamily.display,
              }}
              keyboardType="number-pad"
              value={customMinsStr}
              onChangeText={(t) => setCustomMinsStr(t.replace(/\D/g, '').slice(0, 3))}
              placeholder="45"
              placeholderTextColor={Surface.focusFaint}
            />
          </View>
        ) : (
          <View className="mb-8" />
        )}

        <PrimaryButton title="Start Session" appearance="goalOutline" color={tone} onPress={startFocus} />
        <Pressable onPress={() => setState('idle')} className="mt-4 items-center py-2">
          <Text style={{ color: Surface.focusMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>Cancel</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <View className="flex-1 bg-focus-canvas">
      <Stack.Screen options={{ title: 'Focus', headerShown: true }} />
      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120 }}>
        <Text style={{ color: Surface.focusMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
          Focus
        </Text>
        <Text style={{ color: Surface.focusText, fontFamily: FontFamily.display, fontSize: 44, lineHeight: 46, marginBottom: 18 }}>
          Step into a quiet room.
        </Text>

        {allActions.length === 0 ? (
          <View className="p-8 items-center" style={{ backgroundColor: Surface.focusSurface, borderWidth: 1, borderColor: Surface.focusRule, borderRadius: Radius.lg }}>
            <Ionicons name="timer-outline" size={42} color={Surface.focusMuted} />
            <Text style={{ color: Surface.focusMuted, fontFamily: FontFamily.body, fontSize: 17, lineHeight: 24, textAlign: 'center', marginTop: 12, marginBottom: 16 }}>
              No session actions yet. Add one from Goals to start focusing.
            </Text>
            <PrimaryButton
              title="Add goal"
              size="small"
              color={Surface.focusText}
              fullWidth={false}
              style={{ minWidth: 140 }}
              onPress={() => router.push('/(tabs)/goals?create=1')}
            />
          </View>
        ) : null}

        {goals.map((g) => {
          const actions = (actionsByGoal[g.id] ?? []).filter((a) => a.type === 'session');
          if (actions.length === 0) return null;
          const tone = getGoalColor(g.id);
          return (
            <View key={g.id} className="mb-6">
              <View className="flex-row items-center mb-2">
                <View className="w-[9px] h-[9px] rounded-full mr-2" style={{ backgroundColor: tone }} />
                <Text style={{ color: Surface.focusMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>{g.name}</Text>
              </View>

              {actions.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => chooseAction(g, a)}
                  className="p-4 mb-2 flex-row items-center"
                  style={{ backgroundColor: Surface.focusSurface, borderWidth: 1, borderColor: Surface.focusRule, borderRadius: Radius.lg }}
                >
                  <View className="flex-1">
                    <Text style={{ color: Surface.focusText, fontFamily: FontFamily.bodySemiBold, fontSize: 17, lineHeight: 22 }}>{a.name}</Text>
                    <Text style={{ color: Surface.focusMuted, fontFamily: FontFamily.monoMedium, fontSize: 10, letterSpacing: 0.8, marginTop: 3, textTransform: 'uppercase' }}>{a.target_minutes} minute target</Text>
                  </View>
                  <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: getGoalTint(g.id) }}>
                    <Ionicons name="timer-outline" size={18} color={tone} />
                  </View>
                </Pressable>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
