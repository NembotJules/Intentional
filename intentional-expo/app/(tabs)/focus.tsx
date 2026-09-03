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
import { useRouter, useLocalSearchParams, Stack, Tabs } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { PrimaryButton } from '@/components/PrimaryButton';
import { GoalChip } from '@/components/GoalChip';
import { Colors, Surface, FontFamily, Radius } from '@/constants/design';
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
  getShieldCopy,
  getShieldDetailCopy,
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
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const params = useLocalSearchParams<{ goalId?: string; actionId?: string }>();
  const { goals } = useGoals();
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
    sessionModelRef.current = sessionModel;
  }, [sessionModel]);

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
    }
  }, [goalIdParam, actionIdParam, goals, applyDurationFromAction]);

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
      return () => {
        const current = sessionModelRef.current;
        if (current.phase === 'focusing') {
          clearTick();
          const elapsed = current.elapsedSeconds;
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
    }, [])
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
    const prevPhase = sessionModel.phase;
    const nextModel = transitionFocusSession(
      sessionModel,
      completedFullTimer ? { type: 'complete' } : { type: 'abort' }
    );
    setSessionModel(nextModel);
    await handleShieldTransition(prevPhase, nextModel.phase);
  };

  const startFocus = async () => {
    if (!goal || !action) return;
    hapticMedium();
    const mins = resolvedDurationMinutes();
    const total = mins * 60;
    const prevPhase = sessionModel.phase;
    const nextModel = transitionFocusSession(sessionModel, { type: 'start' });
    setSessionModel(nextModel);
    await handleShieldTransition(prevPhase, nextModel.phase);
    clearTick();
    intervalRef.current = setInterval(() => {
      setSessionModel((prev) => {
        const updated = transitionFocusSession(prev, { type: 'tick', seconds: 1 });
        if (updated.phase === 'completed' && prev.phase === 'focusing') {
          clearTick();
          void endSessionWithElapsed(updated.elapsedSeconds, true);
        }
        return updated;
      });
    }, 1000);
  };

  const endSessionEarly = async () => {
    clearTick();
    await endSessionWithElapsed(sessionModel.elapsedSeconds, false);
  };

  const togglePause = async () => {
    if (!goal || !action) return;
    const prevPhase = sessionModel.phase;
    if (sessionModel.phase === 'paused') {
      clearTick();
      const nextModel = transitionFocusSession(sessionModel, { type: 'resume' });
      setSessionModel(nextModel);
      await handleShieldTransition(prevPhase, nextModel.phase);
      intervalRef.current = setInterval(() => {
        setSessionModel((prev) => {
          const updated = transitionFocusSession(prev, { type: 'tick', seconds: 1 });
          if (updated.phase === 'completed' && prev.phase === 'focusing') {
            clearTick();
            void endSessionWithElapsed(updated.elapsedSeconds, true);
          }
          return updated;
        });
      }, 1000);
    } else {
      clearTick();
      const nextModel = transitionFocusSession(sessionModel, { type: 'pause' });
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

  if (sessionModel.phase === 'focusing' && goal && action) {
    const activeHorizontalPadding = 22;
    const activeContentWidth = Math.max(280, windowWidth - activeHorizontalPadding * 2);
    const activeButtonWidth = (activeContentWidth - 12) / 2;
    const timerFontSize = Math.min(116, Math.max(96, activeContentWidth * 0.3));
    const timerLineHeight = Math.ceil(timerFontSize * 1.18);
    const timerLetterSpacing = -Math.ceil(timerFontSize * 0.045);
    const remaining = sessionModel.totalSeconds - sessionModel.elapsedSeconds;
    const isPaused = false;

    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-focus-canvas">
        <Stack.Screen options={{ headerShown: false }} />
        <Tabs.Screen options={{ tabBarStyle: { display: 'none' } }} />
        <Svg
          pointerEvents="none"
          width="100%"
          height="45%"
          style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
        >
          <Defs>
            <RadialGradient id="focusWarmGlow" cx="50%" cy="12%" rx="58%" ry="72%">
              <Stop offset="0%" stopColor="#D65A31" stopOpacity="0.18" />
              <Stop offset="54%" stopColor="#D65A31" stopOpacity="0.07" />
              <Stop offset="100%" stopColor="#D65A31" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#focusWarmGlow)" />
        </Svg>
        <View
          className="flex-1"
          style={{
            paddingHorizontal: activeHorizontalPadding,
            paddingTop: 34,
            paddingBottom: 28,
            zIndex: 1,
          }}
        >
          <View className="flex-row justify-between items-start" style={{ gap: 18 }}>
            <View className="flex-1">
              <Text
                style={{
                  color: Surface.focusFaint,
                  fontFamily: FontFamily.monoSemiBold,
                  fontSize: 11,
                  letterSpacing: 1.32,
                  textTransform: 'uppercase',
                }}
              >
                {goal.name}
              </Text>
              <Text
                style={{
                  color: Surface.focusText,
                  fontFamily: FontFamily.bodySemiBold,
                  fontSize: 22,
                  lineHeight: 28,
                  marginTop: 7,
                }}
              >
                {action.name}
              </Text>
            </View>
            <View
              style={{
                borderWidth: 1,
                borderColor:
                  sessionModel.shield === 'applied'
                    ? 'rgba(214,90,49,0.35)'
                    : Surface.focusRule,
                borderRadius: Radius.full,
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            >
              <Text
                style={{
                  color:
                    sessionModel.shield === 'applied' ? '#f3b39b' : Surface.focusMuted,
                  fontFamily: FontFamily.monoSemiBold,
                  fontSize: 10,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                }}
              >
                {getShieldCopy(sessionModel.shield)}
              </Text>
            </View>
          </View>

          <View className="flex-1 justify-center items-center">
            <Text
              style={{
                color: Surface.focusText,
                fontFamily: FontFamily.display,
                fontWeight: '400',
                fontSize: timerFontSize,
                lineHeight: timerLineHeight,
                letterSpacing: timerLetterSpacing,
                textAlign: 'center',
                width: activeContentWidth,
                paddingHorizontal: 12,
                includeFontPadding: false,
              }}
            >
              {formatCountdown(remaining)}
            </Text>
            <Text
              style={{
                color: Surface.focusMuted,
                fontFamily: FontFamily.body,
                fontSize: 18,
                lineHeight: 24,
                marginTop: 18,
                maxWidth: 270,
                textAlign: 'center',
              }}
            >
              {getShieldDetailCopy(sessionModel.shield, goal.name, isPaused)}
            </Text>
          </View>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              width: '100%',
              alignItems: 'center',
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Pause focus session"
              onPress={() => void togglePause()}
              style={({ pressed }) => ({
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <View
                style={{
                  width: activeButtonWidth,
                  height: 54,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: Surface.focusRule,
                  borderRadius: 999,
                  backgroundColor: Surface.focusSurface,
                }}
              >
                <Text
                  style={{
                    color: Surface.focusText,
                    fontFamily: FontFamily.monoSemiBold,
                    fontSize: 11,
                    letterSpacing: 0.88,
                    textTransform: 'uppercase',
                  }}
                >
                  Pause
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="End focus session"
              onPress={() =>
                Alert.alert('End session?', 'Your time will still be logged.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'End session', onPress: () => void endSessionEarly() },
                ])
              }
              style={({ pressed }) => ({
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <View
                style={{
                  width: activeButtonWidth,
                  height: 54,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(214,90,49,0.46)',
                  borderRadius: 999,
                  backgroundColor: Surface.focusSurface,
                }}
              >
                <Text
                  style={{
                    color: '#f3b39b',
                    fontFamily: FontFamily.monoSemiBold,
                    fontSize: 11,
                    letterSpacing: 0.88,
                    textTransform: 'uppercase',
                  }}
                >
                  End
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (sessionModel.phase === 'paused' && goal && action) {
    const activeHorizontalPadding = 22;
    const activeContentWidth = Math.max(280, windowWidth - activeHorizontalPadding * 2);
    const activeButtonWidth = (activeContentWidth - 12) / 2;
    const timerFontSize = Math.min(116, Math.max(96, activeContentWidth * 0.3));
    const timerLineHeight = Math.ceil(timerFontSize * 1.18);
    const timerLetterSpacing = -Math.ceil(timerFontSize * 0.045);
    const remaining = sessionModel.totalSeconds - sessionModel.elapsedSeconds;
    const isPaused = true;

    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-focus-canvas">
        <Stack.Screen options={{ headerShown: false }} />
        <Tabs.Screen options={{ tabBarStyle: { display: 'none' } }} />
        <Svg
          pointerEvents="none"
          width="100%"
          height="45%"
          style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
        >
          <Defs>
            <RadialGradient id="focusWarmGlow" cx="50%" cy="12%" rx="58%" ry="72%">
              <Stop offset="0%" stopColor="#D65A31" stopOpacity="0.18" />
              <Stop offset="54%" stopColor="#D65A31" stopOpacity="0.07" />
              <Stop offset="100%" stopColor="#D65A31" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#focusWarmGlow)" />
        </Svg>
        <View
          className="flex-1"
          style={{
            paddingHorizontal: activeHorizontalPadding,
            paddingTop: 34,
            paddingBottom: 28,
            zIndex: 1,
          }}
        >
          <View className="flex-row justify-between items-start" style={{ gap: 18 }}>
            <View className="flex-1">
              <Text
                style={{
                  color: Surface.focusFaint,
                  fontFamily: FontFamily.monoSemiBold,
                  fontSize: 11,
                  letterSpacing: 1.32,
                  textTransform: 'uppercase',
                }}
              >
                {goal.name}
              </Text>
              <Text
                style={{
                  color: Surface.focusText,
                  fontFamily: FontFamily.bodySemiBold,
                  fontSize: 22,
                  lineHeight: 28,
                  marginTop: 7,
                }}
              >
                {action.name}
              </Text>
            </View>
            <View
              style={{
                borderWidth: 1,
                borderColor: Surface.focusRule,
                borderRadius: Radius.full,
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            >
              <Text
                style={{
                  color: Surface.focusMuted,
                  fontFamily: FontFamily.monoSemiBold,
                  fontSize: 10,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                }}
              >
                {getShieldCopy(sessionModel.shield)}
              </Text>
            </View>
          </View>

          <View className="flex-1 justify-center items-center">
            <Text
              style={{
                color: Surface.focusText,
                fontFamily: FontFamily.display,
                fontWeight: '400',
                fontSize: timerFontSize,
                lineHeight: timerLineHeight,
                letterSpacing: timerLetterSpacing,
                textAlign: 'center',
                width: activeContentWidth,
                paddingHorizontal: 12,
                includeFontPadding: false,
              }}
            >
              {formatCountdown(remaining)}
            </Text>
            <Text
              style={{
                color: Surface.focusMuted,
                fontFamily: FontFamily.body,
                fontSize: 18,
                lineHeight: 24,
                marginTop: 18,
                maxWidth: 270,
                textAlign: 'center',
              }}
            >
              {getShieldDetailCopy(sessionModel.shield, goal.name, isPaused)}
            </Text>
          </View>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              width: '100%',
              alignItems: 'center',
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Resume focus session"
              onPress={() => void togglePause()}
              style={({ pressed }) => ({
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <View
                style={{
                  width: activeButtonWidth,
                  height: 54,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: Surface.focusRule,
                  borderRadius: 999,
                  backgroundColor: Surface.focusSurface,
                }}
              >
                <Text
                  style={{
                    color: Surface.focusText,
                    fontFamily: FontFamily.monoSemiBold,
                    fontSize: 11,
                    letterSpacing: 0.88,
                    textTransform: 'uppercase',
                  }}
                >
                  Resume
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="End focus session"
              onPress={() =>
                Alert.alert('End session?', 'Your time will still be logged.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'End session', onPress: () => void endSessionEarly() },
                ])
              }
              style={({ pressed }) => ({
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <View
                style={{
                  width: activeButtonWidth,
                  height: 54,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(181,68,46,0.5)',
                  borderRadius: 999,
                  backgroundColor: Surface.focusSurface,
                }}
              >
                <Text
                  style={{
                    color: '#f3b39b',
                    fontFamily: FontFamily.monoSemiBold,
                    fontSize: 11,
                    letterSpacing: 0.88,
                    textTransform: 'uppercase',
                  }}
                >
                  End
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

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
    const tone = getGoalColor(goal.id);
    const fullComplete = sessionModel.phase === 'completed';
    const bottomPad = tabBarOverlapPadding(insets.bottom) + 24;

    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'left', 'right']}>
        <Stack.Screen options={{ headerShown: false }} />
        <Tabs.Screen options={{ tabBarStyle: defaultTabBarStyle(insets.bottom) }} />

        <KeyboardAvoidingView
          className="flex-1"
          style={{ zIndex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
        >
          {Platform.OS === 'ios' ? (
            <InputAccessoryView nativeID={SESSION_NOTE_INPUT_ACCESSORY_ID}>
              <View className="flex-row justify-end items-center px-3 py-2.5 bg-surface border-t border-rule">
                <Pressable
                  onPress={dismissSessionNoteKeyboard}
                  hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.6 : 1,
                    paddingVertical: 4,
                    paddingHorizontal: 8,
                  })}
                >
                  <Text
                    style={{
                      color: Colors.textPrimary,
                      fontFamily: FontFamily.bodySemiBold,
                      fontSize: 17,
                    }}
                  >
                    Done
                  </Text>
                </Pressable>
              </View>
            </InputAccessoryView>
          ) : null}

          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingTop: 16,
              paddingBottom: bottomPad,
              alignItems: 'center',
            }}
          >
            <View style={{ marginBottom: 16 }}>
              <Text
                style={{
                  color: Colors.textMuted,
                  fontFamily: FontFamily.monoSemiBold,
                  fontSize: 11,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  textAlign: 'center',
                }}
              >
                Session {fullComplete ? 'complete' : 'ended'}
              </Text>
            </View>
            <Text
              style={{
                color: Colors.textPrimary,
                fontFamily: FontFamily.display,
                fontSize: 44,
                lineHeight: 46,
                textAlign: 'center',
                marginBottom: 8,
              }}
            >
              {fullComplete ? 'That counted.' : 'Still counted.'}
            </Text>
            <Text
              style={{
                color: Colors.textSecondary,
                fontFamily: FontFamily.body,
                fontSize: 17,
                lineHeight: 24,
                textAlign: 'center',
                marginBottom: 24,
                paddingHorizontal: 8,
              }}
            >
              {fullComplete ? (
                <>
                  credited to{' '}
                  <Text style={{ color: tone, fontFamily: FontFamily.bodySemiBold }}>
                    {goal.name}
                  </Text>{' '}
                  through {action.name}.
                </>
              ) : (
                <>
                  credited to{' '}
                  <Text style={{ color: tone, fontFamily: FontFamily.bodySemiBold }}>
                    {goal.name}
                  </Text>
                  . Partial effort stays in the ledger.
                </>
              )}
            </Text>

            <View
              className="px-8 py-6 mb-6 items-center w-full max-w-[320px]"
              style={{
                backgroundColor: Surface.surface,
                borderWidth: 1,
                borderColor: Surface.rule,
                borderRadius: Radius.lg,
              }}
            >
              <Text
                style={{
                  color: Colors.textPrimary,
                  fontFamily: FontFamily.display,
                  fontSize: 64,
                  lineHeight: 64,
                }}
              >
                {display}
              </Text>
              <View style={{ marginTop: 16, width: '100%' }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <Text
                    style={{
                      color: Colors.textMuted,
                      fontFamily: FontFamily.monoMedium,
                      fontSize: 11,
                      letterSpacing: 0.8,
                      textTransform: 'uppercase',
                    }}
                  >
                    Started
                  </Text>
                  <Text
                    style={{
                      color: Colors.textSecondary,
                      fontFamily: FontFamily.monoMedium,
                      fontSize: 11,
                    }}
                  >
                    {new Date(completedSession.started_at).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <Text
                    style={{
                      color: Colors.textMuted,
                      fontFamily: FontFamily.monoMedium,
                      fontSize: 11,
                      letterSpacing: 0.8,
                      textTransform: 'uppercase',
                    }}
                  >
                    Completed
                  </Text>
                  <Text
                    style={{
                      color: Colors.textSecondary,
                      fontFamily: FontFamily.monoMedium,
                      fontSize: 11,
                    }}
                  >
                    {fullComplete ? 'Natural end' : 'Early'}
                  </Text>
                </View>
                {actionStreak > 0 && (
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text
                      style={{
                        color: Colors.textMuted,
                        fontFamily: FontFamily.monoMedium,
                        fontSize: 11,
                        letterSpacing: 0.8,
                        textTransform: 'uppercase',
                      }}
                    >
                      Streak
                    </Text>
                    <Text
                      style={{
                        color: Colors.textSecondary,
                        fontFamily: FontFamily.monoMedium,
                        fontSize: 11,
                      }}
                    >
                      {actionStreak} days
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View className="mb-6 w-full max-w-[320px]">
              <Text
                style={{
                  color: Colors.textMuted,
                  fontFamily: FontFamily.monoSemiBold,
                  fontSize: 11,
                  letterSpacing: 1,
                  marginBottom: 8,
                  textTransform: 'uppercase',
                }}
              >
                Note (optional)
              </Text>
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
                inputAccessoryViewID={
                  Platform.OS === 'ios' ? SESSION_NOTE_INPUT_ACCESSORY_ID : undefined
                }
              />
              <Text
                style={{
                  color: Colors.textMuted,
                  fontFamily: FontFamily.monoMedium,
                  fontSize: 11,
                  textAlign: 'right',
                  marginTop: 4,
                }}
              >
                {sessionNoteDraft.length}/280
              </Text>
            </View>

            <View className="w-full max-w-[320px]">
              <PrimaryButton
                title="Back to Today"
                appearance="goalOutline"
                color={Colors.textPrimary}
                showArrow={false}
                onPress={() => void finishSessionComplete()}
              />
            </View>
            <Pressable onPress={() => void startAnotherSession()} className="mt-3 py-2 mb-2">
              <Text className="text-footnote text-text-tertiary text-center font-semibold">
                Done
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (sessionModel.phase === 'preparing' && goal && action) {
    const tone = getGoalColor(goal.id);
    return (
      <KeyboardAvoidingView
        className="flex-1 bg-focus-canvas"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
      >
        <ScrollView
          className="flex-1 bg-focus-canvas"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 20,
            paddingBottom: tabBarOverlapPadding(insets.bottom) + 24,
            flexGrow: 1,
            justifyContent: 'center',
          }}
        >
          <Stack.Screen options={{ title: 'Prepare Session', headerShown: true }} />
          <Tabs.Screen options={{ tabBarStyle: defaultTabBarStyle(insets.bottom) }} />
          <View className="items-center mb-8">
            <Text
              style={{
                color: Surface.focusFaint,
                fontFamily: FontFamily.monoSemiBold,
                fontSize: 11,
                letterSpacing: 1,
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Start focus
            </Text>
            <Text
              style={{
                color: Surface.focusText,
                fontFamily: FontFamily.display,
                fontSize: 44,
                lineHeight: 46,
                textAlign: 'center',
                marginBottom: 4,
              }}
            >
              What should this block serve?
            </Text>
            <View style={{ marginTop: 16, marginBottom: 4 }}>
              <GoalChip name={goal.name} color={tone} icon={goal.icon} useTint />
            </View>
            <Text
              style={{
                color: Surface.focusText,
                fontFamily: FontFamily.bodySemiBold,
                fontSize: 22,
                lineHeight: 28,
                textAlign: 'center',
                marginBottom: 12,
              }}
            >
              {action.name}
            </Text>
            <Text
              style={{
                color: Surface.focusFaint,
                fontFamily: FontFamily.body,
                fontSize: 14,
                lineHeight: 19,
                textAlign: 'center',
                paddingHorizontal: 8,
              }}
            >
              {AppBlocking.isAvailable()
                ? 'Social and Games will be reduced while the timer is active.'
                : 'Focus time will be logged without OS-level app blocking.'}
            </Text>
          </View>

          <View className="items-center mb-6">
            <Text
              style={{
                color: Surface.focusFaint,
                fontFamily: FontFamily.monoSemiBold,
                fontSize: 11,
                letterSpacing: 1,
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              Duration
            </Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {DURATION_PRESETS.map((m) => {
                const selected = !useCustomDuration && durationMins === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => {
                      setUseCustomDuration(false);
                      setDurationMins(m);
                    }}
                    style={{
                      width: (windowWidth - 32 - 24) / 3,
                      maxWidth: 100,
                      height: 72,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: selected ? tone : Surface.focusRule,
                      backgroundColor: selected ? tone : Surface.focusSurface,
                      borderRadius: Radius.md,
                    }}
                  >
                    <Text
                      style={{
                        color: Surface.focusText,
                        fontFamily: FontFamily.display,
                        fontSize: 28,
                        lineHeight: 32,
                      }}
                    >
                      {m}
                    </Text>
                    <Text
                      style={{
                        color: selected ? Surface.focusText : Surface.focusMuted,
                        fontFamily: FontFamily.monoMedium,
                        fontSize: 10,
                        letterSpacing: 0.8,
                        textTransform: 'uppercase',
                        opacity: selected ? 0.85 : 1,
                      }}
                    >
                      min
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => setUseCustomDuration(true)}
                style={{
                  width: (windowWidth - 32 - 24) / 3,
                  maxWidth: 100,
                  height: 72,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: useCustomDuration ? tone : Surface.focusRule,
                  backgroundColor: useCustomDuration ? tone : Surface.focusSurface,
                  borderRadius: Radius.md,
                }}
              >
                <Text
                  style={{
                    color: Surface.focusText,
                    fontFamily: FontFamily.monoSemiBold,
                    fontSize: 11,
                  }}
                >
                  Custom
                </Text>
                <Text
                  style={{
                    color: useCustomDuration ? Surface.focusText : Surface.focusMuted,
                    fontFamily: FontFamily.monoMedium,
                    fontSize: 10,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    opacity: useCustomDuration ? 0.85 : 1,
                  }}
                >
                  min
                </Text>
              </Pressable>
            </View>
          </View>

          {useCustomDuration ? (
            <View className="mb-8 px-2">
              <Text
                style={{
                  color: Surface.focusFaint,
                  fontFamily: FontFamily.monoSemiBold,
                  fontSize: 11,
                  marginBottom: 8,
                }}
              >
                Minutes (1–999)
              </Text>
              <TextInput
                className="rounded-lg px-4 py-3"
                style={{
                  backgroundColor: Surface.focusSurface,
                  borderWidth: 1,
                  borderColor: Surface.focusRule,
                  color: Surface.focusText,
                  fontFamily: FontFamily.display,
                  fontSize: 28,
                  textAlign: 'center',
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

          <PrimaryButton
            title="Begin focus"
            appearance="goalOutline"
            color={tone}
            onPress={() => void startFocus()}
          />
          <Pressable
            onPress={() => setSessionModel(transitionFocusSession(sessionModel, { type: 'reset' }))}
            className="mt-4 items-center py-2"
          >
            <Text
              style={{
                color: Surface.focusMuted,
                fontFamily: FontFamily.monoSemiBold,
                fontSize: 11,
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              Cancel
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View className="flex-1 bg-focus-canvas">
      <Stack.Screen options={{ title: 'Focus', headerShown: true }} />
      <Tabs.Screen options={{ tabBarStyle: defaultTabBarStyle(insets.bottom) }} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120 }}
      >
        <Text
          style={{
            color: Surface.focusMuted,
            fontFamily: FontFamily.monoSemiBold,
            fontSize: 11,
            letterSpacing: 1,
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          Focus
        </Text>
        <Text
          style={{
            color: Surface.focusText,
            fontFamily: FontFamily.display,
            fontSize: 44,
            lineHeight: 46,
            marginBottom: 18,
          }}
        >
          Step into a quiet room.
        </Text>

        {allActions.length === 0 ? (
          <View
            className="p-8 items-center"
            style={{
              backgroundColor: Surface.focusSurface,
              borderWidth: 1,
              borderColor: Surface.focusRule,
              borderRadius: Radius.lg,
            }}
          >
            <Ionicons name="timer-outline" size={42} color={Surface.focusMuted} />
            <Text
              style={{
                color: Surface.focusMuted,
                fontFamily: FontFamily.body,
                fontSize: 17,
                lineHeight: 24,
                textAlign: 'center',
                marginTop: 12,
                marginBottom: 16,
              }}
            >
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
                <View
                  className="w-[9px] h-[9px] rounded-full mr-2"
                  style={{ backgroundColor: tone }}
                />
                <Text
                  style={{
                    color: Surface.focusMuted,
                    fontFamily: FontFamily.monoSemiBold,
                    fontSize: 11,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                  }}
                >
                  {g.name}
                </Text>
              </View>

              {actions.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => chooseAction(g, a)}
                  className="p-4 mb-2 flex-row items-center"
                  style={{
                    backgroundColor: Surface.focusSurface,
                    borderWidth: 1,
                    borderColor: Surface.focusRule,
                    borderRadius: Radius.lg,
                  }}
                >
                  <View className="flex-1">
                    <Text
                      style={{
                        color: Surface.focusText,
                        fontFamily: FontFamily.bodySemiBold,
                        fontSize: 17,
                        lineHeight: 22,
                      }}
                    >
                      {a.name}
                    </Text>
                    <Text
                      style={{
                        color: Surface.focusMuted,
                        fontFamily: FontFamily.monoMedium,
                        fontSize: 10,
                        letterSpacing: 0.8,
                        marginTop: 3,
                        textTransform: 'uppercase',
                      }}
                    >
                      {a.target_minutes} minute target
                    </Text>
                  </View>
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center"
                    style={{ backgroundColor: getGoalTint(g.id) }}
                  >
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
