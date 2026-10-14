/**
 * Onboarding — persuasion flow.
 *
 *   Act 1 · Wake up      (dark)  affirm → shock stats → name the enemy (brain rot) → not your fault
 *   Act 2 · Diagnose     (dark)  name + 5-question quiz → "calculating"
 *   Act 3 · Verdict      (dark)  years of waking life lost → stagnation mirror
 *   Act 4 · The way out  (cream) "We can help" → "We believe" manifesto → proof → model
 *   Build                (cream) pillars (presets + custom) → first action → why → projection
 *   Close                (cream) signed commitment → reveal → paywall
 *
 * Every screen shares one shell: back arrow + progress bar on top, round next
 * arrow bottom-right, body copy typed out with keyboard-style haptic ticks.
 */
import { useMemo, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Animated,
  AccessibilityInfo,
  PanResponder,
  StatusBar,
  type TextStyle,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop, Line, Circle } from 'react-native-svg';

import { resolvePillarIconKey } from '@/components/ui/PillarIcon';
import { Colors, FontFamily, Radius, Surface, ghostBorder, goalBorderColor } from '@/constants/design';
import { ONBOARDING_DRAFT_STORAGE_KEY } from '@/constants/onboardingDraft';
import { setSetting } from '@/db';
import * as api from '@/db/api';
import type { ActionType } from '@/types';
import { EditorialTextInput } from '@/components/EditorialTextInput';
import { hapticMedium, hapticLight, hapticTick, hapticSuccess } from '@/utils/haptics';

// ─── Flow ─────────────────────────────────────────────────────────────────────

const FLOW = [
  'splash',
  // Act 1
  'affirm', 'statAttention', 'statPhone', 'brainrot', 'notYourFault',
  // Act 2
  'name', 'age', 'hours', 'stealer', 'compare', 'wants', 'calculating',
  // Act 3
  'verdict', 'stagnation',
  // Act 4
  'fixIt', 'believe0', 'believe1', 'believe2', 'believe3', 'believe4', 'intentional', 'proof', 'model', 'letsBuild',
  // Build
  'pillars', 'action', 'why', 'projection',
  // Close
  'commit', 'reveal', 'paywall',
] as const;
type ScreenId = (typeof FLOW)[number];

/** Screens before this one use the dark ceremonial palette; from here the lights come on. */
const FIRST_LIGHT_STEP = FLOW.indexOf('fixIt');

// ─── Copy & data ──────────────────────────────────────────────────────────────

const BELIEFS = [
  'We believe your life is built on a few things that truly matter. Your body. Your mind. Your money, etc. We call them your pillars.',
  'We believe every minute of your day should trace back to one of them.',
  'We believe every action you take should move you toward something you chose. Not toward what a feed chose for you.',
  "We believe progress isn't a feeling. It's hours. Logged honestly, they add up to a different life.",
  "We believe you don't need more motivation. You need fewer distractions and a clear next move.",
];

const AGE_BRACKETS = [
  { id: 'u18', label: 'Under 18', age: 16 },
  { id: '18-24', label: '18 – 24', age: 21 },
  { id: '25-34', label: '25 – 34', age: 29 },
  { id: '35-44', label: '35 – 44', age: 39 },
  { id: '45-54', label: '45 – 54', age: 49 },
  { id: '55+', label: '55 +', age: 60 },
];

const STEALERS = [
  { id: 'shorts', label: 'TikTok / Reels' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'social', label: 'X / Reddit' },
  { id: 'messages', label: 'Messages' },
  { id: 'games', label: 'Games' },
];

const COMPARE = [
  { id: 'better', label: 'Better' },
  { id: 'same', label: 'The same' },
  { id: 'worse', label: 'Worse' },
] as const;
type CompareAnswer = (typeof COMPARE)[number]['id'];

/** Quiz answer → preset pillar it pre-selects on the pillars screen. */
const WANTS = [
  { id: 'body', label: 'My body', pillar: 'Body', color: Colors.pillarBody },
  { id: 'money', label: 'Money', pillar: 'Finances', color: Colors.pillarMoney },
  { id: 'skill', label: 'A skill', pillar: 'Craft', color: Colors.pillarCraft },
  { id: 'mind', label: 'My mind', pillar: 'Mind', color: Colors.pillarMind },
];

const PRESET_PILLARS = WANTS.map((w) => ({ name: w.pillar, color: w.color }));
const PILLAR_COLORS = [Colors.pillarBody, Colors.pillarMoney, Colors.pillarMind, Colors.pillarCraft];
const MAX_PILLARS = 6;

/** Paywall is UI-only until purchases are wired (RevenueCat, US-047/048). */
const PLANS = [
  { id: 'yearly', title: 'Yearly', price: '$39.99 / year', note: '7-day free trial · $3.33 / month' },
  { id: 'monthly', title: 'Monthly', price: '$7.99 / month', note: 'Cancel anytime' },
] as const;

const LIFE_EXPECTANCY = 80;
const WAKING_HOURS = 16;

type PendingGoal = {
  name: string;
  color: string;
  icon: string;
};

type Profile = {
  ageBracket: string | null;
  phoneHours: number;
  stealer: string | null;
  compare: CompareAnswer | null;
  wants: string[];
};

const EMPTY_PROFILE: Profile = { ageBracket: null, phoneHours: 4, stealer: null, compare: null, wants: [] };

type OnboardingDraftV8 = {
  v: 8;
  screen: ScreenId;
  profile: Profile;
  goals: PendingGoal[];
  actionName: string;
  actionType: ActionType;
  actionMins: number;
  why: string;
  userName: string;
};

// ─── Theme ────────────────────────────────────────────────────────────────────

function themeFor(dark: boolean) {
  return dark
    ? { bg: Surface.focusCanvas, text: Surface.focusText, muted: Surface.focusMuted, faint: Surface.focusFaint, track: 'rgba(255,248,238,0.16)', card: 'rgba(255,248,238,0.06)', cardBorder: 'rgba(255,248,238,0.16)', selected: Surface.focusText, selectedText: Surface.focusCanvas }
    : { bg: Surface.canvas, text: Colors.textPrimary, muted: Colors.textSecondary, faint: Colors.textMuted, track: Surface.rule, card: Surface.surface, cardBorder: Surface.rule, selected: Surface.ink, selectedText: Surface.canvas };
}

const textStyles = (dark: boolean) => {
  const t = themeFor(dark);
  return {
    eyebrow: { color: t.faint, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase' } as TextStyle,
    hero: { color: t.text, fontFamily: FontFamily.display, fontSize: 64, lineHeight: 66, letterSpacing: -1 } as TextStyle,
    title: { color: t.text, fontFamily: FontFamily.display, fontSize: 36, lineHeight: 42 } as TextStyle,
    lead: { color: t.text, fontFamily: FontFamily.body, fontSize: 21, lineHeight: 30 } as TextStyle,
    body: { color: t.muted, fontFamily: FontFamily.body, fontSize: 19, lineHeight: 27 } as TextStyle,
    source: { color: t.faint, fontFamily: FontFamily.mono, fontSize: 11, lineHeight: 16 } as TextStyle,
  };
};

// ─── Shared pieces ────────────────────────────────────────────────────────────

function EmberGlow() {
  return (
    <Svg pointerEvents="none" width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
      <Defs>
        <RadialGradient id="emberLow" cx="78%" cy="100%" rx="85%" ry="55%">
          <Stop offset="0%" stopColor="#D65A31" stopOpacity="0.42" />
          <Stop offset="55%" stopColor="#D65A31" stopOpacity="0.12" />
          <Stop offset="100%" stopColor="#D65A31" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="emberHigh" cx="90%" cy="8%" rx="60%" ry="40%">
          <Stop offset="0%" stopColor="#D65A31" stopOpacity="0.16" />
          <Stop offset="100%" stopColor="#D65A31" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#emberLow)" />
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#emberHigh)" />
    </Svg>
  );
}

type ShellProps = {
  dark: boolean;
  progress: number;
  onBack?: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
  hideNext?: boolean;
  scroll?: boolean;
  anim: { opacity: Animated.Value; transform: { translateX: Animated.Value }[] };
  children: ReactNode;
};

function StoryShell({ dark, progress, onBack, onNext, nextDisabled, hideNext, scroll, anim, children }: ShellProps) {
  const t = themeFor(dark);
  const body = (
    <Animated.View style={[{ flex: 1 }, anim]}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: 24 }}>{children}</View>
      )}
    </Animated.View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      {dark ? <EmberGlow /> : null}
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingTop: 8, height: 44 }}>
          {onBack ? (
            <Pressable onPress={onBack} hitSlop={14} accessibilityLabel="Back">
              <Ionicons name="arrow-back" size={22} color={t.muted} />
            </Pressable>
          ) : (
            <View style={{ width: 22 }} />
          )}
          <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: t.track, overflow: 'hidden' }}>
            <View style={{ width: `${Math.round(progress * 100)}%`, height: 3, borderRadius: 2, backgroundColor: t.text }} />
          </View>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {body}
          {!hideNext ? (
            <View style={{ alignItems: 'flex-end', paddingHorizontal: 24, paddingBottom: 14, paddingTop: 6 }}>
              <Pressable
                onPress={onNext}
                disabled={nextDisabled}
                accessibilityRole="button"
                accessibilityLabel="Next"
                style={({ pressed }) => ({
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: dark ? 'rgba(255,248,238,0.14)' : Surface.ink,
                  borderWidth: dark ? 1 : 0,
                  borderColor: 'rgba(255,248,238,0.38)',
                  opacity: nextDisabled ? 0.35 : pressed ? 0.8 : 1,
                })}
              >
                <Ionicons name="arrow-forward" size={24} color={dark ? Surface.focusText : Surface.surface} />
              </Pressable>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

type Segment = { text: string; style: TextStyle };

/**
 * Types segments one character at a time with keyboard-style haptic ticks.
 * Untyped text is rendered transparent so the layout never jumps.
 */
function TypeSequence({
  segments,
  reduceMotion,
  onComplete,
  speed = 28,
  gap = 16,
}: {
  segments: Segment[];
  reduceMotion: boolean;
  onComplete?: () => void;
  speed?: number;
  gap?: number;
}) {
  const flat = segments.map((s) => s.text).join('');
  const [count, setCount] = useState(reduceMotion ? flat.length : 0);
  // Parent passes inline callbacks; keep them in a ref so re-renders don't restart typing.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (reduceMotion) {
      setCount(flat.length);
      onCompleteRef.current?.();
      return;
    }
    let i = 0;
    let lastTickAt = 0;
    setCount(0);
    const id = setInterval(() => {
      i += 1;
      setCount(i);
      // Keyboard-like tick per letter; throttled so fast typing reads as clicks, not a buzz.
      const ch = flat[i - 1];
      const now = Date.now();
      if (ch && ch.trim() && now - lastTickAt >= 45) {
        lastTickAt = now;
        hapticTick();
      }
      if (i >= flat.length) {
        clearInterval(id);
        onCompleteRef.current?.();
      }
    }, speed);
    return () => clearInterval(id);
  }, [flat, reduceMotion, speed]);

  let remaining = count;
  return (
    <View style={{ gap }}>
      {segments.map((s, idx) => {
        const shown = Math.max(0, Math.min(s.text.length, remaining));
        remaining -= s.text.length;
        return (
          <Text key={idx} style={s.style}>
            {s.text.slice(0, shown)}
            <Text style={{ color: 'transparent' }}>{s.text.slice(shown)}</Text>
          </Text>
        );
      })}
    </View>
  );
}

function OptionList({
  options,
  selected,
  onSelect,
  dark,
}: {
  options: { id: string; label: string }[];
  selected: string[];
  onSelect: (id: string) => void;
  dark: boolean;
}) {
  const t = themeFor(dark);
  return (
    <View style={{ gap: 10 }}>
      {options.map((o) => {
        const on = selected.includes(o.id);
        return (
          <Pressable
            key={o.id}
            onPress={() => {
              hapticLight();
              onSelect(o.id);
            }}
            style={({ pressed }) => ({
              paddingVertical: 17,
              paddingHorizontal: 20,
              borderRadius: Radius.lg,
              borderWidth: 1,
              borderColor: on ? t.selected : t.cardBorder,
              backgroundColor: on ? t.selected : t.card,
              opacity: pressed ? 0.85 : 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            })}
          >
            <Text style={{ color: on ? t.selectedText : t.text, fontFamily: FontFamily.bodySemiBold, fontSize: 18 }}>{o.label}</Text>
            {on ? <Ionicons name="checkmark" size={20} color={t.selectedText} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Ascension-style drag dial: 270° tick arc, value in the center. */
function Dial({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const SIZE = 270;
  const C = SIZE / 2;
  const R = 112;
  const TICKS = 54;
  const START = 135;
  const SWEEP = 270;
  const originRef = useRef({ x: 0, y: 0 });
  const viewRef = useRef<View>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const measure = () => {
    viewRef.current?.measureInWindow((x, y) => {
      originRef.current = { x: x + C, y: y + C };
    });
  };

  const setFromPoint = (pageX: number, pageY: number) => {
    const dx = pageX - originRef.current.x;
    const dy = pageY - originRef.current.y;
    let a = (Math.atan2(dy, dx) * 180) / Math.PI; // -180..180, 0 = east, clockwise positive
    if (a < 0) a += 360;
    if (a < START) a += 360; // 135..495
    if (a > START + SWEEP) a = a < START + SWEEP + 45 ? START + SWEEP : START; // bottom gap → nearest end
    const raw = min + ((a - START) / SWEEP) * (max - min);
    const next = Math.min(max, Math.max(min, Math.round(raw / step) * step));
    if (next !== valueRef.current) {
      hapticTick();
      onChange(next);
    }
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          measure();
          setFromPoint(e.nativeEvent.pageX, e.nativeEvent.pageY);
        },
        onPanResponderMove: (e) => setFromPoint(e.nativeEvent.pageX, e.nativeEvent.pageY),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [min, max, step]
  );

  const frac = (value - min) / (max - min);
  const knobAngle = ((START + frac * SWEEP) * Math.PI) / 180;
  const ticks = Array.from({ length: TICKS }, (_, i) => {
    const f = i / (TICKS - 1);
    const ang = ((START + f * SWEEP) * Math.PI) / 180;
    const inner = R - 14;
    return {
      x1: C + inner * Math.cos(ang),
      y1: C + inner * Math.sin(ang),
      x2: C + R * Math.cos(ang),
      y2: C + R * Math.sin(ang),
      on: f <= frac + 1e-6,
    };
  });

  return (
    <View ref={viewRef} onLayout={measure} style={{ width: SIZE, height: SIZE, alignSelf: 'center' }} {...responder.panHandlers}>
      <Svg width={SIZE} height={SIZE} pointerEvents="none">
        {ticks.map((tk, i) => (
          <Line
            key={i}
            x1={tk.x1}
            y1={tk.y1}
            x2={tk.x2}
            y2={tk.y2}
            stroke={tk.on ? Surface.focusText : 'rgba(255,248,238,0.22)'}
            strokeWidth={3}
            strokeLinecap="round"
          />
        ))}
        <Circle cx={C + R * Math.cos(knobAngle)} cy={C + R * Math.sin(knobAngle)} r={14} fill={Surface.focusText} />
      </Svg>
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: Surface.focusText, fontFamily: FontFamily.display, fontSize: 64, lineHeight: 68 }}>{value % 1 === 0 ? value : value.toFixed(1)}</Text>
        <Text style={{ color: Surface.focusMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 10, letterSpacing: 1.4 }}>
          {value === max ? `${max}+ HOURS A DAY` : 'HOURS A DAY'}
        </Text>
      </View>
    </View>
  );
}

/** Press-and-hold to commit: fills over ~1.5s with rising haptics. */
function HoldButton({ label, onComplete }: { label: string; onComplete: () => void }) {
  const fill = useRef(new Animated.Value(0)).current;
  const doneRef = useRef(false);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTicks = () => {
    if (tickTimer.current) clearInterval(tickTimer.current);
    tickTimer.current = null;
  };

  const start = () => {
    if (doneRef.current) return;
    hapticLight();
    tickTimer.current = setInterval(hapticTick, 120);
    Animated.timing(fill, { toValue: 1, duration: 1500, useNativeDriver: false }).start(({ finished }) => {
      stopTicks();
      if (finished && !doneRef.current) {
        doneRef.current = true;
        hapticSuccess();
        onComplete();
      }
    });
  };

  const cancel = () => {
    stopTicks();
    if (doneRef.current) return;
    Animated.timing(fill, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  useEffect(() => stopTicks, []);

  return (
    <Pressable onPressIn={start} onPressOut={cancel} accessibilityRole="button" accessibilityLabel={label}>
      <View style={{ height: 62, borderRadius: Radius.full, overflow: 'hidden', borderWidth: 1.5, borderColor: Surface.ink, backgroundColor: Surface.surface, justifyContent: 'center' }}>
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            backgroundColor: Surface.ink,
            width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }}
        />
        <Text style={{ textAlign: 'center', color: Colors.textPrimary, fontFamily: FontFamily.monoSemiBold, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase' }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatHoursShort(h: number): string {
  if (h <= 0) return '0 hours';
  if (h < 1) return `${Math.round(h * 60)} minutes`;
  return h === 1 ? '1 hour' : `${h % 1 === 0 ? h : h.toFixed(1)} hours`;
}

function nextYearMonth(): string {
  return new Date().toLocaleDateString('en-US', { month: 'long' });
}

function applyDraft(
  raw: unknown,
  set: {
    step: (n: number) => void;
    profile: (p: Profile) => void;
    goals: (g: PendingGoal[]) => void;
    actionName: (s: string) => void;
    actionType: (t: ActionType) => void;
    actionMins: (n: number) => void;
    why: (s: string) => void;
    userName: (s: string) => void;
  }
) {
  if (!raw || typeof raw !== 'object') return;
  const d = raw as Partial<OnboardingDraftV8> & { v?: number };
  // Older drafts (v1–v7) used a different screen order: keep their answers, restart the story.
  if (d.v === 8 && typeof d.screen === 'string') {
    const idx = FLOW.indexOf(d.screen as ScreenId);
    // Never resume mid-"calculating" — jump to its result.
    if (idx >= 0) set.step(FLOW[idx] === 'calculating' ? idx + 1 : idx);
    if (d.profile && typeof d.profile === 'object') set.profile({ ...EMPTY_PROFILE, ...d.profile });
  }
  if (Array.isArray(d.goals)) {
    set.goals(
      d.goals
        .filter((g) => g && typeof g.name === 'string' && g.name.trim())
        .map((g) => ({ name: g.name.slice(0, 30), color: typeof g.color === 'string' ? g.color : Colors.pillarBody, icon: typeof g.icon === 'string' ? g.icon : '' }))
    );
  }
  if (typeof d.actionName === 'string') set.actionName(d.actionName.slice(0, 30));
  if (d.actionType === 'habit' || d.actionType === 'session') set.actionType(d.actionType);
  if (typeof d.actionMins === 'number' && d.actionMins > 0) set.actionMins(d.actionMins);
  if (typeof d.why === 'string') set.why(d.why.slice(0, 140));
  if (typeof d.userName === 'string') set.userName(d.userName.slice(0, 30));
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const screen: ScreenId = FLOW[step];
  const dark = step < FIRST_LIGHT_STEP;
  const ts = textStyles(dark);
  const [reduceMotion, setReduceMotion] = useState(false);

  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [userName, setUserName] = useState('');
  const [goals, setGoals] = useState<PendingGoal[]>([]);
  const [customPillar, setCustomPillar] = useState('');
  const [actionName, setActionName] = useState('');
  const [actionType, setActionType] = useState<ActionType>('session');
  const [actionMins, setActionMins] = useState(45);
  const [useCustomMins, setUseCustomMins] = useState(false);
  const [customMinsStr, setCustomMinsStr] = useState('45');
  const [why, setWhy] = useState('');
  const [plan, setPlan] = useState<(typeof PLANS)[number]['id']>('yearly');
  const [draftReady, setDraftReady] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // Screen-local animation state
  const [calcDone, setCalcDone] = useState(0);
  const [verdictCount, setVerdictCount] = useState(0);
  const [modelRows, setModelRows] = useState(0);

  // ── Step transition animation ──────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateAnim = useRef(new Animated.Value(0)).current;
  const dirRef = useRef<1 | -1>(1);
  const stepAnim = { opacity: fadeAnim, transform: [{ translateX: translateAnim }] };

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((enabled) => {
        if (enabled !== undefined) setReduceMotion(enabled);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    translateAnim.setValue(dirRef.current * 28);
    fadeAnim.setValue(0);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.timing(translateAnim, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const goToStep = useCallback(
    (n: number) => {
      const target = Math.max(0, Math.min(FLOW.length - 1, n));
      dirRef.current = target > step ? 1 : -1;
      if (target > step) hapticMedium();
      else hapticLight();
      // Entering the pillars screen for the first time: pre-select what they said they'd build.
      if (FLOW[target] === 'pillars' && goals.length === 0 && profile.wants.length) {
        setGoals(
          WANTS.filter((w) => profile.wants.includes(w.id)).map((w) => ({ name: w.pillar, color: w.color, icon: '' }))
        );
      }
      setStep(target);
    },
    [step, goals.length, profile.wants]
  );
  const next = useCallback(() => goToStep(step + 1), [goToStep, step]);
  const back = useCallback(() => {
    let prev = step - 1;
    if (FLOW[prev] === 'calculating') prev -= 1;
    goToStep(prev);
  }, [goToStep, step]);
  /** Single-choice answers advance on their own after a beat. */
  const advanceSoon = useCallback(() => {
    setTimeout(() => goToStep(step + 1), reduceMotion ? 0 : 260);
  }, [goToStep, step, reduceMotion]);

  // ── Draft persistence ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ONBOARDING_DRAFT_STORAGE_KEY);
        if (raw && !cancelled) {
          applyDraft(JSON.parse(raw), {
            step: setStep,
            profile: setProfile,
            goals: setGoals,
            actionName: setActionName,
            actionType: setActionType,
            actionMins: setActionMins,
            why: setWhy,
            userName: setUserName,
          });
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
    const payload: OnboardingDraftV8 = { v: 8, screen, profile, goals, actionName, actionType, actionMins, why, userName };
    const t = setTimeout(() => {
      void AsyncStorage.setItem(ONBOARDING_DRAFT_STORAGE_KEY, JSON.stringify(payload));
    }, 350);
    return () => clearTimeout(t);
  }, [draftReady, screen, profile, goals, actionName, actionType, actionMins, why, userName]);

  // ── Derived numbers ────────────────────────────────────────────────────────
  const age = AGE_BRACKETS.find((b) => b.id === profile.ageBracket)?.age ?? 29;
  const yearsLost = (Math.max(0, LIFE_EXPECTANCY - age) * profile.phoneHours) / WAKING_HOURS;
  const verdictIsMonths = yearsLost > 0 && yearsLost < 1;
  const verdictTarget = verdictIsMonths ? Math.max(1, Math.round(yearsLost * 12)) : Math.round(yearsLost);
  const stealerLabel = STEALERS.find((s) => s.id === profile.stealer)?.label ?? 'the feed';
  const cleanGoals = useMemo(() => goals.filter((g) => g.name.trim().length > 0), [goals]);
  const primaryPillar = cleanGoals[0]?.name ?? WANTS.find((w) => profile.wants.includes(w.id))?.pillar ?? 'Body';
  const primaryColor = cleanGoals[0]?.color ?? Colors.pillarBody;
  const reclaimedPerDay = profile.phoneHours >= 1 ? 1 : profile.phoneHours > 0 ? profile.phoneHours : actionMins / 60;
  const reclaimedPerYear = Math.round(reclaimedPerDay * 365);
  const firstName = userName.trim() || 'I';

  // ── Screen-local timers ────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'calculating') return;
    setCalcDone(0);
    const timers = [900, 1900, 2900].map((ms, i) =>
      setTimeout(() => {
        hapticLight();
        setCalcDone(i + 1);
      }, reduceMotion ? 0 : ms)
    );
    timers.push(setTimeout(() => goToStep(FLOW.indexOf('verdict')), reduceMotion ? 50 : 3700));
    return () => timers.forEach(clearTimeout);
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (screen !== 'verdict') return;
    if (reduceMotion || verdictTarget === 0) {
      setVerdictCount(verdictTarget);
      return;
    }
    setVerdictCount(0);
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setVerdictCount(n);
      hapticTick();
      if (n >= verdictTarget) {
        clearInterval(id);
        hapticMedium();
      }
    }, Math.max(35, Math.min(90, 1400 / verdictTarget)));
    return () => clearInterval(id);
  }, [screen, verdictTarget, reduceMotion]);

  useEffect(() => {
    if (screen !== 'model') return;
    setModelRows(reduceMotion ? 3 : 0);
    if (reduceMotion) return;
    const timers = [300, 1000, 1700].map((ms, i) =>
      setTimeout(() => {
        hapticLight();
        setModelRows(i + 1);
      }, ms)
    );
    return () => timers.forEach(clearTimeout);
  }, [screen, reduceMotion]);

  // ── Pillars ────────────────────────────────────────────────────────────────
  const togglePillar = (name: string, color: string) => {
    setGoals((prev) => {
      if (prev.some((g) => g.name === name)) return prev.filter((g) => g.name !== name);
      if (prev.length >= MAX_PILLARS) return prev;
      return [...prev, { name, color, icon: '' }];
    });
  };

  const addCustomPillar = () => {
    const name = customPillar.trim().slice(0, 30);
    if (!name) return;
    setGoals((prev) => {
      if (prev.length >= MAX_PILLARS || prev.some((g) => g.name.toLowerCase() === name.toLowerCase())) return prev;
      const used = new Set(prev.map((g) => g.color));
      const color = PILLAR_COLORS.find((c) => !used.has(c)) ?? PILLAR_COLORS[prev.length % PILLAR_COLORS.length];
      return [...prev, { name, color, icon: '' }];
    });
    hapticLight();
    setCustomPillar('');
  };

  // ── Finish ─────────────────────────────────────────────────────────────────
  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    if (userName.trim()) setSetting('user_name', userName.trim());
    setSetting('onboarding_profile', JSON.stringify(profile));

    const existingGoals = await api.getGoals();
    // Replaying onboarding (Settings) must never duplicate an existing setup.
    if (existingGoals.length === 0) {
      for (let i = 0; i < cleanGoals.length; i++) {
        const g = cleanGoals[i];
        const savedGoal = await api.addGoal({
          name: g.name.trim(),
          color: g.color,
          icon: g.icon || resolvePillarIconKey('', g.name),
          sort_order: i,
          why_statement: i === 0 ? why.slice(0, 140) : '',
        });
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
    }
    setSetting('hasCompletedOnboarding', '1');
    await AsyncStorage.removeItem(ONBOARDING_DRAFT_STORAGE_KEY);
    router.replace('/(tabs)/today');
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const progress = step / (FLOW.length - 1);
  const shell = (children: ReactNode, opts: Partial<Omit<ShellProps, 'dark' | 'progress' | 'anim' | 'children'>> = {}) => (
    <StoryShell dark={dark} progress={progress} onBack={back} onNext={next} anim={stepAnim} {...opts}>
      {children}
    </StoryShell>
  );
  const centered = (children: ReactNode) => <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 24 }}>{children}</View>;
  const t = themeFor(dark);

  switch (screen) {
    // ── Splash ──
    case 'splash':
      return (
        <Pressable onPress={next} style={{ flex: 1, backgroundColor: Surface.focusCanvas }}>
          <Stack.Screen options={{ headerShown: false }} />
          <StatusBar barStyle="light-content" />
          <EmberGlow />
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
            <Animated.View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center' }, stepAnim]}>
              <Text style={{ fontFamily: FontFamily.display, fontSize: 72, lineHeight: 76, color: Surface.focusText, letterSpacing: -1, marginBottom: 24 }}>
                Intentional.
              </Text>
              <Text style={{ fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 2, color: Surface.focusMuted, textTransform: 'uppercase' }}>
                Tap to continue
              </Text>
            </Animated.View>
          </SafeAreaView>
        </Pressable>
      );

    // ── Act 1 · Wake up ──
    case 'affirm':
      return shell(
        centered(
          <TypeSequence
            reduceMotion={reduceMotion}
            segments={[
              { text: 'You noticed. Most people never do.', style: { ...ts.lead, fontSize: 26, lineHeight: 34 } },
              { text: 'They scroll through their twenties, wake up at forty, and wonder where it went.', style: ts.body },
            ]}
          />
        ),
        { onBack: undefined }
      );

    case 'statAttention':
      return shell(
        centered(
          <>
            <Text style={[ts.hero, { marginBottom: 18 }]}>47 seconds.</Text>
            <TypeSequence
              reduceMotion={reduceMotion}
              segments={[
                { text: "That's how long you can hold your attention on a screen before switching. It used to be two and a half minutes.", style: ts.lead },
              ]}
            />
            <Text style={[ts.source, { marginTop: 22 }]}>Source: Gloria Mark, UC Irvine</Text>
          </>
        )
      );

    case 'statPhone':
      return shell(
        centered(
          <>
            <Text style={[ts.hero, { marginBottom: 18 }]}>5 hours a day.</Text>
            <TypeSequence
              reduceMotion={reduceMotion}
              segments={[
                { text: 'The time people in the top mobile markets spend on their phone. Every single day.', style: ts.lead },
                { text: 'Not working. Not resting. Not living. Scrolling.', style: ts.body },
              ]}
            />
            <Text style={[ts.source, { marginTop: 22 }]}>Source: data.ai, State of Mobile</Text>
          </>
        )
      );

    case 'brainrot':
      return shell(
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={[ts.eyebrow, { marginBottom: 12 }]}>There's a name for it</Text>
          <Text style={[ts.hero, { fontFamily: FontFamily.displayItalic, marginBottom: 6 }]}>Brain rot.</Text>
          <Text style={[ts.source, { marginBottom: 18 }]}>Oxford Word of the Year, 2024</Text>
          <TypeSequence
            reduceMotion={reduceMotion}
            segments={[
              { text: "The deterioration of a person's mental state from overconsuming trivial online content.", style: ts.lead },
              { text: "It's happening to your focus. One swipe at a time.", style: ts.body },
            ]}
          />
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 30 }}>
            {[
              { title: 'Rotting', icon: 'phone-portrait-outline' as const, items: ['Restless', 'Foggy', 'Same as last year'], good: false },
              { title: 'Sharp', icon: 'flash-outline' as const, items: ['Focused', 'Building', 'Visibly better'], good: true },
            ].map((col) => (
              <View key={col.title} style={{ flex: 1, padding: 16, borderRadius: Radius.lg, borderWidth: 1, borderColor: col.good ? 'rgba(255,248,238,0.4)' : t.cardBorder, backgroundColor: t.card }}>
                <Ionicons name={col.icon} size={26} color={col.good ? Surface.focusText : Surface.focusFaint} />
                <Text style={[ts.eyebrow, { marginTop: 12, marginBottom: 10, color: col.good ? Surface.focusText : Surface.focusFaint }]}>{col.title}</Text>
                {col.items.map((it) => (
                  <Text key={it} style={{ color: col.good ? Surface.focusText : Surface.focusMuted, fontFamily: FontFamily.body, fontSize: 16, lineHeight: 26 }}>
                    {col.good ? '✓' : '✗'} {it}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </View>,
        { scroll: true }
      );

    case 'notYourFault':
      return shell(
        centered(
          <>
            <Text style={[ts.title, { marginBottom: 18 }]}>It's not your fault.</Text>
            <TypeSequence
              reduceMotion={reduceMotion}
              segments={[
                { text: 'The feed was built by thousands of engineers to keep you there. It runs on the same reward loop as a slot machine.', style: ts.lead },
                { text: 'You were never supposed to win against it with willpower.', style: ts.body },
              ]}
            />
          </>
        )
      );

    // ── Act 2 · Diagnose ──
    case 'name':
      return shell(
        centered(
          <>
            <TypeSequence
              reduceMotion={reduceMotion}
              segments={[
                { text: "Let's look closer at your days.", style: ts.lead },
                { text: "First, what's your name?", style: { ...ts.title, fontSize: 32 } },
              ]}
            />
            <TextInput
              value={userName}
              onChangeText={(v) => setUserName(v.slice(0, 30))}
              placeholder="Your name"
              placeholderTextColor={Surface.focusFaint}
              maxLength={30}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => {
                if (userName.trim()) next();
              }}
              style={{
                marginTop: 28,
                color: Surface.focusText,
                fontFamily: FontFamily.bodySemiBold,
                fontSize: 26,
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(255,248,238,0.35)',
              }}
            />
          </>
        ),
        { nextDisabled: !userName.trim() }
      );

    case 'age':
      return shell(
        <View style={{ flex: 1, paddingTop: 28 }}>
          <Text style={[ts.eyebrow, { marginBottom: 10 }]}>Question 1</Text>
          <Text style={[ts.title, { marginBottom: 26 }]}>How old are you?</Text>
          <OptionList
            dark
            options={AGE_BRACKETS}
            selected={profile.ageBracket ? [profile.ageBracket] : []}
            onSelect={(id) => {
              setProfile((p) => ({ ...p, ageBracket: id }));
              advanceSoon();
            }}
          />
        </View>,
        { scroll: true, nextDisabled: !profile.ageBracket }
      );

    case 'hours':
      return shell(
        <View style={{ flex: 1, paddingTop: 28 }}>
          <Text style={[ts.eyebrow, { marginBottom: 10 }]}>Question 2</Text>
          <Text style={[ts.title, { marginBottom: 8 }]}>How many hours a day are you on your phone?</Text>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Dial value={profile.phoneHours} min={0} max={12} step={0.5} onChange={(v) => setProfile((p) => ({ ...p, phoneHours: v }))} />
            <Text style={[ts.source, { textAlign: 'center', marginTop: 18, fontSize: 13 }]}>Drag the dial. Check Screen Time if you're not sure. Be honest.</Text>
          </View>
        </View>
      );

    case 'stealer':
      return shell(
        <View style={{ flex: 1, paddingTop: 28 }}>
          <Text style={[ts.eyebrow, { marginBottom: 10 }]}>Question 3</Text>
          <Text style={[ts.title, { marginBottom: 26 }]}>What steals your time most?</Text>
          <OptionList
            dark
            options={STEALERS}
            selected={profile.stealer ? [profile.stealer] : []}
            onSelect={(id) => {
              setProfile((p) => ({ ...p, stealer: id }));
              advanceSoon();
            }}
          />
        </View>,
        { scroll: true, nextDisabled: !profile.stealer }
      );

    case 'compare':
      return shell(
        <View style={{ flex: 1, paddingTop: 28 }}>
          <Text style={[ts.eyebrow, { marginBottom: 10 }]}>Question 4</Text>
          <Text style={[ts.title, { marginBottom: 26 }]}>Compared to a year ago, you are…</Text>
          <OptionList
            dark
            options={[...COMPARE]}
            selected={profile.compare ? [profile.compare] : []}
            onSelect={(id) => {
              setProfile((p) => ({ ...p, compare: id as CompareAnswer }));
              advanceSoon();
            }}
          />
        </View>,
        { scroll: true, nextDisabled: !profile.compare }
      );

    case 'wants':
      return shell(
        <View style={{ flex: 1, paddingTop: 28 }}>
          <Text style={[ts.eyebrow, { marginBottom: 10 }]}>Question 5</Text>
          <Text style={[ts.title, { marginBottom: 8 }]}>What would you build if you got that time back?</Text>
          <Text style={[ts.body, { fontSize: 16, marginBottom: 22 }]}>Pick as many as you want.</Text>
          <OptionList
            dark
            options={WANTS}
            selected={profile.wants}
            onSelect={(id) =>
              setProfile((p) => ({ ...p, wants: p.wants.includes(id) ? p.wants.filter((x) => x !== id) : [...p.wants, id] }))
            }
          />
        </View>,
        { scroll: true, nextDisabled: profile.wants.length === 0 }
      );

    case 'calculating':
      return shell(
        centered(
          <>
            <Text style={[ts.title, { marginBottom: 28 }]}>Reading your answers…</Text>
            {['Reading your habits', 'Projecting your year', 'Projecting your life'].map((line, i) => {
              const done = calcDone > i;
              return (
                <View key={line} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, opacity: calcDone >= i ? 1 : 0.35 }}>
                  <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={done ? Surface.focusText : Surface.focusFaint} />
                  <Text style={[ts.lead, { fontSize: 19 }]}>{line}</Text>
                </View>
              );
            })}
          </>
        ),
        { hideNext: true, onBack: undefined }
      );

    // ── Act 3 · Verdict ──
    case 'verdict':
      return shell(
        centered(
          profile.phoneHours === 0 ? (
            <>
              <Text style={[ts.hero, { marginBottom: 18 }]}>Almost none.</Text>
              <TypeSequence
                reduceMotion={reduceMotion}
                segments={[
                  { text: "Your phone isn't taking your life. Rare.", style: ts.lead },
                  { text: 'So where do the hours actually go? Without a ledger, nobody really knows.', style: ts.body },
                ]}
              />
            </>
          ) : (
            <>
              <Text style={[ts.hero, { fontSize: 88, lineHeight: 90, marginBottom: 14 }]}>
                {verdictCount} {verdictIsMonths ? (verdictTarget === 1 ? 'month.' : 'months.') : verdictTarget === 1 ? 'year.' : 'years.'}
              </Text>
              <TypeSequence
                reduceMotion={reduceMotion}
                segments={[
                  { text: "At this rate, that's how much of your remaining waking life goes to your phone.", style: ts.lead },
                  { text: "Not your goals. Not your people. A feed you won't remember.", style: ts.body },
                ]}
              />
              <Text style={[ts.source, { marginTop: 24 }]}>
                Based on {formatHoursShort(profile.phoneHours)} a day, {WAKING_HOURS} waking hours a day and a life expectancy of {LIFE_EXPECTANCY}.
              </Text>
            </>
          )
        )
      );

    case 'stagnation': {
      const lines: Segment[] =
        profile.compare === 'better'
          ? [
              { text: "You said you're better than a year ago. Good.", style: { ...ts.title, fontSize: 30 } },
              { text: `Now imagine the version of you that got ${formatHoursShort(profile.phoneHours)} a day back from ${stealerLabel}.`, style: ts.lead },
              { text: 'That person is one decision away.', style: ts.body },
            ]
          : profile.compare === 'worse'
            ? [
                { text: "You said you're worse than a year ago.", style: { ...ts.title, fontSize: 30 } },
                { text: "That's not a character flaw. It's what happens when the feed gets your best hours.", style: ts.lead },
                { text: "Another year like that is a choice. You just haven't made the other one yet.", style: ts.body },
              ]
            : [
                { text: "You said you're the same as a year ago.", style: { ...ts.title, fontSize: 30 } },
                { text: 'Same body. Same bank account. Same skills.', style: ts.lead },
                { text: "Another year like that is a choice. You just haven't made the other one yet.", style: ts.body },
              ];
      return shell(centered(<TypeSequence reduceMotion={reduceMotion} segments={lines} />));
    }

    // ── Act 4 · The way out ──
    case 'fixIt':
      return shell(
        centered(
          <TypeSequence
            reduceMotion={reduceMotion}
            segments={[
              { text: 'We can help you fix it.', style: { ...ts.hero, fontSize: 52, lineHeight: 56 } },
              { text: 'Not with more willpower. With a system.', style: ts.lead },
            ]}
          />
        )
      );

    case 'believe0':
    case 'believe1':
    case 'believe2':
    case 'believe3':
    case 'believe4': {
      const idx = Number(screen.slice(-1));
      return shell(
        <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 12 }}>
          <Text style={[ts.eyebrow, { marginBottom: 18 }]}>We believe</Text>
          {BELIEFS.slice(0, idx).map((b) => (
            <Text key={b} style={{ color: Colors.textMuted, fontFamily: FontFamily.body, fontSize: 15, lineHeight: 21, marginBottom: 12 }}>
              {b}
            </Text>
          ))}
          <View style={{ marginTop: idx > 0 ? 10 : 0 }}>
            <TypeSequence reduceMotion={reduceMotion} segments={[{ text: BELIEFS[idx], style: { ...ts.title, fontSize: 28, lineHeight: 35 } }]} />
          </View>
        </View>,
        { scroll: true }
      );
    }

    case 'intentional':
      return shell(
        centered(
          <TypeSequence
            reduceMotion={reduceMotion}
            segments={[
              { text: "That's what Intentional is.", style: { ...ts.hero, fontSize: 48, lineHeight: 52 } },
              { text: 'A ledger for your life. Every hour, accounted for.', style: ts.lead },
            ]}
          />
        )
      );

    case 'proof':
      return shell(
        centered(
          <>
            <Text style={[ts.eyebrow, { marginBottom: 12 }]}>This isn't just philosophy. There's a name for it</Text>
            <Text style={[ts.hero, { fontFamily: FontFamily.displayItalic, fontSize: 46, lineHeight: 50, marginBottom: 18 }]}>Implementation intentions.</Text>
            <TypeSequence
              reduceMotion={reduceMotion}
              segments={[
                { text: "People who decide exactly what they'll do and when are 2–3× more likely to follow through.", style: ts.lead },
                { text: '91% vs 38% in one study.', style: { ...ts.title, fontSize: 30 } },
              ]}
            />
            <Text style={[ts.source, { marginTop: 22 }]}>Source: Milne, Orbell & Sheeran, 2002</Text>
          </>
        )
      );

    case 'model': {
      const rows = [
        { label: 'Pillar', value: primaryPillar, icon: 'flag-outline' as const },
        { label: 'Daily action', value: '30 min, every day', icon: 'repeat-outline' as const },
        { label: 'Hours reclaimed', value: '3.5 hours this week', icon: 'time-outline' as const },
      ];
      return shell(
        centered(
          <>
            <Text style={[ts.title, { marginBottom: 26 }]}>How it works.</Text>
            {rows.map((r, i) => (
              <View key={r.label} style={{ opacity: modelRows > i ? 1 : 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: Radius.lg, backgroundColor: Surface.surface, borderWidth: 1, borderColor: i === 0 ? goalBorderColor(primaryColor) : Surface.rule }}>
                  <Ionicons name={r.icon} size={22} color={i === 0 ? primaryColor : Colors.textSecondary} />
                  <View>
                    <Text style={ts.eyebrow}>{r.label}</Text>
                    <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 19, marginTop: 2 }}>{r.value}</Text>
                  </View>
                </View>
                {i < rows.length - 1 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 6 }}>
                    <Ionicons name="arrow-down" size={18} color={Colors.textMuted} />
                  </View>
                ) : null}
              </View>
            ))}
            <Text style={[ts.body, { marginTop: 22, opacity: modelRows >= 3 ? 1 : 0 }]}>Every hour you take back from the feed goes to something you chose.</Text>
          </>
        )
      );
    }

    case 'letsBuild':
      return shell(
        centered(
          <TypeSequence
            reduceMotion={reduceMotion}
            segments={[
              { text: "Let's build yours.", style: { ...ts.hero, fontSize: 52, lineHeight: 56 } },
              { text: 'It takes 60 seconds.', style: ts.lead },
            ]}
          />
        )
      );

    // ── Build ──
    case 'pillars': {
      const customs = goals.filter((g) => !PRESET_PILLARS.some((p) => p.name === g.name));
      const full = goals.length >= MAX_PILLARS;
      return shell(
        <View style={{ flex: 1 }}>
          <Text style={[ts.eyebrow, { marginBottom: 10 }]}>Your pillars</Text>
          <Text style={[ts.title, { marginBottom: 8 }]}>What should your days serve?</Text>
          <Text style={[ts.body, { fontSize: 16, marginBottom: 22 }]}>Pick the areas of life your effort should touch. Missing one? Add your own.</Text>
          <View style={{ gap: 10 }}>
            {[...PRESET_PILLARS, ...customs.map((c) => ({ name: c.name, color: c.color }))].map((p) => {
              const on = goals.some((g) => g.name === p.name);
              return (
                <Pressable
                  key={p.name}
                  onPress={() => {
                    hapticLight();
                    togglePillar(p.name, p.color);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: on ? Surface.ink : Surface.surface,
                    borderWidth: 1.5,
                    borderColor: on ? p.color : Surface.rule,
                    borderRadius: Radius.lg,
                    paddingVertical: 16,
                    paddingHorizontal: 20,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.color }} />
                    <Text style={{ color: on ? Surface.canvas : Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 18 }}>{p.name}</Text>
                  </View>
                  {on ? <Ionicons name="checkmark" size={20} color={Surface.canvas} /> : null}
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 18, opacity: full ? 0.45 : 1 }}>
            <View style={{ flex: 1 }}>
              <EditorialTextInput
                variant="underline"
                placeholder={full ? `Up to ${MAX_PILLARS} pillars` : 'Add your own pillar'}
                value={customPillar}
                onChangeText={(v) => setCustomPillar(v.slice(0, 30))}
                maxLength={30}
                editable={!full}
                returnKeyType="done"
                onSubmitEditing={addCustomPillar}
                style={{ fontSize: 18 }}
              />
            </View>
            <Pressable
              onPress={addCustomPillar}
              disabled={!customPillar.trim() || full}
              accessibilityLabel="Add pillar"
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Surface.ink, alignItems: 'center', justifyContent: 'center', opacity: customPillar.trim() && !full ? 1 : 0.35 }}
            >
              <Ionicons name="add" size={22} color={Surface.surface} />
            </Pressable>
          </View>
        </View>,
        { scroll: true, nextDisabled: cleanGoals.length === 0 }
      );
    }

    case 'action':
      return shell(
        <View style={{ flex: 1 }}>
          <Text style={[ts.eyebrow, { marginBottom: 10 }]}>First action</Text>
          <Text style={[ts.title, { marginBottom: 22 }]}>
            What is one thing {primaryPillar} should receive every day?
          </Text>
          <View style={{ padding: 16, backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.lg }}>
            <Text style={[ts.eyebrow, { marginBottom: 10 }]}>Action name</Text>
            <EditorialTextInput
              variant="underline"
              placeholder="Morning training"
              value={actionName}
              onChangeText={(v) => setActionName(v.slice(0, 30))}
              maxLength={30}
              style={{ fontSize: 18, fontWeight: '700', marginBottom: 18 }}
            />
            <Text style={[ts.eyebrow, { marginBottom: 8 }]}>Type</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
              {(['session', 'habit'] as const).map((ty) => {
                const on = actionType === ty;
                return (
                  <Pressable
                    key={ty}
                    onPress={() => setActionType(ty)}
                    style={{ flex: 1, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: on ? Surface.ink : ghostBorder, backgroundColor: on ? Surface.ink : Surface.surface }}
                  >
                    <Text style={{ fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: on ? Surface.surface : Colors.textSecondary }}>
                      {ty === 'session' ? 'Timed session' : 'Habit'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {actionType === 'session' ? (
              <>
                <Text style={[ts.eyebrow, { marginBottom: 8 }]}>Daily target</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {[25, 45, 90, 'Custom'].map((opt) => {
                    const isCustom = opt === 'Custom';
                    const sel = isCustom ? useCustomMins : !useCustomMins && actionMins === opt;
                    return (
                      <Pressable
                        key={String(opt)}
                        onPress={() => {
                          if (isCustom) {
                            setUseCustomMins(true);
                            setCustomMinsStr(String(actionMins));
                          } else {
                            setUseCustomMins(false);
                            setActionMins(opt as number);
                          }
                        }}
                        style={{ borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1, borderColor: sel ? Surface.ink : ghostBorder, backgroundColor: sel ? Surface.ink : Surface.surface }}
                      >
                        <Text style={{ fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: sel ? Surface.surface : Colors.textSecondary }}>
                          {isCustom ? 'Custom' : `${opt}m`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {useCustomMins ? (
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 14 }}>
                    <EditorialTextInput
                      variant="underline"
                      placeholder="45"
                      value={customMinsStr}
                      onChangeText={(v) => {
                        const digits = v.replace(/\D/g, '').slice(0, 3);
                        setCustomMinsStr(digits);
                        const n = Number(digits);
                        if (n > 0) setActionMins(n);
                      }}
                      keyboardType="number-pad"
                      maxLength={3}
                      autoFocus
                      style={{ width: 72, fontSize: 18, fontWeight: '700', textAlign: 'center' }}
                    />
                    <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 15, paddingBottom: 8 }}>minutes a day</Text>
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        </View>,
        { scroll: true, nextDisabled: !actionName.trim() }
      );

    case 'why':
      return shell(
        <View style={{ flex: 1 }}>
          <Text style={[ts.eyebrow, { marginBottom: 10 }]}>Your why</Text>
          <Text style={[ts.title, { marginBottom: 8 }]}>Why does {primaryPillar} matter to you?</Text>
          <Text style={[ts.body, { fontSize: 16, marginBottom: 20 }]}>One line is enough. You'll see it when the feed calls. Optional.</Text>
          <EditorialTextInput
            variant="contained"
            placeholder="So I'm strong enough to carry my kids at 60."
            value={why}
            onChangeText={(v) => setWhy(v.slice(0, 140))}
            multiline
            maxLength={140}
            textAlignVertical="top"
          />
          <Text style={[ts.source, { textAlign: 'right', marginTop: 6 }]}>{why.length} / 140</Text>
        </View>,
        { scroll: true }
      );

    case 'projection':
      return shell(
        centered(
          <>
            <TypeSequence
              reduceMotion={reduceMotion}
              segments={[{ text: `Just ${formatHoursShort(reclaimedPerDay)} a day back from your phone =`, style: ts.lead }]}
            />
            <Text style={[ts.hero, { color: primaryColor, fontSize: 84, lineHeight: 88, marginTop: 14 }]}>{reclaimedPerYear} hours</Text>
            <Text style={[ts.title, { marginBottom: 18 }]}>a year on {primaryPillar}.</Text>
            <Text style={ts.body}>That's a different person by next {nextYearMonth()}.</Text>
          </>
        )
      );

    // ── Close ──
    case 'commit':
      return shell(
        <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 20 }}>
          <Text style={[ts.eyebrow, { marginBottom: 14 }]}>One last thing</Text>
          <Text style={[ts.title, { fontSize: 30, lineHeight: 38, marginBottom: 34 }]}>
            “{firstName === 'I' ? 'I' : `I, ${firstName},`} am done giving my life to the feed. I'll give my pillars one honest session a day.”
          </Text>
          <HoldButton label="Hold to commit" onComplete={() => goToStep(step + 1)} />
          <Text style={[ts.source, { textAlign: 'center', marginTop: 12 }]}>Press and hold</Text>
        </View>,
        { hideNext: true }
      );

    case 'reveal':
      return shell(
        centered(
          <View style={{ alignItems: 'center' }}>
            <Text style={[ts.eyebrow, { marginBottom: 16 }]}>Your system</Text>
            <Text style={[ts.hero, { color: primaryColor, fontSize: 76, lineHeight: 78, textAlign: 'center' }]}>
              {cleanGoals.length} pillar{cleanGoals.length !== 1 ? 's' : ''}.
            </Text>
            {actionName.trim() ? (
              <Text style={[ts.title, { fontSize: 28, lineHeight: 34, textAlign: 'center', marginTop: 10 }]}>
                One first move:{'\n'}
                <Text style={{ color: primaryColor }}>{actionName.trim()}</Text>
              </Text>
            ) : null}
            {cleanGoals.length > 1 ? (
              <Text style={[ts.eyebrow, { marginTop: 18, textAlign: 'center' }]}>{cleanGoals.map((g) => g.name).join(' · ')}</Text>
            ) : null}
          </View>
        )
      );

    case 'paywall':
      return shell(
        <View style={{ flex: 1 }}>
          <Text style={[ts.hero, { fontSize: 46, lineHeight: 50, marginBottom: 20 }]}>Take your life back.</Text>
          {[
            `Block ${stealerLabel} while you focus`,
            `Reclaim ${formatHoursShort(reclaimedPerDay)} a day = ${reclaimedPerYear} hours a year`,
            'Every minute traced to a pillar',
            'See every hour you won back',
          ].map((b) => (
            <View key={b} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
              <Ionicons name="checkmark-circle" size={22} color={primaryColor} />
              <Text style={[ts.lead, { flex: 1, fontSize: 18, lineHeight: 25 }]}>{b}</Text>
            </View>
          ))}
          <View style={{ gap: 10, marginTop: 14 }}>
            {PLANS.map((p) => {
              const on = plan === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    hapticLight();
                    setPlan(p.id);
                  }}
                  style={{ padding: 16, borderRadius: Radius.lg, borderWidth: on ? 2 : 1, borderColor: on ? Surface.ink : Surface.rule, backgroundColor: Surface.surface }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 18 }}>{p.title}</Text>
                    <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.monoSemiBold, fontSize: 13 }}>{p.price}</Text>
                  </View>
                  <Text style={[ts.source, { marginTop: 4, fontSize: 12 }]}>{p.note}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={() => void finish()}
            disabled={finishing}
            style={({ pressed }) => ({ marginTop: 20, height: 58, borderRadius: Radius.full, backgroundColor: Surface.ink, alignItems: 'center', justifyContent: 'center', opacity: pressed || finishing ? 0.85 : 1 })}
          >
            <Text style={{ color: Surface.surface, fontFamily: FontFamily.monoSemiBold, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase' }}>
              {plan === 'yearly' ? 'Start my free trial' : 'Continue'}
            </Text>
          </Pressable>
          <Pressable onPress={() => void finish()} disabled={finishing} style={{ alignItems: 'center', paddingVertical: 14 }}>
            <Text style={[ts.source, { fontSize: 12 }]}>Not now</Text>
          </Pressable>
        </View>,
        { scroll: true, hideNext: true }
      );
  }
}
