import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
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
import { Chip, FocusPill, FocusRing, LeaveSessionSheet, StatTile, StepButton } from '@/components/focus/parts';
import { useGoals } from '@/db/hooks';
import * as api from '@/db/api';
import type { MetaGoal, DailyAction, FocusSession, Objective, Task } from '@/types';
import { getGoalColor, getGoalTint } from '@/utils/goalColors';
import { hapticLight, hapticMedium, hapticSuccess, hapticWarning } from '@/utils/haptics';
import * as AppBlocking from '@/services/appBlocking';
import { PressableScale } from '@/components/ui/motion';
import { localDayKey } from '@/utils/dates';
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
/** US-070: label for a pillar-only session (matches api.sessionLabel). */
const FREE_TIME = 'Free time';
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
  const params = useLocalSearchParams<{ goalId?: string; actionId?: string; taskId?: string }>();
  const { goals, refresh: refreshGoals } = useGoals();
  const [actionsByGoal, setActionsByGoal] = useState<Record<string, DailyAction[]>>({});
  /** US-066: per pillar, the active goal's next task + tasks planned for today or earlier. */
  const [pickerTasksByGoal, setPickerTasksByGoal] = useState<Record<string, PickerTask[]>>({});
  const [objectiveById, setObjectiveById] = useState<Record<string, Objective>>({});
  const [dataVersion, setDataVersion] = useState(0);
  const [sessionModel, setSessionModel] = useState<FocusSessionModel>(initialFocusSessionModel);
  const [goal, setGoal] = useState<MetaGoal | null>(null);
  const [action, setAction] = useState<DailyAction | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [objective, setObjective] = useState<Objective | null>(null);
  const [durationMins, setDurationMins] = useState(25);
  const [useCustomDuration, setUseCustomDuration] = useState(false);
  const [customMinsStr, setCustomMinsStr] = useState('25');
  const [completedSession, setCompletedSession] = useState<FocusSession | null>(null);
  const [sessionNoteDraft, setSessionNoteDraft] = useState('');
  const [actionStreak, setActionStreak] = useState(0);
  /** US-066 end screen: "Is this task done?" → null (asking) · 'done' · 'later'. */
  const [taskAnswer, setTaskAnswer] = useState<null | 'done' | 'later'>(null);
  /** Pillar-only preparing screen: show the pillar's tasks/habits to pick instead. */
  const [showAlternatives, setShowAlternatives] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionModelRef = useRef<FocusSessionModel>(initialFocusSessionModel);
  /** Current session context for callbacks that outlive a render (tab blur save). */
  const sessionCtxRef = useRef<{ goal: MetaGoal | null; action: DailyAction | null; task: Task | null }>({
    goal: null,
    action: null,
    task: null,
  });
  sessionCtxRef.current = { goal, action, task };
  /**
   * Wall-clock timing: JS timers are suspended while the phone is locked or the
   * app is backgrounded, so elapsed time is derived from Date.now() rather than
   * by counting interval ticks. The interval only re-renders the countdown.
   */
  const segmentStartRef = useRef<number | null>(null);
  const accumulatedSecondsRef = useRef(0);
  const completionHandledRef = useRef(false);
  const sessionNoteInputRef = useRef<TextInput>(null);

  const firstParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const goalIdParam = useMemo(() => firstParam(params.goalId), [params.goalId]);
  const actionIdParam = useMemo(() => firstParam(params.actionId), [params.actionId]);
  const taskIdParam = useMemo(() => firstParam(params.taskId), [params.taskId]);

  const applyDuration = useCallback((mins: number) => {
    const t = Math.max(1, Math.round(mins) || 25);
    const presetHit = (DURATION_PRESETS as readonly number[]).includes(t);
    setDurationMins(t);
    setUseCustomDuration(!presetHit);
    setCustomMinsStr(String(t));
  }, []);

  const resetSelection = () => {
    setGoal(null);
    setAction(null);
    setTask(null);
    setObjective(null);
    setCompletedSession(null);
    setSessionNoteDraft('');
    setActionStreak(0);
    setTaskAnswer(null);
    setShowAlternatives(false);
  };

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
      const nextActions: Record<string, DailyAction[]> = {};
      const nextTasks: Record<string, PickerTask[]> = {};
      const objMap: Record<string, Objective> = {};
      const todayKey = localDayKey();
      const planned = (await api.getOpenPlannedTasks()).filter((t) => t.planned_date != null && t.planned_date <= todayKey);
      for (const g of goals) {
        nextActions[g.id] = await api.getActionsByGoal(g.id);
        const objs = await api.getObjectives(g.id);
        for (const o of objs) objMap[o.id] = o;
        const list: PickerTask[] = [];
        const active = await api.getActiveObjective(g.id);
        if (active) {
          const next = await api.getNextTask(active.id);
          if (next) list.push({ task: next, objective: active, kind: 'next' });
        }
        for (const t of planned) {
          const o = objMap[t.objective_id];
          if (!o || o.pillar_id !== g.id || list.some((x) => x.task.id === t.id)) continue;
          list.push({ task: t, objective: o, kind: 'planned' });
        }
        nextTasks[g.id] = list;
      }
      if (mounted) {
        setActionsByGoal(nextActions);
        setPickerTasksByGoal(nextTasks);
        setObjectiveById(objMap);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [goals, dataVersion]);

  const selectHabit = useCallback(
    (g: MetaGoal, a: DailyAction) => {
      setGoal(g);
      setAction(a);
      setTask(null);
      setObjective(null); // saveFocusSession derives the habit's linked goal
      setTaskAnswer(null);
      setShowAlternatives(false);
      const mins = Math.max(1, a.target_minutes || 25);
      applyDuration(mins);
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
    },
    [applyDuration]
  );

  // US-066: focus on a task. Duration defaults to the remaining estimate (min 15).
  const selectTask = useCallback(
    (g: MetaGoal, t: Task, obj: Objective) => {
      setGoal(g);
      setTask(t);
      setObjective(obj);
      setAction(null);
      setTaskAnswer(null);
      setShowAlternatives(false);
      const givenMins = api.getMinutesForTask(t.id);
      const remaining = Math.max(15, t.estimate_minutes - givenMins);
      applyDuration(remaining);
      setSessionModel(
        transitionFocusSession(initialFocusSessionModel, {
          type: 'select_session',
          totalSeconds: remaining * 60,
          goalId: g.id,
          actionId: '',
          goalName: g.name,
          actionName: t.title,
        })
      );
    },
    [applyDuration]
  );

  // US-070: give time to a pillar, no task or habit ("Free time").
  const selectPillar = useCallback(
    (g: MetaGoal) => {
      setGoal(g);
      setAction(null);
      setTask(null);
      setObjective(null);
      setTaskAnswer(null);
      setShowAlternatives(false);
      applyDuration(25);
      setSessionModel(
        transitionFocusSession(initialFocusSessionModel, {
          type: 'select_session',
          totalSeconds: 25 * 60,
          goalId: g.id,
          actionId: '',
          goalName: g.name,
          actionName: FREE_TIME,
        })
      );
    },
    [applyDuration]
  );

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
      router.setParams({ goalId: undefined, actionId: undefined, taskId: undefined });
      if (!a || !g) return;
      selectHabit(g, a);
    });
  }, [actionIdParam, goals, selectHabit, router]);

  // US-066: taskId from the URL — search every goal's tasks (any status), not just active goals.
  useEffect(() => {
    if (!taskIdParam || actionIdParam || !goals.length) return;
    const phase = sessionModelRef.current.phase;
    if (phase === 'focusing' || phase === 'paused') return;
    const resolvedTaskId = decodeURIComponent(taskIdParam);
    (async () => {
      const objectives = await api.getObjectives();
      for (const obj of objectives) {
        const g = goals.find((x) => x.id === obj.pillar_id);
        if (!g) continue;
        const t = (await api.getTasks(obj.id)).find((x) => x.id === resolvedTaskId);
        if (!t) continue;
        router.setParams({ goalId: undefined, actionId: undefined, taskId: undefined });
        selectTask(g, t, obj);
        return;
      }
      router.setParams({ goalId: undefined, actionId: undefined, taskId: undefined });
      // Task gone (deleted?): fall back to free time on the pillar it was opened from.
      const g = goalIdParam ? goals.find((x) => x.id === decodeURIComponent(goalIdParam)) : undefined;
      if (g) selectPillar(g);
    })();
  }, [taskIdParam, actionIdParam, goalIdParam, goals, selectTask, selectPillar, router]);

  // US-070: goalId alone (Today's "Free session") → preselect the pillar, free time.
  useEffect(() => {
    if (!goalIdParam || actionIdParam || taskIdParam || !goals.length) return;
    const phase = sessionModelRef.current.phase;
    if (phase === 'focusing' || phase === 'paused') return;
    const g = goals.find((x) => x.id === decodeURIComponent(goalIdParam));
    router.setParams({ goalId: undefined, actionId: undefined, taskId: undefined });
    if (g) selectPillar(g);
  }, [goalIdParam, actionIdParam, taskIdParam, goals, selectPillar, router]);

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
      // Tabs stay mounted: pick up goals/actions/tasks added elsewhere since last visit.
      void refreshGoals();
      setDataVersion((v) => v + 1);
      return () => {
        const current = sessionModelRef.current;
        if (current.phase === 'focusing') {
          clearTick();
          const elapsed = Math.min(current.totalSeconds, elapsedNow());
          segmentStartRef.current = null;
          // Refs, not closure state: this callback is created once and would see a stale session.
          const ctx = sessionCtxRef.current;
          if (elapsed > 0 && ctx.goal) {
            void api.saveFocusSession(
              createFocusSessionDraft({
                actionId: ctx.action?.id ?? null,
                goalId: ctx.goal.id,
                elapsedSeconds: elapsed,
                completedFullTimer: false,
                taskId: ctx.task?.id ?? null,
                objectiveId: ctx.task?.objective_id ?? null,
              })
            );
          }
          void AppBlocking.removeShields();
          setSessionModel(transitionFocusSession(current, { type: 'reset' }));
          resetSelection();
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshGoals])
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
    // A session always has a pillar; habit and task are optional (US-066 / US-070).
    if (!goal) return;
    const session = await api.saveFocusSession(
      createFocusSessionDraft({
        actionId: action?.id ?? null,
        goalId: goal.id,
        elapsedSeconds: totalElapsed,
        completedFullTimer,
        taskId: task?.id ?? null,
        // Task: its goal. Habit / free time: null → saveFocusSession derives the habit's linked goal.
        objectiveId: task ? task.objective_id : null,
      })
    );
    setCompletedSession(session);
    setSessionNoteDraft('');
    setTaskAnswer(null);
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
    if (!goal) return;
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
    if (!goal) return;
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
    resetSelection();
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
    resetSelection();
    setDataVersion((v) => v + 1);
  };

  // Ending early goes through "Leave now?" first, which nudges toward staying.
  const [leaveAsk, setLeaveAsk] = useState(false);
  const confirmEndEarly = () => {
    hapticWarning();
    setLeaveAsk(true);
  };

  // ─── Focus room (running / paused): warm charcoal, Flick grows with the session ───
  if ((sessionModel.phase === 'focusing' || sessionModel.phase === 'paused') && goal) {
    const isPaused = sessionModel.phase === 'paused';
    const tone = getGoalColor(goal);
    const total = Math.max(1, sessionModel.totalSeconds);
    const progress = Math.min(1, sessionModel.elapsedSeconds / total);
    const remaining = sessionModel.totalSeconds - sessionModel.elapsedSeconds;
    const givenMins = Math.floor(sessionModel.elapsedSeconds / 60);
    const ringSize = Math.min(268, windowWidth - 96);
    const shieldOn = sessionModel.shield === 'applied';
    const itemName = action?.name ?? task?.title ?? FREE_TIME;

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
              {itemName}
            </Text>
          </View>

          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <FocusRing size={ringSize} progress={progress} color={tone} dim={isPaused}>
              <Mascot
                mood={isPaused ? 'think' : 'calm'}
                size={Math.round(ringSize * 0.52)}
                intensity={0.5 + 0.5 * progress}
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
        {leaveAsk ? (
          <LeaveSessionSheet
            pillar={goal.name}
            pillarColor={tone}
            givenMins={givenMins}
            remainingMins={Math.ceil(remaining / 60)}
            onStay={() => {
              hapticSuccess();
              setLeaveAsk(false);
            }}
            onLeave={() => {
              setLeaveAsk(false);
              void endSessionEarly();
            }}
          />
        ) : null}
      </SafeAreaView>
    );
  }

  // ─── Session complete / ended early: light paper, Flick proud ───
  if (
    (sessionModel.phase === 'completed' || sessionModel.phase === 'aborted') &&
    goal &&
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
    const itemName = action?.name ?? task?.title ?? FREE_TIME;
    // US-066: "+45m to <Goal>" — the session's goal (task's, or the habit's linked one), else the pillar.
    const displayGoalName =
      (completedSession.objective_id ? objectiveById[completedSession.objective_id]?.title : undefined) ??
      objective?.title ??
      goal.name;

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
                  style={{ opacity: 1, paddingVertical: 4, paddingHorizontal: 8 }}
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
                +{display} to <Text style={{ color: tone }}>{displayGoalName}</Text>
              </Text>
              <Text style={[T.body, { marginTop: 8, paddingHorizontal: 8 }]}>
                {fullComplete
                  ? `${itemName}. That time went where you meant it to.`
                  : `${itemName}. Partial time still counts.`}
              </Text>
              
              {/* US-066: Task completion prompt */}
              {task && taskAnswer === null ? (
                <View style={{ marginTop: 20, backgroundColor: Surface.surfaceRaised, borderRadius: 18, padding: 18 }}>
                  <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 16, marginBottom: 12, textAlign: 'center' }}>
                    Is this task done?
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <PressableScale
                      onPress={() => {
                        hapticMedium();
                        void api.setTaskDone(task.id, true).then(() => {
                          hapticSuccess();
                          setTaskAnswer('done');
                          setDataVersion((v) => v + 1);
                        });
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Yes, task done"
                      style={{ flex: 1, height: 48, borderRadius: 24, backgroundColor: Surface.ink, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ color: Surface.surface, fontFamily: FontFamily.bodyBold, fontSize: 16 }}>Yes</Text>
                    </PressableScale>
                    <PressableScale
                      onPress={() => setTaskAnswer('later')}
                      accessibilityRole="button"
                      accessibilityLabel="Not yet, task not done"
                      style={{ flex: 1, height: 48, borderRadius: 24, backgroundColor: Surface.hill, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodySemiBold, fontSize: 16 }}>Not yet</Text>
                    </PressableScale>
                  </View>
                </View>
              ) : null}
              {task && taskAnswer === 'done' ? (
                <View
                  accessibilityRole="text"
                  accessibilityLabel={`Task done: ${task.title}`}
                  style={{
                    marginTop: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    backgroundColor: Accent.greenSoft,
                    borderRadius: 18,
                    paddingVertical: 14,
                    paddingHorizontal: 18,
                  }}
                >
                  <Ionicons name="checkmark-circle" size={22} color={Accent.green} />
                  <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 16 }}>Task done</Text>
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
                <StatTile icon="time-outline" label="Started" value={startedAt} />
                {action ? (
                  <StatTile
                    icon="flame"
                    label="Streak"
                    color={Accent.orange}
                    value={actionStreak > 0 ? `${actionStreak} day${actionStreak === 1 ? '' : 's'}` : 'Day 1'}
                  />
                ) : (
                  <StatTile icon="hourglass-outline" label="Given" value={display} />
                )}
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
                style={{ marginTop: 10, paddingVertical: 12, alignItems: 'center', opacity: 1 }}
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
  if (sessionModel.phase === 'preparing' && goal) {
    const tone = getGoalColor(goal);
    const effectiveDuration = useCustomDuration ? clampSessionMinutes(Number(customMinsStr) || 25) : durationMins;
    const presets = DURATION_PRESETS as readonly number[];
    const isFree = !action && !task;
    const itemName = action?.name ?? task?.title ?? `${FREE_TIME} · ${goal.name}`;
    // US-066: Show objective name for tasks
    const displayGoalName = objective?.title ?? goal.name;
    const altTasks = isFree ? pickerTasksByGoal[goal.id] ?? [] : [];
    const altHabits = isFree ? (actionsByGoal[goal.id] ?? []).filter((a) => a.type === 'session') : [];
    const hasAlternatives = altTasks.length + altHabits.length > 0;
    const pillar = goal;

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
                resetSelection();
              }}
              hitSlop={10}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: Surface.surfaceRaised,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 1,
              }}
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
            {showAlternatives ? null : (
              <View style={{ alignItems: 'center' }}>
                <Mascot mood="happy" size={112} intensity={0.6} />
              </View>
            )}
            <Text style={[T.title, { marginTop: 12 }]} numberOfLines={2}>
              {itemName}
            </Text>
            <Text style={[T.body, { marginTop: 6 }]}>
              How long are you giving to <Text style={{ color: tone, fontFamily: FontFamily.bodySemiBold }}>{displayGoalName}</Text>?
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

            {/* US-070: free time first, then an optional task or habit of this pillar */}
            {isFree && hasAlternatives ? (
              <View style={{ marginTop: 18 }}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={showAlternatives ? 'Hide tasks and habits' : `Pick a task or habit in ${pillar.name}`}
                  accessibilityState={{ expanded: showAlternatives }}
                  onPress={() => setShowAlternatives((v) => !v)}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 }}
                >
                  <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodyBold, fontSize: 15 }}>
                    {showAlternatives ? 'Keep it free time' : 'Or pick a task or habit'}
                  </Text>
                  <Ionicons name={showAlternatives ? 'chevron-up' : 'chevron-down'} size={16} color={Surface.muted} />
                </PressableScale>
                {showAlternatives ? (
                  <ScrollView style={{ maxHeight: 220, marginTop: 6 }} contentContainerStyle={{ gap: 8 }} showsVerticalScrollIndicator={false}>
                    {altTasks.map(({ task: t, objective: o }) => (
                      <PickRow
                        key={t.id}
                        compact
                        title={t.title}
                        subtitle={`Task · ${o.title}`}
                        accessibilityLabel={`Focus on ${t.title}, task for ${o.title}`}
                        onPress={() => selectTask(pillar, t, o)}
                      />
                    ))}
                    {altHabits.map((a) => (
                      <PickRow
                        key={a.id}
                        compact
                        title={a.name}
                        subtitle={`Habit · ${a.target_minutes} min`}
                        accessibilityLabel={`Focus on ${a.name}, ${a.target_minutes} minutes for ${pillar.name}`}
                        onPress={() => selectHabit(pillar, a)}
                      />
                    ))}
                  </ScrollView>
                ) : null}
              </View>
            ) : null}
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

        {goals.length === 0 ? (
          <View style={{ backgroundColor: Surface.surfaceRaised, borderRadius: 20, padding: 24, alignItems: 'center' }}>
            <Mascot mood="think" size={96} intensity={0.35} />
            <Text style={[T.lead, { marginTop: 10 }]}>Nothing to focus on yet</Text>
            <Text style={[T.body, { marginTop: 6, marginBottom: 18 }]}>
              Add a pillar and give it your first hour.
            </Text>
            <View style={{ alignSelf: 'stretch' }}>
              <CTA label="Add a pillar" onPress={() => router.push('/(tabs)/goals?create=1')} />
            </View>
          </View>
        ) : null}

        {goals.map((g) => {
          const habits = (actionsByGoal[g.id] ?? []).filter((a) => a.type === 'session');
          const tasks = pickerTasksByGoal[g.id] ?? [];
          const tone = getGoalColor(g);
          return (
            <View key={g.id} style={{ marginBottom: 22 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tone }} />
                <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 17 }}>{g.name}</Text>
              </View>

              <View style={{ gap: 10 }}>
                {/* US-066: the active goal's next task + tasks planned for today (or rolled over), labelled with their goal */}
                {tasks.map(({ task: t, objective: o, kind }) => (
                  <PickRow
                    key={t.id}
                    title={t.title}
                    subtitle={`${kind === 'next' ? 'Next' : t.planned_date === localDayKey() ? 'Today' : 'Planned'} · ${t.estimate_minutes} min for ${o.title}`}
                    accessibilityLabel={`Focus on ${t.title}, task for ${o.title}`}
                    onPress={() => selectTask(g, t, o)}
                  />
                ))}
                {habits.length > 0 && tasks.length > 0 ? (
                  <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodySemiBold, fontSize: 14, marginLeft: 4, marginTop: 4 }}>
                    Habits
                  </Text>
                ) : null}
                {habits.map((a) => (
                  <PickRow
                    key={a.id}
                    title={a.name}
                    subtitle={`${a.target_minutes} min for ${g.name}`}
                    accessibilityLabel={`Focus on ${a.name}, ${a.target_minutes} minutes for ${g.name}`}
                    onPress={() => selectHabit(g, a)}
                  />
                ))}
                {/* US-070: pillar-only free time */}
                <PickRow
                  ghost
                  icon="sparkles-outline"
                  title={`Just give time to ${g.name}`}
                  subtitle={`${FREE_TIME} · no task or habit`}
                  accessibilityLabel={`Just give time to ${g.name}`}
                  onPress={() => selectPillar(g)}
                />
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

type PickerTask = { task: Task; objective: Objective; kind: 'next' | 'planned' };

/** One row of the Focus picker: title, quiet subtitle, round play button. */
function PickRow({
  title,
  subtitle,
  accessibilityLabel,
  onPress,
  compact = false,
  ghost = false,
  icon = 'play',
}: {
  title: string;
  subtitle: string;
  accessibilityLabel: string;
  onPress: () => void;
  compact?: boolean;
  ghost?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const btn = compact ? 32 : 40;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        minHeight: compact ? 56 : 72,
        paddingHorizontal: compact ? 14 : 18,
        paddingVertical: compact ? 10 : 14,
        borderRadius: 18,
        backgroundColor: ghost ? Surface.canvas : Surface.surfaceRaised,
        borderWidth: ghost ? 1 : 0,
        borderColor: Surface.ruleStrong,
        borderStyle: ghost ? 'dashed' : 'solid',
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: compact ? 16 : 17, lineHeight: 22 }} numberOfLines={2}>
          {title}
        </Text>
        <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodySemiBold, fontSize: 14, marginTop: 2 }} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View
        style={{
          width: btn,
          height: btn,
          borderRadius: btn / 2,
          backgroundColor: ghost ? Surface.hill : Surface.ink,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons
          name={icon}
          size={compact ? 15 : 17}
          color={ghost ? Surface.ink : Surface.surface}
          style={icon === 'play' ? { marginLeft: 2 } : undefined}
        />
      </View>
    </PressableScale>
  );
}
