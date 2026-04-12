import { useMemo, useState, useEffect, type ReactNode } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line } from 'react-native-svg';

import { Colors, Surface, ghostBorder, goalBorderColor } from '@/constants/design';
import { ONBOARDING_DRAFT_STORAGE_KEY } from '@/constants/onboardingDraft';
import { setSetting } from '@/db';
import * as api from '@/db/api';
import type { ActionType } from '@/types';
import { GrainOverlay, ScanlineOverlay } from '@/components/BrutalistOverlay';
import { EditorialTextInput } from '@/components/EditorialTextInput';
import { PrimaryButton } from '@/components/PrimaryButton';

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

/** Matches intentional_onboarding_full.html swatches */
const SWATCH_COLORS = [
  '#4A9EED',
  '#22C55E',
  '#8B5CF6',
  '#F59E0B',
  '#EF4444',
  '#EC4899',
  '#14B8A6',
] as const;

const DURATIONS = [25, 45, 60, 90, 120];
const TOTAL_STEPS = 7;
const BRUTALIST_BG = Colors.surfaceLowest;
const FORM_BG = Colors.backgroundPrimary;

type OnboardingDraftV2 = {
  v: 2;
  step: number;
  goals: PendingGoal[];
  actionName: string;
  actionType: ActionType;
  actionMins: number;
  why: string;
};

/** v3 adds actionStepPillarIdx and per-goal action fields on PendingGoal */
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

/** Legacy v1: steps 1–3 = goal, action, why only */
type OnboardingDraftV1 = {
  v: 1;
  step: number;
  goals: PendingGoal[];
  actionName: string;
  actionType: ActionType;
  actionMins: number;
  why: string;
};

/** v1.1 addendum §6 — segmented progress tape */
/** US-005: spec hex — active #e8e4dc · done #2e2e2e · remaining #1e1e1e */
const SEG_ACTIVE = '#e8e4dc';
const SEG_DONE = '#2e2e2e';
const SEG_REMAINING = '#1e1e1e';

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
      style={{ fontFamily: 'SpaceMono', color: Colors.textLabel, letterSpacing: 2.5 }}
    >
      {children}
    </Text>
  );
}

function OnboardingGhost({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="mt-2 items-center py-2">
      <Text
        className="text-[9px] uppercase tracking-[2px]"
        style={{ fontFamily: 'SpaceMono', color: Colors.textLabel }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function BrutalistBack({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="mb-2 flex-row items-center self-start py-2">
      <Text className="text-[9px] uppercase tracking-[2px]" style={{ fontFamily: 'SpaceMono', color: Colors.textLabel }}>
        ← Back
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
  parsed: Partial<OnboardingDraftV3 | OnboardingDraftV2 | OnboardingDraftV1>,
  setStep: (n: number) => void,
  setGoals: (g: PendingGoal[]) => void,
  setActionName: (s: string) => void,
  setActionType: (t: ActionType) => void,
  setActionMins: (n: number) => void,
  setActionStepPillarIdx: (n: number) => void,
  setWhy: (s: string) => void,
) {
  if (parsed.v === 3 || parsed.v === 2) {
    const s = typeof parsed.step === 'number' ? parsed.step : 1;
    setStep(Math.min(6, Math.max(1, s)));
  } else if (parsed.v === 1) {
    const old = typeof parsed.step === 'number' ? parsed.step : 1;
    const map: Record<number, number> = { 1: 3, 2: 4, 3: 5 };
    setStep(map[old] ?? 3);
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
  if (parsed.v === 3 && typeof parsed.actionStepPillarIdx === 'number') setActionStepPillarIdx(parsed.actionStepPillarIdx);
  if (typeof parsed.why === 'string') setWhy(parsed.why.slice(0, 140));
}

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState<PendingGoal[]>([
    { name: '', color: Colors.goalPhysique, icon: '⭐', why: '', actionName: '', actionType: 'session', actionMins: 45 },
  ]);
  const [actionName, setActionName] = useState('');
  const [actionType, setActionType] = useState<ActionType>('session');
  const [actionMins, setActionMins] = useState(45);
  const [useCustomMins, setUseCustomMins] = useState(false);
  const [customMinsStr, setCustomMinsStr] = useState('45');
  /** US-006: which pillar (by cleanGoals index) we're collecting the action for in step 4 */
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
          const parsed = JSON.parse(raw) as Partial<OnboardingDraftV3 | OnboardingDraftV2 | OnboardingDraftV1>;
          if (parsed.v === 1 || parsed.v === 2 || parsed.v === 3) {
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
    const payload: OnboardingDraftV3 = {
      v: 3,
      step,
      goals,
      actionName,
      actionType,
      actionMins,
      actionStepPillarIdx,
      why,
    };
    const t = setTimeout(() => {
      void AsyncStorage.setItem(ONBOARDING_DRAFT_STORAGE_KEY, JSON.stringify(payload));
    }, 350);
    return () => clearTimeout(t);
  }, [draftReady, step, goals, actionName, actionType, actionMins, actionStepPillarIdx, why]);

  const firstGoal = goals[0] ?? { name: '', color: Colors.goalPhysique, icon: '⭐', why: '', actionName: '', actionType: 'session' as ActionType, actionMins: 45 };
  const accent = firstGoal.color;
  const canContinueGoal = goals.some((g) => g.name.trim().length > 0);
  const canContinueAction = actionName.trim().length > 0;
  const cleanGoals = useMemo(() => goals.filter((g) => g.name.trim().length > 0), [goals]);
  const displayPillarName = firstGoal.name.trim() || 'Physique';

  /** US-006: the pillar currently being asked for an action in step 4 */
  const currentActionPillar = cleanGoals[actionStepPillarIdx] ?? cleanGoals[0];
  const isLastActionPillar = actionStepPillarIdx >= cleanGoals.length - 1;

  /**
   * Save the current action fields into the current pillar's PendingGoal,
   * then advance: either to the next pillar's action step or to step 5.
   */
  const advanceActionStep = () => {
    // persist current action into goals state
    const pillarGoal = currentActionPillar;
    if (pillarGoal) {
      setGoals((prev) =>
        prev.map((g) =>
          g.name === pillarGoal.name
            ? { ...g, actionName: actionName.trim(), actionType, actionMins }
            : g
        )
      );
    }
    if (isLastActionPillar) {
      setStep(5);
    } else {
      const nextPillar = cleanGoals[actionStepPillarIdx + 1];
      // pre-load next pillar's previously entered action (if any)
      setActionName(nextPillar?.actionName ?? '');
      setActionType(nextPillar?.actionType ?? 'session');
      setActionMins(nextPillar?.actionMins ?? 45);
      setUseCustomMins(false);
      setActionStepPillarIdx((i) => i + 1);
    }
  };

  /** Go back within step 4 (to previous pillar or to step 3). */
  const backActionStep = () => {
    if (actionStepPillarIdx === 0) {
      setStep(3);
    } else {
      const prevPillar = cleanGoals[actionStepPillarIdx - 1];
      setActionName(prevPillar?.actionName ?? '');
      setActionType(prevPillar?.actionType ?? 'session');
      setActionMins(prevPillar?.actionMins ?? 45);
      setUseCustomMins(false);
      setActionStepPillarIdx((i) => i - 1);
    }
  };

  /** When entering step 4 from step 3, reset to first pillar. */
  const enterActionStep = () => {
    setActionStepPillarIdx(0);
    setActionName(cleanGoals[0]?.actionName ?? '');
    setActionType(cleanGoals[0]?.actionType ?? 'session');
    setActionMins(cleanGoals[0]?.actionMins ?? 45);
    setUseCustomMins(false);
    setStep(4);
  };

  const syncIconWithColor = (color: string) => {
    const preset = PRESETS.find((p) => p.color === color);
    return preset?.icon ?? '⭐';
  };

  const finish = async () => {
    const existingGoals = await api.getGoals();
    if (existingGoals.length > 0) {
      await setSetting('hasCompletedOnboarding', '1');
      await AsyncStorage.removeItem(ONBOARDING_DRAFT_STORAGE_KEY);
      router.replace('/(tabs)/today');
      return;
    }

    const primary = cleanGoals[0] ?? firstGoal;
    const goal = await api.addGoal({
      name: primary.name.trim() || 'My Goal',
      color: primary.color,
      icon: primary.icon,
      sort_order: 0,
      why_statement: why.slice(0, 140),
    });

    await api.addAction({
      goal_id: goal.id,
      name: actionName.trim() || 'Daily focus',
      type: actionType,
      target_minutes: actionType === 'session' ? actionMins : 60,
      reminder_time: null,
      is_active: 1,
      sort_order: 0,
    });

    for (let i = 1; i < cleanGoals.length; i++) {
      const savedGoal = await api.addGoal({
        name: cleanGoals[i].name.trim(),
        color: cleanGoals[i].color,
        icon: cleanGoals[i].icon,
        sort_order: i,
        why_statement: cleanGoals[i].why.slice(0, 140),
      });
      const pAction = cleanGoals[i].actionName.trim();
      if (pAction) {
        await api.addAction({
          goal_id: savedGoal.id,
          name: pAction,
          type: cleanGoals[i].actionType,
          target_minutes: cleanGoals[i].actionType === 'session' ? cleanGoals[i].actionMins : 60,
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

  const brutalistShell = (children: ReactNode) => (
    <View className="flex-1" style={{ backgroundColor: BRUTALIST_BG }}>
      <Stack.Screen options={{ headerShown: false }} />
      <GrainOverlay />
      <ScanlineOverlay />
      <SafeAreaView className="flex-1 px-5" edges={['top', 'bottom']}>
        <View className="relative z-[3] flex-1">{children}</View>
      </SafeAreaView>
    </View>
  );

  const formScroll = (children: ReactNode) => (
    <KeyboardAvoidingView
      className="flex-1"
      style={{ backgroundColor: FORM_BG }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView className="flex-1" style={{ backgroundColor: FORM_BG }} edges={['top', 'bottom']}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 }}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );

  /* ── Step 0 · Welcome ── */
  if (step === 0) {
    return brutalistShell(
      <>
        <View className="flex-1 justify-between pt-2">
          <View>
            <SegmentedProgress step={0} />
            <Text
              className="mb-4 font-bold leading-[0.9]"
              style={{ fontSize: 52, letterSpacing: -2, color: Colors.textDim }}
            >
              IN{'\n'}TEN{'\n'}TION{'\n'}AL.
            </Text>
            <View className="mb-3 border-l border-[#1E1E1E] pl-3">
              <Text
                className="text-[10px] leading-[1.7]"
                style={{ fontFamily: 'SpaceMono', color: Colors.textLabel }}
              >
                &quot;You don&apos;t rise to the level{'\n'}
                of your goals. You fall to{'\n'}
                the level of your systems.&quot;
              </Text>
              <Text className="mt-1 text-[10px]" style={{ fontFamily: 'SpaceMono', color: Colors.textLabel }}>
                — James Clear
              </Text>
            </View>
          </View>

          <View className="flex-1 justify-center py-4">
            <Text
              className="text-[11px] leading-[1.75]"
              style={{ fontFamily: 'SpaceMono', color: Colors.textMuted }}
            >
              Every hour you spend should trace back to something you care about.{'\n\n'}
              This is the system.
            </Text>
            {hasExistingGoals ? (
              <Text
                className="mt-4 text-[10px] leading-5"
                style={{ fontFamily: 'SpaceMono', color: Colors.textSecondary }}
              >
                You already have goals. Use this as a refresher — finishing won&apos;t duplicate them.
              </Text>
            ) : null}
          </View>

          <View className="mt-2">
            <PrimaryButton title="Begin" onPress={() => setStep(1)} />
          </View>
        </View>
      </>,
    );
  }

  /* ── Step 1 · The problem ── */
  if (step === 1) {
    return brutalistShell(
      <View className="flex-1 justify-between pt-2">
        <View>
          <BrutalistBack onPress={() => setStep(0)} />
          <SegmentedProgress step={1} />
          <MonoTag>▶ 00 · THE PROBLEM</MonoTag>
          <Text className="mb-4 text-[38px] font-bold leading-none text-text-primary">
            You&apos;re full{'\n'}of ideas.{'\n'}
            <Text style={{ color: Colors.textDim }}>No system{'\n'}to act.</Text>
          </Text>
          <View className="gap-2">
          <View className="rounded-lg px-3.5 py-3" style={{ backgroundColor: Surface.low }}>
            <Text className="mb-1 text-[9px] uppercase tracking-[1.5px]" style={{ fontFamily: 'SpaceMono', color: Colors.textLabel }}>
              The gap
            </Text>
            <Text className="text-[13px] font-medium leading-snug" style={{ color: Colors.textSecondary }}>
              Goal-setting apps you never open after week one.
            </Text>
          </View>
          <View className="rounded-lg px-3.5 py-3" style={{ backgroundColor: Surface.low }}>
            <Text className="mb-1 text-[9px] uppercase tracking-[1.5px]" style={{ fontFamily: 'SpaceMono', color: Colors.textLabel }}>
              The trap
            </Text>
            <Text className="text-[13px] font-medium leading-snug" style={{ color: Colors.textSecondary }}>
              Task managers that keep you busy without asking why.
            </Text>
          </View>
          <View className="rounded-lg px-3.5 py-3" style={{ backgroundColor: Surface.container }}>
            <Text
              className="mb-1 text-[9px] uppercase tracking-[1.5px] text-text-primary"
              style={{ fontFamily: 'SpaceMono' }}
            >
              The fix
            </Text>
            <Text className="text-[13px] font-medium leading-snug text-text-primary">
              Every minute of work traces back to a goal you named.
            </Text>
          </View>
        </View>
        </View>
        <View className="pb-1">
          <PrimaryButton title="How it works" onPress={() => setStep(2)} />
          <OnboardingGhost label="Skip to setup" onPress={() => setStep(3)} />
        </View>
      </View>,
    );
  }

  /* ── Step 2 · The system ── */
  if (step === 2) {
    return brutalistShell(
      <View className="flex-1 justify-between pt-2">
        <View>
          <BrutalistBack onPress={() => setStep(1)} />
          <SegmentedProgress step={2} />
          <MonoTag>▶ 01 · THE SYSTEM</MonoTag>
          <Text className="mb-2 text-[36px] font-bold leading-none text-text-primary">
            Three levels.{'\n'}One loop.
          </Text>
        </View>

        <View className="flex-1 justify-center py-2">
          <SystemRow
            n="01"
            bg="#4A9EED"
            fg="#0a1a2e"
            title="Meta Goals"
            body="Your 3–5 life pillars. Physique, Skills, Finances, Mind."
            showLine
          />
          <SystemRow
            n="02"
            bg="#8B5CF6"
            fg="#1a0a3a"
            title="Daily Actions"
            body="Habits and sessions attached to each goal."
            showLine
          />
          <SystemRow
            n="03"
            bg="#22C55E"
            fg="#0a1a0a"
            title="Focus Sessions"
            body="Timed, deep work. Every minute logged to a goal."
            showLine={false}
          />
        </View>

        <View className="pb-1">
          <View className="mb-2 h-px" style={{ backgroundColor: Surface.high }} />
          <Text
            className="mb-4 text-[11px] leading-relaxed"
            style={{ fontFamily: 'SpaceMono', color: Colors.textLabel }}
          >
            No disconnected tasks. No forgotten goals. Every session you complete is evidence of who you&apos;re
            becoming.
          </Text>
          <PrimaryButton title="Build your system" onPress={() => setStep(3)} />
        </View>
      </View>,
    );
  }

  /* ── Step 3 · Meta goal ── */
  if (step === 3) {
    return formScroll(
      <>
        <BrutalistBack onPress={() => setStep(2)} />
        <SegmentedProgress step={3} />
        <MonoTag>▶ 02 · META GOAL</MonoTag>
        <Text className="mb-3 text-[25px] font-bold leading-none text-text-primary">
          Name your{'\n'}first pillar.
        </Text>

        <EditorialTextInput
          className="mb-3"
          variant="underline"
          placeholder="e.g. Physique, Skills, Mind"
          value={firstGoal.name}
          onChangeText={(t) =>
            setGoals((prev) =>
              prev.map((p, i) => (i === 0 ? { ...p, name: t.slice(0, 30) } : p)),
            )
          }
          maxLength={30}
        />

        <Text className="mb-2 text-[9px] uppercase tracking-[2.5px]" style={{ fontFamily: 'SpaceMono', color: Colors.textLabel }}>
          Color
        </Text>
        <View className="mb-3.5 flex-row flex-wrap gap-2">
          {SWATCH_COLORS.map((c) => {
            const sel = firstGoal.color === c;
            /** US-006: any other pillar already using this color */
            const usedByOther = goals.slice(1).some((g) => g.color === c);
            return (
              <Pressable
                key={c}
                onPress={() =>
                  setGoals((prev) =>
                    prev.map((p, i) =>
                      i === 0 ? { ...p, color: c, icon: syncIconWithColor(c) } : p,
                    ),
                  )
                }
                className="h-[26px] w-[26px] rounded-full items-center justify-center"
                style={{
                  backgroundColor: c,
                  borderWidth: sel ? 2 : 0.5,
                  borderColor: sel ? Colors.textPrimary : ghostBorder,
                  transform: [{ scale: sel ? 1.06 : 1 }],
                  opacity: usedByOther && !sel ? 0.35 : 1,
                }}
              >
                {usedByOther && !sel ? (
                  <Text style={{ fontSize: 10, color: '#fff', fontWeight: '700', lineHeight: 12 }}>✕</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <View className="mb-3 flex-row items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: Surface.container }}>
          <View className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
          <Text className="text-[12px] font-bold text-text-primary" style={{ letterSpacing: -0.3 }}>
            {displayPillarName}
          </Text>
        </View>

        <View className="mb-2 h-px" style={{ backgroundColor: Surface.high }} />
        <Text
          className="mb-3 text-[10px] leading-relaxed"
          style={{ fontFamily: 'SpaceMono', color: Colors.textMuted }}
        >
          Create 3–5 pillars over time. These are the roots of everything in the app. Each one gets its own color,
          actions, and insights.
        </Text>

        {goals.map((g, i) =>
          i === 0 ? null : (
            <View key={i} className="mb-2 flex-row items-center gap-2 rounded-lg p-2.5" style={{ backgroundColor: Surface.container }}>
              <View className="h-8 w-8 rounded-full" style={{ backgroundColor: g.color }} />
              <EditorialTextInput
                className="h-9 flex-1"
                variant="underline"
                style={{ fontSize: 16, fontWeight: '600', paddingVertical: 8 }}
                placeholder="Pillar name"
                value={g.name}
                onChangeText={(t) =>
                  setGoals((prev) => prev.map((p, j) => (j === i ? { ...p, name: t.slice(0, 30) } : p)))
                }
                maxLength={30}
              />
              <Pressable
                onPress={() => setGoals((prev) => prev.filter((_, idx) => idx !== i))}
                className="h-7 w-7 items-center justify-center rounded-md"
                style={{ backgroundColor: Surface.high, borderWidth: 0.5, borderColor: ghostBorder }}
              >
                <Ionicons name="remove" size={16} color={Colors.textSecondary} />
              </Pressable>
            </View>
          ),
        )}

        {goals.length < 5 && (
          <Pressable
            onPress={() =>
              setGoals((prev) => [
                ...prev,
                {
                  name: '',
                  color: PRESETS[prev.length % PRESETS.length].color,
                  icon: PRESETS[prev.length % PRESETS.length].icon,
                  why: '',
                  actionName: '',
                  actionType: 'session' as ActionType,
                  actionMins: 45,
                },
              ])
            }
            className="mb-3 h-11 flex-row items-center justify-center gap-2 rounded-lg"
            style={{ borderWidth: 0.5, borderStyle: 'dashed', borderColor: ghostBorder, backgroundColor: Surface.low }}
          >
            <Ionicons name="add" size={18} color={accent} />
            <Text className="text-[8px] uppercase tracking-[2px]" style={{ fontFamily: 'SpaceMono', color: accent }}>
              Add another pillar
            </Text>
          </Pressable>
        )}

        <View className="flex-row flex-wrap gap-2 pb-1">
          {PRESETS.map((preset) => (
            <Pressable
              key={preset.name}
              onPress={() =>
                setGoals((prev) => {
                  const idx = prev.findIndex((g) => !g.name.trim());
                  if (idx === -1) return prev;
                  return prev.map((g, i) => (i === idx ? { ...g, ...preset } : g));
                })
              }
              className="rounded-md px-2.5 py-1"
              style={{ backgroundColor: Surface.container }}
            >
              <Text className="text-[7px] uppercase tracking-[1.6px] text-text-secondary">{preset.name}</Text>
            </Pressable>
          ))}
        </View>

        <PrimaryButton
          title="Next"
          appearance="goalOutline"
          color={accent}
          onPress={enterActionStep}
          disabled={!canContinueGoal}
        />
        <OnboardingGhost label="+ Add another pillar later" onPress={enterActionStep} />
      </>,
    );
  }

  /* ── Step 4 · Daily action (cycles per pillar — US-006) ── */
  if (step === 4) {
    const pillarAccent = currentActionPillar?.color ?? accent;
    const pillarName = currentActionPillar?.name.trim() || displayPillarName;
    const multiPillar = cleanGoals.length > 1;
    return formScroll(
      <>
        <BrutalistBack onPress={backActionStep} />
        <SegmentedProgress step={4} />
        <MonoTag>{`▶ 03 · DAILY ACTION${multiPillar ? ` (${actionStepPillarIdx + 1} of ${cleanGoals.length})` : ''}`}</MonoTag>
        <Text className="mb-2.5 text-[25px] font-bold leading-tight text-text-primary">
          What will you{'\n'}do for it?
        </Text>

        <View className="mb-3 flex-row items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: Surface.container }}>
          <View className="h-2 w-2 rounded-full" style={{ backgroundColor: pillarAccent }} />
          <Text className="text-[12px] font-bold text-text-primary">{pillarName}</Text>
          {multiPillar && !isLastActionPillar ? (
            <Text className="ml-auto text-[9px] uppercase tracking-[1px]" style={{ fontFamily: 'SpaceMono', color: Colors.textLabel }}>
              more pillars follow →
            </Text>
          ) : null}
        </View>

        <EditorialTextInput
          className="mb-3"
          variant="underline"
          placeholder="e.g. Morning run, Learn ML..."
          value={actionName}
          onChangeText={(t) => setActionName(t.slice(0, 30))}
          maxLength={30}
          style={{ fontSize: 18, fontWeight: '700' }}
        />

        <Text className="mb-2 text-[9px] uppercase tracking-[2.5px]" style={{ fontFamily: 'SpaceMono', color: Colors.textLabel }}>
          Type
        </Text>
        <View className="mb-3 flex-row gap-1.5">
          {(['habit', 'session'] as const).map((t) => {
            const sel = actionType === t;
            return (
              <Pressable
                key={t}
                onPress={() => setActionType(t)}
                className="flex-1 rounded-md py-2"
                style={{
                  borderWidth: 0.5,
                  borderColor: sel ? goalBorderColor(pillarAccent) : ghostBorder,
                  backgroundColor: sel ? Surface.high : 'transparent',
                }}
              >
                <Text
                  className="text-center text-[9px] uppercase tracking-[1.5px]"
                  style={{ fontFamily: 'SpaceMono', color: sel ? pillarAccent : Colors.textLabel }}
                >
                  {t === 'habit' ? 'Habit' : 'Session'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {actionType === 'session' ? (
          <>
            <Text
              className="mb-2 text-[9px] uppercase tracking-[2.5px]"
              style={{ fontFamily: 'SpaceMono', color: Colors.textLabel }}
            >
              Target duration
            </Text>
            <View className="mb-2 flex-row flex-wrap gap-1.5">
              {DURATIONS.map((m) => {
                const sel = !useCustomMins && actionMins === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => { setUseCustomMins(false); setActionMins(m); }}
                    className="rounded-md px-2.5 py-1.5"
                    style={{
                      borderWidth: 0.5,
                      borderColor: sel ? goalBorderColor(pillarAccent) : ghostBorder,
                      backgroundColor: sel ? Surface.high : 'transparent',
                    }}
                  >
                    <Text
                      className="text-[9px] uppercase tracking-[1px]"
                      style={{ fontFamily: 'SpaceMono', color: sel ? pillarAccent : Colors.textLabel }}
                    >
                      {m === 60 ? '1h' : m === 120 ? '2h' : `${m}m`}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => setUseCustomMins(true)}
                className="rounded-md px-2.5 py-1.5"
                style={{
                  borderWidth: 0.5,
                  borderColor: useCustomMins ? goalBorderColor(pillarAccent) : ghostBorder,
                  backgroundColor: useCustomMins ? Surface.high : 'transparent',
                }}
              >
                <Text
                  className="text-[9px] uppercase tracking-[1px]"
                  style={{ fontFamily: 'SpaceMono', color: useCustomMins ? pillarAccent : Colors.textLabel }}
                >
                  Custom
                </Text>
              </Pressable>
            </View>
            {useCustomMins ? (
              <View className="mb-3 flex-row items-center gap-2">
                <EditorialTextInput
                  variant="underline"
                  style={{ width: 72, fontSize: 16, fontWeight: '700', textAlign: 'center' }}
                  placeholder="45"
                  keyboardType="number-pad"
                  value={customMinsStr}
                  onChangeText={(t) => {
                    const clean = t.replace(/\D/g, '').slice(0, 3);
                    setCustomMinsStr(clean);
                    const n = Number(clean);
                    if (n >= 1) setActionMins(n);
                  }}
                />
                <Text className="text-[9px] uppercase tracking-[1px]" style={{ fontFamily: 'SpaceMono', color: Colors.textLabel }}>
                  minutes
                </Text>
              </View>
            ) : null}
          </>
        ) : null}

        <View className="mb-3 h-px" style={{ backgroundColor: Surface.high }} />
        <Text
          className="mb-4 text-[10px] leading-relaxed"
          style={{ fontFamily: 'SpaceMono', color: Colors.textMuted }}
        >
          Sessions log time. Habits are done / not done. You can add more actions after setup.
        </Text>

        <PrimaryButton
          title={isLastActionPillar ? 'Next' : `Next: ${cleanGoals[actionStepPillarIdx + 1]?.name.trim() || 'next pillar'} →`}
          appearance="goalOutline"
          color={pillarAccent}
          onPress={advanceActionStep}
          disabled={!canContinueAction}
        />
      </>,
    );
  }

  /* ── Step 5 · Your why ── */
  if (step === 5) {
    return formScroll(
      <>
        <BrutalistBack onPress={() => setStep(4)} />
        <SegmentedProgress step={5} />
        <MonoTag>▶ 04 · YOUR WHY</MonoTag>
        <Text className="mb-2.5 text-[25px] font-bold leading-tight text-text-primary">
          Why does this{'\n'}matter to you?
        </Text>

        <View className="mb-3 flex-row items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: Surface.container }}>
          <View className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
          <Text className="text-[12px] font-bold text-text-primary">{displayPillarName}</Text>
        </View>

        <EditorialTextInput
          variant="contained"
          className="mb-1"
          placeholder="I want to feel strong and energised every day..."
          value={why}
          onChangeText={(t) => setWhy(t.slice(0, 140))}
          multiline
          maxLength={140}
          textAlignVertical="top"
        />
        <Text
          className="mb-3 text-right text-[9px] tracking-[1px]"
          style={{ fontFamily: 'SpaceMono', color: why.length >= 140 ? '#EF4444' : Colors.textLabel }}
        >
          {why.length} / 140
        </Text>

        <View className="mb-3 rounded-md px-3 py-2.5" style={{ backgroundColor: Surface.low }}>
          <Text className="mb-1 text-[8px] uppercase tracking-[2px]" style={{ fontFamily: 'SpaceMono', color: Colors.textLabel }}>
            ▶ Example
          </Text>
          <Text className="text-[11px] leading-snug" style={{ color: Colors.textSecondary }}>
            &quot;So I have the energy to show up fully — for my work, for the people I love.&quot;
          </Text>
        </View>

        <Text
          className="mb-3 text-[10px] leading-relaxed"
          style={{ fontFamily: 'SpaceMono', color: Colors.textMuted }}
        >
          This can appear on your lock screen. It&apos;s the reason you open the app on hard days.
        </Text>

        <PrimaryButton title="Finish setup" appearance="goalOutline" color={accent} onPress={() => setStep(6)} />
        <OnboardingGhost label="Skip for now" onPress={() => setStep(6)} />
      </>,
    );
  }

  /* ── Step 6 · Ready ── */
  return brutalistShell(
    <View className="flex-1 pt-2">
      <BrutalistBack onPress={() => setStep(5)} />
      <SegmentedProgress step={6} />
      <MonoTag>▶ 05 · SYSTEM READY</MonoTag>
      <ReadyBurst />
      <Text className="mb-1.5 text-center text-[34px] font-bold leading-none text-text-primary">
        You&apos;re{'\n'}ready.
      </Text>
      <Text
        className="mb-5 text-center text-[9px] uppercase tracking-[2px]"
        style={{ fontFamily: 'SpaceMono', color: Colors.textLabel }}
      >
        SYSTEM INITIALISED
      </Text>

      <View className="mb-4 w-full rounded-lg px-3 py-2.5" style={{ backgroundColor: Surface.container }}>
        <View className="flex-row items-center gap-2.5">
          <View className="h-9 w-0.5 rounded-sm" style={{ backgroundColor: accent }} />
          <View className="flex-1">
            <Text className="text-[13px] font-bold text-text-primary" style={{ letterSpacing: -0.3 }}>
              {displayPillarName}
            </Text>
            <Text className="mt-0.5 text-[9px] tracking-[0.5px]" style={{ fontFamily: 'SpaceMono', color: Colors.textLabel }}>
              {cleanGoals.length} pillar{cleanGoals.length !== 1 ? 's' : ''} · 1 action · start logging today
            </Text>
          </View>
          <View className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
        </View>
      </View>

      <Text
        className="mb-4 text-center text-[11px] leading-relaxed"
        style={{ fontFamily: 'SpaceMono', color: Colors.textLabel }}
      >
        Your first session is one tap away.{'\n'}Everything else follows from there.
      </Text>

      <View className="mt-auto w-full">
        <PrimaryButton
          title={hasExistingGoals ? 'Continue to Today' : 'Start your first session'}
          onPress={finish}
        />
      </View>
    </View>,
  );
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
          className="absolute left-[15px] top-8 h-7 w-px bg-[#1A1A1A]"
          style={{ zIndex: 0 }}
        />
      ) : null}
      <View
        className="z-[1] h-8 w-8 items-center justify-center rounded-full"
        style={{ backgroundColor: bg }}
      >
        <Text className="text-[11px] font-medium" style={{ fontFamily: 'SpaceMono', color: fg }}>
          {n}
        </Text>
      </View>
      <View className="flex-1 pt-0.5">
        <Text className="text-[15px] font-bold text-text-primary" style={{ letterSpacing: -0.3 }}>
          {title}
        </Text>
        <Text className="mt-0.5 text-[10px] leading-snug" style={{ fontFamily: 'SpaceMono', color: Colors.textSecondary }}>
          {body}
        </Text>
      </View>
    </View>
  );
}
