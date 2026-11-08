import { useEffect, useId, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path } from 'react-native-svg';

export type MascotMood = 'happy' | 'wave' | 'think' | 'worried' | 'sad' | 'shock' | 'calm' | 'proud' | 'mystery' | 'sleepy' | 'focus';
/** How Flick holds its arms. Defaults follow the mood; scenes override it to hold props. */
export type MascotArms = 'down' | 'wave' | 'cheer' | 'chin' | 'hug' | 'star' | 'hold' | 'lift';

const DEFAULT_ARMS: Record<MascotMood, MascotArms> = {
  happy: 'down',
  wave: 'wave',
  think: 'chin',
  worried: 'hug',
  sad: 'hug',
  shock: 'cheer',
  calm: 'down',
  proud: 'star',
  mystery: 'down',
  sleepy: 'down',
  focus: 'down',
};

type Pt = [number, number];
type ArmShape = { d: string; hand: Pt; rot: number };

/** Where each hand goes for a pose, in draft space (the flame's base at 60,113; the ground at 134.5). */
function handsFor(arms: MascotArms, l: Pt, r: Pt): { left: Pt; right: Pt; front: boolean } {
  switch (arms) {
    case 'wave':
      return { left: [l[0] - 19, l[1] + 22], right: [r[0] + 21, r[1] - 25], front: false };
    case 'cheer':
      return { left: [l[0] - 16, l[1] - 30], right: [r[0] + 16, r[1] - 30], front: false };
    case 'chin':
      return { left: [l[0] - 19, l[1] + 22], right: [70, 101], front: true };
    case 'hug':
      return { left: [49, 103], right: [71, 103], front: true };
    case 'star':
      return { left: [l[0] - 19, l[1] + 22], right: [104, 42], front: false };
    case 'hold':
      return { left: [l[0] - 19, l[1] + 22], right: [106, 85], front: false };
    case 'lift':
      return { left: [21.6, 35], right: [98.4, 35], front: false };
    default:
      return { left: [l[0] - 19, l[1] + 22], right: [r[0] + 19, r[1] + 22], front: false };
  }
}

/** A tube arm from the shoulder (inside the body) to the hand, bowing outward; the mitten turns along it. */
function armShape(from: Pt, to: Pt, side: -1 | 1): ArmShape {
  const c: Pt = [(from[0] + to[0]) / 2 + side * 6, (from[1] + to[1]) / 2 + 4];
  const rot = (Math.atan2(to[1] - c[1], to[0] - c[0]) * 180) / Math.PI + 90;
  return { d: `M${from[0].toFixed(1)} ${from[1].toFixed(1)} Q${c[0].toFixed(1)} ${c[1].toFixed(1)} ${to[0].toFixed(1)} ${to[1].toFixed(1)}`, hand: to, rot };
}

function armsFor(arms: MascotArms, l: Pt, r: Pt): { back: ArmShape[]; front: ArmShape[]; waveAt: Pt } {
  const h = handsFor(arms, l, r);
  const both = [armShape(l, h.left, -1), armShape(r, h.right, 1)];
  // In front only the arms that cross the body; the other one stays behind.
  if (!h.front) return { back: both, front: [], waveAt: h.right };
  return arms === 'chin' ? { back: [both[0]], front: [both[1]], waveAt: h.right } : { back: [], front: both, waveAt: h.right };
}

const INK = '#1E1612';
const BROW = '#9A4A2A';
/** The 120 box ← draft space: the ground (134.5) lands on y 118, a little smaller so the arms fit. */
const FIT = 'translate(60 118) scale(0.84) translate(-60 -134.5)';

// The flame (with its side lick) and its core, in draft space.
const OUTER = 'M60 8 C67 24 92 40 93 72 C94 98 79 113 60 113 C41 113 26 99 27 74 C28 57 37 47 44 41 C44 49 47 54 51 56 C49 39 52 22 60 8 Z';
const CORE = 'M60 46 C67 57 81 64 81 82 C81 97 72 106 60 106 C48 106 39 97 39 83 C39 68 53 61 60 46 Z';
// Cel shading, clipped to the flame: one shadow down the right and bottom, two highlights top-left.
const SHADE = 'M93 40 C99 80 86 116 60 117 C42 117 30 108 26 96 C40 106 64 108 78 96 C90 85 92 64 87 44 Z';
const HIGHLIGHT_SIDE = 'M44 41 C38 47 31 58 31 72 C31 78 32 82 34 86 C35 70 40 58 48 50 C46 48 45 45 44 41 Z';
const HIGHLIGHT_TIP = 'M60 8 C55 20 53 32 55 44 C57 31 59 22 62 13 Z';
// A mitten (wrist at 0,0, fingers toward -y) with its thumb, and a shoe (sole on y 0, toe toward +x).
const MITTEN = 'M-4.6 1.5 C-6.2 -2.5 -6.4 -8.6 -1.8 -10.6 C2.6 -12.4 6.8 -9.6 6.6 -4.6 C6.5 -1.4 5.4 0.8 4.2 1.8 C1.6 3.4 -2.6 3.4 -4.6 1.5 Z';
const THUMB = 'M-4.2 -2.6 C-8.2 -3 -10 -6.4 -8.2 -8.4 C-6.8 -9.8 -4.6 -8.6 -3.6 -6.4';
const SHOE = 'M-6.5 0 C-7.6 -3.4 -6.4 -6.6 -2.6 -7 L1 -7 C5.6 -6.8 9.6 -4.4 10 -0.6 C10 0.4 9.4 1 8.4 1 L-5.2 1 C-6 1 -6.4 0.6 -6.5 0 Z';
const STAR = 'M101 12 L104 20 L112 20 L106 25 L108 33 L101 28 L94 33 L96 25 L90 20 L98 20 Z';

/** Flat colours per state: lit, dim (a low flame) and the mystery silhouette. */
const PAL = {
  lit: { base: '#FF6A2B', shadow: '#E4471C', highlight: '#FF9A52', lick: '#D33E16', lickSoft: '#E4562A', core: '#FFD95C', coreShadow: '#FFC23D', coreShine: '#FFF0A8', limb: '#FF8A3D', hand: '#FFC23D', shoe: '#E8551F', sole: '#FFC23D' },
  dim: { base: '#E0703F', shadow: '#C85A30', highlight: '#EE9566', lick: '#B9502B', lickSoft: '#C9643A', core: '#F4CF9A', coreShadow: '#EBBE7E', coreShine: '#FAE6C4', limb: '#E8935C', hand: '#F2C98A', shoe: '#D06A3E', sole: '#F2C98A' },
  mystery: { base: '#8B7FA0', shadow: '#6A5F7E', highlight: '#A79CBA', lick: '#6A5F7E', lickSoft: '#766B8A', core: '#B3A9C4', coreShadow: '#9E93B2', coreShine: '#CFC6DC', limb: '#9A8EAE', hand: '#B3A9C4', shoe: '#6A5F7E', sole: '#B3A9C4' },
} as const;

/** US-079: how Flick looks at each lifetime stage (Spark 0 → Sun 5). Additions stack up. */
export const STAGE_LOOK = [
  { body: 0.74, glow: 0, embers: 0, crown: false, rays: false },
  { body: 0.78, glow: 0.35, embers: 0, crown: false, rays: false },
  { body: 0.82, glow: 0.5, embers: 7, crown: false, rays: false },
  { body: 0.86, glow: 0.65, embers: 11, crown: false, rays: false },
  { body: 0.88, glow: 0.8, embers: 11, crown: true, rays: false },
  { body: 0.88, glow: 1, embers: 11, crown: true, rays: true },
] as const;

/**
 * Flick — your spark. Drifting hours make it smaller; hours given to your pillars make it blaze.
 *
 * `intensity` 0..1 drives the flame itself:
 *   ~0    nearly out, a wisp of smoke, dim colours
 *   ~0.6  a healthy flame
 *   ~1    blazing: halo + sparks
 */
export function Mascot({
  mood = 'happy',
  size = 140,
  bob = true,
  intensity = 0.65,
  arms,
  stage,
}: {
  mood?: MascotMood;
  size?: number;
  bob?: boolean;
  intensity?: number;
  arms?: MascotArms;
  /**
   * US-079: lifetime stage 0..5 (Spark, Flame, Torch, Bonfire, Beacon, Sun). Grows Flick and adds
   * a glow, an ember ring, a crown of sparks and sun rays. Leave it out for the plain mascot.
   */
  stage?: number;
}) {
  // Gradient ids are global on web: each Flick needs its own, or one borrows another's colours.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const flicker = useRef(new Animated.Value(0)).current;
  const puff = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!bob) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flicker, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 0.35, duration: 380, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 0.8, duration: 300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 0, duration: 560, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob, flicker]);

  const i = Math.min(1, Math.max(0, intensity));
  const mystery = mood === 'mystery';
  const dim = i < 0.35;
  // Flame height grows from the base. Below a healthy flame it shrinks fast, down to a little stub.
  const scale = i >= 0.6 ? 0.68 + 0.38 * i : 0.42 + (0.908 - 0.42) * (i / 0.6);
  const smoke = mystery ? 0 : Math.max(0, Math.min(1, 1 - i * 2.2));
  const smoking = smoke > 0;

  // Smoke puffs drift up off the tip while the flame is low.
  useEffect(() => {
    if (!smoking || !bob) return;
    puff.setValue(0);
    const loop = Animated.loop(Animated.timing(puff, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [smoking, bob, puff]);
  // US-097: Flick blinks now and then (sometimes twice), only while alive (bob) and with open eyes.
  const [blink, setBlink] = useState(false);
  const openEyed = mood !== 'calm' && mood !== 'proud' && mood !== 'sleepy' && !mystery;
  useEffect(() => {
    if (!bob || !openEyed) return;
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(() => alive && fn(), ms));
    const schedule = () =>
      later(() => {
        setBlink(true);
        later(() => setBlink(false), 130);
        if (Math.random() < 0.25) {
          later(() => setBlink(true), 260);
          later(() => setBlink(false), 390);
        }
        schedule();
      }, 2600 + Math.random() * 3200);
    schedule();
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
  }, [bob, openEyed]);

  // ── US-119 · Flick 2.0: cel-shaded flame, tube arms with mitten hands, chunky legs in shoes ──
  // Drawn in "draft space" (the flame's base at 60,113, the ground at 134.5) and fitted into the 120 box
  // so every existing size/position still lines up: the ground lands on y 118.
  const halo = Math.max(0, (i - 0.6) / 0.4);
  const sparks = i > 0.8 && !mystery;
  const fs = scale / 0.965; // 1 = the healthy flame the drawing was made at (intensity 0.75)
  const P = mystery ? PAL.mystery : dim ? PAL.dim : PAL.lit;
  const eyesClosed = mood === 'calm' || mood === 'proud' || blink;
  const sleepy = mood === 'sleepy';
  const body = `translate(60 113) scale(${fs.toFixed(3)}) translate(-60 -113)`;
  const faceY = 113 - (113 - 80) * fs;
  const faceScale = 0.5 + 0.5 * Math.min(1.1, fs * 0.965);
  const face = `translate(60 ${faceY.toFixed(2)}) scale(${faceScale.toFixed(3)}) translate(-60 -80)`;
  const at = (x: number, y: number): Pt => [60 + (x - 60) * fs, 113 - (113 - y) * fs];
  const pose = arms ?? DEFAULT_ARMS[mood];
  const limbs = armsFor(pose, at(34, 84), at(86, 80));
  const hipL = at(51, 106);
  const hipR = at(69, 106);
  const look = stage === undefined || mystery ? null : STAGE_LOOK[Math.min(5, Math.max(0, Math.round(stage)))]!;
  const grow = look ? `translate(60 118) scale(${look.body}) translate(-60 -118)` : undefined;
  const midY = 118 - (118 - 66) * (look?.body ?? 1);
  const tipY = 113 - 105 * fs;
  const clipBody = `flickBody${uid}`;
  const clipCore = `flickCore${uid}`;

  const arm = (a: ArmShape, k: number) => (
    <G key={k}>
      <Path d={a.d} stroke={INK} strokeWidth={12} strokeLinecap="round" fill="none" />
      <Path d={a.d} stroke={P.limb} strokeWidth={7.4} strokeLinecap="round" fill="none" />
      <G transform={`translate(${a.hand[0].toFixed(1)} ${a.hand[1].toFixed(1)}) rotate(${a.rot.toFixed(0)}) scale(1.2)`}>
        <Path d={THUMB} fill={P.hand} stroke={INK} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
        <Path d={MITTEN} fill={P.hand} stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      </G>
    </G>
  );

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        transformOrigin: 'center bottom',
        transform: [
          { scaleY: flicker.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) },
          { scaleX: flicker.interpolate({ inputRange: [0, 1], outputRange: [1, 0.98] }) },
        ],
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Defs>
          <ClipPath id={clipBody}>
            <Path d={OUTER} />
          </ClipPath>
          <ClipPath id={clipCore}>
            <Path d={CORE} />
          </ClipPath>
        </Defs>

        {look?.rays ? (
          <G opacity={0.9}>
            {Array.from({ length: 12 }, (_, k) => {
              const a = (k / 12) * Math.PI * 2;
              const r0 = 47;
              const r1 = k % 2 ? 54 : 58;
              return (
                <Path
                  key={k}
                  d={`M${(60 + Math.cos(a) * r0).toFixed(1)} ${(midY + Math.sin(a) * r0).toFixed(1)} L${(60 + Math.cos(a) * r1).toFixed(1)} ${(midY + Math.sin(a) * r1).toFixed(1)}`}
                  stroke="#FFB547"
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              );
            })}
          </G>
        ) : null}
        {look && look.glow > 0 ? <Circle cx={60} cy={midY} r={44} fill="#FFD27A" opacity={0.22 * look.glow} /> : null}

        <G transform={grow}>
          <G transform={FIT}>
            {/* ground shadow */}
            <Ellipse cx={60} cy={134.5} rx={22 + 14 * fs} ry={3.6} fill="rgba(30,26,23,0.13)" />

            {/* legs: chunky tubes; shoes planted on the ground, toes out */}
            <Path d={`M${hipL[0].toFixed(1)} ${hipL[1].toFixed(1)} L45.5 126 M${hipR[0].toFixed(1)} ${hipR[1].toFixed(1)} L74.5 126`} stroke={INK} strokeWidth={12} strokeLinecap="round" />
            <Path d={`M${hipL[0].toFixed(1)} ${hipL[1].toFixed(1)} L45.5 126 M${hipR[0].toFixed(1)} ${hipR[1].toFixed(1)} L74.5 126`} stroke={P.limb} strokeWidth={7.4} strokeLinecap="round" />
            <G fill={P.shoe} stroke={INK} strokeWidth={2.6} strokeLinejoin="round">
              <Path d={SHOE} transform="translate(46.5 131) scale(-1.3 1.3)" />
              <Path d={SHOE} transform="translate(73.5 131) scale(1.3)" />
            </G>
            <Path d="M35 130.3 L53.6 130.3 M66.4 130.3 L85 130.3" stroke={P.sole} strokeWidth={1.6} strokeLinecap="round" />

            {/* arms that grow from behind the body */}
            {limbs.back.map(arm)}

            {/* blaze halo */}
            {halo > 0 ? <Path d={OUTER} fill="#FFC94A" opacity={0.45 * halo} transform={`translate(60 115) scale(${(1.16 * fs).toFixed(3)}) translate(-60 -113)`} /> : null}

            {/* smoke when the flame is nearly out */}
            {smoke > 0 ? (
              <G opacity={0.75 * smoke}>
                <Path d={`M60 ${tipY} C52 ${tipY - 12} 68 ${tipY - 20} 59 ${tipY - 32}`} stroke="#B8B0A8" strokeWidth={3.5} strokeLinecap="round" fill="none" />
                <Path d={`M66 ${tipY + 4} C72 ${tipY - 4} 62 ${tipY - 10} 69 ${tipY - 18}`} stroke="#CFC8C0" strokeWidth={2.5} strokeLinecap="round" fill="none" />
              </G>
            ) : null}

            {/* the flame: flat base, a cel shadow down the right and bottom, highlights top-left, darker licks */}
            <G transform={body}>
              <Path d={OUTER} fill={P.base} />
              <G clipPath={`url(#${clipBody})`}>
                <Path d={SHADE} fill={P.shadow} />
                <Path d={HIGHLIGHT_SIDE} fill={P.highlight} />
                <Path d={HIGHLIGHT_TIP} fill={P.highlight} />
                <Path d="M78 52 Q84 58 85 66" stroke={P.lick} strokeWidth={2.6} strokeLinecap="round" fill="none" />
                <Path d="M36 66 Q34 72 35 78" stroke={P.lickSoft} strokeWidth={2.4} strokeLinecap="round" fill="none" />
              </G>
              <Path d={CORE} fill={P.core} />
              <G clipPath={`url(#${clipCore})`}>
                <Path d="M38 92 C46 101 68 103 82 92 L82 110 L38 110 Z" fill={P.coreShadow} />
                <Ellipse cx={51} cy={64} rx={3.2} ry={6} fill={P.coreShine} transform="rotate(25 51 64)" />
              </G>
              <Path d={OUTER} fill="none" stroke={INK} strokeWidth={4.2 / fs} strokeLinejoin="round" />
            </G>

            {/* arms in front of the body (hug, hand on chin) */}
            {limbs.front.map(arm)}
            {pose === 'wave' ? (
              <Path
                d={`M${limbs.waveAt[0] + 8} ${limbs.waveAt[1] - 12} l3 -4.5 M${limbs.waveAt[0] + 11} ${limbs.waveAt[1] - 5} l5 -1`}
                stroke={INK}
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            ) : null}
            {mood === 'proud' && pose === 'star' ? (
              <Path d={STAR} transform="translate(6 -3)" fill="#FFD23F" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
            ) : null}
            {sleepy ? (
              <G>
                <Path d="M92 22 L100 22 L92 31 L100 31" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <Path d="M103 10 L108 10 L103 16 L108 16" stroke={INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.7} />
              </G>
            ) : null}
            {sparks ? (
              <G>
                <Circle cx={16} cy={48} r={2.8} fill="#FFB547" />
                <Circle cx={10} cy={70} r={2} fill="#FFB547" />
                <Circle cx={110} cy={92} r={2.4} fill="#FFB547" />
                {mood !== 'proud' && pose !== 'wave' ? <Circle cx={104} cy={28} r={2.6} fill="#FFB547" /> : null}
              </G>
            ) : null}

            {/* face */}
            <G transform={face}>
              {mystery ? (
                <G>
                  <Path d="M53 72 Q53 64 60 64 Q67 64 67 71 Q67 76 61 78 L61 83" stroke={INK} strokeWidth={4.5} strokeLinecap="round" fill="none" />
                  <Circle cx={61} cy={92} r={3} fill={INK} />
                </G>
              ) : (
                <G>
                  {mood === 'worried' || mood === 'sad' ? (
                    <Path d="M45 72 L53 68 M75 72 L67 68" stroke={BROW} strokeWidth={2.6} strokeLinecap="round" />
                  ) : mood === 'think' ? (
                    <Path d="M45.5 70 Q50 68.5 54 69.5 M65 68 L74 66" stroke={BROW} strokeWidth={2.6} strokeLinecap="round" fill="none" />
                  ) : mood === 'focus' ? (
                    <Path d="M45 68.5 L54 72 M75 68.5 L66 72" stroke={BROW} strokeWidth={2.6} strokeLinecap="round" />
                  ) : mood === 'shock' ? (
                    <Path d="M45 66 Q50 63 54 65 M66 65 Q70 63 75 66" stroke={BROW} strokeWidth={2.4} strokeLinecap="round" fill="none" />
                  ) : !sleepy ? (
                    <Path d="M45.5 70 Q50 67.5 54 69 M66 69 Q70 67.5 74.5 70" stroke={BROW} strokeWidth={2.4} strokeLinecap="round" fill="none" />
                  ) : null}
                  {sleepy ? (
                    <G>
                      <Path d="M45.5 79 Q50.5 83 55.5 79 M64.5 79 Q69.5 83 74.5 79" stroke={INK} strokeWidth={3.2} strokeLinecap="round" fill="none" />
                      <Ellipse cx={60} cy={92} rx={2.8} ry={3.2} fill={INK} />
                    </G>
                  ) : eyesClosed ? (
                    <Path d="M45.5 80 Q50.5 75 55.5 80 M64.5 80 Q69.5 75 74.5 80" stroke={INK} strokeWidth={3.2} strokeLinecap="round" fill="none" />
                  ) : (
                    <G>
                      <Ellipse cx={50.5} cy={79} rx={mood === 'shock' ? 5.4 : 4.6} ry={mood === 'shock' ? 6.6 : 5.6} fill={INK} />
                      <Ellipse cx={69.5} cy={79} rx={mood === 'shock' ? 5.4 : 4.6} ry={mood === 'shock' ? 6.6 : 5.6} fill={INK} />
                      <Circle cx={52.2} cy={76.8} r={1.8} fill="#fff" />
                      <Circle cx={71.2} cy={76.8} r={1.8} fill="#fff" />
                      <Circle cx={49.3} cy={81.6} r={0.8} fill="#fff" />
                      <Circle cx={68.3} cy={81.6} r={0.8} fill="#fff" />
                    </G>
                  )}
                  <Ellipse cx={43} cy={88.5} rx={4.6} ry={2.8} fill="#FF6F61" opacity={0.45} />
                  <Ellipse cx={77} cy={88.5} rx={4.6} ry={2.8} fill="#FF6F61" opacity={0.45} />
                  {mood === 'happy' || mood === 'wave' || mood === 'proud' ? (
                    <G>
                      <Path d="M53 88 Q60 89.5 67 88 Q66 96 60 96 Q54 96 53 88 Z" fill={INK} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
                      <Path d="M54.5 88.6 Q60 89.8 65.5 88.6 L65 90.6 Q60 91.6 55 90.6 Z" fill="#FFFFFF" />
                      <Path d="M56.5 94 Q60 92 63.5 94 Q62 95.6 60 95.6 Q58 95.6 56.5 94 Z" fill="#FF7A8A" />
                    </G>
                  ) : null}
                  {mood === 'calm' ? <Path d="M55 90 Q60 94 65 90" stroke={INK} strokeWidth={2.8} strokeLinecap="round" fill="none" /> : null}
                  {mood === 'focus' ? <Path d="M54 91 Q60 94 66 91" stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" /> : null}
                  {mood === 'think' ? <Path d="M54 92 L66 90" stroke={INK} strokeWidth={3.2} strokeLinecap="round" /> : null}
                  {mood === 'worried' ? <Path d="M53 93 Q56.5 89 60 92 Q63.5 95 67 91" stroke={INK} strokeWidth={2.8} strokeLinecap="round" fill="none" /> : null}
                  {mood === 'sad' ? <Path d="M53 95 Q60 87 67 95" stroke={INK} strokeWidth={3.2} strokeLinecap="round" fill="none" /> : null}
                  {mood === 'sad' ? <Path d="M76 83 Q79.5 90 76 92.5 Q72.5 90 76 83 Z" fill="#6EC6FF" stroke={INK} strokeWidth={1.2} /> : null}
                  {mood === 'shock' ? <Ellipse cx={60} cy={93} rx={4.6} ry={5.6} fill={INK} /> : null}
                </G>
              )}
            </G>
          </G>

          {look && look.embers > 0 ? (
            <G>
              {Array.from({ length: look.embers }, (_, k) => {
                const a = Math.PI * (0.08 + (0.84 * k) / Math.max(1, look.embers - 1));
                return <Circle key={k} cx={60 - Math.cos(a) * 40} cy={116 - Math.sin(a) * 9} r={k % 3 === 1 ? 2.6 : 1.9} fill={k % 2 ? '#FFB547' : '#FF7A3A'} />;
              })}
            </G>
          ) : null}
          {look?.crown ? (
            <G>
              {[-1, 1].map((side) =>
                [0, 1, 2].map((k) => {
                  const x = 60 + side * (30 + k * 7);
                  const y = 22 + k * 11;
                  return (
                    <Path
                      key={`${side}${k}`}
                      d={`M${x} ${y - 4.5} L${x + 1.4} ${y - 1.4} L${x + 4.5} ${y} L${x + 1.4} ${y + 1.4} L${x} ${y + 4.5} L${x - 1.4} ${y + 1.4} L${x - 4.5} ${y} L${x - 1.4} ${y - 1.4} Z`}
                      fill="#FFD23F"
                    />
                  );
                })
              )}
            </G>
          ) : null}
        </G>
      </Svg>
      {smoking && bob
        ? [0, 1 / 3, 2 / 3].map((o, k) => {
            // Each puff runs the same 0→1 rise, offset by `o` along the loop.
            const t = o === 0 ? puff.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) : puff.interpolate({ inputRange: [0, 1 - o, 1 - o + 0.001, 1], outputRange: [o, 1, 0, o] });
            const tipY = ((112 - 106 * scale - 8) / 120) * size;
            const r = size * (0.05 + 0.02 * k);
            return (
              <Animated.View
                key={k}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: size / 2 - r + (k - 1) * size * 0.04,
                  top: tipY - r,
                  width: r * 2,
                  height: r * 2,
                  borderRadius: r,
                  backgroundColor: '#BDB5AD',
                  opacity: t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.7 * smoke, 0] }),
                  transform: [
                    { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.32] }) },
                    { translateX: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, size * 0.05 * (k % 2 ? -1 : 1), 0] }) },
                    { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.5] }) },
                  ],
                }}
              />
            );
          })
        : null}
    </Animated.View>
  );
}
