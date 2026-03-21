import { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { PrimaryButton } from '@/components/PrimaryButton';
import { GoalChip } from '@/components/GoalChip';
import { Colors } from '@/constants/design';
import { useGoals } from '@/db/hooks';
import * as api from '@/db/api';
import type { MetaGoal, DailyAction } from '@/types';
import { shadows } from '@/styles/shadows';
import { getGoalColor, getGoalTint } from '@/utils/goalColors';
import { GrainOverlay, ScanlineOverlay } from '@/components/BrutalistOverlay';

type FocusState = 'idle' | 'preparing' | 'focusing' | 'completed' | 'aborted';

const DURATIONS = [25, 45, 60, 90, 120];

function formatClock(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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
  const progress = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const offset = circumference * (1 - progress);

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
        <Text className="text-timer font-thin text-white">{formatClock(remaining)}</Text>
        <Text className="text-footnote mt-2 text-white/50">remaining</Text>
      </View>
    </View>
  );
}

export default function FocusScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ goalId?: string; actionId?: string }>();
  const { goals } = useGoals();
  const [actionsByGoal, setActionsByGoal] = useState<Record<string, DailyAction[]>>({});
  const [state, setState] = useState<FocusState>('idle');
  const [goal, setGoal] = useState<MetaGoal | null>(null);
  const [action, setAction] = useState<DailyAction | null>(null);
  const [durationMins, setDurationMins] = useState(25);
  const [remaining, setRemaining] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [completedSession, setCompletedSession] = useState<{ duration_seconds: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const goalIdParam = useMemo(
    () => (Array.isArray(params.goalId) ? params.goalId[0] : params.goalId),
    [params.goalId]
  );
  const actionIdParam = useMemo(
    () => (Array.isArray(params.actionId) ? params.actionId[0] : params.actionId),
    [params.actionId]
  );

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
        setDurationMins(a.target_minutes || 25);
        setState('preparing');
      });
    }
  }, [goalIdParam, actionIdParam, goals]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const allActions = useMemo(
    () => Object.values(actionsByGoal).flat().filter((a) => a.type === 'session'),
    [actionsByGoal]
  );

  const clearTick = () => {
    if (!intervalRef.current) return;
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  };

  const endSessionWithElapsed = async (totalElapsed: number, completed: boolean) => {
    if (!goal || !action) return;
    const startedAt = new Date(Date.now() - totalElapsed * 1000).toISOString();
    const session = await api.saveFocusSession({
      action_id: action.id,
      goal_id: goal.id,
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      duration_seconds: totalElapsed,
      note: null,
      was_completed: completed ? 1 : 0,
    });
    setCompletedSession(session);
    setState(completed ? 'completed' : 'aborted');
  };

  const startFocus = () => {
    if (!goal || !action) return;
    const total = durationMins * 60;
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

  const endSession = async (completed: boolean) => {
    clearTick();
    await endSessionWithElapsed(elapsedRef.current, completed);
  };

  const togglePause = () => {
    if (!goal || !action) return;
    if (isPaused) {
      const total = durationMins * 60;
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
    router.replace('/(tabs)/today');
  };

  const chooseAction = (g: MetaGoal, a: DailyAction) => {
    setGoal(g);
    setAction(a);
    setDurationMins(a.target_minutes || 25);
    setState('preparing');
  };

  if (state === 'focusing' && goal && action) {
    const totalSeconds = durationMins * 60;
    const tone = getGoalColor(goal.id);
    return (
      <SafeAreaView className="flex-1 bg-bg-focus px-4">
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
          <View className="items-center mt-3">
            <GoalChip name={goal.name} color={tone} icon={goal.icon} useTint />
            <Text className="text-subheadline uppercase tracking-wider text-white/50 mt-2">{action.name}</Text>
          </View>

          <FocusTimerRing remaining={remaining} total={totalSeconds} color={tone} />

          <View className="w-full mb-1">
            <View className="items-center mb-6">
              <View className="px-3 py-1.5 rounded-full bg-white/10 border border-white/20">
                <Text className="text-caption uppercase tracking-wider text-white/70">Apps Blocked</Text>
              </View>
            </View>
            <View className="flex-row gap-4">
              <View className="flex-1">
                <PrimaryButton
                  title={isPaused ? 'Resume' : 'Pause'}
                  variant="ghost"
                  color={Colors.textInverse}
                  onPress={togglePause}
                />
              </View>
              <View className="flex-1">
                <PrimaryButton
                  title="End"
                  variant="ghost"
                  color={Colors.accentDanger}
                  onPress={() =>
                    Alert.alert('End Session?', 'Do you want to save your progress so far?', [
                      { text: 'Keep Focusing', style: 'cancel' },
                      { text: 'Discard', style: 'destructive', onPress: () => backToToday() },
                      { text: 'Save & End', onPress: () => void endSession(true) },
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
    const mins = Math.floor(completedSession.duration_seconds / 60);
    const hrs = Math.floor(mins / 60);
    const display = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
    const tone = getGoalColor(goal.id);
    const tint = getGoalTint(goal.id);

    return (
      <View className="flex-1 bg-[#080808] items-center justify-center p-8">
        <Stack.Screen options={{ headerShown: false }} />
        <GrainOverlay />
        <ScanlineOverlay />
        <View className="w-24 h-24 rounded-[28px] items-center justify-center mb-6" style={{ backgroundColor: tint, zIndex: 1 }}>
          <Ionicons name={state === 'completed' ? 'checkmark' : 'pause'} size={40} color={tone} />
        </View>
        <Text className="text-title1 font-bold text-text-primary text-center mb-2" style={{ zIndex: 1 }}>
          {state === 'completed' ? 'Session Complete' : 'Session Ended'}
        </Text>
        <Text className="text-body text-text-secondary text-center mb-8" style={{ zIndex: 1 }}>
          You focused on <Text className="font-semibold text-text-primary">{action.name}</Text>
        </Text>

        <View className="bg-bg-secondary rounded-xl px-10 py-6 mb-8 items-center" style={[shadows.float, { zIndex: 1 }]}>
          <Text className="text-largeTitle font-bold text-text-primary">{display}</Text>
          <Text className="text-footnote text-text-tertiary uppercase tracking-wider">Time logged</Text>
        </View>

        <View className="mb-8" style={{ zIndex: 1 }}>
          <GoalChip name={goal.name} color={tone} icon={goal.icon} useTint />
        </View>

        <View style={{ zIndex: 1, width: '100%' }}>
          <PrimaryButton title="Back to Today" onPress={backToToday} />
        </View>
        <Pressable onPress={() => setState('idle')} className="mt-3 py-1" style={{ zIndex: 1 }}>
          <Text className="text-footnote text-text-tertiary">Start another session</Text>
        </Pressable>
      </View>
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

        <View className="flex-row flex-wrap justify-center gap-3 mb-10">
          {DURATIONS.map((m) => {
            const selected = durationMins === m;
            return (
              <Pressable
                key={m}
                onPress={() => setDurationMins(m)}
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
        </View>

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
              title="Go to Goals"
              size="small"
              color={Colors.accentBlue}
              fullWidth={false}
              style={{ minWidth: 140 }}
              onPress={() => router.push('/(tabs)/goals')}
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
