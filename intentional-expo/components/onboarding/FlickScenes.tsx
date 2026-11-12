/**
 * Little animated scenes where Flick acts out what the screen says.
 *
 *   BeliefScene    "At Intentional, we believe…" — one stage per belief: sticker pillars rise, hours make
 *                  them grow (+1h), a goal pins onto each, and Flick points at the one that gets the next hour.
 *   FlickActivity  "N more years of Building / Training / …" — Flick holds a prop and does the verb.
 *   IgniteIntro    The lead-in to "we believe": a smoking stub of a flame catches and blazes up.
 *   FlickDrifting  "The more your hours drift…": Flick stares at a phone and fades.
 *   PulledAway     "You're not lazy": everyday pulls pop up around a burnt-out Flick.
 *   Confetti       The burst after signing the pledge.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Text, View } from 'react-native';

import { Accent, Colors, FontFamily } from '@/constants/design';
import { Sticker, type StickerName } from '@/components/ui/Sticker';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { Reveal } from '@/components/onboarding/parts';
import { Mascot, type MascotMood } from '@/components/onboarding/Mascot';
import { FlickAnimated, type FlickMood } from '@/components/flick/FlickAnimated';

const INK = '#1E1A17';
const EMBER = '#FFB547';
const OB_EMBER = Accent.primary;

function useLoop(make: (v: Animated.Value) => Animated.CompositeAnimation, deps: unknown[], initial = 0) {
  const v = useRef(new Animated.Value(initial)).current;
  useEffect(() => {
    v.setValue(initial);
    const a = Animated.loop(make(v));
    a.start();
    return () => a.stop();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}

function useTo(target: number, deps: unknown[], duration = 600, delay = 0) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: target, duration, delay, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}

// ─── Beliefs ─────────────────────────────────────────────────────────────────
// US-117 · One stage that changes with each belief (no flying dots):
//   1 pillars rise, each with its sticker · 2 hours make them grow (+1h chips) ·
//   3 a goal target pins onto every pillar · 4 Flick points at ONE pillar: "Next hour".

const STAGE_PILLARS: { name: string; color: string; sticker: StickerName; h: [number, number] }[] = [
  { name: 'Body', color: Colors.pillarBody, sticker: 'dumbbell', h: [44, 86] },
  { name: 'Mind', color: Colors.pillarMind, sticker: 'brain', h: [54, 104] },
  { name: 'Money', color: Colors.pillarMoney, sticker: 'coins', h: [38, 74] },
  { name: 'Craft', color: Colors.pillarCraft, sticker: 'hammer', h: [48, 118] },
];
const NEXT_PILLAR = 3;
const STAGE_H = 228;
const STAGE_FLICK = 70;
const COL_W = 50;
const COL_GAP = 12;
const COLS_LEFT = STAGE_FLICK + 6;
const FLOOR = 30; // room for the names under the pillars

function darker(hex: string, k = 0.25) {
  const n = parseInt(hex.replace('#', ''), 16);
  const c = (v: number) => Math.max(0, Math.round(v * (1 - k)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('')}`;
}

function StageColumn({ i, step }: { i: number; step: number }) {
  const p = STAGE_PILLARS[i];
  const rise = useRef(new Animated.Value(0)).current;
  const height = useRef(new Animated.Value(p.h[0])).current;
  const dim = useRef(new Animated.Value(1)).current;
  const hour = useRef(new Animated.Value(0)).current;
  const pin = useRef(new Animated.Value(0)).current;
  const isNext = i === NEXT_PILLAR;

  useEffect(() => {
    Animated.spring(rise, { toValue: step >= 1 ? 1 : 0, friction: 6, tension: 90, delay: i * 120, useNativeDriver: true }).start();
  }, [step >= 1]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const grow = step >= 2;
    Animated.timing(height, { toValue: grow ? p.h[1] : p.h[0], duration: 900, delay: grow ? i * 260 : 0, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    if (step === 2) {
      hour.setValue(0);
      Animated.sequence([Animated.delay(i * 260 + 150), Animated.timing(hour, { toValue: 1, duration: 1300, easing: Easing.out(Easing.quad), useNativeDriver: true })]).start();
    }
  }, [step >= 2, step === 2]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    Animated.spring(pin, { toValue: step >= 3 ? 1 : 0, friction: 5, tension: 120, delay: step >= 3 ? i * 160 : 0, useNativeDriver: true }).start();
  }, [step >= 3]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    Animated.timing(dim, { toValue: step >= 4 && !isNext ? 0.32 : 1, duration: 450, useNativeDriver: true }).start();
  }, [step >= 4]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: COLS_LEFT + i * (COL_W + COL_GAP),
        bottom: 0,
        width: COL_W,
        alignItems: 'center',
        opacity: Animated.multiply(dim, rise.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] })),
        transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
      }}
    >
      {/* +1h: an hour given makes the pillar grow */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -26,
          opacity: hour.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] }),
          transform: [{ translateY: hour.interpolate({ inputRange: [0, 1], outputRange: [10, -14] }) }],
          paddingHorizontal: 8,
          height: 22,
          borderRadius: 11,
          backgroundColor: '#FFFFFF',
          justifyContent: 'center',
          borderBottomWidth: 2,
          borderBottomColor: '#EBD3C6',
        }}
      >
        <Text style={{ fontFamily: FontFamily.bodyBlack, fontSize: 12, color: OB_EMBER }}>+1h</Text>
      </Animated.View>
      <View style={{ marginBottom: -10, zIndex: 2 }}>
        <Sticker name={p.sticker} size={38} />
        {/* the goal pinned on the pillar */}
        <Animated.View style={{ position: 'absolute', right: -14, top: -10, opacity: pin, transform: [{ scale: pin }] }}>
          <Sticker name="target" size={24} />
        </Animated.View>
      </View>
      <Animated.View
        style={{
          width: COL_W,
          height,
          borderRadius: 14,
          backgroundColor: p.color,
          borderBottomWidth: 5,
          borderBottomColor: darker(p.color),
        }}
      />
      <Text numberOfLines={1} style={{ marginTop: 6, height: FLOOR - 6, fontFamily: FontFamily.bodyBold, fontSize: 12, color: '#6B5446' }}>
        {p.name}
      </Text>
    </Animated.View>
  );
}

/** "Next hour" bubble over the one pillar Flick points at. */
function NextHourBubble({ shown }: { shown: boolean }) {
  const v = useTo(shown ? 1 : 0, [shown], 500, shown ? 350 : 0);
  const bob = useLoop(
    (x) =>
      Animated.sequence([
        Animated.timing(x, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(x, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    [shown]
  );
  const p = STAGE_PILLARS[NEXT_PILLAR];
  // Right-aligned to the pillar so it never runs off the card; the arrow points at the pillar's middle.
  const right = (STAGE_PILLARS.length - 1 - NEXT_PILLAR) * (COL_W + COL_GAP);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        right,
        bottom: FLOOR + p.h[1] + 36,
        alignItems: 'flex-end',
        opacity: v,
        transform: [{ scale: v }, { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 4, paddingRight: 12, height: 32, borderRadius: 16, backgroundColor: OB_EMBER, borderBottomWidth: 3, borderBottomColor: '#A84300' }}>
        <Sticker name="stopwatch" size={24} />
        <Text numberOfLines={1} style={{ fontFamily: FontFamily.bodyBlack, fontSize: 13, color: '#FFFFFF' }}>
          Next hour
        </Text>
      </View>
      <View style={{ marginRight: COL_W / 2 - 7, width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#A84300' }} />
    </Animated.View>
  );
}

/** `step` = which belief is on screen (1–4; 0 = empty stage). */
export function BeliefScene({ step }: { step: number }) {
  const mood: MascotMood = step >= 4 ? 'proud' : step >= 3 ? 'happy' : step >= 2 ? 'happy' : 'think';
  const intensity = [0.45, 0.6, 0.75, 0.88, 1][Math.min(4, step)];
  const width = COLS_LEFT + STAGE_PILLARS.length * (COL_W + COL_GAP) - COL_GAP;
  return (
    <View accessible accessibilityLabel={BELIEF_SCENE_A11Y[Math.min(4, step)]} style={{ alignSelf: 'center', width, height: STAGE_H }}>
      <View style={{ position: 'absolute', left: -6, bottom: FLOOR - 4 }}>
        <Mascot mood={mood} size={STAGE_FLICK} intensity={intensity} arms={step >= 4 ? 'cheer' : undefined} />
      </View>
      {/* floor */}
      <View style={{ position: 'absolute', left: -10, right: -10, bottom: FLOOR - 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(45,35,30,0.08)' }} />
      {STAGE_PILLARS.map((_, i) => (
        <StageColumn key={i} i={i} step={step} />
      ))}
      <NextHourBubble shown={step >= 4} />
    </View>
  );
}

const BELIEF_SCENE_A11Y = [
  'Flick, waiting',
  'Four pillars rise: Body, Mind, Money, Craft',
  'Each hour given makes a pillar grow',
  'A goal is pinned on every pillar',
  'Flick points at one pillar: your next hour',
];

// ─── Drifting ────────────────────────────────────────────────────────────────

/** Flick scrolls a phone while its flame shrinks, sours and starts to smoke. */
export function FlickDrifting({ size = 128, reduceMotion }: { size?: number; reduceMotion?: boolean }) {
  const [heat, setHeat] = useState(reduceMotion ? 0.22 : 0.75);
  const scroll = useLoop(
    (v) =>
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(500),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    []
  );
  useEffect(() => {
    if (reduceMotion) return;
    const start = Date.now() + 600;
    const id = setInterval(() => {
      const p = Math.min(1, Math.max(0, (Date.now() - start) / 3200));
      setHeat(0.75 - 0.55 * p);
      if (p >= 1) clearInterval(id);
    }, 80);
    return () => clearInterval(id);
  }, [reduceMotion]);
  const mood: MascotMood = heat > 0.6 ? 'happy' : heat > 0.38 ? 'worried' : 'sad';
  return (
    <View style={{ width: size * 1.4, height: size, alignItems: 'center' }}>
      <Mascot mood={mood} arms="hold" size={size} intensity={heat} />
      {/* the phone, in Flick's right hand, held up to its eyes */}
      <View
        style={{
          position: 'absolute',
          left: size * 0.2 + (size * 101) / 120 - 10,
          top: (size * 66) / 120 - 30,
          width: 26,
          height: 40,
          borderRadius: 6,
          backgroundColor: INK,
          padding: 3,
          transform: [{ rotate: '-14deg' }],
        }}
      >
        <View style={{ flex: 1, borderRadius: 3, backgroundColor: '#8FD0FF', overflow: 'hidden' }}>
          {[0, 1, 2].map((k) => (
            <Animated.View
              key={k}
              style={{
                height: 5,
                marginTop: 4,
                marginHorizontal: 3,
                borderRadius: 2,
                backgroundColor: '#FFFFFF',
                transform: [{ translateY: scroll.interpolate({ inputRange: [0, 1], outputRange: [0, -9] }) }],
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Pulled away ─────────────────────────────────────────────────────────────

/** Left column chips end just left of Flick's face; right column chips start just right of it. */
const PULLS: { text: string; dot: string; side: 'L' | 'R'; y: number }[] = [
  { text: 'Just one more episode', dot: '#E5484D', side: 'L', y: 6 },
  { text: 'New notification', dot: '#F08C2E', side: 'R', y: 30 },
  { text: "I'll start Monday", dot: '#8E5CF6', side: 'L', y: 62 },
  { text: 'Quick scroll', dot: '#E5484D', side: 'R', y: 88 },
  { text: 'Reply to this now', dot: '#3E6BFF', side: 'L', y: 118 },
  { text: 'Busy all day', dot: '#F08C2E', side: 'R', y: 146 },
  { text: 'Where did the day go?', dot: '#8E5CF6', side: 'L', y: 176 },
];

function PullChip({ text, dot, shown }: { text: string; dot: string; shown: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!shown) return;
    Animated.spring(v, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }).start();
  }, [shown, v]);
  return (
    <Animated.View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
        opacity: v,
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
      }}
    >
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />
      <Text numberOfLines={1} style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 12.5, color: INK }}>
        {text}
      </Text>
    </Animated.View>
  );
}

/** Everyday pulls pop up one by one around Flick, and Flick dims with each one. */
export function PulledAway({ width, height = 230, reduceMotion, onDone }: { width: number; height?: number; reduceMotion?: boolean; onDone?: () => void }) {
  const [n, setN] = useState(reduceMotion ? PULLS.length : 0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    if (reduceMotion) {
      onDoneRef.current?.();
      return;
    }
    const timers = PULLS.map((_, i) =>
      setTimeout(() => {
        hapticLight();
        setN(i + 1);
        if (i === PULLS.length - 1) onDoneRef.current?.();
      }, 500 + i * 420)
    );
    return () => timers.forEach(clearTimeout);
  }, [reduceMotion]);
  const heat = 0.55 - (0.47 * n) / PULLS.length;
  return (
    <View style={{ width, height }}>
      <View style={{ position: 'absolute', left: width / 2 - 60, top: height / 2 - 70 }}>
        <Mascot mood={n > 4 ? 'sad' : 'worried'} size={120} intensity={heat} />
      </View>
      {PULLS.map((p, i) => (
        <View
          key={p.text}
          style={[{ position: 'absolute', top: p.y }, p.side === 'L' ? { right: width / 2 + 26 } : { left: width / 2 + 26 }]}
        >
          <PullChip text={p.text} dot={p.dot} shown={n > i} />
        </View>
      ))}
    </View>
  );
}

// ─── Confetti ────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = ['#FF5A2E', '#FFD23F', '#3E6BFF', '#2F8F5B', '#E5484D', '#8E5CF6', '#FFB547'];

function ConfettiPiece({ i, width, height }: { i: number; width: number; height: number }) {
  // Deterministic pseudo-random per piece, so re-renders don't reshuffle it.
  const r = (k: number) => {
    const x = Math.sin(i * 97.13 + k * 13.7) * 10000;
    return x - Math.floor(x);
  };
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.timing(t, { toValue: 1, duration: 2200 + r(1) * 1600, delay: r(2) * 500, easing: Easing.out(Easing.quad), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [t]); // eslint-disable-line react-hooks/exhaustive-deps
  const fromX = width / 2 + (r(3) - 0.5) * 60;
  const toX = r(4) * width;
  const peak = height * (0.05 + r(5) * 0.25);
  const w = 7 + r(6) * 6;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: w,
        height: r(7) > 0.5 ? w * 0.45 : w,
        borderRadius: r(7) > 0.75 ? w : 2,
        backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        opacity: t.interpolate({ inputRange: [0, 0.05, 0.85, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [fromX, toX] }) },
          // shoots up from the middle, then falls past the bottom
          { translateY: t.interpolate({ inputRange: [0, 0.25, 1], outputRange: [height * 0.45, peak, height + 20] }) },
          { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(r(8) > 0.5 ? 1 : -1) * (360 + r(9) * 540)}deg`] }) },
        ],
      }}
    />
  );
}

/** A one-shot confetti burst filling `width × height`. Re-key it to fire again. */
export function Confetti({ width, height, count = 70 }: { width: number; height: number; count?: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height }}>
      {Array.from({ length: count }, (_, i) => (
        <ConfettiPiece key={i} i={i} width={width} height={height} />
      ))}
    </View>
  );
}

// ─── Ignite ──────────────────────────────────────────────────────────────────

/** An ember drifting up from the fire, on a loop. */
function RisingEmber({ x, delay, rise, size }: { x: number; delay: number; rise: number; size: number }) {
  const t = useLoop(
    (v) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    [delay]
  );
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: '50%',
        bottom: '30%',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: x % 2 ? '#FFD23F' : EMBER,
        opacity: t.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 0.9, 0] }),
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [x * 0.3, x, x * 0.8] }) },
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -rise] }) },
        ],
      }}
    />
  );
}

/**
 * A smoking stub of a flame catches, swells and blazes: the turn from "hours drifting" to "hours with a purpose".
 * Calls `onLit` once it's at full blaze.
 */
export function IgniteIntro({ size = 170, reduceMotion, onLit }: { size?: number; reduceMotion?: boolean; onLit?: () => void }) {
  const [heat, setHeat] = useState(reduceMotion ? 1 : 0.08);
  const ring = useRef(new Animated.Value(0)).current;
  const onLitRef = useRef(onLit);
  onLitRef.current = onLit;

  useEffect(() => {
    if (reduceMotion) {
      onLitRef.current?.();
      return;
    }
    const start = Date.now() + 700; // a beat of smoke first
    const id = setInterval(() => {
      const p = Math.min(1, Math.max(0, (Date.now() - start) / 1300));
      setHeat(0.08 + 0.92 * (1 - Math.pow(1 - p, 2)));
      if (p >= 1) {
        clearInterval(id);
        Animated.timing(ring, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
        onLitRef.current?.();
      }
    }, 60);
    return () => clearInterval(id);
  }, [reduceMotion, ring]);

  const lit = heat >= 1;
  const mood: MascotMood = heat < 0.3 ? 'sad' : heat < 0.75 ? 'shock' : 'proud';
  return (
    <View style={{ width: size * 1.6, height: size * 1.25, alignItems: 'center', justifyContent: 'flex-end' }}>
      {/* shockwave when it catches */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: size * 0.05,
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 4,
          borderColor: '#FFD23F',
          opacity: ring.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.9, 0] }),
          transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.7] }) }],
        }}
      />
      {lit
        ? [-46, -22, 0, 18, 40, -34, 30].map((x, k) => <RisingEmber key={k} x={x} delay={k * 260} rise={size * 0.75} size={k % 3 === 0 ? 9 : 6} />)
        : null}
      <Mascot mood={mood} arms={lit ? 'cheer' : undefined} size={size} intensity={heat} />
    </View>
  );
}

// ─── N more years of … ───────────────────────────────────────────────────────

export type ActivityWord = 'Building' | 'Training' | 'Learning' | 'Earning' | 'Loving' | 'Living';

/**
 * US-129 · Flick acting out one word, as a real little scene (Lottie loops `act-<word>` from
 * scripts/build-flick-lottie.mjs): bricks dropping in that he hammers into a wall, a barbell pressed overhead, a book
 * and a lightbulb, coins flipped onto a stack, a hug with a little pink flame, a dance in the sun.
 * Each loop tells its story in 3.6 s, which is how long the onboarding shows each word. Re-key on `word`.
 */
export function FlickActivity({ word, size = 128 }: { word: ActivityWord; color?: string; size?: number }) {
  return (
    <View style={{ width: size * 1.5, height: size, alignItems: 'center' }} accessible accessibilityLabel={`Flick ${ACTIVITY_LABEL[word]}`}>
      <FlickAnimated mood={`act-${word.toLowerCase()}` as FlickMood} size={size} intensity={1} />
    </View>
  );
}

const ACTIVITY_LABEL: Record<ActivityWord, string> = {
  Building: 'hammering bricks into a wall',
  Training: 'lifting a barbell',
  Learning: 'reading a book, then a lightbulb pops',
  Earning: 'flipping coins onto a stack',
  Loving: 'hugging a little pink flame',
  Living: 'dancing in the sun',
};

// ─── US-129 · Flick's entrance ("Meet your spark") and his greeting ("Nice to meet you") ─────────────────

/** A ring of little sparks that burst out once (a landing puff, a happy burst). */
function Burst({ play, colors = ['#FFC93C', '#FF8C1A'], count = 8, dist = 60, y = 0, dust }: { play: boolean; colors?: string[]; count?: number; dist?: number; y?: number; dust?: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!play) return;
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [play, v]);
  if (!play) return null;
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        // dust stays low and spreads sideways; sparks go all around
        const a = dust ? Math.PI + (i / (count - 1)) * Math.PI : (i / count) * Math.PI * 2 - Math.PI / 2;
        const dx = Math.cos(a) * dist, dy = dust ? -Math.abs(Math.sin(a)) * dist * 0.35 : Math.sin(a) * dist;
        const s = dust ? 16 : 10;
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              marginLeft: -s / 2,
              marginTop: y - s / 2,
              width: s,
              height: s,
              borderRadius: s / 2,
              backgroundColor: dust ? '#E9D8C8' : colors[i % colors.length],
              opacity: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 0.9, 0] }),
              transform: [
                { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
                { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
                { scale: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.2, 0.5] }) },
              ],
            }}
          />
        );
      })}
    </>
  );
}

/**
 * "Meet your spark": Flick peeks in from the left edge of the screen, blinks at you, leaps across to his spot,
 * lands with a squash and a puff of dust, then waves hello ("Hi!"). `onArrived` fires on the landing (the text
 * starts typing then). Reduce Motion: he's simply there, waving.
 */
export function FlickEntrance({ size = 128, screenWidth, reduceMotion, onArrived }: { size?: number; screenWidth: number; reduceMotion?: boolean; onArrived?: () => void }) {
  const x = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current; // 0 = at the edge, 1 = home
  const hop = useRef(new Animated.Value(0)).current;
  const peek = useRef(new Animated.Value(0)).current;
  const squash = useRef(new Animated.Value(0)).current;
  const wave = useRef(new Animated.Value(0)).current;
  const [phase, setPhase] = useState<'peek' | 'leap' | 'here'>(reduceMotion ? 'here' : 'peek');
  const arrived = useRef(onArrived);
  arrived.current = onArrived;

  useEffect(() => {
    if (reduceMotion) {
      arrived.current?.();
      return;
    }
    const anim = Animated.sequence([
      // peeks in from behind the edge, leaning, then ducks back a little
      Animated.timing(peek, { toValue: 1, duration: 420, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }),
      Animated.delay(650),
      Animated.timing(peek, { toValue: 0.7, duration: 160, useNativeDriver: true }),
    ]);
    anim.start(({ finished }) => {
      if (!finished) return;
      setPhase('leap');
      hapticLight();
      Animated.parallel([
        Animated.timing(x, { toValue: 1, duration: 620, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(hop, { toValue: 1, duration: 310, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(hop, { toValue: 0, duration: 310, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
      ]).start(({ finished: f2 }) => {
        if (!f2) return;
        setPhase('here');
        hapticMedium();
        arrived.current?.();
        Animated.sequence([
          Animated.timing(squash, { toValue: 1, duration: 90, useNativeDriver: true }),
          Animated.spring(squash, { toValue: 0, friction: 3.5, tension: 160, useNativeDriver: true }),
        ]).start();
        Animated.loop(
          Animated.sequence([
            Animated.timing(wave, { toValue: 1, duration: 220, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(wave, { toValue: -1, duration: 220, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
          { iterations: 4 }
        ).start(() => Animated.timing(wave, { toValue: 0, duration: 200, useNativeDriver: true }).start());
      });
    });
    return () => anim.stop();
  }, [reduceMotion, x, hop, peek, squash, wave]);

  const edge = -(screenWidth / 2) - size * 0.1; // his centre just past the left edge: only his right half shows
  const peekX = peek.interpolate({ inputRange: [0, 1], outputRange: [-size * 0.45, 0] });
  const here = phase === 'here';
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end' }} accessible accessibilityLabel={here ? 'Flick waves hello' : 'Flick peeks in'}>
      <Burst play={here && !reduceMotion} dust count={7} dist={size * 0.55} y={size * 0.42} />
      <Animated.View
        style={{
          transform: [
            { translateX: Animated.add(x.interpolate({ inputRange: [0, 1], outputRange: [edge, 0] }), phase === 'peek' ? peekX : 0) },
            { translateY: hop.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.75] }) },
            { rotate: phase === 'peek' ? '18deg' : phase === 'leap' ? hop.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '-14deg'] }) : wave.interpolate({ inputRange: [-1, 1], outputRange: ['-5deg', '5deg'] }) },
            { scaleX: squash.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.9, 1, 1.16] }) },
            { scaleY: squash.interpolate({ inputRange: [-1, 0, 1], outputRange: [1.1, 1, 0.84] }) },
          ],
          transformOrigin: 'center bottom',
        }}
      >
        <Mascot mood={phase === 'peek' ? 'think' : phase === 'leap' ? 'shock' : 'happy'} arms={here ? 'wave' : phase === 'leap' ? 'cheer' : 'down'} size={size} intensity={0.75} />
      </Animated.View>
      {here ? (
        <Reveal shown appear>
          <View style={{ position: 'absolute', left: size * 0.62, top: -size * 1.02, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 3, borderBottomColor: '#EBD3C6' }}>
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 18, color: INK }}>Hi!</Text>
          </View>
        </Reveal>
      ) : null}
    </View>
  );
}

/**
 * "Nice to meet you": Flick is thrilled to know your name: two happy hops, then arms up in a burst of sparks, then he
 * settles, proud. Reduce Motion: he's simply happy.
 */
export function FlickGreeting({ size = 88, reduceMotion }: { size?: number; reduceMotion?: boolean }) {
  const hop = useRef(new Animated.Value(0)).current;
  const squash = useRef(new Animated.Value(0)).current;
  const [cheer, setCheer] = useState(false);
  useEffect(() => {
    if (reduceMotion) return;
    const one = () =>
      Animated.sequence([
        Animated.timing(squash, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(squash, { toValue: -1, duration: 120, useNativeDriver: true }),
          Animated.timing(hop, { toValue: 1, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(squash, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(hop, { toValue: 0, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
      ]);
    const anim = Animated.sequence([Animated.delay(250), one(), one()]);
    anim.start(({ finished }) => {
      if (!finished) return;
      setCheer(true);
      hapticMedium();
      Animated.sequence([
        Animated.timing(squash, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.spring(squash, { toValue: 0, friction: 3.5, tension: 160, useNativeDriver: true }),
      ]).start();
    });
    return () => anim.stop();
  }, [reduceMotion, hop, squash]);
  return (
    <View style={{ width: size, height: size }} accessible accessibilityLabel={cheer ? 'Flick cheers' : 'Flick hops for joy'}>
      <Burst play={cheer} count={10} dist={size * 0.85} colors={['#FFC93C', '#FF8C1A', '#FF5A7A', '#52B788']} />
      <Animated.View
        style={{
          transformOrigin: 'center bottom',
          transform: [
            { translateY: hop.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.45] }) },
            { scaleX: squash.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.9, 1, 1.15] }) },
            { scaleY: squash.interpolate({ inputRange: [-1, 0, 1], outputRange: [1.12, 1, 0.85] }) },
          ],
        }}
      >
        <Mascot mood={cheer ? 'proud' : 'happy'} arms={cheer ? 'cheer' : undefined} size={size} intensity={cheer ? 1 : 0.75} />
      </Animated.View>
    </View>
  );
}
