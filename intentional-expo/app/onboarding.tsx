/**
 * Onboarding — the story of where your hours go.
 *
 *   Hook        welcome carousel (live app previews) → "Welcome to Intentional!" → meet your spark →
 *               the more hours drift, the smaller the flame → see for yourself (slider) → you're not lazy → name
 *   Meet        nice to meet you + how Intentional works (pillars → hours → focus)
 *   Quiz        goal · what gets in the way · who you are · tried before · did-you-know · age · drifting hours · vs a year ago
 *   Diagnosis   personalizing… → time profile
 *   The fall    oof → days this year → years of life → "do you understand?" → life in dots → stagnation
 *   The way up  good news → N more years of… → Flick ignites → "We believe" → why it works → research
 *   Build       pillars → first action → "this week we'll help you" (+ notification ask)
 *   Close       sign the pledge (hold) → congratulations → before/after → plans
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
import { MAX_PILLARS } from '@/constants/limits';
import { setSetting } from '@/db';
import * as api from '@/db/api';
import type { ActionType } from '@/types';
import { EditorialTextInput } from '@/components/EditorialTextInput';
import { Mascot, type MascotMood } from '@/components/onboarding/Mascot';
import { BeliefScene, Confetti, FlickActivity, FlickDrifting, IgniteIntro, PulledAway, type ActivityWord } from '@/components/onboarding/FlickScenes';
import {
  AppShot,
  CTA,
  DuskBackground,
  FactCard,
  Hill,
  HoldCircle,
  HoursSlider,
  LifeGrid,
  LoadBar,
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
import { preloadTypeSound, startTypingSound, stopTypingSound } from '@/utils/typeSound';
import { hapticHeavy, hapticMedium, hapticLight, hapticSuccess, hapticTick } from '@/utils/haptics';

// ─── Flow ─────────────────────────────────────────────────────────────────────

const FLOW = [
  'welcome', 'hello', 'meetFlick', 'drifting', 'seeForYourself', 'notLazy', 'name', 'meet',
  'goal', 'affects', 'describes', 'tried', 'didYouKnow', 'age', 'hours', 'compare',
  'calculating', 'profile',
  'oof', 'days', 'years', 'understand', 'lifeGrid', 'stagnation',
  'goodNews', 'moreYears', 'believeIntro', 'believe', 'whyWorks', 'research',
  'pillars', 'setGoal', 'action', 'thisWeek',
  'commit', 'congrats', 'loadingPlans', 'beforeAfter', 'plans',
] as const;
type ScreenId = (typeof FLOW)[number];

/** Screens with the back arrow + progress bar. Story beats go full-bleed. */
const CHROME = new Set<ScreenId>([
  'hello', 'meetFlick', 'drifting', 'seeForYourself', 'notLazy', 'name', 'meet', 'goal', 'affects', 'describes', 'tried', 'didYouKnow', 'age', 'hours', 'compare',
  'believe', 'whyWorks', 'research', 'pillars', 'setGoal', 'action', 'thisWeek',
]);
/** Story beats that move on by themselves (tap or Skip to hurry). */
const AUTO_MS: Partial<Record<ScreenId, number>> = { oof: 3000, days: 3800, understand: 3600 };
/** Never land on these when going back. */
const SKIP_BACK = new Set<ScreenId>(['calculating', 'oof', 'days', 'understand', 'congrats', 'loadingPlans']);
/** Lists that reveal one card at a time: count + gap. */
const STAGGER: Partial<Record<ScreenId, { count: number; gap: number }>> = {
  meet: { count: 3, gap: 700 },
  didYouKnow: { count: 4, gap: 750 },
  whyWorks: { count: 5, gap: 800 },
  research: { count: 4, gap: 750 },
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

/** Each belief: text before, the highlighted idea, text after. */
const BELIEFS: [string, string, string][] = [
  ['your life rests on a few ', 'pillars', '. Your body, your mind, your money, your craft, etc. Whatever matters to you.'],
  ['every hour you spend should ', 'feed one of them', '.'],
  ['every goal should be ', 'tied to a pillar', ', so every effort builds a life you chose.'],
  ["you don't need more motivation. You need to ", 'know where your next hour goes', '.'],
];

const MORE_YEARS_OF = [
  { word: 'Building' as ActivityWord, color: Colors.pillarCraft },
  { word: 'Training' as ActivityWord, color: Colors.pillarBody },
  { word: 'Learning' as ActivityWord, color: Colors.pillarMind },
  { word: 'Earning' as ActivityWord, color: Colors.pillarMoney },
  { word: 'Loving' as ActivityWord, color: '#E5484D' },
  { word: 'Living' as ActivityWord, color: '#F2A900' },
];

const PRESET_PILLARS = [
  { name: 'Body', color: Colors.pillarBody, icon: 'barbell-outline' as const },
  { name: 'Finances', color: Colors.pillarMoney, icon: 'cash-outline' as const },
  { name: 'Mind', color: Colors.pillarMind, icon: 'book-outline' as const },
  { name: 'Craft', color: Colors.pillarCraft, icon: 'hammer-outline' as const },
];
const PILLAR_COLORS = PRESET_PILLARS.map((p) => p.color);
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
  Family: ['Call home', 'Dinner, no phones', 'Play time'],
  Friends: ['Message a friend', 'Plan a hangout'],
  Health: ['Walk 30 min', 'Sleep by 11', 'Cook at home'],
  Faith: ['Pray', 'Read scripture', 'Gratitude'],
};

/** US-073: Example goals per pillar type */
const GOAL_IDEAS: Record<string, string[]> = {
  Body: ['Run a half marathon', 'Lose 10 kg', 'Bench press 100 kg'],
  Finances: ['Save €5,000', 'Launch side project', 'Pay off debt'],
  Mind: ['Read 12 books', 'Learn Spanish', 'Finish online course'],
  Craft: ['Ship the MVP', 'Finish portfolio', 'Write 50 articles'],
  Family: ['Weekly family dinners', 'Plan a vacation', 'Build a treehouse'],
  Friends: ['Host 4 dinners', 'Reconnect with 10 people', 'Join a club'],
  Health: ['Sleep 8h every night', 'Cook 5x/week', 'Run 3x/week'],
  Faith: ['Read scripture daily', 'Join a group', 'Serve monthly'],
};

/** Paywall is UI-only until purchases are wired (RevenueCat, US-047/048). */
const PLANS = [
  { id: 'yearly', title: 'Yearly', price: '$39.99 / year', perWeek: '$0.77 / week', badge: 'BEST VALUE · 7-DAY FREE TRIAL' },
  { id: 'monthly', title: 'Monthly', price: '$7.99 / month', perWeek: '$1.84 / week', badge: null },
] as const;

const LIFE_EXPECTANCY = 80;
const WAKING_HOURS = 16;

type PendingGoal = { name: string; color: string; icon: string; objective?: { title: string; deadline: string } };
/** The one daily action each pillar gets, keyed by pillar name. */
type PendingAction = { name: string; type: ActionType; mins: number };
const EMPTY_ACTION: PendingAction = { name: '', type: 'session', mins: 45 };

type Profile = {
  goal: string | null;
  /** Everything that gets in the way (multi-select). */
  affects: string[];
  describes: string | null;
  tried: string | null;
  ageBracket: string | null;
  driftHours: number;
  compare: string | null;
};
const EMPTY_PROFILE: Profile = { goal: null, affects: [], describes: null, tried: null, ageBracket: null, driftHours: 5, compare: null };

type OnboardingDraftV10 = {
  v: 10;
  screen: ScreenId;
  profile: Profile;
  goals: PendingGoal[];
  actions: Record<string, PendingAction>;
  userName: string;
  /** v10 drafts before per-pillar actions stored a single action for the first pillar. */
  actionName?: string;
  actionType?: ActionType;
  actionMins?: number;
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
  } else if (p.affects.includes('busy') || p.affects.includes('priorities')) {
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
    actions: (a: Record<string, PendingAction>) => void;
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
    if (d.profile && typeof d.profile === 'object') {
      const a = (d.profile as { affects?: unknown }).affects;
      // Older drafts stored a single answer for "what gets in the way".
      const affects = Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string') : typeof a === 'string' ? [a] : [];
      set.profile({ ...EMPTY_PROFILE, ...d.profile, affects });
    }
  }
  if (Array.isArray(d.goals)) {
    set.goals(
      d.goals
        .filter((g) => g && typeof g.name === 'string' && g.name.trim())
        .map((g) => ({ name: g.name.slice(0, 30), color: typeof g.color === 'string' ? g.color : Colors.pillarBody, icon: typeof g.icon === 'string' ? g.icon : '' }))
    );
  }
  const actions: Record<string, PendingAction> = {};
  if (d.actions && typeof d.actions === 'object') {
    for (const [k, a] of Object.entries(d.actions)) {
      if (!a || typeof a !== 'object') continue;
      actions[k.slice(0, 30)] = {
        name: typeof a.name === 'string' ? a.name.slice(0, 30) : '',
        type: a.type === 'habit' ? 'habit' : 'session',
        mins: typeof a.mins === 'number' && a.mins > 0 ? a.mins : 45,
      };
    }
  } else if (typeof d.actionName === 'string' && Array.isArray(d.goals) && typeof d.goals[0]?.name === 'string') {
    actions[d.goals[0].name.slice(0, 30)] = {
      name: d.actionName.slice(0, 30),
      type: d.actionType === 'habit' ? 'habit' : 'session',
      mins: typeof d.actionMins === 'number' && d.actionMins > 0 ? d.actionMins : 45,
    };
  }
  set.actions(actions);
  if (typeof d.userName === 'string') set.userName(d.userName.slice(0, 30));
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Small building blocks ────────────────────────────────────────────────────

/** `join` continues the previous segment's line (for a highlighted word mid-sentence). */
type Segment = { text: string; style: TextStyle; join?: boolean };

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
    // Letters follow the clock, not the timer ticks, so a busy frame can't make the text lag behind the sound.
    const start = Date.now();
    let shown = 0;
    let lastTick = 0;
    let done = false;
    setCount(0);
    startTypingSound();
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(id);
      stopTypingSound();
      onDoneRef.current?.();
    };
    const id = setInterval(() => {
      const target = Math.min(flat.length, Math.floor((Date.now() - start) / speed) + 1);
      if (target === shown) return;
      shown = target;
      setCount(target);
      const now = Date.now();
      if (now - lastTick >= 60 && flat[target - 1]?.trim()) {
        lastTick = now;
        hapticTick();
      }
      if (target >= flat.length) finish();
    }, Math.max(16, Math.floor(speed / 2)));
    return () => {
      clearInterval(id);
      if (!done) stopTypingSound();
    };
  }, [flat, reduceMotion, speed]);

  let remaining = count;
  const lines: { seg: Segment; shown: number }[][] = [];
  for (const seg of segments) {
    const shown = Math.max(0, Math.min(seg.text.length, remaining));
    remaining -= seg.text.length;
    if (seg.join && lines.length) lines[lines.length - 1].push({ seg, shown });
    else lines.push([{ seg, shown }]);
  }
  return (
    <View style={{ gap }}>
      {lines.map((line, idx) => (
        <Text key={idx} style={line[0].seg.style}>
          {line.map(({ seg, shown }, j) => (
            <Text key={j} style={seg.style}>
              {seg.text.slice(0, shown)}
              <Text style={{ color: 'transparent' }}>{seg.text.slice(shown)}</Text>
            </Text>
          ))}
        </Text>
      ))}
    </View>
  );
}

/** One link in the "how it works" chain: icon bubble, title, one line, and a connector down to the next. */
function ChainStep({ icon, color, title, text, last }: { icon: keyof typeof Ionicons.glyphMap; color: string; title: string; text: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 14 }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={22} color="#FFFFFF" />
        </View>
        {last ? null : <View style={{ width: 3, flex: 1, minHeight: 14, borderRadius: 2, backgroundColor: OB.track, marginVertical: 4 }} />}
      </View>
      <View style={{ flex: 1, paddingTop: 2, paddingBottom: last ? 0 : 14 }}>
        <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 17, lineHeight: 22, color: OB.ink }}>{title}</Text>
        <Text style={{ fontFamily: FontFamily.body, fontSize: 15, lineHeight: 21, color: OB.muted, marginTop: 2 }}>{text}</Text>
      </View>
    </View>
  );
}

/** Gives its child a little bounce each time `popped` turns on. */
function Pop({ popped, children }: { popped: boolean; children: ReactNode }) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!popped) return;
    v.setValue(0.96);
    Animated.spring(v, { toValue: 1, friction: 3.5, tension: 170, useNativeDriver: true }).start();
  }, [popped, v]);
  return <Animated.View style={{ transform: [{ scale: v }] }}>{children}</Animated.View>;
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
  const { height: winH, width: winW } = useWindowDimensions();
  const [step, setStep] = useState(0);
  const screen: ScreenId = FLOW[step];
  const [reduceMotion, setReduceMotion] = useState(false);

  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [userName, setUserName] = useState('');
  const [goals, setGoals] = useState<PendingGoal[]>([]);
  const [customPillar, setCustomPillar] = useState('');
  const [actions, setActions] = useState<Record<string, PendingAction>>({});
  /** Which pillar the action screen is asking about. */
  const [actionIdx, setActionIdx] = useState(0);
  /** US-073: Which pillar we're setting a goal for (0 = first, index into cleanGoals). */
  const [goalIdx, setGoalIdx] = useState(0);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDeadlineDays, setGoalDeadlineDays] = useState(90);
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
  const [beliefStep, setBeliefStep] = useState(1);
  const [beliefTyped, setBeliefTyped] = useState(false);
  const [introLit, setIntroLit] = useState(false);
  const [flameDemo, setFlameDemo] = useState(1);
  const [pullsDone, setPullsDone] = useState(false);

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
    preloadTypeSound();
  }, []);

  useEffect(() => {
    slideX.setValue(dirRef.current * 24);
    fade.setValue(0);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.timing(slideX, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [step, actionIdx]); // eslint-disable-line react-hooks/exhaustive-deps

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
      // US-073: Reset goal-setting state when entering setGoal screen
      if (FLOW[target] === 'setGoal') {
        setGoalIdx(0);
        setGoalTitle('');
        setGoalDeadlineDays(90);
      }
      setTypedDone(false);
      setIntroLit(false);
      setPullsDone(false);
      if (FLOW[target] === 'seeForYourself') setFlameDemo(1);
      if (FLOW[target] === 'commit') {
        setLit(false);
        setIgnite(0);
      }
      // The action screen walks through every pillar: forward starts at the first, back lands on the last.
      if (FLOW[target] === 'action') {
        setActionIdx(target > step ? 0 : Math.max(0, goals.filter((g) => g.name.trim()).length - 1));
        setUseCustomMins(false);
      }
      setStep(target);
    },
    [step, goals, profile.describes]
  );
  const next = useCallback(() => goToStep(step + 1), [goToStep, step]);
  const back = useCallback(() => {
    if (FLOW[step] === 'action' && actionIdx > 0) {
      dirRef.current = -1;
      hapticLight();
      setUseCustomMins(false);
      setActionIdx((i) => i - 1);
      return;
    }
    let prev = step - 1;
    while (prev > 0 && SKIP_BACK.has(FLOW[prev])) prev -= 1;
    goToStep(prev);
  }, [goToStep, step, actionIdx]);
  const choose = useCallback(
    (patch: Partial<Profile>) => {
      // Selecting only selects. The person moves on with Continue, so a mis-tap is easy to fix.
      setProfile((p) => ({ ...p, ...patch }));
    },
    []
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
            actions: setActions,
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
    const payload: OnboardingDraftV10 = { v: 10, screen, profile, goals, actions, userName };
    const t = setTimeout(() => {
      void AsyncStorage.setItem(ONBOARDING_DRAFT_STORAGE_KEY, JSON.stringify(payload));
    }, 350);
    return () => clearTimeout(t);
  }, [draftReady, screen, profile, goals, actions, userName]);

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
  const primaryAction = (primary && actions[primary.name]) || EMPTY_ACTION;
  // The action screen edits the action of one pillar at a time.
  const actionPillar = cleanGoals[Math.min(actionIdx, Math.max(0, cleanGoals.length - 1))];
  const curAction = (actionPillar && actions[actionPillar.name]) || EMPTY_ACTION;
  const { name: actionName, type: actionType, mins: actionMins } = curAction;
  const patchAction = (patch: Partial<PendingAction>) => {
    if (!actionPillar) return;
    const key = actionPillar.name;
    setActions((a) => ({ ...a, [key]: { ...(a[key] ?? EMPTY_ACTION), ...patch } }));
  };
  const setActionName = (v: string) => patchAction({ name: v });
  const setActionType = (v: ActionType) => patchAction({ type: v });
  const setActionMins = (v: number) => patchAction({ mins: v });
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

  // "We believe" — one belief at a time: type it, let Flick act it out, then the next.
  useEffect(() => {
    if (screen !== 'believe') return;
    setBeliefStep(1);
    setBeliefTyped(false);
  }, [screen]);
  useEffect(() => {
    if (screen !== 'believe' || !beliefTyped || beliefStep >= BELIEFS.length) return;
    const t = setTimeout(() => {
      setBeliefTyped(false);
      setBeliefStep((n) => Math.min(BELIEFS.length, n + 1));
    }, reduceMotion ? 600 : 2600);
    return () => clearTimeout(t);
  }, [screen, beliefTyped, beliefStep, reduceMotion]);

  // Congratulations — a big thump, then a happy buzz.
  useEffect(() => {
    if (screen !== 'congrats') return;
    hapticHeavy();
    const t = setTimeout(hapticSuccess, 350);
    return () => clearTimeout(t);
  }, [screen]);

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
    }, 2000);
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
        
        // US-073: Create objective if one was set during onboarding
        if (g.objective?.title && g.objective.deadline) {
          await api.addObjective({
            pillar_id: savedGoal.id,
            title: g.objective.title,
            done_when: '',
            deadline: g.objective.deadline,
            status: 'active',
            metric_current: null,
            metric_target: null,
            metric_unit: null,
            sort_order: 0,
          });
        }
        
        const a = actions[g.name];
        if (a && a.name.trim()) {
          await api.addAction({
            goal_id: savedGoal.id,
            name: a.name.trim(),
            type: a.type,
            target_minutes: a.type === 'session' ? a.mins : 60,
            reminder_time: null,
            is_active: 1,
            sort_order: 0,
            objective_id: null,
            days_mask: 127,
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
  }: {
    children: ReactNode;
    footer?: ReactNode;
    bg?: string;
    background?: ReactNode;
    scroll?: boolean;
    light?: boolean;
    onPressBody?: () => void;
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
              <View style={{ width: 36 }} />
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

  const question = (title: string, body: ReactNode, opts: { subtitle?: string; canContinue: boolean; scroll?: boolean; mood?: MascotMood; intensity?: number }) =>
    frame({
      scroll: opts.scroll ?? true,
      children: (
        <>
          <View style={{ alignItems: 'center' }}>
            <Mascot mood={opts.mood ?? (opts.canContinue ? 'happy' : 'think')} size={72} intensity={opts.intensity ?? 0.65} />
          </View>
          <Text style={[T.title, { marginTop: 8, marginBottom: opts.subtitle ? 6 : 22 }]}>{title}</Text>
          {opts.subtitle ? <Text style={[T.body, { marginBottom: 22, fontSize: 15 }]}>{opts.subtitle}</Text> : null}
          {body}
        </>
      ),
      footer: <CTA label="Continue" onPress={next} disabled={!opts.canContinue} />,
    });

  const hillTop = Math.round(winH * 0.3);
  const centeredStory = (
    mood: MascotMood,
    children: ReactNode,
    footer?: ReactNode,
    extra?: { onPressBody?: () => void; intensity?: number; hero?: ReactNode }
  ) =>
    frame({
      background: <Hill top={hillTop} />,
      onPressBody: extra?.onPressBody,
      children: (
        <View style={{ flex: 1 }}>
          <View style={{ height: hillTop - 40, alignItems: 'center', justifyContent: 'flex-end' }}>
            {extra?.hero ?? <Mascot mood={mood} size={128} intensity={extra?.intensity} />}
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
      // Real screenshots of the app (assets/images/onboarding), like the top apps do.
      const slides = [
        { shot: require('@/assets/images/onboarding/app-today.jpg'), dark: false, eyebrow: 'Welcome to Intentional', title: 'Stop drifting.\nMake every hour count.' },
        { shot: require('@/assets/images/onboarding/app-focusroom.jpg'), dark: true, eyebrow: 'Focus mode', title: 'Pour your hours\ninto your pillars.' },
        { shot: require('@/assets/images/onboarding/app-insights.jpg'), dark: false, eyebrow: 'Your week', title: 'Watch your life\nadd up.' },
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
                <AppShot source={s.shot} dark={s.dark} height={Math.min(420, Math.round(winH * 0.5) - 24)} />
              </Reveal>
              <View pointerEvents="none" style={{ position: 'absolute', right: 18, bottom: 6 }}>
                <Mascot mood={slide === 0 ? 'wave' : slide === 1 ? 'calm' : 'proud'} size={92} intensity={0.55 + slide * 0.2} />
              </View>
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

    // ── Meet Flick ──
    case 'hello':
      return centeredStory(
        'wave',
        <>
          <Text style={[T.title, { fontSize: 32, lineHeight: 38, marginBottom: 10 }]}>Welcome{'\n'}to Intentional!</Text>
          <TypeSequence reduceMotion={reduceMotion} segments={[{ text: "It's time to give your hours a purpose.", style: T.body }]} />
        </>,
        <CTA label="Let's go!" onPress={next} />,
        { intensity: 0.75 }
      );

    case 'meetFlick':
      return centeredStory(
        'happy',
        <>
          <Text style={[T.title, { fontSize: 32, lineHeight: 38, marginBottom: 10 }]}>Meet your spark</Text>
          <TypeSequence reduceMotion={reduceMotion} segments={[{ text: "This is Flick. It's doing OK.", style: T.body }]} />
        </>,
        <CTA label="Continue" onPress={next} />,
        { intensity: 0.6 }
      );

    case 'drifting':
      return centeredStory(
        'worried',
        <TypeSequence
          reduceMotion={reduceMotion}
          speed={40}
          segments={[{ text: 'The more your hours drift, the smaller your flame gets.', style: { ...T.title, fontSize: 30, lineHeight: 36 } }]}
        />,
        <CTA label="Continue" onPress={next} />,
        { hero: <FlickDrifting size={128} reduceMotion={reduceMotion} /> }
      );

    case 'seeForYourself': {
      const f = flameDemo;
      return centeredStory(
        f > 0.7 ? 'happy' : f > 0.4 ? 'worried' : 'sad',
        <>
          <Text style={[T.title, { fontSize: 32, lineHeight: 38, marginBottom: 22 }]}>See for yourself!</Text>
          <HoursSlider
            value={f}
            min={0}
            max={1}
            step={0.05}
            onChange={setFlameDemo}
            label="Flick's flame"
            colorFor={(v) => (v > 0.66 ? OB.green : v > 0.33 ? OB.orange : OB.red)}
            thumbSize={44}
            showEnds={false}
            thumb={<Mascot mood={f > 0.7 ? 'happy' : f > 0.4 ? 'worried' : 'sad'} size={34} bob={false} intensity={f} arms="down" />}
          />
          <Text style={[T.accent, { marginTop: 14, color: f > 0.66 ? OB.green : f > 0.33 ? OB.orange : OB.red }]}>
            {f > 0.66 ? 'Hours with a purpose. Flick blazes.' : f > 0.33 ? 'Hours slipping away. Flick dims.' : 'Hours gone. Flick is almost out.'}
          </Text>
        </>,
        <CTA label="Continue" onPress={next} />,
        { intensity: f }
      );
    }

    case 'notLazy':
      return frame({
        scroll: true,
        children: (
          <View style={{ alignItems: 'center', paddingTop: 6 }}>
            <Text style={[T.title, { fontSize: 32, lineHeight: 38 }]}>You're not lazy.</Text>
            <Text style={[T.body, { marginTop: 6 }]}>Your hours are being pulled away.</Text>
            <View style={{ marginTop: 14 }}>
              <PulledAway width={Math.min(winW - 40, 360)} reduceMotion={reduceMotion} onDone={() => setPullsDone(true)} />
            </View>
            <Reveal shown={pullsDone}>
              <Text style={[T.body, { marginTop: 14, fontSize: 16 }]}>
                Notifications, endless feeds, other people's priorities. Your day fills up with things you never chose.
              </Text>
            </Reveal>
            {pullsDone ? (
              <View style={{ marginTop: 12, alignSelf: 'stretch' }}>
                <TypeSequence
                  reduceMotion={reduceMotion}
                  segments={[{ text: 'Intentional helps you take your hours back, and give each one to what matters.', style: { ...T.lead, fontSize: 18, lineHeight: 24 } }]}
                />
              </View>
            ) : null}
          </View>
        ),
        footer: <CTA label="Good to know" onPress={next} />,
      });

    case 'name':
      return frame({
        scroll: true,
        children: (
          <View style={{ paddingTop: 10 }}>
            <View style={{ alignItems: 'center', marginBottom: 10 }}>
              <Mascot mood={userName.trim() ? 'happy' : 'wave'} size={96} intensity={userName.trim() ? 0.8 : 0.6} />
            </View>
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

    case 'meet':
      return frame({
        scroll: true,
        children: (
          <View style={{ paddingTop: 4 }}>
            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              <Mascot mood={revealed >= 3 ? 'proud' : 'happy'} size={88} intensity={0.6 + revealed * 0.13} />
            </View>
            <Text style={[T.title, { marginBottom: 6 }]}>{firstName ? `Nice to meet you, ${firstName}.` : 'Nice to meet you.'}</Text>
            <Text style={[T.body, { fontSize: 15, marginBottom: 24 }]}>Here's how Intentional works.</Text>
            <View>
              {[
                { icon: 'apps' as const, color: Colors.pillarBody, title: 'Choose your pillars', text: 'The few areas of your life you want to grow: body, mind, money, craft, etc. You choose.' },
                { icon: 'flag' as const, color: OB.blue, title: 'Give your hours to them', text: 'Each goal belongs to a pillar, so every hour you put in builds one of them.' },
                { icon: 'shield-checkmark' as const, color: Colors.pillarMind, title: 'Protect your focus', text: 'Block the apps you choose while you work.' },
              ].map((r, i) => (
                <Reveal key={r.title} shown={revealed > i}>
                  <ChainStep icon={r.icon} color={r.color} title={r.title} text={r.text} last={i === 2} />
                </Reveal>
              ))}
            </View>
            <Reveal shown={revealed >= 3}>
              <Text style={[T.accent, { marginTop: 22 }]}>First, a few quick questions so it fits your life.</Text>
            </Reveal>
          </View>
        ),
        footer: <CTA label="Sounds good" onPress={next} />,
      });

    // ── Quiz ──
    case 'goal':
      return question(
        firstName ? `${firstName}, what brings you to Intentional?` : 'What brings you to Intentional?',
        <OptionRows options={GOALS} selected={profile.goal ? [profile.goal] : []} onSelect={(id) => choose({ goal: id })} />,
        { canContinue: !!profile.goal, subtitle: 'Pick the one that matters most right now.' }
      );

    case 'affects':
      return question(
        'What gets in the way the most?',
        <OptionRows
          options={AFFECTS}
          selected={profile.affects}
          onSelect={(id) =>
            setProfile((p) => ({ ...p, affects: p.affects.includes(id) ? p.affects.filter((a) => a !== id) : [...p.affects, id] }))
          }
        />,
        { canContinue: profile.affects.length > 0, subtitle: 'Pick all that apply.' }
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
      // The more hours drift, the smaller and sadder Flick gets, until it's a smoking stub.
      const dh = profile.driftHours;
      const mood: MascotMood = dh < 2.5 ? 'happy' : dh < 5 ? 'worried' : 'sad';
      const flame = Math.max(0, 1 - (dh - 0.5) / 11.5);
      return frame({
        background: <Hill top={Math.round(winH * 0.24)} />,
        children: (
          <View style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ height: Math.round(winH * 0.24) - 70, justifyContent: 'flex-end' }}>
              <Mascot mood={mood} size={120} intensity={flame} />
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
        { canContinue: !!profile.compare, subtitle: 'Your body, your skills, your bank account, your peace of mind, etc.' }
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
            <View style={{ alignItems: 'center', marginTop: 34 }}>
              <Mascot mood={typedDone ? 'sad' : 'worried'} size={110} intensity={typedDone ? 0.12 : 0.25} />
            </View>
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
            <View style={{ alignItems: 'center', marginTop: 14 }}>
              <Mascot
                mood={life.phase <= 1 ? 'calm' : life.phase === 2 ? 'worried' : 'sad'}
                size={64}
                intensity={life.phase <= 1 ? 0.6 : life.phase === 2 ? 0.4 : 0.15}
              />
            </View>
            <View style={{ minHeight: 56, marginTop: 8 }}>
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
                { text: "That's not a character flaw. It's what happens when your hours go nowhere.", style: T.lead },
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
              <FlickActivity key={w.word} word={w.word} color={w.color} size={128} />
            </View>
            <View style={{ alignItems: 'center', paddingTop: 34 }}>
              <Text style={T.lead}>
                {yearsBack} more {yearsBack === 1 ? 'year' : 'years'} of
              </Text>
              <Reveal key={w.word} shown>
                <View style={{ alignItems: 'center', marginTop: 6 }}>
                  <Text style={[T.huge, { color: w.color, fontSize: 66, lineHeight: 74 }]}>{w.word}</Text>
                </View>
              </Reveal>
            </View>
          </View>
        ),
        footer: <CTA label="Let's do this!" onPress={next} />,
      });
    }

    case 'believeIntro':
      return frame({
        bg: OB.blue,
        light: true,
        background: <Rings />,
        onPressBody: typedDone ? next : undefined,
        children: (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <IgniteIntro
              reduceMotion={reduceMotion}
              onLit={() => {
                hapticSuccess();
                setIntroLit(true);
              }}
            />
            <View style={{ alignSelf: 'stretch', minHeight: 140, marginTop: 24 }}>
              {introLit ? (
                <TypeSequence
                  reduceMotion={reduceMotion}
                  gap={12}
                  segments={[
                    { text: 'Most apps help you do more.', style: { ...T.lead, color: 'rgba(255,255,255,0.75)' } },
                    { text: 'Intentional helps you live on purpose.', style: { ...T.title, color: '#FFFFFF', fontSize: 34, lineHeight: 40 } },
                  ]}
                  onDone={() => setTypedDone(true)}
                />
              ) : null}
            </View>
          </View>
        ),
        footer: (
          <Reveal shown={typedDone}>
            <CTA label="Here's how" color="#FFFFFF" textColor={OB.blue} onPress={next} disabled={!typedDone} />
          </Reveal>
        ),
      });

    case 'believe': {
      const lastBelief = beliefStep >= BELIEFS.length;
      const big: TextStyle = { fontFamily: FontFamily.bodyBold, fontSize: 21, lineHeight: 28, color: OB.ink };
      return frame({
        scroll: true,
        children: (
          <View style={{ paddingTop: 4 }}>
            <Text style={[T.title, { marginBottom: 14 }]}>At Intentional, we believe…</Text>
            <BeliefScene step={beliefStep} />
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 }}>
              {BELIEFS.map((_, i) => (
                <View key={i} style={{ width: i === beliefStep - 1 ? 18 : 7, height: 7, borderRadius: 4, backgroundColor: i < beliefStep ? OB.blue : OB.track }} />
              ))}
            </View>
            <View style={{ gap: 10, marginTop: 14 }}>
              {BELIEFS.slice(0, beliefStep).map(([before, hl, after], i) => {
                const current = i === beliefStep - 1;
                if (!current) {
                  return (
                    <View key={hl} style={{ backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, opacity: 0.8 }}>
                      <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 14.5, lineHeight: 20, color: OB.muted }}>
                        {before}
                        <Text style={{ fontFamily: FontFamily.bodyBold, color: OB.ink }}>{hl}</Text>
                        {after}
                      </Text>
                    </View>
                  );
                }
                return (
                  <Reveal key={hl} shown>
                    <Pop popped={beliefTyped}>
                      <View style={{ backgroundColor: OB.blueSoft, borderRadius: 20, padding: 18, borderWidth: 2, borderColor: beliefTyped ? OB.blue : 'transparent' }}>
                        <TypeSequence
                          key={`belief-${i}`}
                          reduceMotion={reduceMotion}
                          gap={4}
                          speed={34}
                          segments={[
                            { text: 'WE BELIEVE', style: { fontFamily: FontFamily.bodyBold, fontSize: 13, letterSpacing: 1.2, color: OB.blue } },
                            { text: before, style: big },
                            { text: hl, style: { ...big, color: OB.blue }, join: true },
                            { text: after, style: big, join: true },
                          ]}
                          onDone={() => {
                            if (!reduceMotion) hapticSuccess();
                            setBeliefTyped(true);
                          }}
                        />
                      </View>
                    </Pop>
                  </Reveal>
                );
              })}
            </View>
          </View>
        ),
        footer: (
          <CTA
            label={lastBelief ? 'Continue' : 'Next'}
            onPress={() => {
              if (lastBelief) {
                next();
                return;
              }
              hapticLight();
              setBeliefTyped(false);
              setBeliefStep((n) => Math.min(BELIEFS.length, n + 1));
            }}
            disabled={lastBelief && !beliefTyped}
          />
        ),
      });
    }

    case 'whyWorks':
      return frame({
        scroll: true,
        children: (
          <View style={{ paddingTop: 4 }}>
            <View style={{ alignItems: 'center', marginBottom: 6 }}>
              <Mascot
                mood={revealed >= 5 ? 'proud' : revealed >= 2 ? 'happy' : revealed === 1 ? 'worried' : 'think'}
                size={84}
                intensity={revealed === 1 ? 0.35 : 0.5 + revealed * 0.1}
              />
            </View>
            <Text style={[T.title, { marginBottom: 20 }]}>Why Intentional works</Text>
            <Reveal shown={revealed > 0}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: OB.redSoft, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 18 }}>
                <Ionicons name="close-circle" size={24} color={OB.red} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: OB.ink, textDecorationLine: 'line-through' }}>Random goals that lead nowhere</Text>
                  <Text style={{ fontFamily: FontFamily.body, fontSize: 14, lineHeight: 19, color: OB.muted, marginTop: 2 }}>A wish list with nothing tying it to your days.</Text>
                </View>
              </View>
            </Reveal>
            {[
              { icon: 'apps' as const, color: Colors.pillarBody, title: 'Pillars', text: 'The areas of your life you actually want to improve.' },
              { icon: 'flag' as const, color: OB.blue, title: 'Goals tied to a pillar', text: 'So every effort flows back into a part of your life you care about.' },
              { icon: 'shield-checkmark' as const, color: Colors.pillarMind, title: 'Distractions, blocked', text: 'You pick the apps. We lock them while you work, so your hours go where you meant them to.' },
            ].map((r, i) => (
              <Reveal key={r.title} shown={revealed > i + 1}>
                <ChainStep icon={r.icon} color={r.color} title={r.title} text={r.text} last={i === 2} />
              </Reveal>
            ))}
            <Reveal shown={revealed > 4}>
              <View style={{ backgroundColor: OB.greenSoft, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, marginTop: 20 }}>
                <Text style={[T.lead, { fontFamily: FontFamily.bodyBold, fontSize: 18, lineHeight: 24 }]}>That's how you live your life intentionally.</Text>
              </View>
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
            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              <Mascot mood={revealed >= 4 ? 'happy' : 'think'} size={80} intensity={0.6 + revealed * 0.1} />
            </View>
            <Text style={[T.title, { marginBottom: 22 }]}>Built on behavioral science</Text>
            {[
              {
                icon: 'locate-outline' as const,
                k: 'Your mind is built to hit targets',
                v: 'In Psycho-Cybernetics, Dr. Maxwell Maltz describes the mind as working like a goal-seeking mechanism: give it a clear target and it steers toward it, correcting as it goes. Your pillars and daily actions are those targets.',
                src: 'Maxwell Maltz · Psycho-Cybernetics, 1960',
              },
              {
                icon: 'calendar-outline' as const,
                k: 'Plan it, do it',
                v: 'People who decided exactly when and where they’d act followed through 91% of the time, vs 38% without a plan.',
                src: 'Milne, Orbell & Sheeran · British Journal of Health Psychology, 2002',
              },
              {
                icon: 'repeat-outline' as const,
                k: 'Same action, every day',
                v: 'Repeating one action in the same context is how a habit becomes automatic, in about 66 days on average.',
                src: 'Lally et al. · University College London, 2010',
              },
              {
                icon: 'stats-chart-outline' as const,
                k: 'What gets tracked gets done',
                v: 'Monitoring your progress makes you more likely to reach your goal.',
                src: 'Harkin et al. · Psychological Bulletin, 2016 (138 studies)',
              },
            ].map((r, i) => (
              <Reveal key={r.k} shown={revealed > i}>
                <View style={{ flexDirection: 'row', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: OB.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={r.icon} size={20} color={OB.blue} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, lineHeight: 21, color: OB.ink }}>{r.k}</Text>
                    <Text style={{ fontFamily: FontFamily.body, fontSize: 15, lineHeight: 21, color: OB.ink, marginTop: 4 }}>{r.v}</Text>
                    <Text style={{ fontFamily: FontFamily.body, fontSize: 12, color: OB.faint, marginTop: 6 }}>{r.src}</Text>
                  </View>
                </View>
              </Reveal>
            ))}
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
            <View style={{ alignItems: 'center', marginBottom: 6 }}>
              <Mascot mood={goals.length === 0 ? 'think' : goals.length >= 3 ? 'proud' : 'happy'} size={80} intensity={Math.min(1, 0.4 + goals.length * 0.15)} />
            </View>
            <Text style={[T.title, { marginBottom: 6 }]}>Where will those {yearsBack} years go?</Text>
            <Text style={[T.body, { fontSize: 15, marginBottom: 22 }]}>
              Pick your pillars, the parts of life that matter most to you. Use ours or create your own. Every action will trace back to one.
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

    // US-073: Set goal for each pillar
    case 'setGoal': {
      const pillar = cleanGoals[goalIdx];
      if (!pillar) return null;
      const color = pillar.color;
      const isFirst = goalIdx === 0;
      const isLast = goalIdx >= cleanGoals.length - 1;
      const ideas = GOAL_IDEAS[pillar.name] || [];
      
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
            <View style={{ alignItems: 'center', marginBottom: 6 }}>
              <Mascot mood={goalTitle.trim() ? 'happy' : 'think'} size={80} intensity={goalTitle.trim() ? 0.85 : 0.6} />
            </View>
            {cleanGoals.length > 1 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginBottom: 12 }}>
                {cleanGoals.map((g, i) => {
                  const done = !!g.objective?.title;
                  const on = i === goalIdx;
                  return (
                    <View
                      key={g.name}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        paddingHorizontal: 10,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: on ? g.color : done ? OB.card : 'transparent',
                        borderWidth: 1.5,
                        borderColor: on ? g.color : OB.track,
                      }}
                    >
                      {done && !on ? <Ionicons name="checkmark" size={13} color={g.color} /> : null}
                      <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 12.5, color: on ? '#FFFFFF' : OB.muted }}>{g.name}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
            <Text style={[T.title, { marginBottom: 6 }]}>
              {isFirst ? (
                <>What would winning look like in <Text style={{ color }}>90 days</Text>?</>
              ) : (
                <>Add a goal for <Text style={{ color }}>{pillar.name}</Text>?</>
              )}
            </Text>
            <Text style={[T.body, { fontSize: 15, marginBottom: 22 }]}>
              {isFirst 
                ? 'Give yourself a finish line. Start with one pillar — you can add more later.'
                : 'Optional. You can always add or change goals later.'}
            </Text>
            <TextInput
              key={`goal-${pillar.name}`}
              placeholder={ideas[0] || 'Your goal'}
              placeholderTextColor={OB.faint}
              value={goalTitle}
              onChangeText={(v) => setGoalTitle(v.slice(0, 60))}
              maxLength={60}
              style={{ height: 58, borderRadius: 16, backgroundColor: OB.card, paddingHorizontal: 18, fontFamily: FontFamily.bodyBold, fontSize: 19, color: OB.ink }}
            />
            {ideas.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {ideas.map((idea) => chip(idea, goalTitle === idea, () => setGoalTitle(idea)))}
              </View>
            ) : null}

            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: OB.ink, marginTop: 26, marginBottom: 10 }}>When do you want to finish?</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[
                { label: '30 days', days: 30 },
                { label: '90 days', days: 90 },
                { label: '6 months', days: 180 },
              ].map((opt) =>
                chip(opt.label, goalDeadlineDays === opt.days, () => setGoalDeadlineDays(opt.days))
              )}
            </View>
          </View>
        ),
        footer: (
          <View style={{ gap: 10 }}>
            {!isFirst && (
              <Pressable
                onPress={() => {
                  hapticLight();
                  // Skip this goal, move to next
                  if (isLast) {
                    next();
                  } else {
                    dirRef.current = 1;
                    hapticMedium();
                    setGoalTitle('');
                    setGoalDeadlineDays(90);
                    setGoalIdx((i) => i + 1);
                  }
                }}
                style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: OB.muted }}>Skip for now</Text>
              </Pressable>
            )}
            <CTA
              label={isLast ? 'Continue' : `Next: ${cleanGoals[goalIdx + 1]?.name || 'Continue'}`}
              onPress={() => {
                if (goalTitle.trim()) {
                  // Save the goal to this pillar
                  const deadline = new Date();
                  deadline.setDate(deadline.getDate() + goalDeadlineDays);
                  setGoals(prev => prev.map((g, i) => 
                    i === goalIdx ? { ...g, objective: { title: goalTitle.trim(), deadline: deadline.toISOString().split('T')[0] } } : g
                  ));
                }
                
                if (isLast) {
                  next();
                } else {
                  dirRef.current = 1;
                  hapticMedium();
                  setGoalTitle('');
                  setGoalDeadlineDays(90);
                  setGoalIdx((i) => i + 1);
                }
              }}
              disabled={isFirst && !goalTitle.trim()}
            />
          </View>
        ),
      });
    }

    case 'action': {
      const ideas = (actionPillar && ACTION_IDEAS[actionPillar.name]) || [];
      const color = actionPillar?.color ?? OB.ink;
      const pillarName = actionPillar?.name ?? 'your first pillar';
      const lastPillar = actionIdx >= cleanGoals.length - 1;
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
            <View style={{ alignItems: 'center', marginBottom: 6 }}>
              <Mascot mood={actionName.trim() ? 'happy' : 'think'} size={80} intensity={actionName.trim() ? 0.85 : 0.6} />
            </View>
            {cleanGoals.length > 1 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginBottom: 12 }}>
                {cleanGoals.map((g, i) => {
                  const done = !!actions[g.name]?.name.trim();
                  const on = i === actionIdx;
                  return (
                    <View
                      key={g.name}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        paddingHorizontal: 10,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: on ? g.color : done ? OB.card : 'transparent',
                        borderWidth: 1.5,
                        borderColor: on ? g.color : OB.track,
                      }}
                    >
                      {done && !on ? <Ionicons name="checkmark" size={13} color={g.color} /> : null}
                      <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 12.5, color: on ? '#FFFFFF' : OB.muted }}>{g.name}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
            <Text style={[T.title, { marginBottom: 6 }]}>
              What's one thing <Text style={{ color }}>{pillarName}</Text> gets every day?
            </Text>
            <Text style={[T.body, { fontSize: 15, marginBottom: 22 }]}>
              {cleanGoals.length > 1 ? `Pillar ${actionIdx + 1} of ${cleanGoals.length}. Start small, you can add more later.` : 'Start small. You can add more later.'}
            </Text>
            <TextInput
              key={`action-${pillarName}`}
              placeholder={ideas[0] ?? 'Something small, every day'}
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
        footer: (
          <CTA
            label={lastPillar ? 'Continue' : `Next: ${cleanGoals[actionIdx + 1]?.name}`}
            onPress={() => {
              if (lastPillar) {
                next();
                return;
              }
              dirRef.current = 1;
              hapticMedium();
              setUseCustomMins(false);
              setActionIdx((i) => i + 1);
            }}
            disabled={!actionName.trim()}
          />
        ),
      });
    }

    case 'thisWeek': {
      const items = [
        { icon: 'trending-up-outline' as const, text: `Give ${formatHoursWords(gainPerDay)} more a day to your pillars` },
        {
          icon: 'flag-outline' as const,
          text:
            cleanGoals.length > 1
              ? `One daily action for each of your ${cleanGoals.length} pillars`
              : primaryAction.type === 'session'
                ? `Give ${primaryPillar} ${primaryAction.mins} minutes every day`
                : `${primaryAction.name.trim() || 'Your first action'}, every single day`,
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
    case 'commit': {
      const names = cleanGoals.map((g) => g.name);
      const pillarList =
        names.length === 0 ? 'what matters to me' : names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
      const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const pledge: Segment[] = [
        { text: `${firstName ? `I, ${firstName},` : 'I'} decide to stop drifting through my days.`, style: { ...T.lead, color: '#FFFFFF', textAlign: 'left', fontSize: 19, lineHeight: 26 } },
        { text: `From today, my hours go to the life I chose: ${pillarList}.`, style: { ...T.lead, color: '#FFFFFF', textAlign: 'left', fontSize: 19, lineHeight: 26 } },
        { text: 'I will show up every day, even when it’s only for a few minutes.', style: { ...T.lead, color: '#FFFFFF', textAlign: 'left', fontSize: 19, lineHeight: 26 } },
        { text: 'This is who I am becoming.', style: { ...T.lead, color: '#FFD23F', textAlign: 'left', fontSize: 19, lineHeight: 26 } },
      ];
      return frame({
        bg: '#2B2826',
        light: true,
        background: <Rings />,
        scroll: true,
        children: (
          <View style={{ flex: 1 }}>
            <Text style={[T.title, { color: '#FFFFFF', fontSize: 28, lineHeight: 34, marginTop: 18 }]}>Make it official.</Text>
            <Text style={[T.body, { color: 'rgba(255,255,255,0.7)', marginTop: 6, fontSize: 15 }]}>Read it. Mean it. Then hold to sign.</Text>
            <View style={{ marginTop: 20, padding: 18, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
              <TypeSequence key={`pledge-${firstName}`} reduceMotion={reduceMotion} gap={10} speed={32} segments={pledge} onDone={() => setTypedDone(true)} />
              <Reveal shown={typedDone || lit}>
                <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: lit ? '#FFD23F' : 'rgba(255,255,255,0.55)' }}>
                    {lit ? `Signed${firstName ? `, ${firstName}` : ''}` : 'Sign here'}
                  </Text>
                  <Text style={{ fontFamily: FontFamily.body, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{today}</Text>
                </View>
              </Reveal>
            </View>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 16 }}>
              <Mascot mood={lit ? 'proud' : ignite > 0.05 ? 'happy' : 'calm'} size={110} intensity={lit ? 1 : 0.1 + ignite * 0.85} />
            </View>
          </View>
        ),
        footer: (
          <Reveal shown={typedDone || lit}>
            <View pointerEvents={typedDone || lit ? 'auto' : 'none'} style={{ alignItems: 'center', paddingBottom: 8 }}>
              <HoldCircle
                label="Hold to commit"
                onProgress={setIgnite}
                onComplete={() => {
                  setLit(true);
                  setTimeout(() => goToStep(FLOW.indexOf('congrats')), reduceMotion ? 200 : 1300);
                }}
              />
              <Text style={[T.fine, { color: 'rgba(255,255,255,0.6)', marginTop: 10 }]}>{lit ? 'Your flame is lit.' : 'Press and hold to sign'}</Text>
            </View>
          </Reveal>
        ),
      });
    }

    case 'congrats': {
      const names = cleanGoals.map((g) => g.name);
      return frame({
        bg: OB.blue,
        light: true,
        background: (
          <>
            <Rings />
            {reduceMotion ? null : <Confetti width={winW} height={winH} />}
          </>
        ),
        children: (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 20 }}>
            <Mascot mood="proud" arms="cheer" size={170} intensity={1} />
            <Text style={[T.title, { color: '#FFFFFF', fontSize: 36, lineHeight: 42, marginTop: 18 }]}>
              {firstName ? `Congratulations,\n${firstName}!` : 'Congratulations!'}
            </Text>
            <View style={{ alignSelf: 'stretch', marginTop: 12, minHeight: 90 }}>
              <TypeSequence
                reduceMotion={reduceMotion}
                gap={6}
                segments={[
                  { text: 'You just made a promise to yourself.', style: { ...T.lead, color: '#FFFFFF' } },
                  { text: 'Most people never decide. You did.', style: { ...T.body, color: 'rgba(255,255,255,0.8)' } },
                ]}
                onDone={() => setTypedDone(true)}
              />
            </View>
            <Reveal shown={typedDone}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: '#FFD23F' }}>
                  <Ionicons name="flame" size={16} color={OB.ink} />
                  <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: OB.ink }}>Day 1</Text>
                </View>
                {names.map((n) => (
                  <View key={n} style={{ paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.16)', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: '#FFFFFF' }}>{n}</Text>
                  </View>
                ))}
              </View>
            </Reveal>
          </View>
        ),
        footer: (
          <Reveal shown={typedDone}>
            <CTA label="Build my plan" color="#FFFFFF" textColor={OB.blue} onPress={next} disabled={!typedDone} />
          </Reveal>
        ),
      });
    }

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
                `Daily: ${primaryAction.name.trim() || 'your first action'}`,
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
      <Mascot mood="think" size={110} intensity={0.8} />
      <ActivityIndicator color={OB.muted} />
      <Text style={[T.body, { fontSize: 15 }]}>Building your plan…</Text>
    </View>
  );
}
