import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';

export type MascotMood = 'happy' | 'wave' | 'think' | 'worried' | 'sad' | 'shock' | 'calm' | 'proud' | 'mystery';
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
};

type Pt = [number, number];
/** Hand positions in the 120×120 viewBox, given the shoulders (which move with the flame's size). */
function handsFor(arms: MascotArms, l: Pt, r: Pt): { left: Pt; right: Pt } {
  switch (arms) {
    case 'wave':
      return { left: [l[0] - 9, l[1] + 13], right: [r[0] + 12, r[1] - 26] };
    case 'cheer':
      return { left: [l[0] - 12, l[1] - 24], right: [r[0] + 12, r[1] - 24] };
    case 'chin':
      return { left: [l[0] - 9, l[1] + 13], right: [r[0] - 14, r[1] + 16] };
    case 'hug':
      return { left: [l[0] + 6, l[1] + 18], right: [r[0] - 6, r[1] + 18] };
    case 'star':
      return { left: [l[0] - 9, l[1] + 13], right: [99, 40] };
    case 'hold':
      return { left: [l[0] - 9, l[1] + 13], right: [101, 74] };
    case 'lift':
      return { left: [26, 30], right: [94, 30] };
    default:
      return { left: [l[0] - 9, l[1] + 13], right: [r[0] + 9, r[1] + 13] };
  }
}

/** A soft bent arm from shoulder to hand: the elbow bows away from the body. */
function armPath(from: Pt, to: Pt, side: -1 | 1): string {
  const mx = (from[0] + to[0]) / 2 + side * 5;
  const my = (from[1] + to[1]) / 2 + 3;
  return `M${from[0].toFixed(1)} ${from[1].toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${to[0].toFixed(1)} ${to[1].toFixed(1)}`;
}

const INK = '#1E1A17';

// Soft, candle-like teardrop with a little side lick so it reads as a flame, not a drop.
const OUTER =
  'M60 6 C66 22 90 38 92 70 C94 96 78 112 60 112 C42 112 26 98 28 72 C29 56 38 46 44 40 C44 48 47 53 51 55 C49 38 52 20 60 6 Z';
const CORE = 'M60 44 C66 55 81 62 81 81 C81 96 72 105 60 105 C48 105 39 96 39 82 C39 67 54 60 60 44 Z';

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
}: {
  mood?: MascotMood;
  size?: number;
  bob?: boolean;
  intensity?: number;
  arms?: MascotArms;
}) {
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
  const halo = Math.max(0, (i - 0.6) / 0.4);
  const sparks = i > 0.8 && !mystery;

  const outerTop = mystery ? '#8B7FA0' : dim ? '#E0703F' : '#FF5A2E';
  const outerBottom = mystery ? '#6A5F7E' : dim ? '#E8A06A' : '#FF9F3A';
  const coreTop = mystery ? '#B3A9C4' : dim ? '#F4CF9A' : '#FFE27A';
  const coreBottom = mystery ? '#C9C1D6' : dim ? '#F8E4C4' : '#FFF6D2';
  const eyesClosed = mood === 'calm' || mood === 'proud';
  const base = `translate(60 112) scale(${scale.toFixed(3)}) translate(-60 -112)`;
  // Face sits on the core; keep it where the core is after scaling.
  const faceY = 112 - (112 - 80) * scale;
  const faceScale = 0.5 + 0.5 * scale;
  const face = `translate(60 ${faceY.toFixed(2)}) scale(${faceScale.toFixed(3)}) translate(-60 -80)`;

  // Limbs follow the flame: shoulders sit on its sides, hips on its base.
  const at = (x: number, y: number): Pt => [60 + (x - 60) * scale, 112 - (112 - y) * scale];
  const shoulderL = at(31, 84);
  const shoulderR = at(89, 84);
  const hands = handsFor(arms ?? DEFAULT_ARMS[mood], shoulderL, shoulderR);
  const hipX = 9 * scale;
  const handFill = mystery ? '#B3A9C4' : dim ? '#F2C98A' : '#FFC94A';
  const footFill = mystery ? '#8B7FA0' : dim ? '#E0703F' : '#FF6A33';

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
          <LinearGradient id="flickOuter" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={outerTop} />
            <Stop offset="1" stopColor={outerBottom} />
          </LinearGradient>
          <LinearGradient id="flickCore" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={coreTop} />
            <Stop offset="1" stopColor={coreBottom} />
          </LinearGradient>
        </Defs>

        {/* ground shadow */}
        <Ellipse cx={60} cy={118} rx={26 * scale + 6} ry={2.5} fill="rgba(30,26,23,0.12)" />

        {/* legs + feet */}
        <G>
          <Path d={`M${60 - hipX} 100 L${58 - hipX} 115`} stroke={INK} strokeWidth={3.4} strokeLinecap="round" />
          <Path d={`M${60 + hipX} 100 L${62 + hipX} 115`} stroke={INK} strokeWidth={3.4} strokeLinecap="round" />
          <Ellipse cx={55 - hipX} cy={116} rx={5.5} ry={3} fill={footFill} stroke={INK} strokeWidth={2} />
          <Ellipse cx={65 + hipX} cy={116} rx={5.5} ry={3} fill={footFill} stroke={INK} strokeWidth={2} />
        </G>

        {/* body sits on its legs */}
        <G transform="translate(0 -8)">
        {/* blaze halo */}
        {halo > 0 ? (
          <Path d={OUTER} fill="#FFC94A" opacity={0.45 * halo} transform="translate(60 114) scale(1.16) translate(-60 -112)" />
        ) : null}

        {/* smoke when the flame is nearly out */}
        {smoke > 0 ? (
          <G opacity={0.75 * smoke}>
            <Path d={`M60 ${112 - 106 * scale} C52 ${100 - 106 * scale} 68 ${92 - 106 * scale} 59 ${80 - 106 * scale}`} stroke="#B8B0A8" strokeWidth={3.5} strokeLinecap="round" fill="none" />
            <Path d={`M66 ${108 - 106 * scale} C72 ${100 - 106 * scale} 62 ${94 - 106 * scale} 69 ${86 - 106 * scale}`} stroke="#CFC8C0" strokeWidth={2.5} strokeLinecap="round" fill="none" />
          </G>
        ) : null}

        {/* the flame */}
        <G transform={base}>
          <Path d={OUTER} fill="url(#flickOuter)" stroke={INK} strokeWidth={3.5 / scale} strokeLinejoin="round" />
          <Path d={CORE} fill="url(#flickCore)" />
        </G>

        {/* arms + spark hands */}
        <G>
          <Path d={armPath(shoulderL, hands.left, -1)} stroke={INK} strokeWidth={3.2} strokeLinecap="round" fill="none" />
          <Path d={armPath(shoulderR, hands.right, 1)} stroke={INK} strokeWidth={3.2} strokeLinecap="round" fill="none" />
          <Circle cx={hands.left[0]} cy={hands.left[1]} r={4.6} fill={handFill} stroke={INK} strokeWidth={2.2} />
          <Circle cx={hands.right[0]} cy={hands.right[1]} r={4.6} fill={handFill} stroke={INK} strokeWidth={2.2} />
          {(arms ?? DEFAULT_ARMS[mood]) === 'wave' ? (
            <G>
              <Path d={`M${hands.right[0] + 6} ${hands.right[1] - 9} L${hands.right[0] + 10} ${hands.right[1] - 14}`} stroke={INK} strokeWidth={2} strokeLinecap="round" />
              <Path d={`M${hands.right[0] + 9} ${hands.right[1] - 3} L${hands.right[0] + 15} ${hands.right[1] - 5}`} stroke={INK} strokeWidth={2} strokeLinecap="round" />
            </G>
          ) : null}
        </G>
        {mood === 'proud' && (arms ?? 'star') === 'star' ? (
          <Path
            d="M101 12 L104 20 L112 20 L106 25 L108 33 L101 28 L94 33 L96 25 L90 20 L98 20 Z"
            fill="#FFD23F"
            stroke={INK}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
        ) : null}
        {sparks ? (
          <G>
            <Circle cx={24} cy={46} r={2.6} fill="#FFB547" />
            <Circle cx={18} cy={66} r={1.8} fill="#FFB547" />
            <Circle cx={98} cy={84} r={2.2} fill="#FFB547" />
            {mood !== 'proud' && mood !== 'wave' ? <Circle cx={96} cy={30} r={2.4} fill="#FFB547" /> : null}
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
                <G>
                  <Path d="M45 72 L53 68" stroke={INK} strokeWidth={2.8} strokeLinecap="round" />
                  <Path d="M75 72 L67 68" stroke={INK} strokeWidth={2.8} strokeLinecap="round" />
                </G>
              ) : null}
              {mood === 'think' ? <Path d="M65 69 L74 67" stroke={INK} strokeWidth={2.8} strokeLinecap="round" /> : null}
              {eyesClosed ? (
                <G>
                  <Path d="M46 80 Q50.5 75.5 55 80" stroke={INK} strokeWidth={3.2} strokeLinecap="round" fill="none" />
                  <Path d="M65 80 Q69.5 75.5 74 80" stroke={INK} strokeWidth={3.2} strokeLinecap="round" fill="none" />
                </G>
              ) : (
                <G>
                  <Ellipse cx={51} cy={80} rx={mood === 'shock' ? 4.4 : 3.6} ry={mood === 'shock' ? 5.6 : 4.6} fill={INK} />
                  <Ellipse cx={69} cy={80} rx={mood === 'shock' ? 4.4 : 3.6} ry={mood === 'shock' ? 5.6 : 4.6} fill={INK} />
                  <Circle cx={52.3} cy={78.2} r={1.3} fill="#fff" />
                  <Circle cx={70.3} cy={78.2} r={1.3} fill="#fff" />
                </G>
              )}
              <Circle cx={44} cy={88} r={4} fill="#FF6F61" opacity={0.35} />
              <Circle cx={76} cy={88} r={4} fill="#FF6F61" opacity={0.35} />
              {mood === 'happy' || mood === 'wave' || mood === 'proud' ? (
                <Path d="M53 89 Q60 97 67 89" stroke={INK} strokeWidth={3.2} strokeLinecap="round" fill="none" />
              ) : null}
              {mood === 'calm' ? <Path d="M55 90 Q60 94 65 90" stroke={INK} strokeWidth={2.8} strokeLinecap="round" fill="none" /> : null}
              {mood === 'think' ? <Path d="M54 92 L66 90" stroke={INK} strokeWidth={3.2} strokeLinecap="round" /> : null}
              {mood === 'worried' ? <Path d="M53 93 Q56.5 89 60 92 Q63.5 95 67 91" stroke={INK} strokeWidth={2.8} strokeLinecap="round" fill="none" /> : null}
              {mood === 'sad' ? <Path d="M53 95 Q60 87 67 95" stroke={INK} strokeWidth={3.2} strokeLinecap="round" fill="none" /> : null}
              {mood === 'sad' ? <Path d="M74 84 Q77 90 74 92 Q71 90 74 84 Z" fill="#6EC6FF" /> : null}
              {mood === 'shock' ? <Ellipse cx={60} cy={93} rx={4.4} ry={5.2} fill={INK} /> : null}
            </G>
          )}
        </G>
        </G>
      </Svg>
      {smoking && bob
        ? [0, 1 / 3, 2 / 3].map((o, k) => {
            // Each puff runs the same 0→1 rise, offset by `o` along the loop.
            const t = o === 0 ? puff : puff.interpolate({ inputRange: [0, 1 - o, 1 - o + 0.001, 1], outputRange: [o, 1, 0, o] });
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
