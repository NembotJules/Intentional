/**
 * Onboarding — the story of where your hours go.
 *
 *   Hook        welcome carousel (live app previews) → Flick, your spark, says hi → name
 *   Quiz        goal · what gets in the way · who you are · tried before · did-you-know · age · drifting hours · vs a year ago
 *   Diagnosis   personalizing… → time profile
 *   The fall    oof → days this year → years of life → "do you understand?" → life in dots → stagnation
 *   The way up  good news → N more years of… → "We believe" → why it works → research
 *   Build       pillars → first action → "this week we'll help you" (+ notification ask)
 *   Close       hold to commit → before/after → plans
 *
 * The villain is drift — hours that never go to anything you chose — not any one app.
 * The hero is a pillar: every hour gets a job. Blocking distractions is one tool, not the story.
 * Flick's flame follows the hours: it dims as drifting hours climb, nearly goes out at
 * "years of your life", relights when the hours go to pillars and is lit for good by the hold-to-commit.
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
  Easing,
  AccessibilityInfo,
  ActivityIndicator,
  StatusBar,
  useWindowDimensions,
  type TextStyle,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { resolvePillarIconKey } from '@/components/ui/PillarIcon';
import { Colors, FontFamily } from '@/constants/design';
import { ONBOARDING_DRAFT_STORAGE_KEY } from '@/constants/onboardingDraft';
import { setSetting } from '@/db';
import * as api from '@/db/api';
import type { ActionType } from '@/types';
import { EditorialTextInput } from '@/components/EditorialTextInput';
import { Mascot, type MascotMood } from '@/components/onboarding/Mascot';
import {
  CTA,
  DuskBackground,
  FactCard,
  Hill,
  HoldCircle,
  HoursSlider,
  LifeGrid,
  LoadBar,
  MockFocus,
  MockToday,
  MockWeek,
  OB,
  OptionRows,
  Reveal,
  Rings,
  Sunburst,
  T,
  hoursColor,
  type Option,
} from '@/components/onboarding/parts';
import { requestNotificationPermissions } from '@/services/notifications';
import { hapticMedium, hapticLight, hapticTick } from '@/utils/haptics';

// ─── Flow ─────────────────────────────────────────────────────────────────────

const FLOW = [
  'welcome', 'hello', 'name',
  'goal', 'affects', 'describes', 'tried', 'didYouKnow', 'age', 'hours', 'compare',
  'calculating', 'profile',
  'oof', 'days', 'years', 'understand', 'lifeGrid', 'stagnation',
  'goodNews', 'moreYears', 'believe', 'whyWorks', 'research',
  'pillars', 'action', 'thisWeek',
  'commit', 'loadingPlans', 'beforeAfter', 'plans',
] as const;
type ScreenId = (typeof FLOW)[number];

/** Screens with the back arrow + progress bar. Story beats go full-bleed. */
const CHROME = new Set<ScreenId>([
  'name', 'goal', 'affects', 'describes', 'tried', 'didYouKnow', 'age', 'hours', 'compare',
  'believe', 'whyWorks', 'research', 'pillars', 'action', 'thisWeek',
]);
/** Story beats that move on by themselves (tap or Skip to hurry). */
const AUTO_MS: Partial<Record<ScreenId, number>> = { oof: 3000, days: 3800, understand: 3600 };
/** Never land on these when going back. */
const SKIP_BACK = new Set<ScreenId>(['calculating', 'oof', 'days', 'understand', 'loadingPlans']);
/** Lists that reveal one card at a time: count + gap. */
const STAGGER: Partial<Record<ScreenId, { count: number; gap: number }>> = {
  didYouKnow: { count: 4, gap: 750 },
  believe: { count: 4, gap: 1300 },
  whyWorks: { count: 3, gap: 650 },
  research: { count: 3, gap: 650 },
  thisWeek: { count: 4, gap: 650 },
};

// ─── Copy & data ──────────────────────────────────────────────────────────────

const GOALS: Option[] = [
  { id: 'progress', label: 'Finally make progress on my goals', icon: 'trending-up-outline' },
  { id: 'where', label: 'Know where my hours actually go', icon: 'pie-chart-outline' },
  { id: 'balance', label: 'Give every part of my life its time', icon: 'apps-outline' },
  { id: 'drift', label: 'Stop drifting through my days', icon: 'hourglass-outline' },
  { id: 'focus', label: 'Do deep, focused work', icon: 'locate-outline' },
  { id: 'curious', label: 'Just curious', icon: 'help-circle-outline' },
];

const AFFECTS: Option[] = [
  { id: 'priorities', label: 'Too many priorities, no plan', icon: 'git-network-outline' },
  { id: 'busy', label: 'Busy all day, nothing that matters', icon: 'sync-outline' },
  { id: 'falloff', label: 'I start strong, then fall off', icon: 'trending-down-outline' },
  { id: 'distractions', label: 'Distractions (phone, TV, social)', icon: 'phone-portrait-outline' },
  { id: 'energy', label: 'Low energy at the end of the day', icon: 'battery-dead-outline' },
  { id: 'unknown', label: "I don't know where my time goes", icon: 'help-buoy-outline' },
];

const DESCRIBES: Option[] = [
  { id: 'builder', label: 'Builder / Creator', icon: 'construct-outline' },
  { id: 'knowledge', label: 'Knowledge worker', icon: 'laptop-outline' },
  { id: 'founder', label: 'Founder / Entrepreneur', icon: 'rocket-outline' },
  { id: 'athlete', label: 'Sports / Athlete', icon: 'barbell-outline' },
  { id: 'student', label: 'Student', icon: 'school-outline' },
  { id: 'better', label: 'Just trying to live better', icon: 'heart-outline' },
];

const TRIED: Option[] = [
  { id: 'didnt', label: "Yes, it didn't stick", icon: 'close-circle-outline' },
  { id: 'briefly', label: 'Yes, it worked for a while', icon: 'time-outline' },
  { id: 'first', label: 'No, this is my first time', icon: 'sparkles-outline' },
];

const AGE_BRACKETS = [
  { id: 'u18', label: 'Under 18', age: 16 },
  { id: '18-24', label: '18 – 24', age: 21 },
  { id: '25-34', label: '25 – 34', age: 29 },
  { id: '35-44', label: '35 – 44', age: 39 },
  { id: '45-54', label: '45 – 54', age: 49 },
  { id: '55+', label: '55 +', age: 60 },
];

const COMPARE: Option[] = [
  { id: 'better', label: 'Better', icon: 'arrow-up-circle-outline' },
  { id: 'same', label: 'About the same', icon: 'remove-circle-outline' },
  { id: 'worse', label: 'Worse', icon: 'arrow-down-circle-outline' },
];

const FACTS = [
  { icon: 'sunny-outline' as const, text: 'The average American has about 5 hours of free time a day. Nearly half of it goes to TV.' },
  { icon: 'cloud-outline' as const, text: 'We spend about 47% of our waking hours thinking about something other than what we’re doing.' },
  { icon: 'calendar-outline' as const, text: 'One hour a day is 365 hours a year. That’s over 9 full-time work weeks.' },
  { icon: 'repeat-outline' as const, text: 'It takes about 66 days of repetition for a new action to become automatic.' },
];

const BELIEFS = [
  'your life is built on a few pillars. Your body. Your mind. Your money, etc.',
  'every hour of your day should trace back to one of them.',
  'every action you take should move you toward a goal you chose.',
  "you don't need more motivation. You need to know where your next hour goes.",
];

const MORE_YEARS_OF = [
  { word: 'Building', icon: 'hammer-outline' as const, color: Colors.pillarCraft },
  { word: 'Training', icon: 'barbell-outline' as const, color: Colors.pillarBody },
  { word: 'Learning', icon: 'book-outline' as const, color: Colors.pillarMind },
  { word: 'Earning', icon: 'trending-up-outline' as const, color: Colors.pillarMoney },
  { word: 'Loving', icon: 'heart-outline' as const, color: '#E5484D' },
  { word: 'Living', icon: 'sunny-outline' as const, color: '#F2A900' },
];

const PRESET_PILLARS = [
  { name: 'Body', color: Colors.pillarBody, icon: 'barbell-outline' as const },
  { name: 'Finances', color: Colors.pillarMoney, icon: 'cash-outline' as const },
  { name: 'Mind', color: Colors.pillarMind, icon: 'book-outline' as const },
  { name: 'Craft', color: Colors.pillarCraft, icon: 'hammer-outline' as const },
];
const PILLAR_COLORS = PRESET_PILLARS.map((p) => p.color);
const MAX_PILLARS = 6;
/** "Which best describes you?" → pillars pre-selected on the pillars screen. */
const DESCRIBES_TO_PILLARS: Record<string, string[]> = {
  builder: ['Craft'],
  knowledge: ['Craft'],
  founder: ['Finances'],
  athlete: ['Body'],
  student: ['Mind'],
  better: ['Body', 'Mind'],
};
const ACTION_IDEAS: Record<string, string[]> = {
  Body: ['Morning training', '10k steps', 'Stretch'],
  Finances: ['Side project', 'Review budget', 'Learn investing'],
  Mind: ['Read 20 pages', 'Meditate', 'Journal'],
  Craft: ['Deep work', 'Practice', 'Write 500 words'],
};

/** Paywall is UI-only until purchases are wired (RevenueCat, US-047/048). */
const PLANS = [
  { id: 'yearly', title: 'Yearly', price: '$39.99 / year', perWeek: '$0.77 / week', badge: 'BEST VALUE · 7-DAY FREE TRIAL' },
  { id: 'monthly', title: 'Monthly', price: '$7.99 / month', perWeek: '$1.84 / week', badge: null },
] as const;

const LIFE_EXPECTANCY = 80;
const WAKING_HOURS = 16;

type PendingGoal = { name: string; color: string; icon: string };

type Profile = {
  goal: string | null;
  affects: string | null;
  describes: string | null;
  tried: string | null;
  ageBracket: string | null;
  driftHours: number;
  compare: string | null;
};
const EMPTY_PROFILE: Profile = { goal: null, affects: null, describes: null, tried: null, ageBracket: null, driftHours: 5, compare: null };

type OnboardingDraftV10 = {
  v: 10;
  screen: ScreenId;
  profile: Profile;
  goals: PendingGoal[];
  actionName: string;
  actionType: ActionType;
  actionMins: number;
  userName: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatHm(h: number): string {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  if (hh === 0) return `${mm}m`;
  return mm === 0 ? `${hh}h` : `${hh}h ${mm}m`;
}

function formatHoursWords(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} minutes`;
  if (h === 1) return '1 hour';
  return `${h % 1 === 0 ? h : h.toFixed(1)} hours`;
}

function hoursReaction(h: number): string {
  if (h < 2) return "Nice. Most of your hours already have a job.";
  if (h < 4) return 'That adds up faster than you think.';
  if (h < 7) return "That's a big part of every day, going nowhere.";
  return "That's most of your free time. You've come to the right place.";
}

function timeProfile(p: Profile) {
  const h = p.driftHours;
  const stuck = (p.compare === 'same' || p.compare === 'worse') && p.tried === 'didnt';
  let title = 'The Drifter';
  let desc = "Your days aren't bad. They just aren't pointed at anything, so the hours slip by unassigned.";
  if (h < 3) {
    title = 'The Almost Intentional';
    desc = "Most of your hours already have a job. A clear system gives the rest of them one too.";
  } else if (stuck) {
    title = 'The Stuck Dreamer';
    desc = 'You know exactly who you want to be. The hours keep going somewhere else before you get there.';
  } else if (p.affects === 'busy' || p.affects === 'priorities') {
    title = 'The Busy Achiever';
    desc = "You're never idle, but your hours go to whatever shouts loudest, not to what matters most.";
  } else if (p.describes === 'student') {
    title = 'The Scattered Learner';
    desc = 'You have the drive to grow. Your hours just need somewhere clear to go.';
  } else if (p.describes && ['builder', 'knowledge', 'founder', 'athlete'].includes(p.describes)) {
    title = 'The Untapped Builder';
    desc = 'You value progress, but your best hours rarely land on the things you actually want to build.';
  }
  const intentional = Math.min(0.88, Math.max(0.06, 1 - h / 10));
  const stagnation = Math.min(0.95, (p.compare === 'better' ? 0.3 : p.compare === 'worse' ? 0.82 : 0.62) + (p.tried === 'didnt' ? 0.1 : 0));
  return { title, desc, intentional, stagnation };
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
    userName: (s: string) => void;
  }
) {
  if (!raw || typeof raw !== 'object') return;
  const d = raw as Partial<OnboardingDraftV10> & { v?: number };
  // Older drafts used a different story: keep the build answers, restart the story.
  if (d.v === 10 && typeof d.screen === 'string') {
    let idx = FLOW.indexOf(d.screen as ScreenId);
    while (idx > 0 && SKIP_BACK.has(FLOW[idx])) idx -= 1;
    if (idx >= 0) set.step(idx);
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
  if (typeof d.userName === 'string') set.userName(d.userName.slice(0, 30));
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Small building blocks ────────────────────────────────────────────────────

type Segment = { text: string; style: TextStyle };

/** Types segments letter by letter with keyboard-style haptic ticks. Untyped text stays transparent so nothing jumps. */
function TypeSequence({ segments, reduceMotion, speed = 30, gap = 10, onDone }: { segments: Segment[]; reduceMotion: boolean; speed?: number; gap?: number; onDone?: () => void }) {
  const flat = segments.map((s) => s.text).join('');
  const [count, setCount] = useState(reduceMotion ? flat.length : 0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (reduceMotion) {
      setCount(flat.length);
      onDoneRef.current?.();
      return;
    }
    let i = 0;
    let lastTick = 0;
    setCount(0);
    const id = setInterval(() => {
      i += 1;
      setCount(i);
      const ch = flat[i - 1];
      const now = Date.now();
      if (ch && ch.trim() && now - lastTick >= 45) {
        lastTick = now;
        hapticTick();
      }
      if (i >= flat.length) {
        clearInterval(id);
        onDoneRef.current?.();
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

function MeterBar({ label, low, high, value, delay }: { label: string; low: string; high: string; value: number; delay: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: value, duration: 900, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [v, value, delay]);
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: OB.ink, marginBottom: 7 }}>{label}</Text>
      <View style={{ height: 12, borderRadius: 6, backgroundColor: OB.track, overflow: 'hidden' }}>
        <Animated.View style={{ height: 12, borderRadius: 6, backgroundColor: OB.blue, width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
        <Text style={{ fontFamily: FontFamily.body, fontSize: 12, color: OB.muted }}>{low}</Text>
        <Text style={{ fontFamily: FontFamily.body, fontSize: 12, color: OB.muted }}>{high}</Text>
      </View>
    </View>
  );
}

function SkipLink({ onPress, light }: { onPress: () => void; light?: boolean }) {
  return (
    <Pressable onPress={onPress} hitSlop={16} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 18 }}>
      <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: light ? 'rgba(255,255,255,0.75)' : OB.faint }}>Skip</Text>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const router = useRouter();
  const { height: winH } = useWindowDimensions();
  const [step, setStep] = useState(0);
  const screen: ScreenId = FLOW[step];
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
  const [plan, setPlan] = useState<(typeof PLANS)[number]['id']>('yearly');
  const [draftReady, setDraftReady] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // Screen-local animation state
  const [slide, setSlide] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [calc, setCalc] = useState(0); // 0..3 across the three loading bars
  const [countUp, setCountUp] = useState(0);
  const [typedDone, setTypedDone] = useState(false);
  const [life, setLife] = useState({ phase: 0, lived: 0, lost: 0, done: false });
  const [wordIdx, setWordIdx] = useState(0);
  const askedNotifs = useRef(false);
  const [ignite, setIgnite] = useState(0);
  const [lit, setLit] = useState(false);

  // ── Step transition ────────────────────────────────────────────────────────
  const fade = useRef(new Animated.Value(1)).current;
  const slideX = useRef(new Animated.Value(0)).current;
  const dirRef = useRef<1 | -1>(1);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((on) => {
        if (on !== undefined) setReduceMotion(on);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    slideX.setValue(dirRef.current * 24);
    fade.setValue(0);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.timing(slideX, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const goToStep = useCallback(
    (n: number) => {
      const target = Math.max(0, Math.min(FLOW.length - 1, n));
      dirRef.current = target > step ? 1 : -1;
      if (target > step) hapticMedium();
      else hapticLight();
      // First time on pillars: pre-select what fits who they said they are.
      if (FLOW[target] === 'pillars' && goals.length === 0 && profile.describes) {
        const names = DESCRIBES_TO_PILLARS[profile.describes] ?? [];
        setGoals(PRESET_PILLARS.filter((p) => names.includes(p.name)).map((p) => ({ name: p.name, color: p.color, icon: '' })));
      }
      setTypedDone(false);
      if (FLOW[target] === 'commit') {
        setLit(false);
        setIgnite(0);
      }
      setStep(target);
    },
    [step, goals.length, profile.describes]
  );
  const next = useCallback(() => goToStep(step + 1), [goToStep, step]);
  const back = useCallback(() => {
    let prev = step - 1;
    while (prev > 0 && SKIP_BACK.has(FLOW[prev])) prev -= 1;
    goToStep(prev);
  }, [goToStep, step]);
  const choose = useCallback(
    (patch: Partial<Profile>) => {
      setProfile((p) => ({ ...p, ...patch }));
      setTimeout(() => goToStep(step + 1), reduceMotion ? 0 : 320);
    },
    [goToStep, step, reduceMotion]
  );

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
    const payload: OnboardingDraftV10 = { v: 10, screen, profile, goals, actionName, actionType, actionMins, userName };
    const t = setTimeout(() => {
      void AsyncStorage.setItem(ONBOARDING_DRAFT_STORAGE_KEY, JSON.stringify(payload));
    }, 350);
    return () => clearTimeout(t);
  }, [draftReady, screen, profile, goals, actionName, actionType, actionMins, userName]);

  // ── Derived numbers ────────────────────────────────────────────────────────
  const age = AGE_BRACKETS.find((b) => b.id === profile.ageBracket)?.age ?? 25;
  const h = Math.max(0.5, profile.driftHours);
  const daysThisYear = Math.round((h * 365) / 24);
  const yearsLostExact = (Math.max(0, LIFE_EXPECTANCY - age) * h) / WAKING_HOURS;
  const yearsLost = Math.max(1, Math.round(yearsLostExact));
  const yearsBack = Math.max(1, Math.round(yearsLostExact / 2));
  const gainPerDay = Math.round((h / 2) * 4) / 4; // quarter hours
  const afterHours = Math.max(0.25, h - gainPerDay);
  const lived = Math.min(age, LIFE_EXPECTANCY - 1);
  const lostDots = Math.min(yearsLost, LIFE_EXPECTANCY - lived);
  const ap = timeProfile(profile);
  const cleanGoals = useMemo(() => goals.filter((g) => g.name.trim().length > 0), [goals]);
  const primary = cleanGoals[0];
  const primaryPillar = primary?.name ?? 'your first pillar';
  const firstName = userName.trim();

  // ── Screen-local sequences ─────────────────────────────────────────────────
  // Auto-advancing story beats.
  useEffect(() => {
    const ms = AUTO_MS[screen];
    if (!ms) return;
    const t = setTimeout(() => goToStep(step + 1), reduceMotion ? 1500 : ms);
    return () => clearTimeout(t);
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Welcome carousel.
  useEffect(() => {
    if (screen !== 'welcome') return;
    const id = setInterval(() => setSlide((s) => (s + 1) % 3), 3200);
    return () => clearInterval(id);
  }, [screen]);

  // One-card-at-a-time lists.
  useEffect(() => {
    const cfg = STAGGER[screen];
    if (!cfg) return;
    setRevealed(reduceMotion ? cfg.count : 0);
    if (reduceMotion) return;
    const timers = Array.from({ length: cfg.count }, (_, i) =>
      setTimeout(() => {
        hapticLight();
        setRevealed(i + 1);
      }, 450 + i * cfg.gap)
    );
    return () => timers.forEach(clearTimeout);
  }, [screen, reduceMotion]);

  // "This week" — ask for notifications once the plan is on screen, like a natural next step.
  useEffect(() => {
    if (screen !== 'thisWeek' || revealed < 4 || askedNotifs.current) return;
    askedNotifs.current = true;
    const t = setTimeout(() => void requestNotificationPermissions().catch(() => false), 500);
    return () => clearTimeout(t);
  }, [screen, revealed]);

  // Personalizing… three bars, one after the other.
  useEffect(() => {
    if (screen !== 'calculating') return;
    setCalc(0);
    const start = Date.now();
    const total = reduceMotion ? 600 : 3600;
    let lastWhole = 0;
    const id = setInterval(() => {
      const v = Math.min(3, ((Date.now() - start) / total) * 3);
      setCalc(v);
      if (Math.floor(v) > lastWhole) {
        lastWhole = Math.floor(v);
        hapticLight();
      }
      if (v >= 3) {
        clearInterval(id);
        setTimeout(() => goToStep(FLOW.indexOf('profile')), 350);
      }
    }, 40);
    return () => clearInterval(id);
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Count-ups for the big numbers.
  useEffect(() => {
    const target = screen === 'days' ? daysThisYear : screen === 'years' ? yearsLost : screen === 'goodNews' ? yearsBack : null;
    if (target === null) return;
    if (reduceMotion) {
      setCountUp(target);
      return;
    }
    setCountUp(0);
    const startDelay = screen === 'goodNews' ? 1500 : 500;
    const duration = 1100;
    let id: ReturnType<typeof setInterval> | undefined;
    const t = setTimeout(() => {
      const start = Date.now();
      let last = 0;
      id = setInterval(() => {
        const f = Math.min(1, (Date.now() - start) / duration);
        const v = Math.round(target * (1 - Math.pow(1 - f, 3)));
        if (v !== last) {
          last = v;
          hapticTick();
        }
        setCountUp(v);
        if (f >= 1) {
          clearInterval(id);
          hapticMedium();
        }
      }, 30);
    }, startDelay);
    return () => {
      clearTimeout(t);
      if (id) clearInterval(id);
    };
  }, [screen, daysThisYear, yearsLost, yearsBack, reduceMotion]);

  // Life in dots.
  useEffect(() => {
    if (screen !== 'lifeGrid') return;
    if (reduceMotion) {
      setLife({ phase: 3, lived, lost: lostDots, done: true });
      return;
    }
    let cancelled = false;
    setLife({ phase: 0, lived: 0, lost: 0, done: false });
    (async () => {
      await wait(1300);
      if (cancelled) return;
      setLife((l) => ({ ...l, phase: 1 }));
      for (let i = 1; i <= lived; i++) {
        await wait(Math.max(18, 900 / lived));
        if (cancelled) return;
        if (i % 2 === 0) hapticTick();
        setLife((l) => ({ ...l, lived: i }));
      }
      await wait(1800);
      if (cancelled) return;
      hapticLight();
      setLife((l) => ({ ...l, phase: 2 }));
      await wait(1800);
      if (cancelled) return;
      setLife((l) => ({ ...l, phase: 3 }));
      for (let i = 1; i <= lostDots; i++) {
        await wait(Math.max(40, 1400 / lostDots));
        if (cancelled) return;
        hapticTick();
        setLife((l) => ({ ...l, lost: i }));
      }
      hapticMedium();
      setLife((l) => ({ ...l, done: true }));
    })();
    return () => {
      cancelled = true;
    };
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  // "N more years of …" word cycle.
  useEffect(() => {
    if (screen !== 'moreYears') return;
    setWordIdx(0);
    const id = setInterval(() => {
      hapticLight();
      setWordIdx((i) => (i + 1) % MORE_YEARS_OF.length);
    }, 1150);
    return () => clearInterval(id);
  }, [screen]);

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
    if (firstName) setSetting('user_name', firstName);
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
          why_statement: '',
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

  // ── Shell ──────────────────────────────────────────────────────────────────
  const chromeScreens: readonly ScreenId[] = FLOW.slice(1);
  const progress = Math.max(0.04, chromeScreens.indexOf(screen) / (chromeScreens.length - 1));
  const anim = { flex: 1, opacity: fade, transform: [{ translateX: slideX }] };

  const frame = ({
    children,
    footer,
    bg = OB.bg,
    background,
    scroll,
    light,
    onPressBody,
    mascot,
  }: {
    children: ReactNode;
    footer?: ReactNode;
    bg?: string;
    background?: ReactNode;
    scroll?: boolean;
    light?: boolean;
    onPressBody?: () => void;
    mascot?: boolean;
  }) => {
    const chrome = CHROME.has(screen);
    const content = scroll ? (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    ) : (
      <View style={{ flex: 1, paddingHorizontal: 20 }}>{children}</View>
    );
    return (
      <View style={{ flex: 1, backgroundColor: bg }}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle={light ? 'light-content' : 'dark-content'} />
        {background}
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          {chrome ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, height: 52 }}>
              <Pressable
                onPress={back}
                hitSlop={12}
                accessibilityLabel="Back"
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: OB.card, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="chevron-back" size={20} color={OB.ink} />
              </Pressable>
              <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: OB.track, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round(progress * 100)}%`, height: 8, borderRadius: 4, backgroundColor: OB.blue }} />
              </View>
              {mascot !== false ? <Mascot mood="happy" size={38} bob={false} /> : <View style={{ width: 38 }} />}
            </View>
          ) : null}
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Animated.View style={anim}>
              {onPressBody ? (
                <Pressable style={{ flex: 1 }} onPress={onPressBody} accessibilityLabel="Continue">
                  {content}
                </Pressable>
              ) : (
                content
              )}
            </Animated.View>
            {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 }}>{footer}</View> : null}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  };

  const question = (title: string, body: ReactNode, opts: { subtitle?: string; canContinue: boolean; scroll?: boolean }) =>
    frame({
      scroll: opts.scroll ?? true,
      children: (
        <>
          <Text style={[T.title, { marginTop: 6, marginBottom: opts.subtitle ? 6 : 22 }]}>{title}</Text>
          {opts.subtitle ? <Text style={[T.body, { marginBottom: 22, fontSize: 15 }]}>{opts.subtitle}</Text> : null}
          {body}
        </>
      ),
      footer: <CTA label="Continue" onPress={next} disabled={!opts.canContinue} />,
    });

  const hillTop = Math.round(winH * 0.3);
  const centeredStory = (mood: MascotMood, children: ReactNode, footer?: ReactNode, extra?: { onPressBody?: () => void; intensity?: number }) =>
    frame({
      background: <Hill top={hillTop} />,
      onPressBody: extra?.onPressBody,
      children: (
        <View style={{ flex: 1 }}>
          <View style={{ height: hillTop - 40, alignItems: 'center', justifyContent: 'flex-end' }}>
            <Mascot mood={mood} size={128} intensity={extra?.intensity} />
          </View>
          <View style={{ flex: 1, paddingTop: 28 }}>{children}</View>
        </View>
      ),
      footer,
    });

  // ── Render ─────────────────────────────────────────────────────────────────
  switch (screen) {
    // ── Hook ──
    case 'welcome': {
      const slides = [
        { mock: <MockToday />, eyebrow: 'Welcome to Intentional', title: 'Give every hour\na purpose.' },
        { mock: <MockFocus />, eyebrow: 'Focus mode', title: 'Pour your hours\ninto your pillars.' },
        { mock: <MockWeek />, eyebrow: 'Your week', title: 'Watch your life\nadd up.' },
      ];
      const s = slides[slide];
      return frame({
        bg: '#CFE8FF',
        background: <Hill top={Math.round(winH * 0.42)} color={OB.bg} />,
        onPressBody: () => setSlide((i) => (i + 1) % 3),
        children: (
          <View style={{ flex: 1 }}>
            <View style={{ height: Math.round(winH * 0.5), alignItems: 'center', justifyContent: 'center' }}>
              <Reveal key={slide} shown>
                {s.mock}
              </Reveal>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
              {slides.map((_, i) => (
                <View key={i} style={{ width: i === slide ? 18 : 7, height: 7, borderRadius: 4, backgroundColor: i === slide ? OB.blue : OB.track }} />
              ))}
            </View>
            <Text style={[T.accent, { marginBottom: 8 }]}>{s.eyebrow}</Text>
            <Text style={[T.title, { fontSize: 34, lineHeight: 40 }]}>{s.title}</Text>
          </View>
        ),
        footer: <CTA label="Get started" onPress={next} />,
      });
    }

    case 'hello':
      return centeredStory(
        'wave',
        <>
          <Text style={[T.title, { marginBottom: 10 }]}>Hi, I'm Flick.</Text>
          <Text style={T.body}>I'm your spark. I grow with every hour you give to what matters, and I fade when hours drift away.{'\n'}Let's make them count. First, a few quick questions.</Text>
        </>,
        <CTA label="Let's go" onPress={next} />,
        { intensity: 0.7 }
      );

    case 'name':
      return frame({
        scroll: true,
        children: (
          <View style={{ paddingTop: 30 }}>
            <Text style={[T.title, { marginBottom: 8 }]}>What should we call you?</Text>
            <Text style={[T.body, { fontSize: 15, marginBottom: 30 }]}>So this feels like yours.</Text>
            <TextInput
              value={userName}
              onChangeText={(v) => setUserName(v.slice(0, 30))}
              placeholder="Your first name"
              placeholderTextColor={OB.faint}
              maxLength={30}
              autoFocus
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => {
                if (userName.trim()) next();
              }}
              style={{
                color: OB.ink,
                fontFamily: FontFamily.bodyBold,
                fontSize: 26,
                textAlign: 'center',
                paddingVertical: 16,
                borderRadius: 16,
                backgroundColor: OB.card,
              }}
            />
          </View>
        ),
        footer: <CTA label="Continue" onPress={next} disabled={!userName.trim()} />,
      });

    // ── Quiz ──
    case 'goal':
      return question(
        firstName ? `${firstName}, what do you want from Intentional?` : 'What do you want from Intentional?',
        <OptionRows options={GOALS} selected={profile.goal ? [profile.goal] : []} onSelect={(id) => choose({ goal: id })} />,
        { canContinue: !!profile.goal }
      );

    case 'affects':
      return question(
        'What gets in the way the most?',
        <OptionRows options={AFFECTS} selected={profile.affects ? [profile.affects] : []} onSelect={(id) => choose({ affects: id })} />,
        { canContinue: !!profile.affects }
      );

    case 'describes':
      return question(
        'Which best describes you?',
        <OptionRows options={DESCRIBES} selected={profile.describes ? [profile.describes] : []} onSelect={(id) => choose({ describes: id })} />,
        { canContinue: !!profile.describes }
      );

    case 'tried':
      return question(
        'Have you tried to organize your life around your goals before?',
        <OptionRows options={TRIED} selected={profile.tried ? [profile.tried] : []} onSelect={(id) => choose({ tried: id })} />,
        { canContinue: !!profile.tried }
      );

    case 'didYouKnow':
      return frame({
        background: <Hill top={Math.round(winH * 0.24)} />,
        scroll: true,
        children: (
          <View style={{ alignItems: 'center' }}>
            <Text style={[T.title, { marginTop: 6, marginBottom: 12 }]}>Did you know?</Text>
            <Mascot mood={revealed >= 3 ? 'shock' : 'think'} size={104} intensity={0.6 - revealed * 0.06} />
            <View style={{ gap: 10, marginTop: 22, alignSelf: 'stretch' }}>
              {FACTS.map((f, i) => (
                <Reveal key={f.text} shown={revealed > i}>
                  <FactCard icon={f.icon} text={f.text} />
                </Reveal>
              ))}
            </View>
            <Reveal shown={revealed >= FACTS.length}>
              <Text style={[T.fine, { marginTop: 14 }]}>Sources: U.S. Bureau of Labor Statistics, American Time Use Survey · Killingsworth & Gilbert, Science, 2010 · Lally et al., UCL, 2010</Text>
            </Reveal>
          </View>
        ),
        footer: <CTA label="Continue" onPress={next} />,
      });

    case 'age':
      return question(
        'How old are you?',
        <OptionRows
          options={AGE_BRACKETS.map((b) => ({ id: b.id, label: b.label }))}
          selected={profile.ageBracket ? [profile.ageBracket] : []}
          onSelect={(id) => choose({ ageBracket: id })}
        />,
        { canContinue: !!profile.ageBracket, subtitle: "We'll use it to project your numbers." }
      );

    case 'hours': {
      const mood: MascotMood = profile.driftHours < 3 ? 'happy' : profile.driftHours < 7 ? 'worried' : 'shock';
      return frame({
        background: <Hill top={Math.round(winH * 0.24)} />,
        children: (
          <View style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ height: Math.round(winH * 0.24) - 70, justifyContent: 'flex-end' }}>
              <Mascot mood={mood} size={112} intensity={1 - ((profile.driftHours - 0.5) / 11.5) * 0.85} />
            </View>
            <Text style={[T.title, { marginTop: 22 }]}>How many hours a day drift by?</Text>
            <Text style={[T.body, { fontSize: 15, marginTop: 6 }]}>Scrolling, TV, busywork, waiting around. Hours that don't go to anything you chose.</Text>
            <Text style={[T.huge, { fontSize: 56, lineHeight: 62, marginTop: 18 }]}>
              {profile.driftHours % 1 === 0 ? profile.driftHours : profile.driftHours.toFixed(1)}
              {profile.driftHours >= 12 ? '+' : ''} {profile.driftHours === 1 ? 'Hour' : 'Hours'}
            </Text>
            <View style={{ alignSelf: 'stretch', marginTop: 18 }}>
              <HoursSlider value={profile.driftHours} min={0.5} max={12} step={0.5} onChange={(v) => setProfile((p) => ({ ...p, driftHours: v }))} />
            </View>
            <Text style={[T.accent, { marginTop: 18, color: hoursColor(profile.driftHours) }]}>{hoursReaction(profile.driftHours)}</Text>
            <Text style={[T.fine, { marginTop: 8 }]}>Not sure? Screen Time is a good place to start.</Text>
          </View>
        ),
        footer: <CTA label="Continue" onPress={next} />,
      });
    }

    case 'compare':
      return question(
        'Compared to a year ago, you are…',
        <OptionRows options={COMPARE} selected={profile.compare ? [profile.compare] : []} onSelect={(id) => choose({ compare: id })} />,
        { canContinue: !!profile.compare, subtitle: 'Your body, your skills, your bank account, your peace of mind.' }
      );

    // ── Diagnosis ──
    case 'calculating':
      return centeredStory(
        'mystery',
        <View style={{ paddingHorizontal: 10 }}>
          <Text style={[T.title, { marginBottom: 26 }]}>Personalizing your experience!</Text>
          {['Reading your answers…', 'Mapping your hours…', 'Finding your pillars…'].map((l, i) => (
            <View key={l} style={{ marginBottom: 18 }}>
              <LoadBar progress={calc - i} />
              <Text style={[T.accent, { marginTop: 8, opacity: calc >= i ? 1 : 0.45 }]}>{l}</Text>
            </View>
          ))}
        </View>
      );

    case 'profile':
      return frame({
        background: <Sunburst height={Math.round(winH * 0.3)} />,
        children: (
          <View style={{ flex: 1 }}>
            <View style={{ height: Math.round(winH * 0.3) - 30, alignItems: 'center', justifyContent: 'flex-end' }}>
              <Mascot mood="worried" size={124} intensity={0.5} />
            </View>
            <View style={{ backgroundColor: OB.bg, marginHorizontal: -20, paddingHorizontal: 20, paddingTop: 22, flex: 1 }}>
              <Text style={T.accent}>{firstName ? `${firstName}, your time profile is` : 'Your time profile is'}</Text>
              <Text style={[T.title, { marginTop: 4, marginBottom: 8 }]}>{ap.title}</Text>
              <Text style={[T.body, { fontSize: 15, marginBottom: 24 }]}>{ap.desc}</Text>
              <MeterBar label="Hours with a purpose" low="Few" high="Most" value={ap.intentional} delay={300} />
              <MeterBar label="Stagnation risk" low="Low" high="High" value={ap.stagnation} delay={700} />
            </View>
          </View>
        ),
        footer: <CTA label="Makes sense" onPress={next} />,
      });

    // ── The fall ──
    case 'oof':
      return centeredStory(
        'worried',
        <View style={{ alignItems: 'center' }}>
          <Text style={[T.huge, { fontSize: 84, lineHeight: 90 }]}>OOF</Text>
          <TypeSequence reduceMotion={reduceMotion} speed={45} segments={[{ text: 'I have some bad news for you…', style: T.lead }]} />
        </View>,
        <SkipLink onPress={next} />,
        { onPressBody: next, intensity: 0.42 }
      );

    case 'days':
      return centeredStory(
        'sad',
        <View style={{ alignItems: 'center' }}>
          <TypeSequence reduceMotion={reduceMotion} segments={[{ text: 'This year, about', style: T.lead }]} onDone={() => setTypedDone(true)} />
          <Text style={[T.huge, { marginTop: 8 }]}>{countUp}</Text>
          <Text style={[T.huge, { fontSize: 56, lineHeight: 60, marginTop: -6 }]}>Days</Text>
          <Text style={[T.lead, { marginTop: 10, opacity: typedDone && countUp === daysThisYear ? 1 : 0 }]}>will go to nothing you chose.</Text>
        </View>,
        <SkipLink onPress={next} />,
        { onPressBody: next, intensity: 0.3 }
      );

    case 'years':
      return frame({
        bg: '#6E6870',
        light: true,
        background: <DuskBackground />,
        children: (
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[T.lead, { color: '#FFFFFF', marginTop: 40 }]}>You're on track to let</Text>
            <Text style={[T.huge, { color: '#FFFFFF', fontSize: 88, lineHeight: 96 }]}>
              {countUp} {yearsLost === 1 ? 'year' : 'years'}
            </Text>
            <Text style={[T.lead, { color: 'rgba(255,255,255,0.92)' }]}>of your life drift by,{'\n'}given to nothing you chose.</Text>
            <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: 18 }}>
              <Mascot mood="sad" size={130} intensity={0.04} />
            </View>
            <Text style={[T.fine, { color: 'rgba(255,255,255,0.8)', marginBottom: 4 }]}>
              Based on {formatHoursWords(h)} a day, {WAKING_HOURS} waking hours a day and a life expectancy of {LIFE_EXPECTANCY}.
            </Text>
          </View>
        ),
        footer: <CTA label="Next" onPress={next} color="#FFFFFF" textColor={OB.ink} />,
      });

    case 'understand':
      return frame({
        onPressBody: next,
        children: (
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 8 }}>
            <TypeSequence
              reduceMotion={reduceMotion}
              segments={[
                { text: 'Do you understand what it means to let ', style: { ...T.title, fontSize: 30, lineHeight: 38 } },
              ]}
              onDone={() => setTypedDone(true)}
            />
            <Text style={[T.title, { fontSize: 30, lineHeight: 38, opacity: typedDone ? 1 : 0 }]}>
              <Text style={{ color: OB.blue }}>{yearsLost} years</Text> slip by without a purpose?
            </Text>
          </View>
        ),
        footer: <SkipLink onPress={next} />,
      });

    case 'lifeGrid': {
      const title =
        life.phase === 0 || life.phase === 1 ? 'This is your life.' : life.phase === 2 ? 'This is what you have left.' : 'And these are the years that will drift by.';
      return frame({
        onPressBody: life.done ? undefined : () => setLife({ phase: 3, lived, lost: lostDots, done: true }),
        children: (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text key={title} style={[T.title, { minHeight: 76, marginBottom: 18 }]}>
              {title}
            </Text>
            <LifeGrid total={LIFE_EXPECTANCY} lived={lived} livedShown={life.lived} lost={lostDots} lostShown={life.lost} hideLived={life.phase >= 2} />
            <View style={{ minHeight: 56, marginTop: 18 }}>
              {life.phase === 1 ? <Text style={T.lead}>You are here, assuming you're {age}.</Text> : null}
              {life.phase === 3 && life.done ? (
                <Text style={[T.lead, { color: OB.red }]}>
                  {yearsLost} {yearsLost === 1 ? 'year' : 'years'}. Never given to anything.
                </Text>
              ) : null}
            </View>
          </View>
        ),
        footer: life.done ? <CTA label="Next" onPress={next} /> : <SkipLink onPress={() => setLife({ phase: 3, lived, lost: lostDots, done: true })} />,
      });
    }

    case 'stagnation': {
      const lines: Segment[] =
        profile.compare === 'better'
          ? [
              { text: "You said you're better than a year ago. Good.", style: T.title },
              { text: `Now imagine the version of you that gave ${formatHoursWords(gainPerDay)} more a day to what matters.`, style: T.lead },
              { text: 'That person is one decision away.', style: T.body },
            ]
          : profile.compare === 'worse'
            ? [
                { text: "You said you're worse than a year ago.", style: T.title },
                { text: "That's not a character flaw. It's what happens when your hours have no job.", style: T.lead },
                { text: "Another year like that is a choice. You just haven't made the other one yet.", style: T.body },
              ]
            : [
                { text: "You said you're about the same as a year ago.", style: T.title },
                { text: 'Same body. Same bank account. Same skills.', style: T.lead },
                { text: "Another year like that is a choice. You just haven't made the other one yet.", style: T.body },
              ];
      return centeredStory('think', <TypeSequence reduceMotion={reduceMotion} gap={14} segments={lines} />, <CTA label="Next" onPress={next} />, { intensity: 0.22 });
    }

    // ── The way up ──
    case 'goodNews': {
      const sunH = Math.round(winH * 0.3);
      return frame({
        background: (
          <>
            <Sunburst height={sunH + 40} />
            <Hill top={sunH} color={OB.bg} />
          </>
        ),
        children: (
          <View style={{ flex: 1 }}>
            <View style={{ height: sunH - 30, alignItems: 'center', justifyContent: 'flex-end' }}>
              <Mascot mood={countUp > 0 ? 'happy' : 'calm'} size={128} intensity={0.12 + 0.78 * (countUp / yearsBack)} />
            </View>
            <View style={{ alignItems: 'center', paddingTop: 30 }}>
              <TypeSequence
                reduceMotion={reduceMotion}
                segments={[
                  { text: 'The good news is…', style: { ...T.lead, color: OB.muted } },
                  { text: 'Every hour can be given a job.', style: T.title },
                ]}
                onDone={() => setTypedDone(true)}
              />
              <Reveal shown={typedDone}>
                <Text style={[T.lead, { marginTop: 16 }]}>Intentional can help you give back up to</Text>
                <Text style={[T.huge, { color: OB.green, fontSize: 64, lineHeight: 70 }]}>
                  {countUp} {yearsBack === 1 ? 'year' : 'years'}
                </Text>
                <Text style={[T.lead, { marginTop: 2 }]}>to the things that matter to you.</Text>
              </Reveal>
            </View>
          </View>
        ),
        footer: <CTA label="Let's do this!" onPress={next} />,
      });
    }

    case 'moreYears': {
      const w = MORE_YEARS_OF[wordIdx];
      const sunH = Math.round(winH * 0.3);
      return frame({
        background: (
          <>
            <Sunburst height={sunH + 40} />
            <Hill top={sunH} color={OB.bg} />
          </>
        ),
        children: (
          <View style={{ flex: 1 }}>
            <View style={{ height: sunH - 30, alignItems: 'center', justifyContent: 'flex-end' }}>
              <Mascot mood="proud" size={128} intensity={1} />
            </View>
            <View style={{ alignItems: 'center', paddingTop: 34 }}>
              <Text style={T.lead}>
                {yearsBack} more {yearsBack === 1 ? 'year' : 'years'} of
              </Text>
              <Reveal key={w.word} shown>
                <View style={{ alignItems: 'center', marginTop: 6 }}>
                  <Text style={[T.huge, { color: w.color, fontSize: 66, lineHeight: 74 }]}>{w.word}</Text>
                  <Ionicons name={w.icon} size={34} color={w.color} />
                </View>
              </Reveal>
            </View>
          </View>
        ),
        footer: <CTA label="Let's do this!" onPress={next} />,
      });
    }

    case 'believe':
      return frame({
        scroll: true,
        children: (
          <View style={{ paddingTop: 8 }}>
            <Text style={[T.title, { marginBottom: 6 }]}>At Intentional, we believe…</Text>
            <Text style={[T.body, { fontSize: 15, marginBottom: 22 }]}>This is the whole idea behind the app.</Text>
            <View style={{ gap: 12 }}>
              {BELIEFS.map((b, i) => (
                <Reveal key={b} shown={revealed > i}>
                  <View style={{ backgroundColor: i === 0 ? OB.blueSoft : '#FFFFFF', borderRadius: 18, padding: 18, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 }}>
                    <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 17, lineHeight: 24, color: OB.ink }}>
                      <Text style={{ fontFamily: FontFamily.bodyBold, color: OB.blue }}>We believe </Text>
                      {b}
                    </Text>
                  </View>
                </Reveal>
              ))}
            </View>
          </View>
        ),
        footer: <CTA label="Continue" onPress={next} disabled={revealed < BELIEFS.length} />,
      });

    case 'whyWorks':
      return frame({
        children: (
          <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 30 }}>
            <Text style={[T.title, { marginBottom: 24 }]}>Why Intentional works</Text>
            <View style={{ gap: 12 }}>
              <Reveal shown={revealed > 0}>
                <FactCard tone="red" text="To-do lists  →  Busy, not better" />
              </Reveal>
              <Reveal shown={revealed > 1}>
                <FactCard tone="red" text="Goal apps  →  Forgotten by February" />
              </Reveal>
              <Reveal shown={revealed > 2}>
                <FactCard tone="green" text="Intentional  →  Every hour goes to a pillar" />
              </Reveal>
            </View>
            <Reveal shown={revealed > 2}>
              <Text style={[T.body, { marginTop: 22, fontSize: 15 }]}>
                Lists track tasks. Goals sit in a note. Intentional connects every hour you spend to the life you're building.
              </Text>
            </Reveal>
          </View>
        ),
        footer: <CTA label="Continue" onPress={next} />,
      });

    case 'research':
      return frame({
        scroll: true,
        children: (
          <View style={{ paddingTop: 8 }}>
            <Text style={[T.title, { marginBottom: 22 }]}>Built on behavioral science</Text>
            {[
              { k: 'Plan it, do it', v: 'People who decided exactly when and where they’d exercise followed through 91% of the time, vs 38% without a plan.', src: 'Milne, Orbell & Sheeran · British Journal of Health Psychology, 2002' },
              { k: 'Same action, every day', v: 'Repeating one action in the same context is how a habit becomes automatic.', src: 'Lally et al. · University College London, 2010' },
              { k: 'What gets tracked gets done', v: 'Monitoring your progress makes you more likely to reach your goal.', src: 'Harkin et al. · Psychological Bulletin, 2016 (138 studies)' },
            ].map((r, i) => (
              <Reveal key={r.k} shown={revealed > i}>
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 }}>
                  <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: OB.ink }}>{r.k}</Text>
                  <Text style={{ fontFamily: FontFamily.body, fontSize: 15, lineHeight: 21, color: OB.ink, marginTop: 4 }}>{r.v}</Text>
                  <Text style={{ fontFamily: FontFamily.body, fontSize: 12, color: OB.faint, marginTop: 6 }}>{r.src}</Text>
                </View>
              </Reveal>
            ))}
            <Reveal shown={revealed >= 3}>
              <View style={{ backgroundColor: OB.blueSoft, borderRadius: 18, padding: 16, marginTop: 4, gap: 4 }}>
                {['Behavioral psychology', 'Designed for sustainable focus', 'No shame, no punishment'].map((l) => (
                  <Text key={l} style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: OB.ink, textAlign: 'center' }}>
                    {l}
                  </Text>
                ))}
              </View>
            </Reveal>
          </View>
        ),
        footer: <CTA label="Continue" onPress={next} />,
      });

    // ── Build ──
    case 'pillars': {
      const customs = goals.filter((g) => !PRESET_PILLARS.some((p) => p.name === g.name));
      const full = goals.length >= MAX_PILLARS;
      const all = [
        ...PRESET_PILLARS.map((p) => ({ id: p.name, label: p.name, icon: p.icon, color: p.color })),
        ...customs.map((c) => ({ id: c.name, label: c.name, icon: 'flag-outline' as const, color: c.color })),
      ];
      return frame({
        scroll: true,
        children: (
          <View>
            <Text style={[T.title, { marginBottom: 6 }]}>Where will those {yearsBack} years go?</Text>
            <Text style={[T.body, { fontSize: 15, marginBottom: 22 }]}>
              Pick your pillars, the parts of life that matter most. Every action will trace back to one.
            </Text>
            <View style={{ gap: 10 }}>
              {all.map((p) => {
                const on = goals.some((g) => g.name === p.id);
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      hapticLight();
                      togglePillar(p.id, p.color);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 14,
                      minHeight: 58,
                      paddingHorizontal: 18,
                      borderRadius: 16,
                      borderWidth: 2,
                      borderColor: on ? p.color : 'transparent',
                      backgroundColor: on ? '#FFFFFF' : OB.card,
                    }}
                  >
                    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: p.color, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={p.icon} size={18} color="#FFFFFF" />
                    </View>
                    <Text style={{ flex: 1, color: OB.ink, fontFamily: FontFamily.bodyBold, fontSize: 18 }}>{p.label}</Text>
                    <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? p.color : OB.track} />
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, opacity: full ? 0.45 : 1 }}>
              <TextInput
                placeholder={full ? `Up to ${MAX_PILLARS} pillars` : 'Add your own pillar'}
                placeholderTextColor={OB.faint}
                value={customPillar}
                onChangeText={(v) => setCustomPillar(v.slice(0, 30))}
                maxLength={30}
                editable={!full}
                returnKeyType="done"
                onSubmitEditing={addCustomPillar}
                style={{ flex: 1, height: 54, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: OB.track, paddingHorizontal: 16, fontFamily: FontFamily.bodySemiBold, fontSize: 17, color: OB.ink }}
              />
              <Pressable
                onPress={addCustomPillar}
                disabled={!customPillar.trim() || full}
                accessibilityLabel="Add pillar"
                style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: OB.ink, alignItems: 'center', justifyContent: 'center', opacity: customPillar.trim() && !full ? 1 : 0.3 }}
              >
                <Ionicons name="add" size={26} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        ),
        footer: <CTA label="Continue" onPress={next} disabled={cleanGoals.length === 0} />,
      });
    }

    case 'action': {
      const ideas = (primary && ACTION_IDEAS[primary.name]) || [];
      const color = primary?.color ?? OB.ink;
      const chip = (label: string, on: boolean, onPress: () => void) => (
        <Pressable
          key={label}
          onPress={() => {
            hapticLight();
            onPress();
          }}
          style={{ paddingHorizontal: 16, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? OB.ink : OB.card }}
        >
          <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: on ? '#FFFFFF' : OB.ink }}>{label}</Text>
        </Pressable>
      );
      return frame({
        scroll: true,
        children: (
          <View>
            <Text style={[T.title, { marginBottom: 6 }]}>
              What's one thing <Text style={{ color }}>{primaryPillar}</Text> gets every day?
            </Text>
            <Text style={[T.body, { fontSize: 15, marginBottom: 22 }]}>Start small. You can add more later.</Text>
            <TextInput
              placeholder={ideas[0] ?? 'Morning training'}
              placeholderTextColor={OB.faint}
              value={actionName}
              onChangeText={(v) => setActionName(v.slice(0, 30))}
              maxLength={30}
              style={{ height: 58, borderRadius: 16, backgroundColor: OB.card, paddingHorizontal: 18, fontFamily: FontFamily.bodyBold, fontSize: 19, color: OB.ink }}
            />
            {ideas.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {ideas.map((idea) => chip(idea, actionName === idea, () => setActionName(idea)))}
              </View>
            ) : null}

            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: OB.ink, marginTop: 26, marginBottom: 10 }}>How do you track it?</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['session', 'habit'] as const).map((ty) => {
                const on = actionType === ty;
                return (
                  <Pressable
                    key={ty}
                    onPress={() => {
                      hapticLight();
                      setActionType(ty);
                    }}
                    style={{ flex: 1, borderRadius: 16, padding: 14, borderWidth: 2, borderColor: on ? OB.ink : 'transparent', backgroundColor: on ? '#FFFFFF' : OB.card }}
                  >
                    <Ionicons name={ty === 'session' ? 'timer-outline' : 'checkmark-done-outline'} size={22} color={OB.ink} />
                    <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: OB.ink, marginTop: 6 }}>{ty === 'session' ? 'Timed session' : 'Daily habit'}</Text>
                    <Text style={{ fontFamily: FontFamily.body, fontSize: 13, color: OB.muted, marginTop: 2 }}>{ty === 'session' ? 'Focus timer, logs minutes' : 'Just check it off'}</Text>
                  </Pressable>
                );
              })}
            </View>

            {actionType === 'session' ? (
              <>
                <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: OB.ink, marginTop: 22, marginBottom: 10 }}>Daily target</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {[25, 45, 90].map((m) =>
                    chip(`${m} min`, !useCustomMins && actionMins === m, () => {
                      setUseCustomMins(false);
                      setActionMins(m);
                    })
                  )}
                  {chip('Custom', useCustomMins, () => {
                    setUseCustomMins(true);
                    setCustomMinsStr(String(actionMins));
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
                    <Text style={{ color: OB.muted, fontFamily: FontFamily.body, fontSize: 15, paddingBottom: 8 }}>minutes a day</Text>
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        ),
        footer: <CTA label="Continue" onPress={next} disabled={!actionName.trim()} />,
      });
    }

    case 'thisWeek': {
      const items = [
        { icon: 'trending-up-outline' as const, text: `Give ${formatHoursWords(gainPerDay)} more a day to your pillars` },
        {
          icon: 'flag-outline' as const,
          text: actionType === 'session' ? `Give ${primaryPillar} ${actionMins} minutes every day` : `${actionName.trim() || 'Your first action'}, every single day`,
        },
        { icon: 'git-branch-outline' as const, text: 'Trace every hour to a pillar' },
        { icon: 'shield-checkmark-outline' as const, text: 'Protect your focus, distractions blocked while you work' },
      ];
      return frame({
        children: (
          <View style={{ flex: 1, paddingTop: 10 }}>
            <Text style={[T.title, { marginBottom: 22 }]}>This week, Intentional will help you:</Text>
            <View style={{ gap: 10 }}>
              {items.map((it, i) => (
                <Reveal key={it.text} shown={revealed > i}>
                  <FactCard tone="blue" icon={it.icon} text={it.text} />
                </Reveal>
              ))}
            </View>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Mascot mood={revealed >= 4 ? 'happy' : 'think'} size={96} intensity={0.55 + revealed * 0.08} />
            </View>
          </View>
        ),
        footer: <CTA label="Continue" onPress={next} disabled={revealed < items.length} />,
      });
    }

    // ── Close ──
    case 'commit':
      return frame({
        bg: '#2B2826',
        light: true,
        background: <Rings />,
        children: (
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[T.title, { color: '#FFFFFF', fontSize: 32, lineHeight: 38, marginTop: 40 }]}>Ready to make{'\n'}every hour count?</Text>
            <Text style={[T.body, { color: 'rgba(255,255,255,0.75)', marginTop: 10 }]}>{lit ? "Your flame is lit. Let's keep it that way." : 'Hold the button to light your flame.'}</Text>
            <Text style={[T.lead, { color: '#FFFFFF', marginTop: 34, paddingHorizontal: 10 }]}>
              “{firstName ? `I, ${firstName}, ` : 'I '}choose where my hours go. Every one of them, to something that matters.”
            </Text>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Mascot mood={lit ? 'proud' : ignite > 0.05 ? 'happy' : 'calm'} size={150} intensity={lit ? 1 : 0.1 + ignite * 0.85} />
            </View>
          </View>
        ),
        footer: (
          <View style={{ alignItems: 'center', paddingBottom: 8 }}>
            <HoldCircle
              label="Hold to commit"
              onProgress={setIgnite}
              onComplete={() => {
                setLit(true);
                setTimeout(() => goToStep(FLOW.indexOf('loadingPlans')), reduceMotion ? 200 : 1300);
              }}
            />
            <Text style={[T.fine, { color: 'rgba(255,255,255,0.6)', marginTop: 10 }]}>Press and hold</Text>
          </View>
        ),
      });

    case 'loadingPlans':
      return (
        <LoadingPlans onDone={next} reduceMotion={reduceMotion} />
      );

    case 'beforeAfter': {
      const beforeBars = [0.75, 1, 0.95, 0.6];
      const afterBars = [0.6, 0.85, 1, 0.9];
      const maxBar = 90;
      return frame({
        bg: '#F6EEE3',
        scroll: true,
        children: (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 10 }}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 18, color: OB.ink }}>Before</Text>
                <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 20, color: OB.ink, letterSpacing: 0.5 }}>INTENTIONAL</Text>
                <Text style={{ fontFamily: FontFamily.body, fontSize: 11, color: OB.faint, marginTop: 14 }}>Hours drifting a day</Text>
                <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 26, color: OB.ink }}>{formatHm(h)}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: maxBar, marginTop: 10 }}>
                  {beforeBars.map((b, i) => (
                    <View key={i} style={{ width: 16, height: maxBar * b * Math.min(1, h / 8 + 0.3), borderRadius: 3, backgroundColor: OB.orange }} />
                  ))}
                </View>
              </View>
              <View style={{ width: 1.5, alignSelf: 'stretch', backgroundColor: OB.track, marginTop: 50 }} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 18, color: OB.ink }}>After</Text>
                <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 20, color: OB.ink, letterSpacing: 0.5 }}>INTENTIONAL</Text>
                <Text style={{ fontFamily: FontFamily.body, fontSize: 11, color: OB.faint, marginTop: 14 }}>Hours to your pillars</Text>
                <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 26, color: OB.ink }}>+{formatHm(gainPerDay)}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: maxBar, marginTop: 10 }}>
                  {afterBars.map((b, i) => (
                    <View key={i} style={{ width: 16, height: maxBar * b, borderRadius: 3, backgroundColor: (cleanGoals[i % Math.max(1, cleanGoals.length)]?.color) ?? OB.green }} />
                  ))}
                </View>
              </View>
            </View>
            <View style={{ alignItems: 'center', marginTop: 18 }}>
              <Mascot mood="proud" size={92} intensity={1} />
            </View>
            <Text style={[T.title, { marginTop: 8 }]}>
              Use Intentional and give <Text style={{ color: OB.green }}>{formatHoursWords(gainPerDay)}</Text> more a day to what matters
            </Text>
            <View style={{ gap: 16, marginTop: 24, paddingHorizontal: 6 }}>
              {[
                { icon: 'git-branch-outline' as const, k: 'Every hour has a job.', v: `Each one traced to ${cleanGoals.length > 1 ? 'your pillars' : primaryPillar}.` },
                { icon: 'stats-chart-outline' as const, k: 'Watch your life add up.', v: 'Your week, pillar by pillar.' },
                { icon: 'shield-checkmark-outline' as const, k: 'Focus, protected.', v: 'Distractions blocked while you work.' },
              ].map((b) => (
                <View key={b.k} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={b.icon} size={22} color={OB.ink} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: OB.ink }}>{b.k}</Text>
                    <Text style={{ fontFamily: FontFamily.body, fontSize: 15, color: OB.muted }}>{b.v}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ),
        footer: <CTA label="Continue" onPress={next} />,
      });
    }

    case 'plans':
      return frame({
        scroll: true,
        children: (
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <Pressable onPress={() => void finish()} disabled={finishing} hitSlop={14} accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={OB.faint} />
              </Pressable>
            </View>
            <View style={{ alignItems: 'center', marginTop: 4 }}>
              <Mascot mood="happy" size={96} intensity={0.9} />
            </View>
            <Text style={[T.title, { marginTop: 12 }]}>
              Choose your{'\n'}
              <Text style={{ color: OB.blue }}>Intentional plan</Text>
            </Text>
            <View style={{ gap: 12, marginTop: 24 }}>
              {PLANS.map((p) => {
                const on = plan === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      hapticLight();
                      setPlan(p.id);
                    }}
                    style={{ borderRadius: 18, borderWidth: 2, borderColor: on ? OB.blue : OB.track, backgroundColor: '#FFFFFF', overflow: 'hidden' }}
                  >
                    {p.badge ? (
                      <View style={{ backgroundColor: on ? OB.blue : OB.track, paddingVertical: 5 }}>
                        <Text style={{ textAlign: 'center', color: on ? '#FFFFFF' : OB.muted, fontFamily: FontFamily.bodyBold, fontSize: 11, letterSpacing: 0.8 }}>{p.badge}</Text>
                      </View>
                    ) : null}
                    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 18, color: OB.ink }}>{p.title}</Text>
                        <Text style={{ fontFamily: FontFamily.body, fontSize: 13, color: OB.muted }}>{p.price}</Text>
                      </View>
                      <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: OB.ink }}>{p.perWeek}</Text>
                      <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? OB.blue : OB.track} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ gap: 8, marginTop: 22, paddingHorizontal: 4 }}>
              {[
                `Your plan: ${cleanGoals.map((g) => g.name).join(' · ') || 'your pillars'}`,
                `Daily: ${actionName.trim() || 'your first action'}`,
                'Focus mode with app blocking, insights and weekly reviews',
              ].map((l) => (
                <View key={l} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <Ionicons name="checkmark" size={18} color={OB.green} />
                  <Text style={{ flex: 1, fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: OB.ink }}>{l}</Text>
                </View>
              ))}
            </View>
          </View>
        ),
        footer: (
          <>
            <Text style={[T.fine, { marginBottom: 10, fontSize: 13, color: OB.muted }]}>
              {plan === 'yearly' ? 'No payment due today · Cancel anytime' : 'Cancel anytime'}
            </Text>
            <CTA label={plan === 'yearly' ? 'Start my free trial' : 'Continue'} onPress={() => void finish()} disabled={finishing} />
          </>
        ),
      });
  }
}

/** Brief "loading premium options" beat before the offer. */
function LoadingPlans({ onDone, reduceMotion }: { onDone: () => void; reduceMotion: boolean }) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => onDoneRef.current(), reduceMotion ? 300 : 1500);
    return () => clearTimeout(t);
  }, [reduceMotion]);
  return (
    <View style={{ flex: 1, backgroundColor: OB.bg, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ActivityIndicator color={OB.muted} />
      <Text style={[T.body, { fontSize: 15 }]}>Building your plan…</Text>
    </View>
  );
}
