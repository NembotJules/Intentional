import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TouchableOpacity,
  Alert,
  TextInput,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  InputAccessoryView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { PrimaryButton } from '@/components/PrimaryButton';
import { GoalChip } from '@/components/GoalChip';
import { Colors } from '@/constants/design';
import { useGoals } from '@/db/hooks';
import * as api from '@/db/api';
import type { MetaGoal, DailyAction, FocusSession } from '@/types';
import { shadows } from '@/styles/shadows';
import { getGoalColor, getGoalTint } from '@/utils/goalColors';
import { GrainOverlay, ScanlineOverlay } from '@/components/BrutalistOverlay';

type FocusState = 'idle' | 'preparing' | 'focusing' | 'completed' | 'aborted';

/** US-023: MVP presets (25 / 60 / 90 / 120) + action default + Custom */
const DURATION_PRESETS = [25, 60, 90, 120] as const;

const SESSION_NOTE_INPUT_ACCESSORY_ID = 'sessionNoteInputAccessory';

/** Must match `(tabs)/_layout.tsx` tabBarStyle height so PAUSE/END aren’t covered by the floating tab bar */
function tabBarOverlapPadding(insetsBottom: number) {
  const tabBarCore = 56;
  const tabBarExtra = 8;
  const gapAboveBar = 10;
  return tabBarCore + Math.max(insetsBottom, 6) + tabBarExtra + gapAboveBar;
}

function formatCountdown(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function clampMinutes(n: number): number {
  if (Number.isNaN(n) || n < 1) return 1;
  return Math.min(999, Math.floor(n));
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
        <Text className="text-timer font-thin text-white">{formatCountdown(remaining)}</Text>
        <Text className="text-footnote mt-2 text-white/50">remaining</Text>
      </View>
    </View>
  );
}

/** US-028: ~600ms geometric burst */
function CelebrationBurst({ color }: { color: string }) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(p, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [p]);

  const rings = [0, 1, 2];
  return (
    <View className="absolute inset-0 items-center justify-center pointer-events-none" style={{ zIndex: 0 }}>
      {rings.map((i) => {
        const scale = p.interpolate({
          inputRange: [0, 1],
          outputRange: [0.4 + i * 0.15, 1.6 + i * 0.35],
        });
        const opacity = p.interpolate({
          inputRange: [0, 0.35, 1],
          outputRange: [0.55 - i * 0.12, 0.35 - i * 0.08, 0],
        });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              width: 120,
              height: 120,
              borderRadius: 60,
              borderWidth: 1.5,
              borderColor: color,
              opacity,
              transform: [{ scale }],
            }}
          />
        );
      })}
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
    if (useCustomDuration) return clampMinutes(Number(customMinsStr));
    return durationMins;
  }, [useCustomDuration, customMinsStr, durationMins]);

  const endSessionWithElapsed = async (totalElapsed: number, completedFullTimer: boolean) => {
    if (!goal || !action) return;
    const startedAt = new Date(Date.now() - totalElapsed * 1000).toISOString();
    const session = await api.saveFocusSession({
      action_id: action.id,
      goal_id: goal.id,
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      duration_seconds: totalElapsed,
      note: null,
      was_completed: completedFullTimer ? 1 : 0,
    });
    setCompletedSession(session);
    setSessionNoteDraft('');
    setState(completedFullTimer ? 'completed' : 'aborted');
  };

  const startFocus = () => {
    if (!goal || !action) return;
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
        className="flex-1 bg-bg-focus px-4"
        style={{ paddingBottom: tabBarOverlapPadding(insets.bottom) }}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <GrainOverlay />
        <ScanlineOverlay />
        <View className="pt-2 items-center">
          <View className="px-4 py-1.5 rounded-full border border-white/15 bg-white/5 flex-row items-center gap-2">
            <Ionicons name="lock-closed" size={12} color="rgba(255,255,255,0.6)" />
            <Text className="text-caption uppercase tracking-wider text-white/70">Deep Focus</Text>
          </View>
        </View>
        <View className="flex-1 items-center justify-between py-8" style={{ zIndex: 1 }}>
          <View className="items-center mt-3 px-2">
            <Text className="text-footnote uppercase tracking-wider text-white/60 text-center">{goal.name}</Text>
            <GoalChip name={goal.name} color={tone} icon={goal.icon} useTint />
            <Text className="text-title3 font-semibold text-white text-center mt-3">{action.name}</Text>
          </View>

          <FocusTimerRing remaining={remaining} total={totalSeconds} color={tone} />

          <View className="w-full mb-1">
            <View className="items-center mb-6">
              <View className="px-3 py-1.5 rounded-full bg-white/10 border border-white/20">
                <Text className="text-caption uppercase tracking-wider text-white/70">
                  {isPaused ? 'BLOCKING PAUSED' : 'BLOCKING OFF IN THIS BUILD'}
                </Text>
              </View>
              <Text className="text-[10px] text-white/40 mt-2 text-center px-4 leading-4">
                App blocking isn’t available here — your focus timer still runs.
              </Text>
            </View>
            <View className="flex-row gap-4 flex-shrink-0">
              <View className="flex-1">
                <PrimaryButton
                  title={isPaused ? 'RESUME' : 'PAUSE'}
                  variant="ghost"
                  color={Colors.textPrimary}
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
      <SafeAreaView className="flex-1 bg-[#080808]" edges={['top', 'left', 'right']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
          <GrainOverlay />
          <ScanlineOverlay />
          <CelebrationBurst color={tone} />
        </View>

        <KeyboardAvoidingView
          className="flex-1"
          style={{ zIndex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {Platform.OS === 'ios' ? (
            <InputAccessoryView nativeID={SESSION_NOTE_INPUT_ACCESSORY_ID}>
              <View className="flex-row justify-end items-center px-3 py-2.5 bg-bg-secondary border-t border-separator">
                <TouchableOpacity onPress={dismissSessionNoteKeyboard} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}>
                  <Text className="text-body font-semibold text-text-primary">Done</Text>
                </TouchableOpacity>
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
            <View className="w-24 h-24 rounded-[28px] items-center justify-center mb-6" style={{ backgroundColor: tint }}>
              <Ionicons name={fullComplete ? 'checkmark' : 'time-outline'} size={40} color={tone} />
            </View>
            <Text className="text-title1 font-bold text-text-primary text-center mb-2">Session complete</Text>
            <Text className="text-body text-text-secondary text-center mb-2 px-2">
              {fullComplete ? (
                <>
                  Nice work on <Text className="font-semibold text-text-primary">{action.name}</Text>
                </>
              ) : (
                <>
                  You ended early — <Text className="font-semibold text-text-primary">{display}</Text> still logged.
                </>
              )}
            </Text>

            <View className="bg-bg-secondary rounded-xl px-10 py-6 mb-4 items-center w-full max-w-[320px]" style={shadows.float}>
              <Text className="text-largeTitle font-bold text-text-primary">{display}</Text>
              <Text className="text-footnote text-text-tertiary uppercase tracking-wider">Time logged</Text>
            </View>

            <Text className="text-subheadline text-text-secondary mb-6 text-center px-2">
              <Text style={{ color: tone }} className="font-bold">
                {actionStreak}
              </Text>
              {' · '}
              day streak for this action
            </Text>

            <View className="mb-6 w-full max-w-[320px]">
              <Text className="text-footnote text-text-tertiary uppercase tracking-wider mb-2">Session note (optional)</Text>
              <TextInput
                ref={sessionNoteInputRef}
                className="bg-bg-secondary rounded-xl px-4 py-3 text-body text-text-primary border border-separator min-h-[88px]"
                placeholder="What did you work on?"
                placeholderTextColor={Colors.textTertiary}
                multiline
                blurOnSubmit={false}
                maxLength={280}
                value={sessionNoteDraft}
                onChangeText={setSessionNoteDraft}
                textAlignVertical="top"
                returnKeyType="default"
                inputAccessoryViewID={Platform.OS === 'ios' ? SESSION_NOTE_INPUT_ACCESSORY_ID : undefined}
              />
              <View className="flex-row justify-between items-center mt-2">
                <TouchableOpacity
                  onPress={dismissSessionNoteKeyboard}
                  activeOpacity={0.7}
                  hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
                  className="py-2 pr-4 min-h-[44px] justify-center"
                >
                  <Text className="text-caption text-text-secondary font-semibold">Done typing</Text>
                </TouchableOpacity>
                <Text className="text-caption text-text-tertiary">{sessionNoteDraft.length}/280</Text>
              </View>
            </View>

            <View className="mb-6">
              <GoalChip name={goal.name} color={tone} icon={goal.icon} useTint />
            </View>

            <View className="w-full max-w-[320px]">
              <PrimaryButton title="Done" onPress={() => void finishSessionComplete()} />
            </View>
            <Pressable onPress={() => void startAnotherSession()} className="mt-3 py-2 mb-2">
              <Text className="text-footnote text-text-tertiary text-center">Start another session</Text>
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
        className="flex-1 bg-bg-primary"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 36, flexGrow: 1, justifyContent: 'center' }}
      >
        <Stack.Screen options={{ title: 'Prepare Session', headerShown: true }} />
        <View className="items-center mb-8">
          <GoalChip name={goal.name} color={tone} icon={goal.icon} useTint />
          <Text className="text-title2 font-semibold text-text-primary mt-4 text-center">{action.name}</Text>
          <Text className="text-subheadline text-text-secondary mt-1">Choose your focus duration</Text>
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
                className="w-20 h-20 rounded-lg items-center justify-center border"
                style={{
                  backgroundColor: selected ? Colors.textPrimary : Colors.backgroundSecondary,
                  borderColor: selected ? Colors.textPrimary : Colors.separator,
                }}
              >
                <Text className={`text-title3 font-bold ${selected ? 'text-white' : 'text-text-primary'}`}>{m}</Text>
                <Text className={`text-caption uppercase ${selected ? 'text-white/80' : 'text-text-tertiary'}`}>min</Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setUseCustomDuration(true)}
            className="w-20 h-20 rounded-lg items-center justify-center border"
            style={{
              backgroundColor: useCustomDuration ? Colors.textPrimary : Colors.backgroundSecondary,
              borderColor: useCustomDuration ? Colors.textPrimary : Colors.separator,
            }}
          >
            <Text className={`text-[11px] font-bold ${useCustomDuration ? 'text-white' : 'text-text-primary'}`}>Custom</Text>
            <Text className={`text-caption uppercase ${useCustomDuration ? 'text-white/80' : 'text-text-tertiary'}`}>min</Text>
          </Pressable>
        </View>

        {useCustomDuration ? (
          <View className="mb-8 px-2">
            <Text className="text-footnote text-text-tertiary mb-2">Minutes (1–999)</Text>
            <TextInput
              className="bg-bg-secondary rounded-lg px-4 py-3 text-title2 text-text-primary border border-separator"
              keyboardType="number-pad"
              value={customMinsStr}
              onChangeText={(t) => setCustomMinsStr(t.replace(/\D/g, '').slice(0, 3))}
              placeholder="45"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>
        ) : (
          <View className="mb-8" />
        )}

        <PrimaryButton title="Start Session" variant="ghost" color={tone} onPress={startFocus} />
        <Pressable onPress={() => setState('idle')} className="mt-4 items-center py-2">
          <Text className="text-footnote uppercase tracking-wider text-text-tertiary">Cancel</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <View className="flex-1 bg-bg-primary">
      <Stack.Screen options={{ title: 'Focus', headerShown: true }} />
      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 26 }}>
        <Text className="text-footnote uppercase tracking-wider text-text-tertiary mb-4">Select A Session</Text>

        {allActions.length === 0 ? (
          <View className="bg-bg-secondary rounded-xl p-8 items-center" style={shadows.card}>
            <Ionicons name="timer-outline" size={42} color={Colors.textTertiary} />
            <Text className="text-subheadline text-text-secondary text-center mt-3 mb-4">
              No session actions yet. Add one from Goals to start focusing.
            </Text>
            <PrimaryButton
              title="Add goal"
              size="small"
              color={Colors.accentBlue}
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
                <View className="w-1 h-5 rounded-full mr-2" style={{ backgroundColor: tone }} />
                <Text className="text-footnote uppercase tracking-wider text-text-tertiary">{g.name}</Text>
              </View>

              {actions.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => chooseAction(g, a)}
                  className="bg-bg-secondary rounded-lg p-4 mb-2 flex-row items-center"
                  style={shadows.card}
                >
                  <View className="flex-1">
                    <Text className="text-headline font-semibold text-text-primary">{a.name}</Text>
                    <Text className="text-footnote text-text-secondary mt-0.5">{a.target_minutes} minute target</Text>
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
