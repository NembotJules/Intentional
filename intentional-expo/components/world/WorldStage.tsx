/**
 * US-100 · Flick's world as a full screen: a stage for the unlock scene (and later full-screen moments).
 * The sky fills the screen (services/world.worldLook: time of day + today's warmth); the hills and the hearth
 * sit on a ground line at `groundY` px, which glides between steps like a camera move. Flick stands on the
 * ground and his speech bubble floats above him; the screen lays its own content on the ground below.
 */
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Cloud } from '@/components/world/FlickWorld';
import { ThemeDecor } from '@/components/world/ThemeDecor';
import type { WorldLook } from '@/services/world';
import { worldTheme } from '@/services/worldThemes';

// Grass tufts and flowers on the ground (fractions of the width, px below the ground line).
const TUFTS = [[0.06, 40], [0.21, 92], [0.37, 58], [0.62, 70], [0.8, 34], [0.93, 104], [0.12, 168], [0.47, 150], [0.72, 186], [0.29, 236], [0.88, 250], [0.55, 300]] as const;
const FLOWERS = [[0.18, 30], [0.27, 64], [0.74, 28], [0.83, 70], [0.1, 118], [0.9, 140], [0.4, 108], [0.63, 126], [0.33, 190]] as const;

const STARS = [
  [0.09, 0.1], [0.2, 0.21], [0.31, 0.07], [0.43, 0.16], [0.55, 0.06], [0.65, 0.23], [0.77, 0.11], [0.89, 0.19], [0.16, 0.35], [0.36, 0.31], [0.6, 0.37], [0.84, 0.33], [0.05, 0.47], [0.95, 0.43],
] as const;

export function WorldStage({
  look,
  themeId,
  width,
  height,
  groundY,
  flick,
  flickSize,
  bubble,
}: {
  look: WorldLook;
  themeId?: string | null;
  width: number;
  height: number;
  /** Where the ground line sits, in px from the top. */
  groundY: number;
  /** Flick (usually a LiveFlick), drawn standing on the ground. */
  flick: ReactNode;
  flickSize: number;
  /** Above Flick's head. */
  bubble?: ReactNode;
}) {
  const base = Math.round(height * 0.5);
  const shift = useSharedValue(groundY - base);
  useEffect(() => {
    shift.value = withSpring(groundY - base, { damping: 20, stiffness: 120, mass: 1 });
  }, [groundY, base, shift]);
  const layer = useAnimatedStyle(() => ({ transform: [{ translateY: shift.value }] }));
  const night = look.phase === 'night';
  const bloom = worldTheme(themeId).bloom;
  const w = Math.max(1, width);
  const landH = base + height;
  const cx = w / 2;

  return (
    <View
      pointerEvents="box-none"
      accessibilityLabel={`Flick's world on the full screen, ${look.phase}`}
      style={{ position: 'absolute', left: 0, top: 0, width: w, height, backgroundColor: look.skyBottom, overflow: 'hidden' }}
    >
      {/* sky, sun or moon, stars */}
      <Svg width={w} height={height} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="stageSky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={look.skyTop} />
            <Stop offset="1" stopColor={look.skyBottom} />
          </LinearGradient>
          <RadialGradient id="stageBody" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={look.body.color} stopOpacity={0.5} />
            <Stop offset="1" stopColor={look.body.color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={w} height={height} fill="url(#stageSky)" />
        {STARS.slice(0, look.stars).map(([x, y], i) => (
          <Circle key={i} cx={x * w} cy={y * groundY} r={i % 3 === 0 ? 1.8 : 1.2} fill="#FFFDF2" opacity={0.85} />
        ))}
        <Circle cx={look.body.x * w} cy={Math.max(70, look.body.y * groundY * 0.85)} r={60} fill="url(#stageBody)" />
        <Circle cx={look.body.x * w} cy={Math.max(70, look.body.y * groundY * 0.85)} r={look.body.kind === 'moon' ? 18 : 24} fill={look.body.color} />
        {look.body.kind === 'moon' ? <Circle cx={look.body.x * w + 8} cy={Math.max(70, look.body.y * groundY * 0.85) - 5} r={16} fill={look.skyTop} /> : null}
      </Svg>
      <Cloud y={height * 0.09} scale={1} duration={50000} delay={0} width={w} opacity={night ? 0.1 : 0.8} />
      <Cloud y={height * 0.2} scale={0.65} duration={68000} delay={8000} width={w} opacity={night ? 0.07 : 0.65} />

      {/* the land, Flick and his bubble move together with the ground line */}
      <Animated.View pointerEvents="box-none" style={[{ position: 'absolute', left: 0, top: 0, width: w, height: landH }, layer]}>
        <Svg width={w} height={landH} style={{ position: 'absolute' }}>
          <Defs>
            <RadialGradient id="stageGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFD27A" stopOpacity={0.85} />
              <Stop offset="0.5" stopColor="#FFB547" stopOpacity={0.28} />
              <Stop offset="1" stopColor="#FFB547" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <ThemeDecor themeId={themeId} phase={look.phase} x={0} y={base - 50} width={w} scale={1.2} layer="sky" />
          <Path d={`M0 ${base - 34} C${w * 0.18} ${base - 72} ${w * 0.36} ${base - 64} ${w * 0.51} ${base - 46} C${w * 0.67} ${base - 26} ${w * 0.82} ${base - 62} ${w} ${base - 56} L${w} ${landH} L0 ${landH} Z`} fill={look.hillBack} />
          <ThemeDecor themeId={themeId} phase={look.phase} x={w * 0.78} y={base - 52} width={w} scale={1.2} layer="far" />
          <Circle cx={cx} cy={base - flickSize * 0.45} r={flickSize * 1.15} fill="url(#stageGlow)" opacity={look.glow} />
          <Path d={`M0 ${base + 6} C${w * 0.2} ${base - 18} ${w * 0.38} ${base - 8} ${cx} ${base - 4} C${w * 0.64} ${base} ${w * 0.82} ${base - 22} ${w} ${base - 10} L${w} ${landH} L0 ${landH} Z`} fill={look.hillFront} />
          <ThemeDecor themeId={themeId} phase={look.phase} x={w * 0.14} y={base + 2} width={w} scale={1} layer="near" />
          {/* the hearth Flick stands in */}
          <Ellipse cx={cx} cy={base + 2} rx={flickSize * 0.42} ry={8} fill="rgba(30,20,10,0.18)" />
          {[-0.33, -0.22, -0.11, 0, 0.11, 0.22, 0.33].map((dx, i) => (
            <Ellipse key={i} cx={cx + dx * flickSize} cy={base + Math.abs(dx) * 14 - 2} rx={flickSize * 0.065} ry={flickSize * 0.045} fill={i % 2 ? '#A69685' : '#8C7D6E'} stroke="#5E5247" strokeWidth={1.2} />
          ))}
          {TUFTS.map(([fx, dy], i) => (
            <Path
              key={`t${i}`}
              d={`M${fx * w - 6} ${base + dy} q3 -9 6 0 q3 -12 6 0 q3 -8 6 0`}
              stroke={night ? 'rgba(0,0,0,0.25)' : 'rgba(40,70,30,0.28)'}
              strokeWidth={2}
              strokeLinecap="round"
              fill="none"
            />
          ))}
          {/* flowers (embers at night) grow with today's hours, as on Today */}
          {FLOWERS.slice(0, look.blooms).map(([fx, dy], i) => (
            <G key={`f${i}`} transform={`translate(${fx * w} ${base + dy})`}>
              <Path d="M0 0 L0 -8" stroke={night ? '#1F3029' : '#4E8A3E'} strokeWidth={1.8} strokeLinecap="round" />
              <Circle cx={0} cy={-10} r={4} fill={night ? '#FFB547' : bloom[i % bloom.length]} />
              <Circle cx={0} cy={-10} r={1.5} fill="#FFF6D2" />
            </G>
          ))}
        </Svg>
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: base - flickSize + 6, alignItems: 'center' }}>
          {flick}
        </View>
        {bubble ? (
          <View pointerEvents="box-none" style={{ position: 'absolute', left: 20, right: 20, bottom: landH - (base - flickSize) + 4 }}>
            {bubble}
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}
