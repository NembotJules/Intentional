/**
 * Little animated scenes where Flick acts out what the screen says.
 *
 *   BeliefScene    "At Intentional, we believe…" — pillars rise, embers (hours) fly into them,
 *                  a flag lands on top, and the last belief sends one bright ember to one pillar.
 *   FlickActivity  "N more years of Building / Training / …" — Flick holds a prop and does the verb.
 *   IgniteIntro    The lead-in to "we believe": a smoking stub of a flame catches and blazes up.
 *   FlickDrifting  "The more your hours drift…": Flick stares at a phone and fades.
 *   PulledAway     "You're not lazy": everyday pulls pop up around a burnt-out Flick.
 *   Confetti       The burst after signing the pledge.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontFamily } from '@/constants/design';
import { hapticLight } from '@/utils/haptics';
import { Mascot, type MascotMood } from '@/components/onboarding/Mascot';

const INK = '#1E1A17';
const EMBER = '#FFB547';

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

const SCENE_PILLARS = [
  { color: Colors.pillarBody, icon: 'barbell' as const, h: 64 },
  { color: Colors.pillarMind, icon: 'book' as const, h: 82 },
  { color: Colors.pillarMoney, icon: 'cash' as const, h: 56 },
  { color: Colors.pillarCraft, icon: 'hammer' as const, h: 72 },
];
const SCENE_H = 150;
const FLICK = 92;
const PILLAR_W = 30;
const PILLAR_GAP = 12;
const PILLARS_LEFT = FLICK + 34; // x where the first pillar starts
const GOAL_PILLAR = 1; // the pillar the flag and the "next hour" ember go to

function Pillar({ i, shown, pulse }: { i: number; shown: boolean; pulse: Animated.Value | null }) {
  const p = SCENE_PILLARS[i];
  const grow = useTo(shown ? 1 : 0, [shown], 650, i * 140);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: PILLARS_LEFT + i * (PILLAR_W + PILLAR_GAP),
        bottom: 12,
        width: PILLAR_W,
        height: p.h,
        borderRadius: 9,
        borderWidth: 2.5,
        borderColor: INK,
        backgroundColor: p.color,
        alignItems: 'center',
        paddingTop: 6,
        transformOrigin: 'center bottom',
        transform: [
          { scaleY: grow },
          ...(pulse ? [{ scale: pulse.interpolate({ inputRange: [0, 0.8, 0.9, 1], outputRange: [1, 1, 1.08, 1] }) }] : []),
        ],
      }}
    >
      <Ionicons name={p.icon} size={14} color="#FFFFFF" />
    </Animated.View>
  );
}

/** One ember arcing from Flick's tip into pillar `to`. */
function Ember({ to, delay, period, big }: { to: number; delay: number; period: number; big?: boolean }) {
  const t = useLoop(
    (v) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(Math.max(0, period - 900 - delay)),
      ]),
    [to, delay, period]
  );
  const startX = FLICK * 0.62;
  const startY = SCENE_H - FLICK * 0.85;
  const endX = PILLARS_LEFT + to * (PILLAR_W + PILLAR_GAP) + PILLAR_W / 2 - 5;
  const endY = SCENE_H - 12 - SCENE_PILLARS[to].h - 4;
  const size = big ? 14 : 10;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: big ? '#FFD23F' : EMBER,
        borderWidth: big ? 2 : 0,
        borderColor: INK,
        opacity: t.interpolate({ inputRange: [0, 0.08, 0.85, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [startX, endX] }) },
          // arc: up first, then down into the pillar
          { translateY: t.interpolate({ inputRange: [0, 0.45, 1], outputRange: [startY, Math.min(startY, endY) - 34, endY] }) },
        ],
      }}
    />
  );
}

/** `step` = how many belief cards are on screen (0–4). */
export function BeliefScene({ step }: { step: number }) {
  const mood: MascotMood = step >= 4 ? 'proud' : step >= 3 ? 'happy' : step >= 1 ? 'think' : 'calm';
  const intensity = [0.45, 0.6, 0.72, 0.85, 1][Math.min(4, step)];
  const flag = useTo(step >= 3 ? 1 : 0, [step >= 3], 500);
  const goalPulse = useLoop(
    (v) => Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true }),
    [step >= 4]
  );
  const goal = SCENE_PILLARS[GOAL_PILLAR];
  const width = PILLARS_LEFT + SCENE_PILLARS.length * (PILLAR_W + PILLAR_GAP);

  return (
    <View style={{ alignSelf: 'center', width, height: SCENE_H }}>
      <View style={{ position: 'absolute', left: 0, bottom: 0 }}>
        <Mascot mood={mood} size={FLICK} intensity={intensity} />
      </View>
      {SCENE_PILLARS.map((_, i) => (
        <Pillar key={i} i={i} shown={step >= 1} pulse={step >= 4 && i === GOAL_PILLAR ? goalPulse : null} />
      ))}
      {/* "every hour traces back to one of them": hours fly into every pillar */}
      {step === 2 || step === 3
        ? SCENE_PILLARS.map((_, i) => <Ember key={`e${i}`} to={i} delay={i * 450} period={2200} />)
        : null}
      {/* "know where your next hour goes": one bright ember, one pillar */}
      {step >= 4 ? <Ember to={GOAL_PILLAR} delay={0} period={1400} big /> : null}
      {/* "a goal you chose": a flag lands on a pillar */}
      <Animated.View
        style={{
          position: 'absolute',
          left: PILLARS_LEFT + GOAL_PILLAR * (PILLAR_W + PILLAR_GAP) + PILLAR_W / 2 - 3,
          bottom: 12 + goal.h - 2,
          opacity: flag,
          transformOrigin: 'left bottom',
          transform: [{ scale: flag }, { translateY: flag.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
        }}
      >
        <View style={{ width: 3, height: 30, backgroundColor: INK, borderRadius: 2 }} />
        <View
          style={{
            position: 'absolute',
            left: 3,
            top: 0,
            width: 20,
            height: 14,
            backgroundColor: '#E5484D',
            borderWidth: 2,
            borderColor: INK,
            borderTopRightRadius: 4,
            borderBottomRightRadius: 4,
          }}
        />
      </Animated.View>
      {/* floor */}
      <View style={{ position: 'absolute', left: FLICK - 4, right: -6, bottom: 10, height: 3, borderRadius: 2, backgroundColor: 'rgba(30,26,23,0.12)' }} />
    </View>
  );
}

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

const PROP: Record<ActivityWord, keyof typeof Ionicons.glyphMap> = {
  Building: 'hammer',
  Training: 'barbell',
  Learning: 'book',
  Earning: 'cash',
  Loving: 'heart',
  Living: 'sunny',
};

/** A small round "held" prop with an ink outline, like Flick's spark hands. */
function PropBadge({ icon, color, size = 48 }: { icon: keyof typeof Ionicons.glyphMap; color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#FFFFFF',
        borderWidth: 2.5,
        borderColor: INK,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={icon} size={size * 0.55} color={color} />
    </View>
  );
}

/** Particles that pop out and float up (hearts, coins, sparkles, bricks). */
function Floaters({ icon, color, count, spread, rise, period, square }: { icon?: keyof typeof Ionicons.glyphMap; color: string; count: number; spread: number; rise: number; period: number; square?: boolean }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Floater key={i} i={i} icon={icon} color={color} x={(i - (count - 1) / 2) * (spread / Math.max(1, count - 1))} rise={rise} period={period} delay={(i * period) / count} square={square} />
      ))}
    </>
  );
}

function Floater({ i, icon, color, x, rise, period, delay, square }: { i: number; icon?: keyof typeof Ionicons.glyphMap; color: string; x: number; rise: number; period: number; delay: number; square?: boolean }) {
  const t = useLoop(
    (v) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: period, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    [period, delay]
  );
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: '50%',
        top: '45%',
        opacity: t.interpolate({ inputRange: [0, 0.1, 0.75, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [x * 0.4, x] }) },
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -rise] }) },
          { scale: t.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.4, 1, 0.9] }) },
          { rotate: `${(i % 2 ? 1 : -1) * 12}deg` },
        ],
      }}
    >
      {icon ? <Ionicons name={icon} size={20} color={color} /> : <View style={{ width: 14, height: square ? 10 : 14, borderRadius: square ? 3 : 7, backgroundColor: color, borderWidth: 2, borderColor: INK }} />}
    </Animated.View>
  );
}

/**
 * Flick acting out one word. The box is `size` wide; the prop sits at Flick's right "hand".
 * Re-key on `word` so each word restarts its motion.
 */
export function FlickActivity({ word, color, size = 128 }: { word: ActivityWord; color: string; size?: number }) {
  const t = useLoop(
    (v) =>
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: word === 'Training' ? 520 : 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: word === 'Training' ? 520 : 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    [word]
  );
  const sun = useTo(word === 'Living' ? 1 : 0, [word], 900);

  // How Flick's body moves for each verb.
  const bodyMotion: Record<ActivityWord, object[]> = {
    Building: [{ rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '4deg'] }) }],
    Training: [{ scaleY: t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.93] }) }],
    Learning: [{ rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] }) }],
    Earning: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
    Loving: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }],
    Living: [{ rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '6deg'] }) }],
  };

  // Where the prop is and how it moves.
  let prop: ReactNode;
  const handX = size * 0.74;
  const handY = size * 0.42;
  if (word === 'Building') {
    prop = (
      <Animated.View
        style={{
          position: 'absolute',
          left: handX,
          top: handY - 14,
          transformOrigin: 'left bottom',
          transform: [{ rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['-35deg', '25deg'] }) }],
        }}
      >
        <PropBadge icon="hammer" color={color} />
      </Animated.View>
    );
  } else if (word === 'Training') {
    prop = (
      <Animated.View
        style={{
          position: 'absolute',
          left: size / 2 - 26,
          top: -4,
          transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-14, 10] }) }],
        }}
      >
        <PropBadge icon="barbell" color={color} size={52} />
      </Animated.View>
    );
  } else if (word === 'Learning') {
    prop = (
      <Animated.View
        style={{
          position: 'absolute',
          left: handX - 4,
          top: handY + 10,
          transform: [{ rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '6deg'] }) }],
        }}
      >
        <PropBadge icon="book" color={color} />
      </Animated.View>
    );
  } else if (word === 'Living') {
    prop = (
      <Animated.View
        style={{
          position: 'absolute',
          left: size * 0.75 - 60,
          top: -54,
          opacity: sun,
          transform: [{ translateY: sun.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }, { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '20deg'] }) }],
        }}
      >
        <Ionicons name="sunny" size={120} color={color} />
      </Animated.View>
    );
  } else {
    prop = (
      <Animated.View
        style={{
          position: 'absolute',
          left: handX,
          top: handY,
          transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
        }}
      >
        <PropBadge icon={PROP[word]} color={color} />
      </Animated.View>
    );
  }

  return (
    <View style={{ width: size * 1.5, height: size, alignItems: 'center' }}>
      {word === 'Living' ? prop : null}
      {word === 'Building' ? <Floaters color={color} count={3} spread={70} rise={46} period={1500} square /> : null}
      {word === 'Learning' ? <Floaters icon="sparkles" color="#F2A900" count={3} spread={80} rise={70} period={1600} /> : null}
      {word === 'Earning' ? <Floaters icon="logo-usd" color={color} count={4} spread={110} rise={80} period={1500} /> : null}
      {word === 'Loving' ? <Floaters icon="heart" color={color} count={4} spread={110} rise={90} period={1700} /> : null}
      <Animated.View style={{ transformOrigin: 'center bottom', transform: bodyMotion[word] as never }}>
        <Mascot
          mood={word === 'Learning' ? 'think' : word === 'Living' ? 'proud' : 'happy'}
          arms={word === 'Training' ? 'lift' : word === 'Living' ? 'cheer' : 'hold'}
          size={size}
          intensity={1}
        />
      </Animated.View>
      {word !== 'Living' ? <View style={{ position: 'absolute', left: size * 0.25, top: 0, width: size, height: size }}>{prop}</View> : null}
    </View>
  );
}
