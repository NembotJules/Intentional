import { useMemo, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line } from 'react-native-svg';

import { Colors, FontFamily, Radius, Surface, ghostBorder, goalBorderColor } from '@/constants/design';
import { ONBOARDING_DRAFT_STORAGE_KEY } from '@/constants/onboardingDraft';
import { setSetting } from '@/db';
import * as api from '@/db/api';
import type { ActionType } from '@/types';
import { EditorialTextInput } from '@/components/EditorialTextInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { hapticMedium, hapticLight } from '@/utils/haptics';

type PendingGoal = {
  name: string;
  color: string;
  icon: string;
  why: string;
  /** Per-pillar action collected in step 4 (US-006) */
  actionName: string;
  actionType: ActionType;
  actionMins: number;
};

const PRESETS = [
  { name: 'Physique', color: Colors.goalPhysique, icon: '🏃' },
  { name: 'Finances', color: Colors.goalFinances, icon: '💰' },
  { name: 'Skills', color: Colors.goalSkills, icon: '📚' },
  { name: 'Mind', color: Colors.goalMind, icon: '🧠' },
  /** Teal from onboarding swatches — wellness pillar */
  { name: 'Health', color: '#14B8A6', icon: '❤️' },
] as const;

/** Unique hexes only — several design tokens share the same value (e.g. goalSkills + pillarCraft). */
const SWATCH_COLORS = Array.from(
  new Set([
    Colors.goalPhysique,
    Colors.goalFinances,
    Colors.goalMind,
    Colors.goalSkills,
    Colors.pillarCraft,
    Colors.accentDanger,
    Colors.accentSuccess,
  ]),
);

const DURATIONS = [25, 45, 60, 90, 120];
const TOTAL_STEPS = 3;
const BRUTALIST_BG = Surface.canvas;
const FORM_BG = Surface.canvas;

/** v4 simplified 3-step onboarding matching Quiet Ledger reference */
type OnboardingDraftV4 = {
  v: 4;
  step: number;
  goals: PendingGoal[];
  actionName: string;
  actionType: ActionType;
  actionMins: number;
  why: string;
};

type OnboardingDraftV3 = {
  v: 3;
  step: number;
  goals: PendingGoal[];
  actionName: string;
  actionType: ActionType;
  actionMins: number;
  actionStepPillarIdx: number;
  why: string;
};

type OnboardingDraftV2 = {
  v: 2;
  step: number;
  goals: PendingGoal[];
  actionName: string;
  actionType: ActionType;
  actionMins: number;
  why: string;
};

type OnboardingDraftV1 = {
  v: 1;
  step: number;
  goals: PendingGoal[];
  actionName: string;
  actionType: ActionType;
  actionMins: number;
  why: string;
};

const SEG_ACTIVE = Surface.ink;
const SEG_DONE = Surface.ruleStrong;
const SEG_REMAINING = Surface.rule;

function SegmentedProgress({ step }: { step: number }) {
  return (
    <View className="mb-5 flex-row pt-1" style={{ gap: 4 }}>
      {Array.from({ length: TOTAL_STEPS }, (_, idx) => {
        const active = idx === step;
        const done = idx < step;
        const bg = active ? SEG_ACTIVE : done ? SEG_DONE : SEG_REMAINING;
        const width = active ? 2.5 : 2;
        return (
          <View key={idx} style={{ flex: active ? 1.3 : 1, height: width, borderRadius: 0, backgroundColor: bg }} />
        );
      })}
    </View>
  );
}

function MonoTag({ children }: { children: string }) {
  return (
    <Text
      className="mb-3 text-[10px] uppercase"
      style={{ fontFamily: FontFamily.monoSemiBold, color: Colors.textMuted, letterSpacing: 1.2 }}
    >
      {children}
    </Text>
  );
}

function OnboardingGhost({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="mt-2 items-center py-2">
      <Text
        className="text-[10px] uppercase"
        style={{ fontFamily: FontFamily.monoSemiBold, color: Colors.textMuted, letterSpacing: 1 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function OnboardingBack({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="mb-2 flex-row items-center self-start py-2">
      <Text className="text-[10px] uppercase" style={{ fontFamily: FontFamily.monoSemiBold, color: Colors.textMuted, letterSpacing: 1 }}>
        Back
      </Text>
    </Pressable>
  );
}

function ReadyBurst() {
  return (
    <View className="relative mb-3.5 mt-2 h-[100px] w-[100px] items-center justify-center self-center">
      <Svg width={100} height={100} viewBox="0 0 100 100" style={StyleSheet.absoluteFillObject}>
        <G opacity={0.15} transform="translate(50,50)">
          <Line x1={0} y1={-44} x2={0} y2={-30} stroke={Colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" />
          <Line x1={31} y1={-31} x2={21} y2={-21} stroke={Colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" />
          <Line x1={44} y1={0} x2={30} y2={0} stroke={Colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" />
          <Line x1={31} y1={31} x2={21} y2={21} stroke={Colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" />
          <Line x1={0} y1={44} x2={0} y2={30} stroke={Colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" />
          <Line x1={-31} y1={31} x2={-21} y2={21} stroke={Colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" />
          <Line x1={-44} y1={0} x2={-30} y2={0} stroke={Colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" />
          <Line x1={-31} y1={-31} x2={-21} y2={-21} stroke={Colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" />
        </G>
        <Circle cx={50} cy={50} r={28} fill="none" stroke={Colors.textPrimary} strokeWidth={0.5} opacity={0.2} />
        <Circle cx={50} cy={50} r={38} fill="none" stroke={Colors.textPrimary} strokeWidth={0.5} opacity={0.08} />
        <Circle
          cx={50}
          cy={50}
          r={18}
          fill="rgba(232,228,220,0.05)"
          stroke={Colors.textPrimary}
          strokeWidth={0.5}
          opacity={0.3}
        />
      </Svg>
      <Text className="text-[28px] font-bold text-text-primary" style={{ zIndex: 2 }}>
        ✓
      </Text>
    </View>
  );
}

function applyDraftPayload(
  parsed: Partial<OnboardingDraftV4 | OnboardingDraftV3 | OnboardingDraftV2 | OnboardingDraftV1>,
  setStep: (n: number) => void,
  setGoals: (g: PendingGoal[]) => void,
  setActionName: (s: string) => void,
  setActionType: (t: ActionType) => void,
  setActionMins: (n: number) => void,
  setActionStepPillarIdx: (n: number) => void,
  setWhy: (s: string) => void,
) {
  if (parsed.v === 4) {
    // New simplified 3-step flow
    const s = typeof parsed.step === 'number' ? parsed.step : 1;
    setStep(Math.min(3, Math.max(1, s)));
  } else if (parsed.v === 3 || parsed.v === 2) {
    // Old 7-step flow - map to new 3-step flow
    const old = typeof parsed.step === 'number' ? parsed.step : 1;
    // Old steps: 0-6 (welcome, problem, system, pillar, action, why, ready)
    // New steps: 1-3 (pillar, action, why)
    let newStep = 1;
    if (old >= 3 && old < 4) newStep = 1; // pillar selection
    else if (old >= 4 && old < 5) newStep = 2; // action
    else if (old >= 5) newStep = 3; // why
    setStep(newStep);
  } else if (parsed.v === 1) {
    // Very old 3-step flow
    const old = typeof parsed.step === 'number' ? parsed.step : 1;
    setStep(Math.min(3, Math.max(1, old)));
  }
  if (Array.isArray(parsed.goals) && parsed.goals.length > 0) {
    const next = parsed.goals.map((g) => ({
      name: typeof g.name === 'string' ? g.name.slice(0, 30) : '',
      color: typeof g.color === 'string' ? g.color : Colors.goalPhysique,
      icon: typeof g.icon === 'string' ? g.icon.slice(-2) || '⭐' : '⭐',
      why: typeof g.why === 'string' ? g.why.slice(0, 140) : '',
      actionName: typeof (g as PendingGoal).actionName === 'string' ? (g as PendingGoal).actionName.slice(0, 30) : '',
      actionType: ((g as PendingGoal).actionType === 'habit' || (g as PendingGoal).actionType === 'session') ? (g as PendingGoal).actionType : 'session',
      actionMins: typeof (g as PendingGoal).actionMins === 'number' && (g as PendingGoal).actionMins > 0 ? (g as PendingGoal).actionMins : 45,
    }));
    setGoals(next);
  }
  if (typeof parsed.actionName === 'string') setActionName(parsed.actionName.slice(0, 30));
  if (parsed.actionType === 'habit' || parsed.actionType === 'session') setActionType(parsed.actionType);
  if (typeof parsed.actionMins === 'number' && parsed.actionMins > 0) setActionMins(parsed.actionMins);
  if (parsed.v === 3 && typeof (parsed as OnboardingDraftV3).actionStepPillarIdx === 'number') {
    setActionStepPillarIdx((parsed as OnboardingDraftV3).actionStepPillarIdx);
  }
  if (typeof parsed.why === 'string') setWhy(parsed.why.slice(0, 140));
}

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // ── Step transition animation ─────────────────────────────────────────────
  const fadeAnim      = useRef(new Animated.Value(1)).current;
  const translateAnim = useRef(new Animated.Value(0)).current;
  const dirRef        = useRef<1 | -1>(1); // 1 = forward, -1 = back

  /** Slide-and-fade in when step changes. */
  useEffect(() => {
    const dir = dirRef.current;
    // Start off-screen on the entry side
    translateAnim.setValue(dir * 32);
    fadeAnim.setValue(0);
    Animated.parallel([
      Animated.timing(fadeAnim,      { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.timing(translateAnim, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Use this instead of setStep to get animation + haptics. */
  const goToStep = useCallback((n: number) => {
    dirRef.current = n > step ? 1 : -1;
    if (n > step) hapticMedium(); else hapticLight();
    setStep(n);
  }, [step]);

  const [goals, setGoals] = useState<PendingGoal[]>([]);
  const [actionName, setActionName] = useState('');
  const [actionType, setActionType] = useState<ActionType>('session');
  const [actionMins, setActionMins] = useState(45);
  const [useCustomMins, setUseCustomMins] = useState(false);
  const [customMinsStr, setCustomMinsStr] = useState('45');
  const [actionStepPillarIdx, setActionStepPillarIdx] = useState(0);
  const [why, setWhy] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [hasExistingGoals, setHasExistingGoals] = useState(false);

  useEffect(() => {
    void api.getGoals().then((g) => setHasExistingGoals(g.length > 0));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ONBOARDING_DRAFT_STORAGE_KEY);
        if (raw && !cancelled) {
          const parsed = JSON.parse(raw) as Partial<OnboardingDraftV4 | OnboardingDraftV3 | OnboardingDraftV2 | OnboardingDraftV1>;
          if (parsed.v === 1 || parsed.v === 2 || parsed.v === 3 || parsed.v === 4) {
            applyDraftPayload(parsed, setStep, setGoals, setActionName, setActionType, setActionMins, setActionStepPillarIdx, setWhy);
          }
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setDraftReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    const payload: OnboardingDraftV4 = {
      v: 4,
      step,
      goals,
      actionName,
      actionType,
      actionMins,
      why,
    };
    const t = setTimeout(() => {
      void AsyncStorage.setItem(ONBOARDING_DRAFT_STORAGE_KEY, JSON.stringify(payload));
    }, 350);
    return () => clearTimeout(t);
  }, [draftReady, step, goals, actionName, actionType, actionMins, why]);

  const firstGoal = goals[0] ?? { name: '', color: Colors.goalPhysique, icon: '⭐', why: '', actionName: '', actionType: 'session' as ActionType, actionMins: 45 };
  const accent = firstGoal.color;
  const canContinueGoal = goals.some((g) => g.name.trim().length > 0);
  const canContinueAction = actionName.trim().length > 0;
  const cleanGoals = useMemo(() => goals.filter((g) => g.name.trim().length > 0), [goals]);
  const displayPillarName = firstGoal.name.trim() || 'Physique';

  const currentActionPillar = cleanGoals[actionStepPillarIdx] ?? cleanGoals[0];

  const finish = async () => {
    const existingGoals = await api.getGoals();
    if (existingGoals.length > 0) {
      await setSetting('hasCompletedOnboarding', '1');
      await AsyncStorage.removeItem(ONBOARDING_DRAFT_STORAGE_KEY);
      router.replace('/(tabs)/today');
      return;
    }

    // Create all selected pillars and their first action
    for (let i = 0; i < cleanGoals.length; i++) {
      const g = cleanGoals[i];
      const savedGoal = await api.addGoal({
        name: g.name.trim(),
        color: g.color,
        icon: g.icon || '⭐',
        sort_order: i,
        why_statement: i === 0 ? why.slice(0, 140) : '',
      });

      // First pillar gets the main action
      if (i === 0 && actionName.trim()) {
        await api.addAction({
          goal_id: savedGoal.id,
          name: actionName.trim(),
          type: actionType,
          target_minutes: actionType === 'session' ? actionMins : 60,
          reminder_time: null,
          is_active: 1,
          sort_order: 0,
        });
      }
    }

    await setSetting('hasCompletedOnboarding', '1');
    await AsyncStorage.removeItem(ONBOARDING_DRAFT_STORAGE_KEY);
    router.replace('/(tabs)/today');
  };

  const stepAnim = { opacity: fadeAnim, transform: [{ translateX: translateAnim }] };

  const formScroll = (children: ReactNode) => (
    <KeyboardAvoidingView
      className="flex-1"
      style={{ backgroundColor: FORM_BG }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView className="flex-1" style={{ backgroundColor: FORM_BG }} edges={['top', 'bottom']}>
        <Animated.View style={[{ flex: 1 }, stepAnim]}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32 }}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );

  /* ── Step 1 · Pick pillars ── */
  if (step === 1) {
    return formScroll(
      <>
        <SegmentedProgress step={1} />
        <MonoTag>STEP 1 OF 3</MonoTag>
        <Text className="mb-3 text-[34px] leading-tight text-text-primary" style={{ fontFamily: FontFamily.display }}>
          What should your{'\n'}days serve?
        </Text>
        <Text className="mb-5 text-[15px] leading-[22px]" style={{ color: Colors.textSecondary, fontFamily: FontFamily.body }}>
          Pick 3 to 5 areas of life you want your daily effort to touch.
        </Text>

        <Text className="mb-5 text-[15px] leading-[22px]" style={{ color: Colors.textSecondary, fontFamily: FontFamily.body }}>
          Pick 3 to 5 areas of life you want your daily effort to touch.
        </Text>

        <View className="p-4 mb-5" style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.lg }}>
          <View className="mb-2">
            <Pressable
              onPress={() =>
                setGoals((prev) => {
                  const hasBody = prev.some((g) => g.name === 'Body');
                  if (hasBody) return prev.filter((g) => g.name !== 'Body');
                  return [...prev, { name: 'Body', color: Colors.pillarBody, icon: '', why: '', actionName: '', actionType: 'session' as ActionType, actionMins: 45 }];
                })
              }
              className="flex-row items-center py-3 px-3 rounded-lg"
              style={{
                backgroundColor: goals.some((g) => g.name === 'Body') ? Surface.surfaceRaised : 'transparent',
                borderWidth: goals.some((g) => g.name === 'Body') ? 1 : 0,
                borderColor: goalBorderColor(Colors.pillarBody),
              }}
            >
              <View className="w-2 h-2 rounded-full mr-3" style={{ backgroundColor: Colors.pillarBody }} />
              <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 17, flex: 1 }}>Body</Text>
              {goals.some((g) => g.name === 'Body') && (
                <Ionicons name="checkmark" size={20} color={Colors.pillarBody} />
              )}
            </Pressable>
          </View>

          <View className="mb-2">
            <Pressable
              onPress={() =>
                setGoals((prev) => {
                  const hasFinances = prev.some((g) => g.name === 'Finances');
                  if (hasFinances) return prev.filter((g) => g.name !== 'Finances');
                  return [...prev, { name: 'Finances', color: Colors.pillarMoney, icon: '', why: '', actionName: '', actionType: 'session' as ActionType, actionMins: 45 }];
                })
              }
              className="flex-row items-center py-3 px-3 rounded-lg"
              style={{
                backgroundColor: goals.some((g) => g.name === 'Finances') ? Surface.surfaceRaised : 'transparent',
                borderWidth: goals.some((g) => g.name === 'Finances') ? 1 : 0,
                borderColor: goalBorderColor(Colors.pillarMoney),
              }}
            >
              <View className="w-2 h-2 rounded-full mr-3" style={{ backgroundColor: Colors.pillarMoney }} />
              <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 17, flex: 1 }}>Finances</Text>
              {goals.some((g) => g.name === 'Finances') && (
                <Ionicons name="checkmark" size={20} color={Colors.pillarMoney} />
              )}
            </Pressable>
          </View>

          <View className="mb-2">
            <Pressable
              onPress={() =>
                setGoals((prev) => {
                  const hasMind = prev.some((g) => g.name === 'Mind');
                  if (hasMind) return prev.filter((g) => g.name !== 'Mind');
                  return [...prev, { name: 'Mind', color: Colors.pillarMind, icon: '', why: '', actionName: '', actionType: 'session' as ActionType, actionMins: 45 }];
                })
              }
              className="flex-row items-center py-3 px-3 rounded-lg"
              style={{
                backgroundColor: goals.some((g) => g.name === 'Mind') ? Surface.surfaceRaised : 'transparent',
                borderWidth: goals.some((g) => g.name === 'Mind') ? 1 : 0,
                borderColor: goalBorderColor(Colors.pillarMind),
              }}
            >
              <View className="w-2 h-2 rounded-full mr-3" style={{ backgroundColor: Colors.pillarMind }} />
              <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 17, flex: 1 }}>Mind</Text>
              {goals.some((g) => g.name === 'Mind') && (
                <Ionicons name="checkmark" size={20} color={Colors.pillarMind} />
              )}
            </Pressable>
          </View>

          <View>
            <Pressable
              onPress={() =>
                setGoals((prev) => {
                  const hasCraft = prev.some((g) => g.name === 'Craft');
                  if (hasCraft) return prev.filter((g) => g.name !== 'Craft');
                  return [...prev, { name: 'Craft', color: Colors.pillarCraft, icon: '', why: '', actionName: '', actionType: 'session' as ActionType, actionMins: 45 }];
                })
              }
              className="flex-row items-center py-3 px-3 rounded-lg"
              style={{
                backgroundColor: goals.some((g) => g.name === 'Craft') ? Surface.surfaceRaised : 'transparent',
                borderWidth: goals.some((g) => g.name === 'Craft') ? 1 : 0,
                borderColor: goalBorderColor(Colors.pillarCraft),
              }}
            >
              <View className="w-2 h-2 rounded-full mr-3" style={{ backgroundColor: Colors.pillarCraft }} />
              <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 17, flex: 1 }}>Craft</Text>
              {goals.some((g) => g.name === 'Craft') && (
                <Ionicons name="checkmark" size={20} color={Colors.pillarCraft} />
              )}
            </Pressable>
          </View>
        </View>

        <PrimaryButton
          title="Continue"
          appearance="filled"
          onPress={() => goToStep(2)}
          disabled={cleanGoals.length === 0}
        />
      </>,
    );
  }

  /* ── Step 2 · First action ── */
  if (step === 2) {
    const pillarAccent = currentActionPillar?.color ?? accent;
    const pillarName = currentActionPillar?.name.trim() || 'this pillar';
    return formScroll(
      <>
        <OnboardingBack onPress={() => goToStep(1)} />
        <SegmentedProgress step={2} />
        <MonoTag>STEP 2 OF 3</MonoTag>
        <Text className="mb-3 text-[25px] leading-tight text-text-primary" style={{ fontFamily: FontFamily.display }}>
          What is one thing{'\n'}{pillarName} should receive?
        </Text>

        <View className="p-4 mb-5" style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.lg }}>
          <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' }}>Action name</Text>
          <EditorialTextInput
            className="mb-4"
            variant="underline"
            placeholder="Ship client proposal"
            value={actionName}
            onChangeText={(t) => setActionName(t.slice(0, 30))}
            maxLength={30}
            style={{ fontSize: 18, fontWeight: '700' }}
          />

          <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>Type</Text>
          <View className="flex-row gap-2 mb-4">
            <Pressable
              onPress={() => setActionType('session')}
              className="flex-1 h-11 rounded-md items-center justify-center"
              style={{
                borderWidth: 0.5,
                borderColor: actionType === 'session' ? goalBorderColor(pillarAccent) : ghostBorder,
                backgroundColor: actionType === 'session' ? Surface.ink : Surface.surface,
              }}
            >
              <Text
                className="text-[11px] uppercase tracking-[1.5px]"
                style={{ fontFamily: FontFamily.monoSemiBold, color: actionType === 'session' ? Surface.surface : Colors.textSecondary }}
              >
                Session
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActionType('habit')}
              className="flex-1 h-11 rounded-md items-center justify-center"
              style={{
                borderWidth: 0.5,
                borderColor: actionType === 'habit' ? goalBorderColor(pillarAccent) : ghostBorder,
                backgroundColor: actionType === 'habit' ? Surface.surfaceRaised : Surface.surface,
              }}
            >
              <Text
                className="text-[11px] uppercase tracking-[1.5px]"
                style={{ fontFamily: FontFamily.monoSemiBold, color: actionType === 'habit' ? pillarAccent : Colors.textSecondary }}
              >
                Habit
              </Text>
            </Pressable>
          </View>

          {actionType === 'session' && (
            <>
              <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>Daily target</Text>
              <View className="flex-row flex-wrap gap-2">
                {[25, 90, 'Custom'].map((opt) => {
                  const isCustom = opt === 'Custom';
                  const minutes = typeof opt === 'number' ? opt : actionMins;
                  const sel = !isCustom ? actionMins === opt && !useCustomMins : useCustomMins;
                  return (
                    <Pressable
                      key={String(opt)}
                      onPress={() => {
                        if (isCustom) {
                          setUseCustomMins(true);
                        } else {
                          setUseCustomMins(false);
                          setActionMins(minutes);
                        }
                      }}
                      className="rounded-md px-4 py-2"
                      style={{
                        borderWidth: 0.5,
                        borderColor: sel ? goalBorderColor(pillarAccent) : ghostBorder,
                        backgroundColor: sel ? Surface.ink : Surface.surface,
                      }}
                    >
                      <Text
                        className="text-[11px] uppercase tracking-[1px]"
                        style={{ fontFamily: FontFamily.monoSemiBold, color: sel ? Surface.surface : Colors.textSecondary }}
                      >
                        {isCustom ? 'Custom' : `${minutes}m`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </View>

        <PrimaryButton
          title="Continue"
          appearance="filled"
          onPress={() => goToStep(3)}
          disabled={!actionName.trim()}
        />
      </>,
    );
  }

  /* ── Step 3 · Optional why ── */
  if (step === 3) {
    const pillarName = cleanGoals[0]?.name.trim() || 'this pillar';
    const pillarAccent = cleanGoals[0]?.color ?? accent;
    return formScroll(
      <>
        <OnboardingBack onPress={() => goToStep(2)} />
        <SegmentedProgress step={3} />
        <MonoTag>STEP 3 OF 3</MonoTag>
        <Text className="mb-3 text-[25px] leading-tight text-text-primary" style={{ fontFamily: FontFamily.display }}>
          Why does{'\n'}{pillarName} matter?
        </Text>
        <Text className="mb-5 text-[15px] leading-[22px]" style={{ color: Colors.textSecondary, fontFamily: FontFamily.body }}>
          One line is enough. You can edit it later.
        </Text>

        <EditorialTextInput
          variant="contained"
          className="mb-4"
          placeholder="Build enough room to choose better work."
          value={why}
          onChangeText={(t) => setWhy(t.slice(0, 140))}
          multiline
          maxLength={140}
          textAlignVertical="top"
        />

        <View className="flex-row gap-2">
          <View className="flex-1">
            <PrimaryButton
              title="Enter Today"
              appearance="filled"
              onPress={finish}
            />
          </View>
          <View className="flex-1">
            <PrimaryButton
              title="Skip for now"
              appearance="goalOutline"
              color={pillarAccent}
              onPress={finish}
            />
          </View>
        </View>
      </>,
    );
  }

  return null;
}

function SystemRow({
  n,
  bg,
  fg,
  title,
  body,
  showLine,
}: {
  n: string;
  bg: string;
  fg: string;
  title: string;
  body: string;
  showLine: boolean;
}) {
  return (
    <View className="relative flex-row gap-3 pb-3.5">
      {showLine ? (
        <View
        className="absolute left-[15px] top-8 h-7 w-px"
        style={{ zIndex: 0, backgroundColor: Surface.rule }}
        />
      ) : null}
      <View
        className="z-[1] h-8 w-8 items-center justify-center rounded-full"
        style={{ backgroundColor: bg }}
      >
        <Text className="text-[11px] font-medium" style={{ fontFamily: FontFamily.monoSemiBold, color: fg }}>
          {n}
        </Text>
      </View>
      <View className="flex-1 pt-0.5">
        <Text className="text-[15px] font-bold text-text-primary" style={{ letterSpacing: -0.3 }}>
          {title}
        </Text>
        <Text className="mt-0.5 text-[10px] leading-snug" style={{ fontFamily: FontFamily.monoMedium, color: Colors.textSecondary }}>
          {body}
        </Text>
      </View>
    </View>
  );
}
