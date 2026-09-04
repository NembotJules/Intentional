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
  AccessibilityInfo,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line } from 'react-native-svg';
import { BlurView } from 'expo-blur';

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
const TOTAL_STEPS = 7;
const BRUTALIST_BG = Surface.canvas;
const FORM_BG = Surface.canvas;

/** Story lines for progressive tap-gated phase */
const STORY_LINES = [
  "Attention only reveals itself when you look carefully enough.",
  "Look closer.",
  "Closer…",
  "Your days are like this too.",
  "Scattered across apps that never ask what you actually want.",
];

/** v7 adds progressive tap-gated story + typewriter intake */
type OnboardingDraftV7 = {
  v: 7;
  step: number;
  goals: PendingGoal[];
  actionName: string;
  actionType: ActionType;
  actionMins: number;
  why: string;
  userName: string;
};

/** v6 adds Mobbin-style story open (splash + 3 beats + name) matching Opal structure on Quiet Ledger cream */
type OnboardingDraftV6 = {
  v: 6;
  step: number;
  goals: PendingGoal[];
  actionName: string;
  actionType: ActionType;
  actionMins: number;
  why: string;
  userName: string;
};

/** v5 adds welcome screen (step 0) and reveal screen (step 4) for Opal-inspired confidence */
type OnboardingDraftV5 = {
  v: 5;
  step: number;
  goals: PendingGoal[];
  actionName: string;
  actionType: ActionType;
  actionMins: number;
  why: string;
};

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
  // Map questions phase steps (3-6) to progress indices (0-3)
  const progressStep = step - 3;
  const progressTotal = 4;
  
  return (
    <View className="mb-5 flex-row pt-1" style={{ gap: 4 }}>
      {Array.from({ length: progressTotal }, (_, idx) => {
        const active = idx === progressStep;
        const done = idx < progressStep;
        const bg = active ? SEG_ACTIVE : done ? SEG_DONE : SEG_REMAINING;
        const height = active ? 4 : 3;
        return (
          <View key={idx} style={{ flex: active ? 1.3 : 1, height, borderRadius: 2, backgroundColor: bg }} />
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
  parsed: Partial<OnboardingDraftV7 | OnboardingDraftV6 | OnboardingDraftV5 | OnboardingDraftV4 | OnboardingDraftV3 | OnboardingDraftV2 | OnboardingDraftV1>,
  setStep: (n: number) => void,
  setGoals: (g: PendingGoal[]) => void,
  setActionName: (s: string) => void,
  setActionType: (t: ActionType) => void,
  setActionMins: (n: number) => void,
  setActionStepPillarIdx: (n: number) => void,
  setWhy: (s: string) => void,
  setUserName: (s: string) => void,
) {
  if (parsed.v === 7) {
    const s = typeof parsed.step === 'number' ? parsed.step : 0;
    setStep(Math.min(6, Math.max(0, s)));
    if (typeof (parsed as OnboardingDraftV7).userName === 'string') {
      setUserName((parsed as OnboardingDraftV7).userName.slice(0, 30));
    }
  } else if (parsed.v === 6) {
    // Old 9-step flow (splash, 3 beats, name, pillar, action, why, reveal) → new 7-step (splash, story, name, pillar, action, why, reveal)
    const old = typeof parsed.step === 'number' ? parsed.step : 0;
    let newStep = 0;
    if (old === 0) newStep = 0; // splash → splash
    else if (old >= 1 && old <= 3) newStep = 1; // any story beat → unified story phase
    else if (old === 4) newStep = 2; // name → name
    else if (old === 5) newStep = 3; // pillar → pillar
    else if (old === 6) newStep = 4; // action → action
    else if (old === 7) newStep = 5; // why → why
    else if (old >= 8) newStep = 6; // reveal → reveal
    setStep(newStep);
    if (typeof (parsed as OnboardingDraftV6).userName === 'string') {
      setUserName((parsed as OnboardingDraftV6).userName.slice(0, 30));
    }
  } else if (parsed.v === 5) {
    // Old 5-step flow (welcome, pillar, action, why, reveal) → new 7-step
    const old = typeof parsed.step === 'number' ? parsed.step : 0;
    let newStep = 0;
    if (old === 0) newStep = 0;
    else if (old === 1) newStep = 3;
    else if (old === 2) newStep = 4;
    else if (old === 3) newStep = 5;
    else if (old >= 4) newStep = 6;
    setStep(newStep);
  } else if (parsed.v === 4) {
    // Old 3-step flow (pillar, action, why) → new 7-step
    const old = typeof parsed.step === 'number' ? parsed.step : 1;
    let newStep = 3;
    if (old === 1) newStep = 3;
    else if (old === 2) newStep = 4;
    else if (old >= 3) newStep = 5;
    setStep(newStep);
  } else if (parsed.v === 3 || parsed.v === 2) {
    // Old 7-step flow → new 7-step
    const old = typeof parsed.step === 'number' ? parsed.step : 1;
    let newStep = 0;
    if (old >= 3 && old < 4) newStep = 3;
    else if (old >= 4 && old < 5) newStep = 4;
    else if (old >= 5) newStep = 5;
    setStep(newStep);
  } else if (parsed.v === 1) {
    const old = typeof parsed.step === 'number' ? parsed.step : 1;
    setStep(Math.min(5, Math.max(3, old + 2)));
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
  const [step, setStep] = useState(0);

  // ── Story phase state ─────────────────────────────────────────────────────
  const [storyLineIndex, setStoryLineIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  // ── Typewriter state ──────────────────────────────────────────────────────
  const [typewriterPhase, setTypewriterPhase] = useState<'intro' | 'question' | 'greeting' | 'setup' | 'done'>('intro');

  // ── Step transition animation ─────────────────────────────────────────────
  const fadeAnim      = useRef(new Animated.Value(1)).current;
  const translateAnim = useRef(new Animated.Value(0)).current;
  const dirRef        = useRef<1 | -1>(1); // 1 = forward, -1 = back

  // ── Story line fade animation ────────────────────────────────────────────
  const lineOpacity = useRef(new Animated.Value(1)).current;

  // ── Check for reduced motion ──────────────────────────────────────────────
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then((enabled) => {
      if (enabled !== undefined) setReduceMotion(enabled);
    }).catch(() => {});
  }, []);

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
  const [userName, setUserName] = useState('');
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
          const parsed = JSON.parse(raw) as Partial<OnboardingDraftV7 | OnboardingDraftV6 | OnboardingDraftV5 | OnboardingDraftV4 | OnboardingDraftV3 | OnboardingDraftV2 | OnboardingDraftV1>;
          if (parsed.v === 1 || parsed.v === 2 || parsed.v === 3 || parsed.v === 4 || parsed.v === 5 || parsed.v === 6 || parsed.v === 7) {
            applyDraftPayload(parsed, setStep, setGoals, setActionName, setActionType, setActionMins, setActionStepPillarIdx, setWhy, setUserName);
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
    const payload: OnboardingDraftV7 = {
      v: 7,
      step,
      goals,
      actionName,
      actionType,
      actionMins,
      why,
      userName,
    };
    const t = setTimeout(() => {
      void AsyncStorage.setItem(ONBOARDING_DRAFT_STORAGE_KEY, JSON.stringify(payload));
    }, 350);
    return () => clearTimeout(t);
  }, [draftReady, step, goals, actionName, actionType, actionMins, why, userName]);

  const firstGoal = goals[0] ?? { name: '', color: Colors.goalPhysique, icon: '⭐', why: '', actionName: '', actionType: 'session' as ActionType, actionMins: 45 };
  const accent = firstGoal.color;
  const canContinueGoal = goals.some((g) => g.name.trim().length > 0);
  const canContinueAction = actionName.trim().length > 0;
  const cleanGoals = useMemo(() => goals.filter((g) => g.name.trim().length > 0), [goals]);
  const displayPillarName = firstGoal.name.trim() || 'Physique';

  const currentActionPillar = cleanGoals[actionStepPillarIdx] ?? cleanGoals[0];

  const finish = async () => {
    // Save user name to settings
    if (userName.trim()) {
      await setSetting('user_name', userName.trim());
    }

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

  const brutalistShell = (children: ReactNode) => (
    <View className="flex-1" style={{ backgroundColor: BRUTALIST_BG }}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView className="flex-1 px-5" edges={['top', 'bottom']}>
        <Animated.View className="relative z-[3] flex-1" style={stepAnim}>{children}</Animated.View>
      </SafeAreaView>
    </View>
  );

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

  /* ── Step 0 · Wordmark splash ── */
  if (step === 0) {
    return (
      <Pressable 
        onPress={() => goToStep(1)}
        className="flex-1"
        style={{ backgroundColor: BRUTALIST_BG }}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView className="flex-1 px-5" edges={['top', 'bottom']}>
          <Animated.View className="relative z-[3] flex-1 justify-center items-center" style={stepAnim}>
            <Text
              className="mb-6"
              style={{ fontFamily: FontFamily.display, fontSize: 72, lineHeight: 72, color: Colors.textPrimary, letterSpacing: -1 }}
            >
              Intentional.
            </Text>
            <Text
              className="text-[11px] uppercase tracking-[2px]"
              style={{ fontFamily: FontFamily.monoSemiBold, color: Colors.textMuted }}
            >
              Tap to continue
            </Text>
          </Animated.View>
        </SafeAreaView>
      </Pressable>
    );
  }

  /* ── Step 1 · Progressive tap-gated story ── */
  if (step === 1) {
    const currentLine = STORY_LINES[storyLineIndex];
    const isLastLine = storyLineIndex === STORY_LINES.length - 1;

    const handleTap = () => {
      if (isLastLine) {
        hapticMedium();
        goToStep(2);
        setStoryLineIndex(0);
        return;
      }

      if (reduceMotion) {
        hapticLight();
        setStoryLineIndex((prev) => prev + 1);
      } else {
        // Fade out and blur current line
        Animated.timing(lineOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          hapticLight();
          setStoryLineIndex((prev) => prev + 1);
          lineOpacity.setValue(1);
        });
      }
    };

    return (
      <Pressable 
        onPress={handleTap}
        className="flex-1"
        style={{ backgroundColor: BRUTALIST_BG }}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView className="flex-1 px-5" edges={['top', 'bottom']}>
          <View className="relative z-[3] flex-1 justify-center items-center">
            <Animated.View style={{ opacity: lineOpacity }}>
              <Text
                className="text-center mb-8"
                style={{ 
                  fontFamily: FontFamily.display, 
                  fontSize: storyLineIndex === 2 ? 46 : 32, 
                  lineHeight: storyLineIndex === 2 ? 52 : 40, 
                  color: Colors.textPrimary 
                }}
              >
                {currentLine}
              </Text>
            </Animated.View>
            <Text
              className="text-[11px] uppercase tracking-[2px]"
              style={{ fontFamily: FontFamily.monoSemiBold, color: Colors.textMuted }}
            >
              Tap to continue
            </Text>
          </View>
        </SafeAreaView>
      </Pressable>
    );
  }

  /* ── Step 2 · Name input with typewriter ── */
  if (step === 2) {
    const canContinue = userName.trim().length > 0;
    
    const handleNameContinue = () => {
      setTypewriterPhase('greeting');
      setTimeout(() => {
        setTypewriterPhase('setup');
        setTimeout(() => {
          setTypewriterPhase('done');
          setTimeout(() => {
            goToStep(3);
            setTypewriterPhase('intro');
          }, reduceMotion ? 0 : 800);
        }, reduceMotion ? 0 : 2500);
      }, reduceMotion ? 0 : 1500);
    };

    return formScroll(
      <>
        <View className="flex-1 justify-center py-8">
          {typewriterPhase === 'intro' && (
            <>
              <TypewriterText
                text="I'll help you build a system where every hour traces back to something you care about."
                reduceMotion={reduceMotion}
                onComplete={() => {
                  setTimeout(() => setTypewriterPhase('question'), reduceMotion ? 0 : 600);
                }}
              />
            </>
          )}

          {typewriterPhase === 'question' && (
            <>
              <Text 
                className="mb-4" 
                style={{ fontFamily: FontFamily.display, fontSize: 22, lineHeight: 30, color: Colors.textPrimary }}
              >
                I'll help you build a system where every hour traces back to something you care about.
              </Text>
              <TypewriterText
                text="First, what's your name?"
                reduceMotion={reduceMotion}
              />
              <View className="mt-6">
                <EditorialTextInput
                  className="mb-8"
                  variant="underline"
                  placeholder="Your name"
                  value={userName}
                  onChangeText={(t) => setUserName(t.slice(0, 30))}
                  maxLength={30}
                  style={{ fontSize: 22, fontWeight: '700', textAlign: 'center' }}
                  autoFocus
                />
                <PrimaryButton
                  title="Continue"
                  appearance="filled"
                  onPress={handleNameContinue}
                  disabled={!canContinue}
                />
              </View>
            </>
          )}

          {typewriterPhase === 'greeting' && (
            <>
              <Text 
                className="mb-4" 
                style={{ fontFamily: FontFamily.display, fontSize: 22, lineHeight: 30, color: Colors.textPrimary }}
              >
                Hi, {userName.trim()}.
              </Text>
              <TypewriterText
                text="I'm going to ask you a few questions. No need to overthink it. Then we'll build your setup."
                reduceMotion={reduceMotion}
              />
            </>
          )}

          {typewriterPhase === 'setup' && (
            <>
              <Text 
                className="mb-2" 
                style={{ fontFamily: FontFamily.display, fontSize: 22, lineHeight: 30, color: Colors.textPrimary }}
              >
                Hi, {userName.trim()}.
              </Text>
              <Text 
                style={{ fontFamily: FontFamily.display, fontSize: 22, lineHeight: 30, color: Colors.textPrimary }}
              >
                I'm going to ask you a few questions. No need to overthink it. Then we'll build your setup.
              </Text>
            </>
          )}
        </View>
      </>,
    );
  }

  /* ── Step 3 · Pick pillars ── */
  if (step === 3) {
    return formScroll(
      <>
        <SegmentedProgress step={3} />
        <MonoTag>▶ 01 · YOUR PILLARS</MonoTag>
        <Text className="mb-3 text-[34px] leading-tight text-text-primary" style={{ fontFamily: FontFamily.display }}>
          What should your{'\n'}days serve?
        </Text>
        <Text className="mb-5 text-[15px] leading-[22px]" style={{ color: Colors.textSecondary, fontFamily: FontFamily.body }}>
          Pick 3 to 5 areas of life you want your daily effort to touch.
        </Text>

        <View className="mb-5" style={{ gap: 12 }}>
          <Pressable
            onPress={() =>
              setGoals((prev) => {
                const hasBody = prev.some((g) => g.name === 'Body');
                if (hasBody) return prev.filter((g) => g.name !== 'Body');
                return [...prev, { name: 'Body', color: Colors.pillarBody, icon: '', why: '', actionName: '', actionType: 'session' as ActionType, actionMins: 45 }];
              })
            }
            style={{
              backgroundColor: goals.some((g) => g.name === 'Body') ? Surface.ink : Surface.surface,
              borderWidth: 1.5,
              borderColor: goals.some((g) => g.name === 'Body') ? Colors.pillarBody : Surface.rule,
              borderRadius: Radius.cta,
              paddingVertical: 18,
              paddingHorizontal: 20,
            }}
          >
            <Text style={{ color: goals.some((g) => g.name === 'Body') ? Surface.canvas : Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 19, textAlign: 'center' }}>Body</Text>
          </Pressable>

          <Pressable
            onPress={() =>
              setGoals((prev) => {
                const hasFinances = prev.some((g) => g.name === 'Finances');
                if (hasFinances) return prev.filter((g) => g.name !== 'Finances');
                return [...prev, { name: 'Finances', color: Colors.pillarMoney, icon: '', why: '', actionName: '', actionType: 'session' as ActionType, actionMins: 45 }];
              })
            }
            style={{
              backgroundColor: goals.some((g) => g.name === 'Finances') ? Surface.ink : Surface.surface,
              borderWidth: 1.5,
              borderColor: goals.some((g) => g.name === 'Finances') ? Colors.pillarMoney : Surface.rule,
              borderRadius: Radius.cta,
              paddingVertical: 18,
              paddingHorizontal: 20,
            }}
          >
            <Text style={{ color: goals.some((g) => g.name === 'Finances') ? Surface.canvas : Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 19, textAlign: 'center' }}>Finances</Text>
          </Pressable>

          <Pressable
            onPress={() =>
              setGoals((prev) => {
                const hasMind = prev.some((g) => g.name === 'Mind');
                if (hasMind) return prev.filter((g) => g.name !== 'Mind');
                return [...prev, { name: 'Mind', color: Colors.pillarMind, icon: '', why: '', actionName: '', actionType: 'session' as ActionType, actionMins: 45 }];
              })
            }
            style={{
              backgroundColor: goals.some((g) => g.name === 'Mind') ? Surface.ink : Surface.surface,
              borderWidth: 1.5,
              borderColor: goals.some((g) => g.name === 'Mind') ? Colors.pillarMind : Surface.rule,
              borderRadius: Radius.cta,
              paddingVertical: 18,
              paddingHorizontal: 20,
            }}
          >
            <Text style={{ color: goals.some((g) => g.name === 'Mind') ? Surface.canvas : Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 19, textAlign: 'center' }}>Mind</Text>
          </Pressable>

          <Pressable
            onPress={() =>
              setGoals((prev) => {
                const hasCraft = prev.some((g) => g.name === 'Craft');
                if (hasCraft) return prev.filter((g) => g.name !== 'Craft');
                return [...prev, { name: 'Craft', color: Colors.pillarCraft, icon: '', why: '', actionName: '', actionType: 'session' as ActionType, actionMins: 45 }];
              })
            }
            style={{
              backgroundColor: goals.some((g) => g.name === 'Craft') ? Surface.ink : Surface.surface,
              borderWidth: 1.5,
              borderColor: goals.some((g) => g.name === 'Craft') ? Colors.pillarCraft : Surface.rule,
              borderRadius: Radius.cta,
              paddingVertical: 18,
              paddingHorizontal: 20,
            }}
          >
            <Text style={{ color: goals.some((g) => g.name === 'Craft') ? Surface.canvas : Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 19, textAlign: 'center' }}>Craft</Text>
          </Pressable>
        </View>

        <PrimaryButton
          title="Continue"
          appearance="filled"
          onPress={() => goToStep(4)}
          disabled={cleanGoals.length === 0}
        />
      </>,
    );
  }

  /* ── Step 4 · First action ── */
  if (step === 4) {
    const pillarAccent = currentActionPillar?.color ?? accent;
    const pillarName = currentActionPillar?.name.trim() || 'this pillar';
    return formScroll(
      <>
        <OnboardingBack onPress={() => goToStep(3)} />
        <SegmentedProgress step={4} />
        <MonoTag>▶ 02 · FIRST ACTION</MonoTag>
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
          onPress={() => goToStep(5)}
          disabled={!actionName.trim()}
        />
      </>,
    );
  }

  /* ── Step 5 · Optional why ── */
  if (step === 5) {
    const pillarName = cleanGoals[0]?.name.trim() || 'this pillar';
    const pillarAccent = cleanGoals[0]?.color ?? accent;
    return formScroll(
      <>
        <OnboardingBack onPress={() => goToStep(4)} />
        <SegmentedProgress step={5} />
        <MonoTag>▶ 03 · YOUR WHY</MonoTag>
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
              title="Continue"
              appearance="filled"
              onPress={() => goToStep(6)}
            />
          </View>
          <View className="flex-1">
            <PrimaryButton
              title="Skip"
              appearance="goalOutline"
              color={pillarAccent}
              onPress={() => goToStep(6)}
            />
          </View>
        </View>
      </>,
    );
  }

  /* ── Step 6 · Reveal ── */
  if (step === 6) {
    const pillarAccent = cleanGoals[0]?.color ?? accent;
    const pillarCount = cleanGoals.length;
    const primaryPillar = cleanGoals[0];
    return brutalistShell(
      <View className="flex-1 justify-between pt-2">
        <View>
          <OnboardingBack onPress={() => goToStep(5)} />
          <SegmentedProgress step={6} />
          <MonoTag>▶ 04 · YOUR SYSTEM</MonoTag>
        </View>

        <View className="flex-1 justify-center items-center px-4">
          <Text
            className="text-center mb-4"
            style={{
              fontFamily: FontFamily.display,
              fontSize: 76,
              lineHeight: 76,
              color: pillarAccent,
              letterSpacing: -2,
            }}
          >
            {pillarCount} pillar{pillarCount !== 1 ? 's' : ''}.
          </Text>
          {actionName.trim() && (
            <Text
              className="text-center mb-2"
              style={{
                fontFamily: FontFamily.display,
                fontSize: 28,
                lineHeight: 32,
                color: Colors.textPrimary,
              }}
            >
              One first move:{'\n'}
              <Text style={{ color: pillarAccent }}>{actionName.trim()}</Text>
            </Text>
          )}
          {cleanGoals.length > 1 && (
            <Text
              className="text-center mt-4 text-[11px] uppercase tracking-[1.5px]"
              style={{ fontFamily: FontFamily.monoMedium, color: Colors.textMuted }}
            >
              {cleanGoals.slice(1).map(g => g.name).join(' · ')}
            </Text>
          )}
        </View>

        <View className="pb-1">
          <PrimaryButton title="Enter Today" onPress={finish} />
        </View>
      </View>,
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

/** Typewriter text component */
function TypewriterText({
  text,
  onComplete,
  speed = 30,
  reduceMotion = false,
}: {
  text: string;
  onComplete?: () => void;
  speed?: number;
  reduceMotion?: boolean;
}) {
  const [displayedText, setDisplayedText] = useState('');
  const indexRef = useRef(0);

  useEffect(() => {
    if (reduceMotion) {
      setDisplayedText(text);
      onComplete?.();
      return;
    }

    indexRef.current = 0;
    setDisplayedText('');

    const interval = setInterval(() => {
      if (indexRef.current < text.length) {
        setDisplayedText(text.slice(0, indexRef.current + 1));
        indexRef.current++;
      } else {
        clearInterval(interval);
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, reduceMotion, onComplete]);

  return <Text style={{ fontFamily: FontFamily.display, fontSize: 22, lineHeight: 30, color: Colors.textPrimary }}>{displayedText}</Text>;
}
