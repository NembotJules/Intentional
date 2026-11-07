/**
 * US-098 · Flick's world: the scene at the top of Today. Flick stands by his little hearth on a hill;
 * the sky follows the time of day (services/world.skyPhase) and the hill warms with today's hours
 * (services/world.worldWarmth → worldLook: grey-blue and quiet at 0, green with flowers and a glow once
 * the plan is given). Idle life: drifting clouds, twinkling stars, Flick's glow breathing.
 * Drawn with react-native-svg + Reanimated, so it runs in Expo Go and on the web.
 * `themeId` picks a world from services/worldThemes; US-101 worlds are earned with real hours (services/worldUnlocks)
 * and chosen in app/worlds.tsx (the globe button, `onWorldsPress`).
 * US-111: full screen on Today: the scene ends on open ground (`look.ground`), and Today paints the rest of the page
 * in the same colour, so the whole screen is Flick's world.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { LiveFlick } from '@/components/flick/LiveFlick';
import type { MascotMood } from '@/components/onboarding/Mascot';
import { PressableScale } from '@/components/ui/motion';
import { FontFamily, Surface } from '@/constants/design';
import { worldLook } from '@/services/world';
import { worldTheme } from '@/services/worldThemes';
import { ThemeDecor } from '@/components/world/ThemeDecor';
import { Sticker } from '@/components/ui/Sticker';

const H = 300;
const VW = 390;

// Fixed, hand-placed so the scene never jumps between renders.
const STARS = [
  [34, 30], [78, 62], [120, 22], [168, 48], [214, 18], [252, 70], [300, 34], [346, 58], [62, 104], [142, 92], [232, 110], [326, 100], [20, 140], [370, 130],
] as const;
const BLOOMS = [
  [70, 262], [104, 252], [138, 270], [246, 266], [282, 254], [318, 268], [52, 280], [334, 284], [176, 284],
] as const;

export function Cloud({ y, scale, duration, delay, width, opacity }: { y: number; scale: number; duration: number; delay: number; width: number; opacity: number }) {
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = 0;
    const id = setTimeout(() => {
      x.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
    }, delay);
    return () => clearTimeout(id);
  }, [x, duration, delay]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: -140 + x.value * (width + 280) }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: y, left: 0, opacity }, style]}>
      <Svg width={120 * scale} height={44 * scale} viewBox="0 0 120 44">
        <Path d="M14 40 C2 40 2 24 16 24 C16 12 34 6 44 16 C50 4 74 2 80 18 C94 12 110 20 104 32 C116 34 114 40 106 40 Z" fill="#FFFFFF" />
      </Svg>
    </Animated.View>
  );
}

export function FlickWorld({
  hour,
  minute = 0,
  warmth,
  mood,
  flickIntensity,
  stage,
  stageLabel,
  stageA11y,
  onStagePress,
  lines,
  pulseKey,
  flickLabel,
  themeId,
  onWorldsPress,
  fullBleed = false,
  topInset = 0,
  header,
}: {
  hour: number;
  minute?: number;
  warmth: number;
  mood: MascotMood;
  flickIntensity: number;
  stage: number;
  /** "Spark · 10h to Flame" */
  stageLabel: string;
  stageA11y: string;
  onStagePress: () => void;
  lines: string[];
  pulseKey?: number | string;
  flickLabel: string;
  themeId?: string | null;
  /** US-101: opens Flick's worlds (the picker). */
  onWorldsPress?: () => void;
  /**
   * US-106: edge to edge at the top of the screen (no card, no radius). The sky grows upward by
   * `topInset` (the status bar) plus the header's 64pt, and `header` floats on it.
   */
  fullBleed?: boolean;
  topInset?: number;
  header?: (onDark: boolean) => ReactNode;
}) {
  const look = useMemo(() => worldLook({ hour, minute, warmth, themeId }), [hour, minute, warmth, themeId]);
  const theme = worldTheme(themeId);
  const bloom = theme.bloom;
  const [width, setWidth] = useState(VW);
  const night = look.phase === 'night';
  const extra = fullBleed ? topInset + (header ? 64 : 0) : 0;
  const onDark = look.phase === 'night' || look.phase === 'dusk';

  const twinkle = useSharedValue(0);
  const breathe = useSharedValue(0);
  useEffect(() => {
    twinkle.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true);
    breathe.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [twinkle, breathe]);
  const starsA = useAnimatedStyle(() => ({ opacity: 0.35 + 0.65 * twinkle.value }));
  const starsB = useAnimatedStyle(() => ({ opacity: 1 - 0.65 * twinkle.value }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: look.glow * (0.75 + 0.25 * breathe.value), transform: [{ scale: 0.94 + 0.08 * breathe.value }] }));

  const starLayer = (odd: 0 | 1) => (
    <Svg width="100%" height={H} viewBox={`0 0 ${VW} ${H}`} preserveAspectRatio="xMidYMax slice">
      {STARS.slice(0, look.stars)
        .filter((_, i) => i % 2 === odd)
        .map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.8 : 1.2} fill="#FFFDF2" />
        ))}
    </Svg>
  );

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessibilityLabel={`Flick's world: ${theme.name}, ${look.phase}`}
      style={{ height: H + extra, borderRadius: fullBleed ? 0 : 32, overflow: 'hidden', backgroundColor: fullBleed ? look.skyTop : look.skyBottom }}
    >
      {/* sky, sun or moon, hills */}
      <Svg width="100%" height={H} viewBox={`0 0 ${VW} ${H}`} preserveAspectRatio="xMidYMax slice" style={{ position: 'absolute', top: extra }}>
        <Defs>
          <LinearGradient id="worldSky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={look.skyTop} />
            <Stop offset="1" stopColor={look.skyBottom} />
          </LinearGradient>
          <RadialGradient id="worldBody" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={look.body.color} stopOpacity={0.55} />
            <Stop offset="1" stopColor={look.body.color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={VW} height={H} fill="url(#worldSky)" />
        <Circle cx={look.body.x * VW} cy={look.body.y * H} r={46} fill="url(#worldBody)" />
        <Circle cx={look.body.x * VW} cy={look.body.y * H} r={look.body.kind === 'moon' ? 15 : 19} fill={look.body.color} />
        {look.body.kind === 'moon' ? <Circle cx={look.body.x * VW + 7} cy={look.body.y * H - 4} r={13} fill={look.skyTop} /> : null}
        {/* the world's backdrop (peaks, a skyline), the far hill and its signature thing (a tent, pines, a boat…) */}
        <ThemeDecor themeId={themeId} phase={look.phase} x={0} y={198} width={VW} layer="sky" />
        <Path d={`M0 214 C70 180 140 186 200 204 C260 222 320 190 ${VW} 196 L${VW} ${H} L0 ${H} Z`} fill={look.hillBack} />
        <ThemeDecor themeId={themeId} phase={look.phase} x={300} y={182} width={VW} layer="far" />
        {/* near hill */}
        <Path d={`M0 250 C80 226 150 232 195 238 C250 246 320 224 ${VW} 236 L${VW} ${H} L0 ${H} Z`} fill={look.hillFront} />
        <ThemeDecor themeId={themeId} phase={look.phase} x={64} y={246} width={VW} layer="near" />
        {/* US-111: full screen, Flick stands on open ground that runs on down the whole page */}
        {fullBleed ? <Path d={`M0 262 C110 242 280 242 ${VW} 262 L${VW} ${H} L0 ${H} Z`} fill={look.ground} /> : null}
        {/* flowers / embers grow with today's hours */}
        {BLOOMS.slice(0, look.blooms).map(([x, y], i) => (
          <G key={i} transform={`translate(${x} ${y})`}>
            <Path d="M0 0 L0 -7" stroke={night ? '#1F3029' : '#4E8A3E'} strokeWidth={1.6} strokeLinecap="round" />
            <Circle cx={0} cy={-9} r={3.4} fill={night ? '#FFB547' : bloom[i % bloom.length]} />
            <Circle cx={0} cy={-9} r={1.3} fill={night ? '#FFF1C9' : '#FFF6D2'} />
          </G>
        ))}
        {/* the hearth: a ring of stones Flick stands in */}
        <Ellipse cx={195} cy={270} rx={46} ry={9} fill="rgba(30,20,10,0.18)" />
        {[-40, -27, -13, 0, 13, 27, 40].map((dx, i) => (
          <Ellipse key={i} cx={195 + dx} cy={270 + Math.abs(dx) / 8 - 3} rx={8} ry={5.5} fill={i % 2 ? '#A69685' : '#8C7D6E'} stroke="#5E5247" strokeWidth={1.2} />
        ))}
      </Svg>

      {/* stars twinkle in two alternating groups */}
      {look.stars > 0 ? (
        <>
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, right: 0, top: extra }, starsA]}>
            {starLayer(0)}
          </Animated.View>
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, right: 0, top: extra }, starsB]}>
            {starLayer(1)}
          </Animated.View>
        </>
      ) : null}

      {/* clouds drift across (thin at night) */}
      <Cloud y={36 + extra * 0.6} scale={0.9} duration={46000} delay={0} width={width} opacity={night ? 0.12 : 0.85} />
      <Cloud y={88 + extra * 0.6} scale={0.6} duration={62000} delay={9000} width={width} opacity={night ? 0.08 : 0.7} />

      {/* Flick's glow breathes; it grows with today's hours */}
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: '50%', bottom: fullBleed ? 24 : 4, width: 260, height: 260, marginLeft: -130 }, glowStyle]}>
        <Svg width={260} height={260} viewBox="0 0 260 260">
          <Defs>
            <RadialGradient id="flickGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFD27A" stopOpacity={0.9} />
              <Stop offset="0.45" stopColor="#FFB547" stopOpacity={0.35} />
              <Stop offset="1" stopColor="#FFB547" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={130} cy={130} r={130} fill="url(#flickGlow)" />
        </Svg>
      </Animated.View>

      {/* Flick, standing in his hearth */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: fullBleed ? 46 : 26, alignItems: 'center' }}>
        <LiveFlick mood={mood} size={fullBleed ? 150 : 128} intensity={flickIntensity} stage={stage} lines={lines} pulseKey={pulseKey} bubbleSide="top" label={flickLabel} />
      </View>

      {/* the stage badge */}
      <PressableScale
        onPress={onStagePress}
        accessibilityRole="button"
        accessibilityLabel={stageA11y}
        style={{
          position: 'absolute',
          top: 14 + extra,
          left: fullBleed ? 20 : 14,
          flexDirection: 'row',
          alignItems: 'center',
          height: 30,
          paddingHorizontal: 12,
          borderRadius: 15,
          backgroundColor: 'rgba(255,252,247,0.88)',
        }}
      >
        <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 13, color: Surface.ink }}>{stageLabel}</Text>
      </PressableScale>

      {/* US-101: Flick's worlds */}
      {onWorldsPress ? (
        <PressableScale
          onPress={onWorldsPress}
          accessibilityRole="button"
          accessibilityLabel="Flick's worlds"
          style={{ position: 'absolute', top: 14 + extra, right: fullBleed ? 20 : 14, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,252,247,0.88)' }}
        >
          <Sticker name="picture" size={20} />
        </PressableScale>
      ) : null}

      {/* US-106: the screen's header floats on the sky */}
      {fullBleed && header ? (
        <View style={{ position: 'absolute', top: topInset, left: 0, right: 0, height: 64 }}>{header(onDark)}</View>
      ) : null}
    </View>
  );
}

